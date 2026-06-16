import 'package:flutter/material.dart';
import '../../../config/app_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Dummy data model
// ─────────────────────────────────────────────────────────────────────────────

class _QuizResult {
  final String title;
  final String date;
  final int rank;
  final int totalParticipants;
  final int score;
  final int totalQuestions;
  final String tag;

  const _QuizResult({
    required this.title,
    required this.date,
    required this.rank,
    required this.totalParticipants,
    required this.score,
    required this.totalQuestions,
    required this.tag,
  });
}

const _dummyResults = [
  _QuizResult(
    title: 'Daily Quiz #13',
    date: 'Today, 9:00 PM',
    rank: 4,
    totalParticipants: 127,
    score: 860,
    totalQuestions: 20,
    tag: 'Daily',
  ),
  _QuizResult(
    title: 'Aptitude Challenge',
    date: 'Yesterday, 8:30 PM',
    rank: 2,
    totalParticipants: 94,
    score: 1240,
    totalQuestions: 15,
    tag: 'Challenge',
  ),
  _QuizResult(
    title: 'Daily Quiz #12',
    date: '8 Jun, 9:00 PM',
    rank: 11,
    totalParticipants: 118,
    score: 540,
    totalQuestions: 20,
    tag: 'Daily',
  ),
  _QuizResult(
    title: 'Weekly Special',
    date: '5 Jun, 7:00 PM',
    rank: 1,
    totalParticipants: 203,
    score: 1580,
    totalQuestions: 25,
    tag: 'Special',
  ),
  _QuizResult(
    title: 'Daily Quiz #11',
    date: '4 Jun, 9:00 PM',
    rank: 7,
    totalParticipants: 110,
    score: 720,
    totalQuestions: 20,
    tag: 'Daily',
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // summary stats derived from dummy data
    final avgRank =
        (_dummyResults.map((r) => r.rank).reduce((a, b) => a + b) /
                _dummyResults.length)
            .round();
    final bestRank = _dummyResults
        .map((r) => r.rank)
        .reduce((a, b) => a < b ? a : b);

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppConfig.backgroundGradient(isDark),
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Page header ───────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'History',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: isDark ? Colors.white : const Color(0xFF0C0E14),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_dummyResults.length} quizzes played',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? const Color(0xFF7A8499)
                            : const Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── Summary bar ──────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _SummaryBar(
                  isDark: isDark,
                  quizzesPlayed: _dummyResults.length,
                  bestRank: bestRank,
                  avgRank: avgRank,
                ),
              ),

              const SizedBox(height: 28),

              // ── Section label ────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _SectionLabel(label: 'ALL RESULTS', isDark: isDark),
              ),

              const SizedBox(height: 14),

              // ── List ─────────────────────────────────────────────────
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  itemCount: _dummyResults.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) =>
                      _ResultCard(isDark: isDark, result: _dummyResults[i]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Bar
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryBar extends StatelessWidget {
  final bool isDark;
  final int quizzesPlayed;
  final int bestRank;
  final int avgRank;

  const _SummaryBar({
    required this.isDark,
    required this.quizzesPlayed,
    required this.bestRank,
    required this.avgRank,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161B26) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06),
        ),
      ),
      child: Row(
        children: [
          _SummaryCell(
            isDark: isDark,
            label: 'Played',
            value: '$quizzesPlayed',
            color: const Color(0xFFC8FF57),
          ),
          _Divider(isDark: isDark),
          _SummaryCell(
            isDark: isDark,
            label: 'Best Rank',
            value: '#$bestRank',
            color: const Color(0xFFFFD166),
          ),
          _Divider(isDark: isDark),
          _SummaryCell(
            isDark: isDark,
            label: 'Avg Rank',
            value: '#$avgRank',
            color: const Color(0xFF6C8EFF),
          ),
        ],
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  final bool isDark;
  final String label;
  final String value;
  final Color color;

  const _SummaryCell({
    required this.isDark,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: color,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  final bool isDark;
  const _Divider({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 36,
      color: isDark
          ? const Color(0xFFFFFFFF).withOpacity(0.07)
          : const Color(0xFF000000).withOpacity(0.07),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Card
// ─────────────────────────────────────────────────────────────────────────────

class _ResultCard extends StatelessWidget {
  final bool isDark;
  final _QuizResult result;

  const _ResultCard({required this.isDark, required this.result});

  Color get _rankColor {
    if (result.rank == 1) return const Color(0xFFFFD166);
    if (result.rank <= 3) return const Color(0xFFC8FF57);
    if (result.rank <= 10) return const Color(0xFF6C8EFF);
    return const Color(0xFF7A8499);
  }

  Color get _tagColor {
    switch (result.tag) {
      case 'Challenge':
        return const Color(0xFFFF6B6B);
      case 'Special':
        return const Color(0xFFFFD166);
      default:
        return const Color(0xFF6C8EFF);
    }
  }

  String get _rankLabel {
    if (result.rank == 1) return '🥇';
    if (result.rank == 2) return '🥈';
    if (result.rank == 3) return '🥉';
    return '#${result.rank}';
  }

  @override
  Widget build(BuildContext context) {
    final tagColor = _tagColor;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161B26) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Rank bubble
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: _rankColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _rankColor.withOpacity(0.2),
                  width: 1,
                ),
              ),
              child: Center(
                child: Text(
                  _rankLabel,
                  style: TextStyle(
                    fontSize: result.rank <= 3 ? 22 : 16,
                    fontWeight: FontWeight.w800,
                    color: _rankColor,
                  ),
                ),
              ),
            ),

            const SizedBox(width: 14),

            // Text content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          result.title,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                            color: isDark
                                ? Colors.white
                                : const Color(0xFF0C0E14),
                          ),
                        ),
                      ),
                      // Tag pill
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: tagColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          result.tag,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: tagColor,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 6),

                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 12,
                        color: isDark
                            ? const Color(0xFF7A8499)
                            : const Color(0xFF9CA3AF),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        result.date,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isDark
                              ? const Color(0xFF7A8499)
                              : const Color(0xFF6B7280),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(
                        Icons.people_outline_rounded,
                        size: 12,
                        color: isDark
                            ? const Color(0xFF7A8499)
                            : const Color(0xFF9CA3AF),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${result.totalParticipants} participants',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: isDark
                              ? const Color(0xFF7A8499)
                              : const Color(0xFF6B7280),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  // Score bar
                  _ScoreBar(
                    isDark: isDark,
                    score: result.score,
                    maxScore: result.totalQuestions * 100,
                    rankColor: _rankColor,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Bar
// ─────────────────────────────────────────────────────────────────────────────

class _ScoreBar extends StatelessWidget {
  final bool isDark;
  final int score;
  final int maxScore;
  final Color rankColor;

  const _ScoreBar({
    required this.isDark,
    required this.score,
    required this.maxScore,
    required this.rankColor,
  });

  @override
  Widget build(BuildContext context) {
    final fraction = (score / maxScore).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Score',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? const Color(0xFF7A8499)
                    : const Color(0xFF9CA3AF),
              ),
            ),
            Text(
              '$score pts',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: rankColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: fraction,
            minHeight: 5,
            backgroundColor: isDark
                ? const Color(0xFFFFFFFF).withOpacity(0.07)
                : const Color(0xFF000000).withOpacity(0.07),
            valueColor: AlwaysStoppedAnimation<Color>(rankColor),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers (copy of home screen's _SectionLabel)
// ─────────────────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  final bool isDark;

  const _SectionLabel({required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.4,
        color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
      ),
    );
  }
}
