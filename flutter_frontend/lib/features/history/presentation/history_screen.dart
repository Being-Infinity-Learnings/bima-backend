import 'package:flutter/material.dart';

import '../../../config/app_config.dart';
import '../../quiz/data/quiz_dummy_data.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final results = demoHistoryResults;
    final bestRank = results.isEmpty
        ? 0
        : results.map((r) => r.rank).reduce((a, b) => a < b ? a : b);
    final avgRank = results.isEmpty
        ? 0
        : (results.map((r) => r.rank).reduce((a, b) => a + b) / results.length)
              .round();
    final totalScore = results.isEmpty
        ? 0
        : results.map((r) => r.score).reduce((a, b) => a + b);

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
              // ── Page header ────────────────────────────────────────────
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
                      '${results.length} quiz${results.length == 1 ? '' : 'zes'} played',
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

              const SizedBox(height: 20),

              // ── Summary bar ────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _SummaryBar(
                  isDark: isDark,
                  quizzesPlayed: results.length,
                  bestRank: bestRank,
                  avgRank: avgRank,
                  totalScore: totalScore,
                ),
              ),

              const SizedBox(height: 28),

              // ── Section label ──────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _SectionLabel(label: 'ALL RESULTS', isDark: isDark),
              ),

              const SizedBox(height: 14),

              // ── Results list ───────────────────────────────────────────
              Expanded(
                child: results.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.bar_chart_outlined,
                              size: 48,
                              color: isDark
                                  ? const Color(0xFF7A8499)
                                  : const Color(0xFF9CA3AF),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No quiz history yet.\nPlay your first quiz!',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                height: 1.5,
                                color: isDark
                                    ? const Color(0xFF7A8499)
                                    : const Color(0xFF9CA3AF),
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                        itemCount: results.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, i) => _ResultCard(
                          isDark: isDark,
                          result: results[i],
                          onTap: () => _showDetail(context, isDark, results[i]),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetail(
    BuildContext context,
    bool isDark,
    DemoHistoryResult result,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ResultDetailSheet(isDark: isDark, result: result),
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
  final int totalScore;

  const _SummaryBar({
    required this.isDark,
    required this.quizzesPlayed,
    required this.bestRank,
    required this.avgRank,
    required this.totalScore,
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
          _VerticalDivider(isDark: isDark),
          _SummaryCell(
            isDark: isDark,
            label: 'Best Rank',
            value: '#$bestRank',
            color: const Color(0xFFFFD166),
          ),
          _VerticalDivider(isDark: isDark),
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

class _VerticalDivider extends StatelessWidget {
  final bool isDark;
  const _VerticalDivider({required this.isDark});

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
// Result Card (list item)
// ─────────────────────────────────────────────────────────────────────────────

class _ResultCard extends StatelessWidget {
  final bool isDark;
  final DemoHistoryResult result;
  final VoidCallback onTap;

  const _ResultCard({
    required this.isDark,
    required this.result,
    required this.onTap,
  });

  Color get _rankColor {
    if (result.rank == 1) return const Color(0xFFFFD166);
    if (result.rank <= 3) return const Color(0xFFC8FF57);
    if (result.rank <= 10) return const Color(0xFF6C8EFF);
    return const Color(0xFF7A8499);
  }

  Color get _tagColor {
    switch (result.tag) {
      case QuizTag.challenge:
        return const Color(0xFFFF6B6B);
      case QuizTag.special:
        return const Color(0xFFFFD166);
      case QuizTag.aptitude:
        return const Color(0xFFC8FF57);
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

    return GestureDetector(
      onTap: onTap,
      child: Container(
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
                            result.tag.label,
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
                          '${result.totalParticipants}',
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

              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: isDark
                    ? const Color(0xFF7A8499)
                    : const Color(0xFF9CA3AF),
              ),
            ],
          ),
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
// Result Detail Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────

class _ResultDetailSheet extends StatelessWidget {
  final bool isDark;
  final DemoHistoryResult result;

  const _ResultDetailSheet({required this.isDark, required this.result});

  Color get _rankColor {
    if (result.rank == 1) return const Color(0xFFFFD166);
    if (result.rank <= 3) return const Color(0xFFC8FF57);
    if (result.rank <= 10) return const Color(0xFF6C8EFF);
    return const Color(0xFF7A8499);
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = isDark ? const Color(0xFF161B26) : Colors.white;
    final rankColor = _rankColor;

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFFFFFFFF).withOpacity(0.12)
                    : const Color(0xFF000000).withOpacity(0.1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          const SizedBox(height: 24),

          Text(
            result.title,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF0C0E14),
            ),
          ),

          const SizedBox(height: 4),

          Text(
            result.date,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
            ),
          ),

          const SizedBox(height: 24),

          // Stats grid
          Row(
            children: [
              _DetailStat(
                isDark: isDark,
                label: 'Your Rank',
                value: '#${result.rank}',
                color: rankColor,
              ),
              const SizedBox(width: 12),
              _DetailStat(
                isDark: isDark,
                label: 'Total Players',
                value: '${result.totalParticipants}',
                color: const Color(0xFF6C8EFF),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Row(
            children: [
              _DetailStat(
                isDark: isDark,
                label: 'Score',
                value: '${result.score} pts',
                color: const Color(0xFFC8FF57),
              ),
              const SizedBox(width: 12),
              _DetailStat(
                isDark: isDark,
                label: 'Questions',
                value: '${result.totalQuestions}',
                color: const Color(0xFFFFD166),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Note about limited history
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark
                  ? const Color(0xFFFFFFFF).withOpacity(0.03)
                  : const Color(0xFF000000).withOpacity(0.03),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.lock_outline_rounded,
                  size: 16,
                  color: isDark
                      ? const Color(0xFF7A8499)
                      : const Color(0xFF9CA3AF),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Detailed question-by-question review is not available for students. Contact your admin for full analytics.',
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.5,
                      color: isDark
                          ? const Color(0xFF7A8499)
                          : const Color(0xFF9CA3AF),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailStat extends StatelessWidget {
  final bool isDark;
  final String label;
  final String value;
  final Color color;

  const _DetailStat({
    required this.isDark,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.07),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? const Color(0xFF7A8499)
                    : const Color(0xFF9CA3AF),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Label
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
