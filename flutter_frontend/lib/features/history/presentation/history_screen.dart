import 'package:flutter/material.dart';

import '../../../config/app_config.dart';
import '../../quiz/data/quiz_models.dart';
import '../../quiz/data/quiz_repository.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

const int _pageSize = 10;

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final QuizRepository _repository = QuizRepository();

  final List<HistoryResult> _results = [];
  int _page = 0;
  int _total = 0;
  bool _hasMore = true;
  bool _isLoadingFirstPage = true;
  bool _isLoadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPage();
  }

  Future<void> _loadPage() async {
    final isFirstPage = _page == 0;
    setState(() {
      if (isFirstPage) {
        _isLoadingFirstPage = true;
      } else {
        _isLoadingMore = true;
      }
      _error = null;
    });

    try {
      final nextPage = _page + 1;
      final result = await _repository.getMyHistory(
        page: nextPage,
        limit: _pageSize,
      );

      if (!mounted) return;
      setState(() {
        _results.addAll(result.results);
        _page = nextPage;
        _total = result.pagination.total;
        _hasMore = result.pagination.hasMore;
        _isLoadingFirstPage = false;
        _isLoadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load your quiz history. Please try again.';
        _isLoadingFirstPage = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _results.clear();
      _page = 0;
      _total = 0;
      _hasMore = true;
    });
    await _loadPage();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

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
                      _isLoadingFirstPage
                          ? 'Loading...'
                          : '$_total quiz${_total == 1 ? '' : 'zes'} played',
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

              // ── Section label ──────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _SectionLabel(label: 'ALL RESULTS', isDark: isDark),
              ),

              const SizedBox(height: 14),

              // ── Results list ───────────────────────────────────────────
              Expanded(child: _buildBody(isDark)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(bool isDark) {
    if (_isLoadingFirstPage) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _results.isEmpty) {
      return _ErrorState(isDark: isDark, message: _error!, onRetry: _refresh);
    }

    if (_results.isEmpty) {
      return _EmptyState(isDark: isDark);
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
        itemCount: _results.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          if (i == _results.length) {
            return _LoadMoreFooter(
              isDark: isDark,
              hasMore: _hasMore,
              isLoading: _isLoadingMore,
              error: _results.isNotEmpty ? _error : null,
              onPressed: _loadPage,
            );
          }

          final result = _results[i];
          return _ResultCard(
            isDark: isDark,
            result: result,
            onTap: () => _showDetail(context, isDark, result),
          );
        },
      ),
    );
  }

  void _showDetail(BuildContext context, bool isDark, HistoryResult result) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ResultDetailSheet(isDark: isDark, result: result),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final bool isDark;
  const _EmptyState({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.bar_chart_outlined,
            size: 48,
            color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
          ),
          const SizedBox(height: 16),
          Text(
            'No quiz history yet.\nPlay your first quiz!',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 15,
              height: 1.5,
              color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final bool isDark;
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({
    required this.isDark,
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline_rounded,
            size: 48,
            color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                height: 1.5,
                color: isDark
                    ? const Color(0xFF7A8499)
                    : const Color(0xFF9CA3AF),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Load-more footer
// ─────────────────────────────────────────────────────────────────────────────

class _LoadMoreFooter extends StatelessWidget {
  final bool isDark;
  final bool hasMore;
  final bool isLoading;
  final String? error;
  final VoidCallback onPressed;

  const _LoadMoreFooter({
    required this.isDark,
    required this.hasMore,
    required this.isLoading,
    required this.error,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    if (!hasMore) return const SizedBox.shrink();

    if (isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        children: [
          if (error != null) ...[
            Text(
              error!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? const Color(0xFF7A8499)
                    : const Color(0xFF9CA3AF),
              ),
            ),
            const SizedBox(height: 8),
          ],
          OutlinedButton(
            onPressed: onPressed,
            style: OutlinedButton.styleFrom(
              foregroundColor: isDark ? Colors.white : const Color(0xFF0C0E14),
              side: BorderSide(
                color: isDark
                    ? const Color(0xFFFFFFFF).withOpacity(0.12)
                    : const Color(0xFF000000).withOpacity(0.12),
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            child: const Text(
              'Load more',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Card (list item)
// ─────────────────────────────────────────────────────────────────────────────

class _ResultCard extends StatelessWidget {
  final bool isDark;
  final HistoryResult result;
  final VoidCallback onTap;

  const _ResultCard({
    required this.isDark,
    required this.result,
    required this.onTap,
  });

  Color get _rankColor {
    final rank = result.rank;
    if (rank == null) return const Color(0xFF7A8499);
    if (rank == 1) return const Color(0xFFFFD166);
    if (rank <= 3) return const Color(0xFFC8FF57);
    if (rank <= 10) return const Color(0xFF6C8EFF);
    return const Color(0xFF7A8499);
  }

  String get _rankLabel {
    final rank = result.rank;
    if (rank == null) return '—';
    if (rank == 1) return '🥇';
    if (rank == 2) return '🥈';
    if (rank == 3) return '🥉';
    return '#$rank';
  }

  @override
  Widget build(BuildContext context) {
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
                      fontSize: (result.rank ?? 99) <= 3 ? 22 : 16,
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
                    Text(
                      result.title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        color: isDark ? Colors.white : const Color(0xFF0C0E14),
                      ),
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
                          formatHistoryDate(result.completedAt),
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
                      maxScore: (result.totalQuestions * 100).clamp(1, 1 << 30),
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
  final HistoryResult result;

  const _ResultDetailSheet({required this.isDark, required this.result});

  Color get _rankColor {
    final rank = result.rank;
    if (rank == null) return const Color(0xFF7A8499);
    if (rank == 1) return const Color(0xFFFFD166);
    if (rank <= 3) return const Color(0xFFC8FF57);
    if (rank <= 10) return const Color(0xFF6C8EFF);
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
            formatHistoryDate(result.completedAt),
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
                value: result.rank == null ? '—' : '#${result.rank}',
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
                    'Detailed question-by-question review is not available for students.',
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

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting helper (no intl dependency needed)
// ─────────────────────────────────────────────────────────────────────────────

const List<String> _monthAbbrev = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String formatHistoryDate(DateTime dateTime) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final date = DateTime(dateTime.year, dateTime.month, dateTime.day);
  final diffDays = today.difference(date).inDays;

  final hour = dateTime.hour % 12 == 0 ? 12 : dateTime.hour % 12;
  final minute = dateTime.minute.toString().padLeft(2, '0');
  final period = dateTime.hour >= 12 ? 'PM' : 'AM';
  final time = '$hour:$minute $period';

  if (diffDays == 0) return 'Today, $time';
  if (diffDays == 1) return 'Yesterday, $time';
  return '${dateTime.day} ${_monthAbbrev[dateTime.month - 1]}, $time';
}
