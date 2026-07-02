import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../config/app_config.dart';
import '../../quiz/data/quiz_dummy_data.dart';
import '../../quiz/data/quiz_models.dart';
import '../../quiz/providers/quiz_providers.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Countdown provider — ticks every second so quiz card timers update live
// ─────────────────────────────────────────────────────────────────────────────

final _nowProvider = StreamProvider<DateTime>((ref) {
  return Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now());
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final user = ref.watch(authProvider).user;

    // Keep the clock ticking
    ref.watch(_nowProvider);

    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good Morning'
        : hour < 17
            ? 'Good Afternoon'
            : 'Good Evening';
    final emoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';

    // Stats derived from history
    final results = demoHistoryResults;
    final quizzesDone = results.length;
    final bestRank = results.isEmpty
        ? '-'
        : '#${results.map((r) => r.rank).reduce((a, b) => a < b ? a : b)}';

    return Scaffold(
      backgroundColor:
          isDark ? AppConfig.backgroundDarkStart : AppConfig.surfaceColor,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppConfig.backgroundGradient(isDark),
          ),
        ),
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myQuizzesProvider);
              await ref.read(myQuizzesProvider.future);
            },
            color: AppConfig.primaryColor,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 700),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Header ─────────────────────────────────────────
                      _Header(
                        isDark: isDark,
                        greeting: '$greeting $emoji',
                        userName: user?.fullName ?? 'Student',
                      ),

                      const SizedBox(height: 24),

                      // ── Stats row ──────────────────────────────────────
                      _StatsRow(
                        isDark: isDark,
                        quizzesDone: quizzesDone,
                        bestRank: bestRank,
                        streak: '${quizzesDone > 4 ? 7 : quizzesDone}d 🔥',
                      ),

                      const SizedBox(height: 32),

                      // ── Upcoming quizzes ───────────────────────────────
                      Builder(builder: (context) {
                        final upcomingAsync = ref.watch(myQuizzesProvider);

                        return upcomingAsync.when(
                          loading: () => Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _SectionHeader(
                                label: 'UPCOMING QUIZZES',
                                isDark: isDark,
                              ),
                              const SizedBox(height: 14),
                              const Center(
                                child: Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: CircularProgressIndicator(
                                    color: AppConfig.primaryColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          error: (err, __) => Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _SectionHeader(
                                label: 'UPCOMING QUIZZES',
                                isDark: isDark,
                              ),
                              const SizedBox(height: 14),
                              _EmptyState(
                                isDark: isDark,
                                icon: Icons.wifi_off_rounded,
                                message:
                                    'Could not load quizzes.\nPull down to try again.',
                              ),
                            ],
                          ),
                          data: (quizzes) => Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _SectionHeader(
                                label: 'UPCOMING QUIZZES',
                                isDark: isDark,
                                trailing: quizzes.isEmpty
                                    ? null
                                    : Text(
                                        '${quizzes.length} scheduled',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: isDark
                                              ? const Color(0xFF7A8499)
                                              : const Color(0xFF9CA3AF),
                                        ),
                                      ),
                              ),
                              const SizedBox(height: 14),
                              if (quizzes.isEmpty)
                                _EmptyState(
                                  isDark: isDark,
                                  icon: Icons.event_note_outlined,
                                  message:
                                      'No quizzes scheduled right now.\nCheck back later!',
                                )
                              else
                                ...quizzes.map((quiz) => Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 12),
                                      child: _UpcomingQuizCard(
                                        quiz: quiz,
                                        isDark: isDark,
                                        onTap: () => context
                                            .push('/quiz/${quiz.id}/waiting'),
                                      ),
                                    )),
                            ],
                          ),
                        );
                      }),

                      const SizedBox(height: 32),

                      // ── Recent activity ────────────────────────────────
                      _SectionHeader(
                        label: 'RECENT ACTIVITY',
                        isDark: isDark,
                        trailing: GestureDetector(
                          onTap: () {
                            // Switch to history tab (index 1)
                            // The AppShell handles this via tab switching
                          },
                          child: Text(
                            'View all',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppConfig.primaryColor,
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 14),

                      if (demoHistoryResults.isEmpty)
                        _EmptyState(
                          isDark: isDark,
                          icon: Icons.bar_chart_outlined,
                          message: 'No quiz history yet.\nPlay your first quiz!',
                        )
                      else ...[
                        _LastResultCard(
                          isDark: isDark,
                          result: demoHistoryResults.first,
                        ),
                        const SizedBox(height: 10),
                        // Show 1 more result as a mini card
                        if (demoHistoryResults.length > 1)
                          _MiniHistoryCard(
                            isDark: isDark,
                            result: demoHistoryResults[1],
                          ),
                      ],

                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final bool isDark;
  final String greeting;
  final String userName;

  const _Header({
    required this.isDark,
    required this.greeting,
    required this.userName,
  });

  @override
  Widget build(BuildContext context) {
    final initial =
        userName.isNotEmpty ? userName[0].toUpperCase() : 'S';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                greeting,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                  color: isDark ? Colors.white : const Color(0xFF0C0E14),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                userName,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: isDark
                      ? const Color(0xFF7A8499)
                      : const Color(0xFF6B7280),
                ),
              ),
            ],
          ),
        ),
        // Avatar
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFFC8FF57), Color(0xFF8AE600)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFC8FF57).withOpacity(0.3),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Center(
            child: Text(
              initial,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0C0E14),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Row
// ─────────────────────────────────────────────────────────────────────────────

class _StatsRow extends StatelessWidget {
  final bool isDark;
  final int quizzesDone;
  final String bestRank;
  final String streak;

  const _StatsRow({
    required this.isDark,
    required this.quizzesDone,
    required this.bestRank,
    required this.streak,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatChip(
            isDark: isDark,
            label: 'Played',
            value: '$quizzesDone',
            icon: Icons.check_circle_outline_rounded,
            iconColor: const Color(0xFFC8FF57),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatChip(
            isDark: isDark,
            label: 'Best Rank',
            value: bestRank,
            icon: Icons.emoji_events_outlined,
            iconColor: const Color(0xFFFFD166),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatChip(
            isDark: isDark,
            label: 'Streak',
            value: streak,
            icon: Icons.local_fire_department_outlined,
            iconColor: const Color(0xFFFF6B6B),
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final bool isDark;
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;

  const _StatChip({
    required this.isDark,
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161B26) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF0C0E14),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: isDark
                  ? const Color(0xFF7A8499)
                  : const Color(0xFF6B7280),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  final bool isDark;
  final Widget? trailing;

  const _SectionHeader({
    required this.label,
    required this.isDark,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
            color:
                isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
          ),
        ),
        if (trailing != null) ...[
          const Spacer(),
          trailing!,
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming Quiz Card (tappable, with live countdown)
// ─────────────────────────────────────────────────────────────────────────────

class _UpcomingQuizCard extends StatefulWidget {
  final MyQuizSummary quiz;
  final bool isDark;
  final VoidCallback onTap;

  const _UpcomingQuizCard({
    required this.quiz,
    required this.isDark,
    required this.onTap,
  });

  @override
  State<_UpcomingQuizCard> createState() => _UpcomingQuizCardState();
}

class _UpcomingQuizCardState extends State<_UpcomingQuizCard> {
  late Duration _remaining;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remaining = _diff(widget.quiz.scheduledStartTime);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _remaining = _diff(widget.quiz.scheduledStartTime);
      });
    });
  }

  Duration _diff(DateTime scheduledAt) {
    final diff = scheduledAt.difference(DateTime.now());
    return diff.isNegative ? Duration.zero : diff;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatCountdown(Duration d) {
    if (d.inSeconds <= 0) return 'Starting...';
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (h > 0) return '${h}h ${m}m';
    if (d.inMinutes > 0) return '${d.inMinutes}m ${s}s';
    return '${d.inSeconds}s';
  }

  String _formatScheduledAt(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final minute = dt.minute.toString().padLeft(2, '0');
    final period = dt.hour >= 12 ? 'PM' : 'AM';
    return '${months[dt.month - 1]} ${dt.day} • $hour12:$minute $period';
  }

  Color _statusColor(bool isLive) =>
      isLive ? const Color(0xFFFF6B6B) : const Color(0xFF6C8EFF);

  String _statusLabel(bool isLive) => isLive ? 'LIVE NOW' : 'SCHEDULED';

  bool get _isImminent => _remaining.inMinutes < 15;
  bool get _isStarting => widget.quiz.isLive || _remaining.inSeconds <= 0;

  @override
  Widget build(BuildContext context) {
    final isLive = widget.quiz.isLive;
    final accent = _statusColor(isLive);
    final urgencyColor =
        _isStarting || _isImminent ? const Color(0xFFFF6B6B) : accent;

    return GestureDetector(
      onTap: widget.onTap,
      child: Container(
        decoration: BoxDecoration(
          color: widget.isDark
              ? Color.alphaBlend(accent.withOpacity(0.05), const Color(0xFF161B26))
              : Color.alphaBlend(accent.withOpacity(0.04), Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: accent.withOpacity(widget.isDark ? 0.12 : 0.18),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Tag pill
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: accent.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _statusLabel(isLive),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: accent,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                  const Spacer(),
                  // Countdown chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: urgencyColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: _isImminent
                          ? Border.all(
                              color: urgencyColor.withOpacity(0.3))
                          : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _isImminent
                              ? Icons.flash_on_rounded
                              : Icons.schedule_rounded,
                          size: 13,
                          color: urgencyColor,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _formatCountdown(_remaining),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: urgencyColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              Text(
                widget.quiz.title,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                  color: widget.isDark
                      ? Colors.white
                      : const Color(0xFF0C0E14),
                ),
              ),

              const SizedBox(height: 4),

              Text(
                _formatScheduledAt(widget.quiz.scheduledStartTime),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.4,
                  color: widget.isDark
                      ? const Color(0xFF7A8499)
                      : const Color(0xFF6B7280),
                ),
              ),

              const SizedBox(height: 12),

              Row(
                children: [
                  Icon(
                    Icons.help_outline_rounded,
                    size: 14,
                    color: widget.isDark
                        ? const Color(0xFF7A8499)
                        : const Color(0xFF9CA3AF),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    '${widget.quiz.questionCount} Questions',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: widget.isDark
                          ? const Color(0xFF7A8499)
                          : const Color(0xFF6B7280),
                    ),
                  ),
                  const Spacer(),
                  // Enter lobby CTA
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _isStarting ? 'Join Now →' : 'Enter Lobby →',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0C0E14),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Last Result Card
// ─────────────────────────────────────────────────────────────────────────────

class _LastResultCard extends StatelessWidget {
  final bool isDark;
  final DemoHistoryResult result;

  const _LastResultCard({required this.isDark, required this.result});

  String get _rankEmoji {
    if (result.rank == 1) return '🥇';
    if (result.rank == 2) return '🥈';
    if (result.rank == 3) return '🥉';
    return '🏆';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1C2440), Color(0xFF141A30)],
        ),
        border: Border.all(
          color: const Color(0xFFFFD166).withOpacity(0.2),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD166).withOpacity(0.06),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'LAST QUIZ RESULT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.4,
                      color: const Color(0xFFFFD166).withOpacity(0.7),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    result.title,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF7A8499),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Rank #${result.rank}',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1,
                      color: Color(0xFFFFD166),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'out of ${result.totalParticipants} participants · ${result.date}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF7A8499),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFFFD166).withOpacity(0.1),
                border: Border.all(
                    color: const Color(0xFFFFD166).withOpacity(0.2),
                    width: 1.5),
              ),
              child: Center(
                child: Text(_rankEmoji,
                    style: const TextStyle(fontSize: 28)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini History Card
// ─────────────────────────────────────────────────────────────────────────────

class _MiniHistoryCard extends StatelessWidget {
  final bool isDark;
  final DemoHistoryResult result;

  const _MiniHistoryCard({required this.isDark, required this.result});

  Color _rankColor(int rank) {
    if (rank == 1) return const Color(0xFFFFD166);
    if (rank <= 3) return const Color(0xFFC8FF57);
    if (rank <= 10) return const Color(0xFF6C8EFF);
    return const Color(0xFF7A8499);
  }

  String _rankLabel(int rank) {
    if (rank == 1) return '🥇';
    if (rank == 2) return '🥈';
    if (rank == 3) return '🥉';
    return '#$rank';
  }

  @override
  Widget build(BuildContext context) {
    final rankColor = _rankColor(result.rank);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161B26) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: rankColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                _rankLabel(result.rank),
                style: TextStyle(
                  fontSize: result.rank <= 3 ? 20 : 15,
                  fontWeight: FontWeight.w800,
                  color: rankColor,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  result.title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF0C0E14),
                  ),
                ),
                Text(
                  result.date,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? const Color(0xFF7A8499)
                        : const Color(0xFF9CA3AF),
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${result.score} pts',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: rankColor,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final String message;

  const _EmptyState({
    required this.isDark,
    required this.icon,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161B26) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06),
        ),
      ),
      child: Column(
        children: [
          Icon(icon,
              size: 36,
              color: isDark
                  ? const Color(0xFF7A8499)
                  : const Color(0xFF9CA3AF)),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: isDark
                  ? const Color(0xFF7A8499)
                  : const Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }
}
