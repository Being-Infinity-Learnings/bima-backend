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

  const MyQuizSummary({
    required this.id,
    required this.title,
    required this.coverImageUrl,
    required this.scheduledStartTime,
    required this.status,
    required this.visibility,
    required this.questionCount,
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
    );
  }

  bool get isLive => status == 'LIVE';
}

/// Lightweight snapshot of the runtime that is embedded inside the
/// `GET /quiz/my/:quizId` response. Only present once an admin has called
/// `POST /runtime/:quizId/initialize`.
class QuizRuntimeSnapshot {
  final String phase;
  final int? remainingTime;

  const QuizRuntimeSnapshot({required this.phase, required this.remainingTime});

  factory QuizRuntimeSnapshot.fromJson(Map<String, dynamic> json) {
    return QuizRuntimeSnapshot(
      phase: json['phase'] as String,
      remainingTime: json['remainingTime'] as int?,
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

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO payloads
// ─────────────────────────────────────────────────────────────────────────────

/// Mirrors the backend's `QuizPhase` enum (runtime.constants.js).
enum QuizPhase { waiting, lobby, question, leaderboard, results, completed, unknown }

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
      optionImage: json['optionImage'] as String?,
    );
  }
}

class QuizQuestionPayload {
  final String id;
  final String questionText;
  final String? questionImage;
  final String questionType;
  final List<QuizOptionPayload> options;

  const QuizQuestionPayload({
    required this.id,
    required this.questionText,
    required this.questionImage,
    required this.questionType,
    required this.options,
  });

  factory QuizQuestionPayload.fromJson(Map<String, dynamic> json) {
    return QuizQuestionPayload(
      id: json['id'] as String,
      questionText: json['questionText'] as String? ?? '',
      questionImage: json['questionImage'] as String?,
      questionType: json['questionType'] as String? ?? 'SINGLE_CORRECT',
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
  final int? connectedUsers;
  final int? questionIndex;
  final QuizQuestionPayload? question;

  const RuntimeState({
    required this.phase,
    required this.remainingTimeMs,
    this.connectedUsers,
    this.questionIndex,
    this.question,
  });

  factory RuntimeState.fromJson(Map<String, dynamic> json) {
    return RuntimeState(
      phase: quizPhaseFromString(json['phase'] as String?),
      remainingTimeMs: json['remainingTime'] as int?,
      connectedUsers: json['connectedUsers'] as int?,
      questionIndex: json['questionIndex'] as int?,
      question: json['question'] == null
          ? null
          : QuizQuestionPayload.fromJson(
              json['question'] as Map<String, dynamic>,
            ),
    );
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
