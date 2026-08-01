import 'dart:async';

/// Riverpod providers for the quiz feature.
///
/// • [myQuizzesProvider]        — Home screen "Upcoming Quizzes" list.
/// • [myQuizDetailProvider]     — one-shot detail fetch (used by the waiting
///   screen's polling loop and to bootstrap the runtime controller).
/// • [quizRuntimeControllerProvider] — owns the Socket.IO connection for a
///   single quiz attempt and is shared by the lobby / play / leaderboard /
///   results screens so the connection survives navigation between them.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/quiz_models.dart';
import '../data/quiz_repository.dart';
import '../data/quiz_socket_service.dart';

final quizRepositoryProvider = Provider<QuizRepository>((ref) {
  return QuizRepository();
});

/// Home screen upcoming-quizzes list.
final myQuizzesProvider = FutureProvider.autoDispose<List<MyQuizSummary>>((
  ref,
) {
  return ref.read(quizRepositoryProvider).getMyQuizzes();
});

/// Home screen "Recent Activity" card — just the single most recently
/// completed quiz the student has a result for (or null if they haven't
/// played any quiz yet).
final latestHistoryResultProvider = FutureProvider.autoDispose<HistoryResult?>((
  ref,
) async {
  final page = await ref
      .read(quizRepositoryProvider)
      .getMyHistory(page: 1, limit: 1);
  return page.results.isEmpty ? null : page.results.first;
});

/// One-shot fetch of a single quiz's detail + runtime snapshot.
/// The waiting screen re-reads this provider on a timer via `ref.refresh`.
final myQuizDetailProvider = FutureProvider.autoDispose
    .family<MyQuizDetail, String>((ref, quizId) {
      return ref.read(quizRepositoryProvider).getMyQuizById(quizId);
    });

// ─────────────────────────────────────────────────────────────────────────────
// Live runtime controller
// ─────────────────────────────────────────────────────────────────────────────

enum SocketConnectionStatus { idle, connecting, connected, disconnected, error }

enum SubmissionStatus { none, pending, submitted, error }

class QuizRuntimeState {
  final SocketConnectionStatus connectionStatus;
  final String? connectionError;

  final RuntimeState? runtime;
  final List<LeaderboardEntry> leaderboard;
  final QuestionResult? myQuestionResult;
  final FinalResult? myFinalResult;

  /// Exact total participant count for this quiz attempt, as reported by
  /// the backend (leaderboard size), independent of the fact that only the
  /// top 10 leaderboard entries are ever sent to the client.
  final int totalParticipants;

  /// Locally selected (not-yet-submitted) option for the current question.
  final String? selectedOptionId;
  final SubmissionStatus submissionStatus;
  final String? submissionError;

  /// Tracks which question the current selection/submission belongs to so
  /// we can reset state cleanly when a new question arrives.
  final String? answeredForQuestionId;

  const QuizRuntimeState({
    this.connectionStatus = SocketConnectionStatus.idle,
    this.connectionError,
    this.runtime,
    this.leaderboard = const [],
    this.myQuestionResult,
    this.myFinalResult,
    this.totalParticipants = 0,
    this.selectedOptionId,
    this.submissionStatus = SubmissionStatus.none,
    this.submissionError,
    this.answeredForQuestionId,
  });

  QuizPhase get phase => runtime?.phase ?? QuizPhase.waiting;

  /// Best current estimate of the SERVER's clock, derived from the most
  /// recent runtime snapshot's `serverTime` plus however long ago that
  /// snapshot was received. Every screen that compares against
  /// `phaseEndsAt`/`phaseStartedAt` should use this instead of a raw
  /// `DateTime.now()`, so a device with a skewed system clock still shows
  /// a countdown that lines up with when the server actually fires the
  /// phase-end / reveal events. Falls back to the device clock if we
  /// haven't received a `serverTime` yet (e.g. very first frame).
  DateTime estimatedServerNow() {
    final offset = runtime?.clockOffsetMs;
    if (offset == null) return DateTime.now();
    return DateTime.now().add(Duration(milliseconds: offset));
  }

  QuizRuntimeState copyWith({
    SocketConnectionStatus? connectionStatus,
    String? connectionError,
    bool clearConnectionError = false,
    RuntimeState? runtime,
    List<LeaderboardEntry>? leaderboard,
    QuestionResult? myQuestionResult,
    bool clearQuestionResult = false,
    FinalResult? myFinalResult,
    int? totalParticipants,
    String? selectedOptionId,
    bool clearSelectedOptionId = false,
    SubmissionStatus? submissionStatus,
    String? submissionError,
    bool clearSubmissionError = false,
    String? answeredForQuestionId,
    bool clearAnsweredForQuestionId = false,
  }) {
    return QuizRuntimeState(
      connectionStatus: connectionStatus ?? this.connectionStatus,
      connectionError: clearConnectionError
          ? null
          : (connectionError ?? this.connectionError),
      runtime: runtime ?? this.runtime,
      leaderboard: leaderboard ?? this.leaderboard,
      myQuestionResult: clearQuestionResult
          ? null
          : (myQuestionResult ?? this.myQuestionResult),
      myFinalResult: myFinalResult ?? this.myFinalResult,
      totalParticipants: totalParticipants ?? this.totalParticipants,
      selectedOptionId: clearSelectedOptionId
          ? null
          : (selectedOptionId ?? this.selectedOptionId),
      submissionStatus: submissionStatus ?? this.submissionStatus,
      submissionError: clearSubmissionError
          ? null
          : (submissionError ?? this.submissionError),
      answeredForQuestionId: clearAnsweredForQuestionId
          ? null
          : (answeredForQuestionId ?? this.answeredForQuestionId),
    );
  }
}

class QuizRuntimeController extends StateNotifier<QuizRuntimeState> {
  QuizRuntimeController(this._quizId, this._repository)
    : super(const QuizRuntimeState());

  final String _quizId;
  final QuizRepository _repository;
  final QuizSocketService _socket = QuizSocketService();

  bool _disposed = false;
  Timer? _connectTimeoutTimer;

  void _clearConnectTimeout() {
    _connectTimeoutTimer?.cancel();
    _connectTimeoutTimer = null;
  }

  void _startConnectTimeout() {
    _clearConnectTimeout();
    _connectTimeoutTimer = Timer(const Duration(seconds: 12), () {
      if (_disposed) return;
      if (state.connectionStatus == SocketConnectionStatus.connecting) {
        state = state.copyWith(
          connectionStatus: SocketConnectionStatus.error,
          connectionError:
              'Connection timed out. Check your network and try again.',
        );
      }
    });
  }

  /// Opens the socket connection (if not already connecting/connected) and
  /// joins the quiz room. Safe to call multiple times — subsequent calls
  /// while already connecting/connected are no-ops.
  Future<void> connectAndJoin() async {
    if (state.connectionStatus == SocketConnectionStatus.connecting ||
        state.connectionStatus == SocketConnectionStatus.connected) {
      return;
    }

    state = state.copyWith(
      connectionStatus: SocketConnectionStatus.connecting,
      clearConnectionError: true,
    );
    _startConnectTimeout();

    final token = await _repository.getSocketToken();
    if (_disposed) return;

    if (token == null) {
      _clearConnectTimeout();
      state = state.copyWith(
        connectionStatus: SocketConnectionStatus.error,
        connectionError: 'You need to be signed in to join this quiz.',
      );
      return;
    }

    _socket.connect(
      token: token,
      onConnect: () {
        if (_disposed) return;
        _socket.joinQuiz(_quizId);
      },
      onConnectError: (message) {
        if (_disposed) return;
        _clearConnectTimeout();
        state = state.copyWith(
          connectionStatus: SocketConnectionStatus.error,
          connectionError: message,
        );
      },
      onDisconnect: () {
        if (_disposed) return;
        _clearConnectTimeout();
        if (state.connectionStatus == SocketConnectionStatus.connected) {
          state = state.copyWith(
            connectionStatus: SocketConnectionStatus.disconnected,
          );
        }
      },
      onQuizJoined: (data) {
        if (_disposed) return;
        if (data['success'] == false) {
          state = state.copyWith(
            connectionStatus: SocketConnectionStatus.error,
            connectionError:
                data['message'] as String? ?? 'Could not join quiz.',
          );
          return;
        }
        final runtime = RuntimeState.fromJson(
          data['data'] as Map<String, dynamic>,
        );
        _clearConnectTimeout();
        state = state.copyWith(
          connectionStatus: SocketConnectionStatus.connected,
          runtime: runtime,
        );
        _resetPerQuestionStateIfNeeded(runtime);
      },
      onJoinQuizError: (data) {
        if (_disposed) return;
        _clearConnectTimeout();
        state = state.copyWith(
          connectionStatus: SocketConnectionStatus.error,
          connectionError:
              data['message'] as String? ?? 'Could not join this quiz.',
        );
      },
      onRuntimeUpdated: (data) {
        if (_disposed) return;
        if (data['data'] == null) return;
        final runtime = RuntimeState.fromJson(
          data['data'] as Map<String, dynamic>,
        );
        state = state.copyWith(runtime: runtime);
        _resetPerQuestionStateIfNeeded(runtime);
      },
      onLeaderboardUpdated: (data) {
        if (_disposed) return;
        final payload = data['data'] as Map<String, dynamic>?;
        final list = (payload?['leaderboard'] as List?) ?? [];
        state = state.copyWith(
          leaderboard: list
              .map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
              .toList(),
          totalParticipants:
              (payload?['totalParticipants'] as num?)?.toInt() ??
              state.totalParticipants,
        );
      },
      onQuestionResults: (data) {
        if (_disposed) return;
        final payload = data['data'] as Map<String, dynamic>?;
        if (payload == null) return;
        final questionResult = QuestionResult.fromJson(payload);
        state = state.copyWith(
          myQuestionResult: questionResult,
          totalParticipants: questionResult.totalParticipants,
        );
      },
      onFinalResults: (data) {
        if (_disposed) return;
        final payload = data['data'] as Map<String, dynamic>?;
        if (payload == null) return;
        final finalResult = FinalResult.fromJson(payload);
        state = state.copyWith(
          myFinalResult: finalResult,
          totalParticipants: finalResult.totalParticipants,
        );
      },
      onAnswerSubmitted: () {
        if (_disposed) return;
        state = state.copyWith(submissionStatus: SubmissionStatus.submitted);
      },
      onAnswerSubmissionError: (message) {
        if (_disposed) return;
        state = state.copyWith(
          submissionStatus: SubmissionStatus.error,
          submissionError: message,
        );
      },
    );
  }

  /// Clears per-question selection/submission state whenever the active
  /// question changes (new QUESTION phase, or moving past LEADERBOARD).
  void _resetPerQuestionStateIfNeeded(RuntimeState runtime) {
    if (runtime.phase == QuizPhase.question && runtime.question != null) {
      if (state.answeredForQuestionId != runtime.question!.id) {
        state = state.copyWith(
          clearSelectedOptionId: true,
          submissionStatus: SubmissionStatus.none,
          clearSubmissionError: true,
          clearQuestionResult: true,
          answeredForQuestionId: runtime.question!.id,
        );
      }
    }
  }

  void selectOption(String optionId) {
    if (state.submissionStatus != SubmissionStatus.none) return;
    state = state.copyWith(selectedOptionId: optionId);
  }

  /// Deselects the current pick — only allowed before submitting.
  void clearSelection() {
    if (state.submissionStatus != SubmissionStatus.none) return;
    state = state.copyWith(clearSelectedOptionId: true);
  }

  void submitSelectedAnswer() {
    final questionId = state.runtime?.question?.id;
    final selected = state.selectedOptionId;
    if (questionId == null || selected == null) return;
    if (state.submissionStatus != SubmissionStatus.none) return;

    state = state.copyWith(
      submissionStatus: SubmissionStatus.pending,
      clearSubmissionError: true,
    );
    _socket.submitAnswer(questionId: questionId, selectedOptionIds: [selected]);
  }

  /// Fully tears down the socket connection. Call this when the student
  /// leaves the quiz flow (back out of the lobby, or finishes on the
  /// results screen) — not on every screen transition within the flow.
  void leaveQuiz() {
    _clearConnectTimeout();
    _socket.disconnect();
    state = const QuizRuntimeState();
  }

  @override
  void dispose() {
    _disposed = true;
    _clearConnectTimeout();
    _socket.disconnect();
    super.dispose();
  }
}

final quizRuntimeControllerProvider =
    StateNotifierProvider.family<
      QuizRuntimeController,
      QuizRuntimeState,
      String
    >((ref, quizId) {
      return QuizRuntimeController(quizId, ref.read(quizRepositoryProvider));
    });
