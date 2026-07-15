/// ════════════════════════════════════════════════════════════════════════════
/// BIMA – Quiz Runtime Models
/// ════════════════════════════════════════════════════════════════════════════
///
/// These models mirror the JSON shapes returned by:
///   • REST  : GET /quiz/my            → List<MyQuizSummary>
///             GET /quiz/my/:quizId    → MyQuizDetail
///   • Socket: quizJoined / runtimeUpdated → RuntimeState
///             leaderboardUpdated          → List<LeaderboardEntry>
///             questionResults              → QuestionResult
///             finalResults                 → FinalResult
library quiz_models;

/// Card shown on the Home screen "Upcoming Quizzes" list.
/// Comes from `GET /quiz/my`.
class MyQuizSummary {
  final String id;
  final String title;
  final String? coverImageUrl;
  final DateTime scheduledStartTime;

  /// SCHEDULED | LIVE
  final String status;

  /// PUBLIC | RESTRICTED
  final String visibility;
  final int questionCount;

  /// Only present when [status] == 'LIVE'. Tells us exactly which runtime
  /// phase the quiz is in (WAITING / LOBBY / QUESTION / LEADERBOARD /
  /// RESULTS) so the home screen can distinguish "lobby open, still
  /// counting down" from "quiz actually in progress".
  final QuizRuntimeSnapshot? runtime;

  const MyQuizSummary({
    required this.id,
    required this.title,
    required this.coverImageUrl,
    required this.scheduledStartTime,
    required this.status,
    required this.visibility,
    required this.questionCount,
    this.runtime,
  });

  factory MyQuizSummary.fromJson(Map<String, dynamic> json) {
    return MyQuizSummary(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'Untitled Quiz',
      coverImageUrl: json['coverImageUrl'] as String?,
      scheduledStartTime: DateTime.parse(
        json['scheduledStartTime'] as String,
      ).toLocal(),
      status: json['status'] as String? ?? 'SCHEDULED',
      visibility: json['visibility'] as String? ?? 'PUBLIC',
      questionCount: (json['_count']?['quizQuestions'] as int?) ?? 0,
      runtime: json['runtime'] == null
          ? null
          : QuizRuntimeSnapshot.fromJson(
              json['runtime'] as Map<String, dynamic>,
            ),
    );
  }

  bool get isLive => status == 'LIVE';

  /// True once the host has opened the lobby but the quiz hasn't actually
  /// started running questions yet. While this is true we still show a
  /// countdown (to the lobby/question phase ending). Once the quiz moves
  /// into QUESTION/LEADERBOARD/RESULTS this becomes false and the card
  /// switches to a plain "Ongoing" state with no timer.
  bool get isInLobby => isLive && (runtime?.phase == 'LOBBY');

  /// True once the quiz has moved past the lobby and is actually running
  /// (questions, leaderboard, or results). No countdown makes sense here.
  bool get isInProgress =>
      isLive &&
      runtime != null &&
      runtime!.phase != 'WAITING' &&
      runtime!.phase != 'LOBBY';
}

/// Lightweight snapshot of the runtime that is embedded inside the
/// `GET /quiz/my/:quizId` response. Only present once an admin has called
/// `POST /runtime/:quizId/initialize`.
class QuizRuntimeSnapshot {
  final String phase;
  final int? remainingTime;
  final DateTime? phaseStartedAt;
  final DateTime? phaseEndsAt;

  const QuizRuntimeSnapshot({
    required this.phase,
    required this.remainingTime,
    required this.phaseStartedAt,
    required this.phaseEndsAt,
  });

  factory QuizRuntimeSnapshot.fromJson(Map<String, dynamic> json) {
    return QuizRuntimeSnapshot(
      phase: json['phase'] as String,
      remainingTime: json['remainingTime'] as int?,
      phaseStartedAt: json['phaseStartedAt'] == null
          ? null
          : DateTime.parse(json['phaseStartedAt'] as String).toLocal(),
      phaseEndsAt: json['phaseEndsAt'] == null
          ? null
          : DateTime.parse(json['phaseEndsAt'] as String).toLocal(),
    );
  }

  /// True once the host has opened the lobby (or moved further along).
  bool get lobbyIsOpen => phase != 'WAITING';
}

/// Full detail returned by `GET /quiz/my/:quizId`.
class MyQuizDetail {
  final String id;
  final String title;
  final String? description;
  final String? coverImageUrl;
  final String visibility;
  final DateTime scheduledStartTime;
  final int defaultTimer;
  final String status;
  final int questionCount;
  final QuizRuntimeSnapshot? runtime;

  const MyQuizDetail({
    required this.id,
    required this.title,
    required this.description,
    required this.coverImageUrl,
    required this.visibility,
    required this.scheduledStartTime,
    required this.defaultTimer,
    required this.status,
    required this.questionCount,
    required this.runtime,
  });

  factory MyQuizDetail.fromJson(Map<String, dynamic> json) {
    return MyQuizDetail(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'Untitled Quiz',
      description: json['description'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      visibility: json['visibility'] as String? ?? 'PUBLIC',
      scheduledStartTime: DateTime.parse(
        json['scheduledStartTime'] as String,
      ).toLocal(),
      defaultTimer: (json['defaultTimer'] as num?)?.toInt() ?? 20,
      status: json['status'] as String? ?? 'SCHEDULED',
      questionCount: (json['_count']?['quizQuestions'] as int?) ?? 0,
      runtime: json['runtime'] == null
          ? null
          : QuizRuntimeSnapshot.fromJson(
              json['runtime'] as Map<String, dynamic>,
            ),
    );
  }

  /// Whether the student should be sent straight into the live runtime flow
  /// (lobby already open / quiz already in progress) rather than the
  /// "waiting for host" screen.
  bool get lobbyIsOpen => runtime != null && runtime!.lobbyIsOpen;
}

/// One row of the student's quiz history.
/// Comes from `GET /quiz/my/history`. Deliberately contains ONLY
/// summary/result data — no question or answer content.
class HistoryResult {
  final String quizId;
  final String title;
  final DateTime completedAt;
  final int? rank;
  final int totalParticipants;
  final int score;
  final int totalQuestions;

  const HistoryResult({
    required this.quizId,
    required this.title,
    required this.completedAt,
    required this.rank,
    required this.totalParticipants,
    required this.score,
    required this.totalQuestions,
  });

  factory HistoryResult.fromJson(Map<String, dynamic> json) {
    return HistoryResult(
      quizId: json['quizId'] as String,
      title: json['title'] as String? ?? 'Untitled Quiz',
      completedAt: DateTime.parse(json['completedAt'] as String).toLocal(),
      rank: (json['rank'] as num?)?.toInt(),
      totalParticipants: (json['totalParticipants'] as num?)?.toInt() ?? 0,
      score: (json['score'] as num?)?.toInt() ?? 0,
      totalQuestions: (json['totalQuestions'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Pagination metadata returned alongside a page of [HistoryResult]s.
class HistoryPagination {
  final int page;
  final int limit;
  final int total;
  final bool hasMore;

  const HistoryPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.hasMore,
  });

  factory HistoryPagination.fromJson(Map<String, dynamic> json) {
    return HistoryPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 10,
      total: (json['total'] as num?)?.toInt() ?? 0,
      hasMore: json['hasMore'] as bool? ?? false,
    );
  }
}

/// A single page of quiz history results, as returned by
/// `GET /quiz/my/history`.
class HistoryPage {
  final List<HistoryResult> results;
  final HistoryPagination pagination;

  const HistoryPage({required this.results, required this.pagination});

  factory HistoryPage.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as List? ?? [];
    return HistoryPage(
      results: data
          .map((e) => HistoryResult.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: HistoryPagination.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO payloads
// ─────────────────────────────────────────────────────────────────────────────

/// Mirrors the backend's `QuizPhase` enum (runtime.constants.js).
enum QuizPhase {
  waiting,
  lobby,
  question,
  leaderboard,
  results,
  completed,
  unknown,
}

QuizPhase quizPhaseFromString(String? raw) {
  switch (raw) {
    case 'WAITING':
      return QuizPhase.waiting;
    case 'LOBBY':
      return QuizPhase.lobby;
    case 'QUESTION':
      return QuizPhase.question;
    case 'LEADERBOARD':
      return QuizPhase.leaderboard;
    case 'RESULTS':
      return QuizPhase.results;
    case 'COMPLETED':
      return QuizPhase.completed;
    default:
      return QuizPhase.unknown;
  }
}

class QuizOptionPayload {
  final String id;
  final String optionText;
  final String? optionImage;

  const QuizOptionPayload({
    required this.id,
    required this.optionText,
    required this.optionImage,
  });

  factory QuizOptionPayload.fromJson(Map<String, dynamic> json) {
    return QuizOptionPayload(
      id: json['id'] as String,
      optionText: json['optionText'] as String? ?? '',
      optionImage:
          json['optionImage'] as String? ??
          json['mediaUrl'] as String? ??
          json['imageUrl'] as String?,
    );
  }
}

class QuizQuestionPayload {
  final String id;
  final String questionText;
  final String? questionImage;
  final String questionType;
  final int? durationMs;
  final List<QuizOptionPayload> options;

  const QuizQuestionPayload({
    required this.id,
    required this.questionText,
    required this.questionImage,
    required this.questionType,
    required this.durationMs,
    required this.options,
  });

  factory QuizQuestionPayload.fromJson(Map<String, dynamic> json) {
    return QuizQuestionPayload(
      id: json['id'] as String,
      questionText: json['questionText'] as String? ?? '',
      questionImage:
          json['questionImage'] as String? ??
          json['mediaUrl'] as String? ??
          json['imageUrl'] as String?,
      questionType: json['questionType'] as String? ?? 'SINGLE_CORRECT',
      durationMs: (json['durationMs'] as num?)?.toInt(),
      options: ((json['options'] as List?) ?? [])
          .map((o) => QuizOptionPayload.fromJson(o as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Emitted via `quizJoined` and `runtimeUpdated`.
class RuntimeState {
  final QuizPhase phase;
  final int? remainingTimeMs;
  final DateTime? phaseStartedAt;
  final DateTime? phaseEndsAt;
  final int? connectedUsers;
  final int? questionIndex;
  final QuizQuestionPayload? question;

  /// The server's own `Date.now()` at the instant this snapshot was built
  /// (see `serverTime` in `runtime.engine.js#getRuntimeState`). Combined
  /// with [receivedAt] (stamped locally the moment this object is parsed),
  /// this lets callers compute how far the device's clock is from the
  /// server's clock, instead of comparing `phaseEndsAt` against the
  /// device's own possibly-skewed `DateTime.now()`.
  final int? serverTime;

  /// Local wall-clock time at the moment this snapshot was parsed. Used
  /// together with [serverTime] to derive the clock offset.
  final DateTime receivedAt;

  RuntimeState({
    required this.phase,
    required this.remainingTimeMs,
    required this.phaseStartedAt,
    required this.phaseEndsAt,
    this.connectedUsers,
    this.questionIndex,
    this.question,
    this.serverTime,
    DateTime? receivedAt,
  }) : receivedAt = receivedAt ?? DateTime.now();

  factory RuntimeState.fromJson(Map<String, dynamic> json) {
    return RuntimeState(
      phase: quizPhaseFromString(json['phase'] as String?),
      remainingTimeMs: json['remainingTime'] as int?,
      phaseStartedAt: json['phaseStartedAt'] == null
          ? null
          : DateTime.parse(json['phaseStartedAt'] as String).toLocal(),
      phaseEndsAt: json['phaseEndsAt'] == null
          ? null
          : DateTime.parse(json['phaseEndsAt'] as String).toLocal(),
      connectedUsers: json['connectedUsers'] as int?,
      questionIndex: json['questionIndex'] as int?,
      question: json['question'] == null
          ? null
          : QuizQuestionPayload.fromJson(
              json['question'] as Map<String, dynamic>,
            ),
      serverTime: json['serverTime'] as int?,
      receivedAt: DateTime.now(),
    );
  }

  /// How far ahead the server's clock is compared to this device's clock,
  /// captured at the moment this snapshot arrived. Add this to
  /// `DateTime.now()` anywhere a screen needs to compare against
  /// `phaseEndsAt`, instead of using the device's raw clock.
  int? get clockOffsetMs {
    if (serverTime == null) return null;
    return serverTime! - receivedAt.millisecondsSinceEpoch;
  }
}

class LeaderboardEntry {
  final int rank;
  final String userId;
  final String fullName;
  final String? profileImage;
  final int totalScore;

  const LeaderboardEntry({
    required this.rank,
    required this.userId,
    required this.fullName,
    required this.profileImage,
    required this.totalScore,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      userId: json['userId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? 'Player',
      profileImage: json['profileImage'] as String?,
      totalScore: (json['totalScore'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Emitted (per-user, targeted) via `questionResults` after each question.
class QuestionResult {
  final bool correct;
  final int score;
  final int totalScore;
  final int? rank;
  final List<String> correctOptionIds;

  const QuestionResult({
    required this.correct,
    required this.score,
    required this.totalScore,
    required this.rank,
    required this.correctOptionIds,
  });

  factory QuestionResult.fromJson(Map<String, dynamic> json) {
    return QuestionResult(
      correct: json['correct'] as bool? ?? false,
      score: (json['score'] as num?)?.toInt() ?? 0,
      totalScore: (json['totalScore'] as num?)?.toInt() ?? 0,
      rank: (json['rank'] as num?)?.toInt(),
      correctOptionIds: ((json['correctOptionIds'] as List?) ?? [])
          .map((e) => e.toString())
          .toList(),
    );
  }
}

/// Emitted (per-user, targeted) via `finalResults` when the quiz ends.
class FinalResult {
  final int? rank;
  final int totalScore;

  const FinalResult({required this.rank, required this.totalScore});

  factory FinalResult.fromJson(Map<String, dynamic> json) {
    return FinalResult(
      rank: (json['rank'] as num?)?.toInt(),
      totalScore: (json['totalScore'] as num?)?.toInt() ?? 0,
    );
  }
}
