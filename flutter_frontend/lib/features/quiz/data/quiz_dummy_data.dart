/// ════════════════════════════════════════════════════════════════════════════
/// BIMA – Quiz Demo Data
/// ════════════════════════════════════════════════════════════════════════════
///
/// This is the SINGLE FILE you edit to change the demo experience.
///
/// HOW TO EDIT DEMO DATA
/// ─────────────────────
/// • Upcoming quizzes  →  edit [demoUpcomingQuizzes]
/// • History results   →  edit [demoHistoryResults]
/// • Questions/answers →  edit the [questions] list inside each [DemoQuiz]
/// • Leaderboard names →  edit [demoLeaderboardEntries]
///
/// ADDING AN IMAGE TO A QUESTION
/// ──────────────────────────────
/// Set [imageUrl] to any valid https:// URL. If null or empty, no image
/// is shown and the question text fills the card on its own.
/// Recommended image ratio: 16:9 or square. Images are cropped to fill.
/// Example:
///   imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/...'
///
library quiz_dummy_data;

// ─────────────────────────────────────────────────────────────────────────────
// Models
// ─────────────────────────────────────────────────────────────────────────────

class DemoAnswer {
  final String id;
  final String text;
  final bool isCorrect;

  const DemoAnswer({
    required this.id,
    required this.text,
    required this.isCorrect,
  });
}

class DemoQuestion {
  final String id;
  final String text;
  final List<DemoAnswer> answers;

  /// Timer in seconds for this specific question.
  final int timerSeconds;

  /// Optional image URL shown above the question text.
  /// If null or empty string, no image is displayed.
  /// Accepts any valid https:// network image URL.
  final String? imageUrl;

  const DemoQuestion({
    required this.id,
    required this.text,
    required this.answers,
    this.timerSeconds = 20,
    this.imageUrl,
  });
}

enum QuizTag { daily, challenge, special, aptitude }

extension QuizTagLabel on QuizTag {
  String get label {
    switch (this) {
      case QuizTag.daily:
        return 'Daily';
      case QuizTag.challenge:
        return 'Challenge';
      case QuizTag.special:
        return 'Special';
      case QuizTag.aptitude:
        return 'Aptitude';
    }
  }
}

class DemoQuiz {
  final String id;
  final String title;
  final String description;

  /// ISO-8601 string, e.g. "2026-06-22T21:00:00"
  /// Or use "NOW+HH:MM:SS" for demo offset from app launch.
  final String scheduledAt;

  /// How many minutes before [scheduledAt] the lobby opens.
  final int lobbyOpenMinutesBefore;

  final QuizTag tag;
  final List<DemoQuestion> questions;

  const DemoQuiz({
    required this.id,
    required this.title,
    required this.description,
    required this.scheduledAt,
    this.lobbyOpenMinutesBefore = 15,
    required this.tag,
    required this.questions,
  });

  int get questionCount => questions.length;
}

class DemoLeaderboardEntry {
  final int rank;
  final String name;
  final int score;

  /// Short college or batch label shown under the name, optional.
  final String? label;

  const DemoLeaderboardEntry({
    required this.rank,
    required this.name,
    required this.score,
    this.label,
  });
}

class DemoHistoryResult {
  final String quizId;
  final String title;
  final String date;
  final int rank;
  final int totalParticipants;
  final int score;
  final int totalQuestions;
  final QuizTag tag;

  const DemoHistoryResult({
    required this.quizId,
    required this.title,
    required this.date,
    required this.rank,
    required this.totalParticipants,
    required this.score,
    required this.totalQuestions,
    required this.tag,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  EDIT THIS SECTION TO CHANGE DEMO CONTENT
// ─────────────────────────────────────────────────────────────────────────────

/// Upcoming quizzes shown on the Home screen and the lobby.
const List<DemoQuiz> demoUpcomingQuizzes = [
  DemoQuiz(
    id: 'quiz-14',
    title: 'Daily Quiz #14',
    description:
        'Today\'s daily knowledge challenge covering aptitude, reasoning, '
        'and general awareness. Answer fast — speed matters!',
    scheduledAt: 'NOW+00:00:30',
    lobbyOpenMinutesBefore: 15,
    tag: QuizTag.daily,
    questions: [
      DemoQuestion(
        id: 'q1',
        text: 'What is the square root of 144?',
        timerSeconds: 5,
        // No image — text-only question
        answers: [
          DemoAnswer(id: 'a', text: '10', isCorrect: false),
          DemoAnswer(id: 'b', text: '11', isCorrect: false),
          DemoAnswer(id: 'c', text: '12', isCorrect: true),
          DemoAnswer(id: 'd', text: '13', isCorrect: false),
        ],
      ),
      DemoQuestion(
        id: 'q2',
        text: 'Which planet is known as the Red Planet?',
        timerSeconds: 5,
        // Example with an image — replace URL to test your own images
        imageUrl: 'https://cdn.eso.org/images/screen/eso1509a.jpg',
        answers: [
          DemoAnswer(id: 'a', text: 'Venus', isCorrect: false),
          DemoAnswer(id: 'b', text: 'Mars', isCorrect: true),
          DemoAnswer(id: 'c', text: 'Jupiter', isCorrect: false),
          DemoAnswer(id: 'd', text: 'Saturn', isCorrect: false),
        ],
      ),
      DemoQuestion(
        id: 'q3',
        text:
            'If a train travels at 60 km/h, how far does it go in 90 minutes?',
        timerSeconds: 5,
        answers: [
          DemoAnswer(id: 'a', text: '60 km', isCorrect: false),
          DemoAnswer(id: 'b', text: '80 km', isCorrect: false),
          DemoAnswer(id: 'c', text: '90 km', isCorrect: true),
          DemoAnswer(id: 'd', text: '120 km', isCorrect: false),
        ],
      ),
      DemoQuestion(
        id: 'q4',
        text: 'Who wrote "A Brief History of Time"?',
        timerSeconds: 5,
        // imageUrl:
        //     '',
        answers: [
          DemoAnswer(id: 'a', text: 'Albert Einstein', isCorrect: false),
          DemoAnswer(id: 'b', text: 'Stephen Hawking', isCorrect: true),
          DemoAnswer(id: 'c', text: 'Isaac Newton', isCorrect: false),
          DemoAnswer(id: 'd', text: 'Richard Feynman', isCorrect: false),
        ],
      ),
      DemoQuestion(
        id: 'q5',
        text: 'What does CPU stand for?',
        timerSeconds: 5,
        answers: [
          DemoAnswer(id: 'a', text: 'Central Processing Unit', isCorrect: true),
          DemoAnswer(id: 'b', text: 'Computer Power Unit', isCorrect: false),
          DemoAnswer(id: 'c', text: 'Core Processing Unit', isCorrect: false),
          DemoAnswer(
            id: 'd',
            text: 'Central Program Utility',
            isCorrect: false,
          ),
        ],
      ),
    ],
  ),
  DemoQuiz(
    id: 'quiz-apt',
    title: 'Aptitude Challenge',
    description:
        'A specially curated aptitude and logical reasoning quiz. '
        'No shortcuts — pure thinking speed wins!',
    scheduledAt: 'NOW+05:40:00',
    lobbyOpenMinutesBefore: 10,
    tag: QuizTag.aptitude,
    questions: [
      DemoQuestion(
        id: 'q1',
        text: 'Find the next number in the series: 2, 6, 12, 20, 30, __?',
        timerSeconds: 5,
        answers: [
          DemoAnswer(id: 'a', text: '40', isCorrect: false),
          DemoAnswer(id: 'b', text: '42', isCorrect: true),
          DemoAnswer(id: 'c', text: '44', isCorrect: false),
          DemoAnswer(id: 'd', text: '36', isCorrect: false),
        ],
      ),
      DemoQuestion(
        id: 'q2',
        text:
            'A is 40 m south of B. C is 40 m east of B. What is the distance from A to C?',
        timerSeconds: 5,
        answers: [
          DemoAnswer(id: 'a', text: '40 m', isCorrect: false),
          DemoAnswer(id: 'b', text: '56.5 m', isCorrect: true),
          DemoAnswer(id: 'c', text: '80 m', isCorrect: false),
          DemoAnswer(id: 'd', text: '60 m', isCorrect: false),
        ],
      ),
      DemoQuestion(
        id: 'q3',
        text: 'Which of the following is NOT a prime number?',
        timerSeconds: 5,
        answers: [
          DemoAnswer(id: 'a', text: '17', isCorrect: false),
          DemoAnswer(id: 'b', text: '23', isCorrect: false),
          DemoAnswer(id: 'c', text: '51', isCorrect: true),
          DemoAnswer(id: 'd', text: '29', isCorrect: false),
        ],
      ),
    ],
  ),
];

/// Live running leaderboard shown during and after each question.
/// Entry with name == 'You' is highlighted as the current user.
/// Scores here represent cumulative totals after all questions answered so far.
const List<DemoLeaderboardEntry> demoLeaderboardEntries = [
  DemoLeaderboardEntry(
    rank: 1,
    name: 'Riya Sharma',
    score: 950,
    label: 'CSE-A',
  ),
  DemoLeaderboardEntry(rank: 2, name: 'Arjun Mehta', score: 910, label: 'IT-B'),
  DemoLeaderboardEntry(
    rank: 3,
    name: 'Sneha Kapoor',
    score: 870,
    label: 'CSE-B',
  ),
  DemoLeaderboardEntry(rank: 4, name: 'You', score: 860, label: ''),
  DemoLeaderboardEntry(rank: 5, name: 'Dev Patel', score: 820, label: 'ECE-A'),
  DemoLeaderboardEntry(
    rank: 6,
    name: 'Priya Singh',
    score: 780,
    label: 'CSE-A',
  ),
  DemoLeaderboardEntry(rank: 7, name: 'Rahul Gupta', score: 760, label: 'ME-B'),
  DemoLeaderboardEntry(
    rank: 8,
    name: 'Ananya Joshi',
    score: 740,
    label: 'IT-A',
  ),
  DemoLeaderboardEntry(
    rank: 9,
    name: 'Vikram Nair',
    score: 700,
    label: 'CSE-C',
  ),
  DemoLeaderboardEntry(
    rank: 10,
    name: 'Pooja Iyer',
    score: 680,
    label: 'ECE-B',
  ),
];

/// Your rank in the live leaderboard (1-indexed).
/// Must match the position of the 'You' entry above.
const int demoUserRank = 4;

/// How many seconds the leaderboard is shown between questions.
const int demoLeaderboardDisplaySeconds = 8;

/// Total participants shown in lobby and results.
const int demoTotalParticipants = 127;

/// History results shown on the History screen.
const List<DemoHistoryResult> demoHistoryResults = [
  DemoHistoryResult(
    quizId: 'quiz-13',
    title: 'Daily Quiz #13',
    date: 'Today, 9:00 PM',
    rank: 4,
    totalParticipants: 127,
    score: 860,
    totalQuestions: 20,
    tag: QuizTag.daily,
  ),
  DemoHistoryResult(
    quizId: 'quiz-apt-prev',
    title: 'Aptitude Challenge',
    date: 'Yesterday, 8:30 PM',
    rank: 2,
    totalParticipants: 94,
    score: 1240,
    totalQuestions: 15,
    tag: QuizTag.aptitude,
  ),
  DemoHistoryResult(
    quizId: 'quiz-12',
    title: 'Daily Quiz #12',
    date: '8 Jun, 9:00 PM',
    rank: 11,
    totalParticipants: 118,
    score: 540,
    totalQuestions: 20,
    tag: QuizTag.daily,
  ),
  DemoHistoryResult(
    quizId: 'quiz-weekly',
    title: 'Weekly Special',
    date: '5 Jun, 7:00 PM',
    rank: 1,
    totalParticipants: 203,
    score: 1580,
    totalQuestions: 25,
    tag: QuizTag.special,
  ),
  DemoHistoryResult(
    quizId: 'quiz-11',
    title: 'Daily Quiz #11',
    date: '4 Jun, 9:00 PM',
    rank: 7,
    totalParticipants: 110,
    score: 720,
    totalQuestions: 20,
    tag: QuizTag.daily,
  ),
  DemoHistoryResult(
    quizId: 'quiz-10',
    title: 'Daily Quiz #10',
    date: '3 Jun, 9:00 PM',
    rank: 3,
    totalParticipants: 135,
    score: 1100,
    totalQuestions: 20,
    tag: QuizTag.daily,
  ),
];
