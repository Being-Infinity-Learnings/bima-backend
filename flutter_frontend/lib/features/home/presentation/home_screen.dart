import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../config/app_config.dart';
import '../../../core/navigation/app_shell.dart';
import '../../../core/navigation/route_observer.dart';
import '../../history/presentation/history_screen.dart' show formatHistoryDate;
import '../../quiz/data/quiz_models.dart';
import '../../quiz/providers/quiz_providers.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Countdown provider — ticks every second so quiz card timers update live
// ─────────────────────────────────────────────────────────────────────────────

final _nowProvider = StreamProvider<DateTime>((ref) {
  return Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now());
});

// Home tab index in AppShell's bottom nav.
const int _homeTabIndex = 0;

// History tab index in AppShell's bottom nav.
const int _historyTabIndex = 1;

// Profile tab index in AppShell's bottom nav.
const int _profileTabIndex = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> with RouteAware {
  Timer? _autoRefreshTimer;
  ProviderSubscription<int>? _tabListener;

  // How many upcoming quizzes are currently shown. Starts at one page and
  // grows by one page each time "Show more" is tapped.
  static const int _quizzesPageSize = 5;
  int _visibleQuizCount = _quizzesPageSize;

  // AppShell (and therefore this widget, kept alive inside its
  // IndexedStack) is its own top-level route. Pushing a quiz screen
  // (/quiz/:id/waiting, /lobby, /play, ...) pushes a NEW route on top of
  // it rather than replacing it — AppShell/HomeScreen stay mounted the
  // whole time, just hidden. Without tracking that, a Timer started here
  // would keep firing API calls for as long as the app runs, including
  // the entire time someone is actively attending a quiz.
  bool _isTopRoute = true;

  void _refreshNow() {
    ref.invalidate(myQuizzesProvider);
    ref.invalidate(latestHistoryResultProvider);
    setState(() => _visibleQuizCount = _quizzesPageSize);
  }

  // Start/stop the 10s poll based on current visibility. Only polls while
  // the Home tab is selected AND Home's route is the topmost visible one
  // — i.e. never while another tab is showing, and never while the user
  // is off in the quiz flow.
  void _syncPolling() {
    final isHomeTabSelected =
        ref.read(selectedTabIndexProvider) == _homeTabIndex;
    final shouldPoll = isHomeTabSelected && _isTopRoute;

    if (shouldPoll) {
      _autoRefreshTimer ??= Timer.periodic(const Duration(seconds: 10), (_) {
        if (!mounted) return;
        _refreshNow();
      });
    } else {
      _autoRefreshTimer?.cancel();
      _autoRefreshTimer = null;
    }
  }

  @override
  void initState() {
    super.initState();

    // The Home tab is kept alive inside AppShell's IndexedStack, so
    // switching tabs doesn't dispose/recreate this widget. Watch tab
    // selection ourselves: refresh once the instant the user actually
    // lands back on Home, and start/stop the poll accordingly.
    Future.microtask(() {
      if (!mounted) return;
      _tabListener = ref.listenManual<int>(selectedTabIndexProvider, (
        previous,
        next,
      ) {
        final enteredHome = next == _homeTabIndex && previous != _homeTabIndex;
        _syncPolling();
        if (enteredHome) {
          _refreshNow();
        }
      });
      _syncPolling();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) {
      routeObserver.subscribe(this, route);
    }
  }

  // A quiz screen (or anything else) was pushed on top of Home's route —
  // Home is now hidden. Stop polling.
  @override
  void didPushNext() {
    _isTopRoute = false;
    _syncPolling();
  }

  // The screen that was covering Home got popped — e.g. the user finished
  // or left a quiz and is back looking at Home. Refresh immediately and
  // resume polling.
  @override
  void didPopNext() {
    _isTopRoute = true;
    _syncPolling();
    _refreshNow();
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _tabListener?.close();
    routeObserver.unsubscribe(this);
    super.dispose();
  }

  void _goToHistoryTab(WidgetRef ref) {
    ref.read(selectedTabIndexProvider.notifier).state = _historyTabIndex;
  }

  void _goToProfileTab(WidgetRef ref) {
    ref.read(selectedTabIndexProvider.notifier).state = _profileTabIndex;
  }

  @override
  Widget build(BuildContext context) {
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
    final greetingIcon = hour < 12
        ? Icons.wb_twilight_rounded
        : hour < 17
        ? Icons.wb_sunny_rounded
        : Icons.nightlight_round;

    return Scaffold(
      backgroundColor: isDark
          ? AppConfig.backgroundDarkStart
          : AppConfig.surfaceColor,
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
              ref.invalidate(latestHistoryResultProvider);
              setState(() => _visibleQuizCount = _quizzesPageSize);
              await ref.read(myQuizzesProvider.future);
            },
            color: AppConfig.primaryColor,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 700),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Header ─────────────────────────────────────────
                      _Header(
                        isDark: isDark,
                        greeting: greeting,
                        greetingIcon: greetingIcon,
                        userName: user?.fullName ?? 'Student',
                        onAvatarTap: () => _goToProfileTab(ref),
                      ),

                      const SizedBox(height: 28),

                      // ── Upcoming quizzes ───────────────────────────────
                      Builder(
                        builder: (context) {
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
                                                ? AppConfig.mutedTextColor(
                                                    isDark,
                                                  )
                                                : AppConfig.mutedTextLight,
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
                                else ...[
                                  ...quizzes
                                      .take(_visibleQuizCount)
                                      .map(
                                        (quiz) => Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: 12,
                                          ),
                                          child: _UpcomingQuizCard(
                                            quiz: quiz,
                                            isDark: isDark,
                                            onTap: () => context.push(
                                              '/quiz/${quiz.id}/waiting',
                                            ),
                                          ),
                                        ),
                                      ),
                                  if (_visibleQuizCount < quizzes.length)
                                    _ShowMoreButton(
                                      isDark: isDark,
                                      remaining:
                                          quizzes.length - _visibleQuizCount,
                                      pageSize: _quizzesPageSize,
                                      onTap: () => setState(
                                        () => _visibleQuizCount +=
                                            _quizzesPageSize,
                                      ),
                                    ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),

                      const SizedBox(height: 32),

                      // ── Recent activity ────────────────────────────────
                      _SectionHeader(
                        label: 'RECENT ACTIVITY',
                        isDark: isDark,
                        trailing: GestureDetector(
                          onTap: () => _goToHistoryTab(ref),
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

                      Builder(
                        builder: (context) {
                          final latestAsync = ref.watch(
                            latestHistoryResultProvider,
                          );

                          return latestAsync.when(
                            loading: () => const Center(
                              child: Padding(
                                padding: EdgeInsets.symmetric(vertical: 12),
                                child: CircularProgressIndicator(
                                  color: AppConfig.primaryColor,
                                ),
                              ),
                            ),
                            error: (err, __) => _EmptyState(
                              isDark: isDark,
                              icon: Icons.wifi_off_rounded,
                              message:
                                  'Could not load recent activity.\nPull down to try again.',
                            ),
                            data: (result) => result == null
                                ? _EmptyState(
                                    isDark: isDark,
                                    icon: Icons.bar_chart_outlined,
                                    message:
                                        'No quiz history yet.\nPlay your first quiz!',
                                  )
                                : _LastResultCard(
                                    isDark: isDark,
                                    result: result,
                                    onTap: () => _goToHistoryTab(ref),
                                  ),
                          );
                        },
                      ),

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
  final IconData greetingIcon;
  final String userName;
  final VoidCallback onAvatarTap;

  const _Header({
    required this.isDark,
    required this.greeting,
    required this.greetingIcon,
    required this.userName,
    required this.onAvatarTap,
  });

  @override
  Widget build(BuildContext context) {
    final initial = userName.isNotEmpty ? userName[0].toUpperCase() : 'S';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    greeting,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                      color: AppConfig.bodyTextColor(isDark),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    greetingIcon,
                    size: 22,
                    color: isDark
                        ? AppConfig.accentLime
                        : AppConfig.bodyTextLight,
                  ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                userName,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: AppConfig.mutedTextColor(isDark),
                ),
              ),
            ],
          ),
        ),
        // Avatar — tap to jump to the Profile tab.
        GestureDetector(
          onTap: onAvatarTap,
          child: Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [AppConfig.accentLime, AppConfig.accentLimeDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppConfig.accentLime.withOpacity(0.3),
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
                  color: AppConfig.bodyTextLight,
                ),
              ),
            ),
          ),
        ),
      ],
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
            color: AppConfig.mutedTextColor(isDark),
          ),
        ),
        if (trailing != null) ...[const Spacer(), trailing!],
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

/// Which of the three states this card should render as:
///  • [waiting]     – not live yet, counting down to [scheduledStartTime].
///  • [lobby]        – host opened the lobby, counting down to the lobby's
///                     [phaseEndsAt] (or falling back to the scheduled time
///                     if that isn't known yet).
///  • [inProgress]   – quiz has moved past the lobby (QUESTION / LEADERBOARD
///                     / RESULTS). No timer makes sense here.
enum _CardPhase { waiting, lobby, inProgress }

class _UpcomingQuizCardState extends State<_UpcomingQuizCard> {
  late Duration _remaining;
  Timer? _timer;

  _CardPhase get _phase {
    final quiz = widget.quiz;
    if (quiz.isInProgress) return _CardPhase.inProgress;
    if (quiz.isInLobby) return _CardPhase.lobby;
    return _CardPhase.waiting;
  }

  /// The moment we're counting down to, or null if no countdown applies.
  DateTime? get _countdownTarget {
    switch (_phase) {
      case _CardPhase.waiting:
        return widget.quiz.scheduledStartTime;
      case _CardPhase.lobby:
        return widget.quiz.runtime?.phaseEndsAt ??
            widget.quiz.scheduledStartTime;
      case _CardPhase.inProgress:
        return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _remaining = _diff(_countdownTarget);
    _startTimerIfNeeded();
  }

  @override
  void didUpdateWidget(covariant _UpcomingQuizCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Runtime phase may have changed (e.g. lobby -> question) since the
    // last poll, so re-evaluate whether we still need a ticking timer.
    _remaining = _diff(_countdownTarget);
    _startTimerIfNeeded();
  }

  void _startTimerIfNeeded() {
    _timer?.cancel();
    if (_countdownTarget == null) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _remaining = _diff(_countdownTarget);
      });
    });
  }

  Duration _diff(DateTime? target) {
    if (target == null) return Duration.zero;
    final diff = target.difference(DateTime.now());
    return diff.isNegative ? Duration.zero : diff;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatCountdown(Duration d) {
    if (_phase == _CardPhase.inProgress) return 'Ongoing';
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
    final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final minute = dt.minute.toString().padLeft(2, '0');
    final period = dt.hour >= 12 ? 'PM' : 'AM';
    return '${months[dt.month - 1]} ${dt.day} • $hour12:$minute $period';
  }

  Color _statusColor(_CardPhase phase) {
    switch (phase) {
      case _CardPhase.inProgress:
        return AppConfig.accentCoral; // red — live, no waiting
      case _CardPhase.lobby:
        return AppConfig.accentAmber; // amber — lobby open, timer running
      case _CardPhase.waiting:
        return AppConfig.accentBlue; // blue — just scheduled
    }
  }

  String _statusLabel(_CardPhase phase) {
    switch (phase) {
      case _CardPhase.inProgress:
        return 'LIVE NOW';
      case _CardPhase.lobby:
        return 'LOBBY OPEN';
      case _CardPhase.waiting:
        return 'SCHEDULED';
    }
  }

  bool get _isImminent =>
      _phase != _CardPhase.inProgress && _remaining.inMinutes < 15;

  @override
  Widget build(BuildContext context) {
    final phase = _phase;
    final accent = _statusColor(phase);
    final urgencyColor = phase != _CardPhase.waiting || _isImminent
        ? AppConfig.accentCoral
        : accent;

    return GestureDetector(
      onTap: widget.onTap,
      child: Container(
        decoration: BoxDecoration(
          color: widget.isDark
              ? Color.alphaBlend(
                  accent.withOpacity(0.05),
                  AppConfig.darkCardColor,
                )
              : Color.alphaBlend(
                  accent.withOpacity(0.04),
                  AppConfig.whiteColor,
                ),
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
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: accent.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _statusLabel(phase),
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
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: urgencyColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: _isImminent
                          ? Border.all(color: urgencyColor.withOpacity(0.3))
                          : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          phase == _CardPhase.inProgress
                              ? Icons.podcasts_rounded
                              : (_isImminent
                                    ? Icons.flash_on_rounded
                                    : Icons.schedule_rounded),
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
                  color: AppConfig.bodyTextColor(widget.isDark),
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
                  color: AppConfig.mutedTextColor(widget.isDark),
                ),
              ),

              const SizedBox(height: 12),

              Row(
                children: [
                  Icon(
                    Icons.help_outline_rounded,
                    size: 14,
                    color: widget.isDark
                        ? AppConfig.mutedTextColor(widget.isDark)
                        : AppConfig.mutedTextLight,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    '${widget.quiz.questionCount} Questions',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: widget.isDark
                          ? AppConfig.mutedTextColor(widget.isDark)
                          : AppConfig.mutedTextSecondary,
                    ),
                  ),
                  const Spacer(),
                  // Enter lobby CTA
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      phase == _CardPhase.inProgress
                          ? 'Join Now →'
                          : 'Enter Lobby →',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: AppConfig.bodyTextLight,
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
// Last Result Card — the single most recently played (COMPLETED) quiz.
// Tapping it takes the student to the History tab.
// ─────────────────────────────────────────────────────────────────────────────

class _LastResultCard extends StatelessWidget {
  final bool isDark;
  final HistoryResult result;
  final VoidCallback onTap;

  const _LastResultCard({
    required this.isDark,
    required this.result,
    required this.onTap,
  });

  String get _rankEmoji {
    final rank = result.rank;
    if (rank == 1) return '🥇';
    if (rank == 2) return '🥈';
    if (rank == 3) return '🥉';
    return '🏆';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppConfig.lastResultCardGradient(isDark),
          ),
          border: Border.all(color: AppConfig.accentGold.withOpacity(0.2)),
          boxShadow: [
            BoxShadow(
              color: AppConfig.accentGold.withOpacity(0.06),
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
                        color: AppConfig.lastResultAccentColor(
                          isDark,
                        ).withOpacity(0.85),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      result.title,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppConfig.lastResultMutedText(isDark),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      result.rank == null ? '—' : 'Rank #${result.rank}',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1,
                        color: AppConfig.lastResultAccentColor(isDark),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'out of ${result.totalParticipants} participants · '
                      '${formatHistoryDate(result.completedAt)}',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppConfig.lastResultMutedText(isDark),
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
                  color: AppConfig.accentGold.withOpacity(0.1),
                  border: Border.all(
                    color: AppConfig.accentGold.withOpacity(0.2),
                    width: 1.5,
                  ),
                ),
                child: Center(
                  child: Text(_rankEmoji, style: const TextStyle(fontSize: 28)),
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
// Show More — reveals the next page of upcoming quizzes.
// ─────────────────────────────────────────────────────────────────────────────

class _ShowMoreButton extends StatelessWidget {
  final bool isDark;
  final int remaining;
  final int pageSize;
  final VoidCallback onTap;

  const _ShowMoreButton({
    required this.isDark,
    required this.remaining,
    required this.pageSize,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final accent = AppConfig.accentOnSurface(isDark, AppConfig.primaryColor);
    final nextBatch = remaining < pageSize ? remaining : pageSize;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppConfig.cardColor(isDark),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppConfig.subtleOverlay(isDark)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Show $nextBatch more',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: accent,
              ),
            ),
            const SizedBox(width: 6),
            Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: accent),
          ],
        ),
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
        color: AppConfig.cardColor(isDark),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? AppConfig.whiteColor.withOpacity(0.06)
              : AppConfig.blackColor.withOpacity(0.06),
        ),
      ),
      child: Column(
        children: [
          Icon(icon, size: 36, color: AppConfig.mutedTextColor(isDark)),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: AppConfig.mutedTextColor(isDark),
            ),
          ),
        ],
      ),
    );
  }
}
