import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/quiz_models.dart';
import '../providers/quiz_providers.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../config/app_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
//
// Only ever reached between questions (the backend skips straight to RESULTS
// after the final question), so "isLast" is always false here in practice —
// kept as a flag anyway in case that ever changes.

class QuizLeaderboardScreen extends ConsumerStatefulWidget {
  final String quizId;
  const QuizLeaderboardScreen({super.key, required this.quizId});

  @override
  ConsumerState<QuizLeaderboardScreen> createState() =>
      _QuizLeaderboardScreenState();
}

class _QuizLeaderboardScreenState extends ConsumerState<QuizLeaderboardScreen>
    with TickerProviderStateMixin {
  late AnimationController _entranceCtrl;
  List<Animation<double>> _rowAnims = [];
  late AnimationController _countdownRingCtrl;

  Timer? _localTicker;
  int _secondsLeft = 0;
  int _totalSeconds = 0;
  bool _clockInitialized = false;

  Timer? _leaderboardTimer;
  int? _leaderboardEndsAtMs;
  String? _leaderboardSyncKey;
  bool _leaderboardFinished = false;

  /// Server-clock-corrected "now" — see [QuizRuntimeState.estimatedServerNow].
  /// Always use this (not raw `DateTime.now()`) when comparing against
  /// `phaseEndsAt`, so a device with a skewed system clock still counts
  /// down in lockstep with when the server actually advances the phase.
  DateTime _serverNow() => ref
      .read(quizRuntimeControllerProvider(widget.quizId))
      .estimatedServerNow();

  @override
  void initState() {
    super.initState();
    _entranceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _countdownRingCtrl = AnimationController(vsync: this);
  }

  @override
  void dispose() {
    _localTicker?.cancel();
    _entranceCtrl.dispose();
    _countdownRingCtrl.dispose();
    _leaderboardTimer?.cancel();
    super.dispose();
  }

  /// (Re)starts the local countdown from the server's authoritative
  /// `phaseEndsAt`. Keyed off `phaseEndsAt` itself (not a one-shot flag) so
  /// that a reconnect mid-leaderboard — which re-delivers a fresh
  /// `runtimeUpdated` with a recomputed `remainingTime` — correctly resyncs
  /// the clock instead of quietly keeping whatever the client's ticker
  /// happened to have counted down to locally.
  void _initClock(DateTime? phaseEndsAt, int? remainingMs) {
    final syncKey = phaseEndsAt?.toIso8601String() ?? 'no-deadline';
    if (_clockInitialized && _leaderboardSyncKey == syncKey) return;
    _clockInitialized = true;
    _leaderboardSyncKey = syncKey;

    final leftMs =
        phaseEndsAt?.difference(_serverNow()).inMilliseconds ??
        remainingMs ??
        5000;
    final total = (leftMs / 1000).ceil();
    _totalSeconds = total > 0 ? total : 1;
    _secondsLeft = leftMs > 0 ? _totalSeconds : 0;

    _countdownRingCtrl.duration = Duration(seconds: _totalSeconds);
    _countdownRingCtrl
      ..reset()
      ..forward();

    _localTicker?.cancel();
    _localTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final msLeft =
          phaseEndsAt?.difference(_serverNow()).inMilliseconds ??
          (_secondsLeft - 1) * 1000;
      final left = (msLeft / 1000).ceil().clamp(0, _totalSeconds);
      if (left <= 0) {
        _localTicker?.cancel();
        if (mounted) setState(() => _secondsLeft = 0);
      } else {
        setState(() => _secondsLeft = left);
      }
    });
  }

  void _buildRowAnimsIfNeeded(int count) {
    if (_rowAnims.length == count) return;
    _entranceCtrl.duration = Duration(milliseconds: 300 + count * 55);
    _rowAnims = List.generate(count, (i) {
      final start = count == 0 ? 0.0 : (i / count) * 0.65;
      final end = count == 0 ? 1.0 : ((i + 1) / count) * 0.65 + 0.35;
      return Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(
          parent: _entranceCtrl,
          curve: Interval(
            start,
            end.clamp(0.0, 1.0),
            curve: Curves.easeOutCubic,
          ),
        ),
      );
    });
    _entranceCtrl.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final quizState = ref.watch(quizRuntimeControllerProvider(widget.quizId));
    final myId = ref.watch(authProvider).user?.id;

    if (quizState.connectionStatus != SocketConnectionStatus.connected) {
      return Scaffold(
        backgroundColor: AppConfig.scaffoldColor(isDark),
        body: const Center(
          child: CircularProgressIndicator(color: AppConfig.primaryColor),
        ),
      );
    }

    _initClock(
      quizState.runtime?.phaseEndsAt,
      quizState.runtime?.remainingTimeMs,
    );

    final leaderboard = List<LeaderboardEntry>.from(quizState.leaderboard)
      ..sort((a, b) => a.rank.compareTo(b.rank));
    _buildRowAnimsIfNeeded(leaderboard.length);

    final result = quizState.myQuestionResult;
    final wasCorrect = result?.correct ?? false;
    final didNotAnswer = quizState.selectedOptionId == null;
    const isLast = false;

    // `leaderboard` here is the top-10 slice the server sends for display,
    // so its length is capped at 10 even when more people have joined.
    // `result?.rank`, on the other hand, is computed against every
    // registered participant and isn't capped — so on its own
    // `leaderboard.length` can be smaller than the rank (e.g. "#11 of 10").
    // Fold in `peakParticipantCount` (same approximation the results
    // screen uses) and the rank itself so the total shown can never be
    // less than the rank it's paired with.
    final totalParticipants = math.max(
      math.max(quizState.peakParticipantCount, leaderboard.length),
      result?.rank ?? 0,
    );

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _TopBar(
              isLast: isLast,
              secondsLeft: _secondsLeft,
              totalSeconds: _totalSeconds,
              countdownCtrl: _countdownRingCtrl,
              isDark: isDark,
            ),

            const SizedBox(height: 12),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _AnswerResultBanner(
                wasCorrect: wasCorrect,
                didNotAnswer: didNotAnswer,
                score: result?.score ?? 0,
                isDark: isDark,
              ),
            ),

            const SizedBox(height: 14),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _YourRankCallout(
                rank: result?.rank,
                total: totalParticipants,
                isDark: isDark,
              ),
            ),

            const SizedBox(height: 14),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'LIVE STANDINGS',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: AppConfig.mutedTextColor(isDark),
                ),
              ),
            ),

            const SizedBox(height: 10),

            Expanded(
              child: leaderboard.isEmpty
                  ? Center(
                      child: Text(
                        'Waiting for scores…',
                        style: TextStyle(
                          color: AppConfig.mutedTextColor(isDark),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                      itemCount: leaderboard.length,
                      itemBuilder: (_, i) {
                        final entry = leaderboard[i];
                        final isYou = myId != null && entry.userId == myId;
                        final anim = i < _rowAnims.length
                            ? _rowAnims[i]
                            : const AlwaysStoppedAnimation(1.0);
                        return AnimatedBuilder(
                          animation: anim,
                          builder: (_, child) => Opacity(
                            opacity: anim.value,
                            child: Transform.translate(
                              offset: Offset(0, 18 * (1 - anim.value)),
                              child: child,
                            ),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _LeaderboardRow(
                              entry: entry,
                              isYou: isYou,
                              isDark: isDark,
                            ),
                          ),
                        );
                      },
                    ),
            ),

            _AutoAdvanceHint(
              isLast: isLast,
              secondsLeft: _secondsLeft,
              isDark: isDark,
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  final bool isLast;
  final int secondsLeft;
  final int totalSeconds;
  final AnimationController countdownCtrl;
  final bool isDark;

  const _TopBar({
    required this.isLast,
    required this.secondsLeft,
    required this.totalSeconds,
    required this.countdownCtrl,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'LEADERBOARD',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: AppConfig.mutedTextColor(isDark),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                isLast ? 'Final standings' : 'Live standings',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: AppConfig.bodyTextColor(isDark),
                ),
              ),
            ],
          ),
          const Spacer(),
          AnimatedBuilder(
            animation: countdownCtrl,
            builder: (_, __) {
              final progress = (1.0 - countdownCtrl.value).clamp(0.0, 1.0);
              return Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 52,
                    height: 52,
                    child: CircularProgressIndicator(
                      value: progress,
                      strokeWidth: 3.5,
                      backgroundColor: AppConfig.subtleOverlay(isDark),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        AppConfig.primaryColor,
                      ),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$secondsLeft',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppConfig.primaryColor,
                        ),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _AnswerResultBanner extends StatelessWidget {
  final bool wasCorrect;
  final bool didNotAnswer;
  final int score;
  final bool isDark;

  const _AnswerResultBanner({
    required this.wasCorrect,
    required this.didNotAnswer,
    required this.score,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final Color color;
    final IconData icon;
    final String headline;
    final String sub;

    if (didNotAnswer) {
      color = AppConfig.mutedTextColor(isDark);
      icon = Icons.timer_off_rounded;
      headline = 'No answer — time ran out';
      sub = 'Submit before the timer ends next time';
    } else if (wasCorrect) {
      color = AppConfig.successColor;
      icon = Icons.check_circle_rounded;
      headline = 'Correct! +$score pts';
      sub = 'Speed bonus applied — great timing!';
    } else {
      color = AppConfig.errorColor;
      icon = Icons.cancel_rounded;
      headline = 'Wrong answer';
      sub = 'You selected the wrong option, 0 points awarded';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(isDark ? 0.09 : 0.15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.22)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  headline,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppConfig.mutedTextColor(isDark),
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

class _YourRankCallout extends StatelessWidget {
  final int? rank;
  final int total;
  final bool isDark;
  const _YourRankCallout({
    required this.rank,
    required this.total,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppConfig.highlightRankCardStart(isDark),
            AppConfig.highlightRankCardEnd(isDark),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppConfig.rankGold.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.emoji_events_rounded,
            size: 20,
            color: AppConfig.rankGold,
          ),
          const SizedBox(width: 10),
          Text(
            'Your current rank',
            style: TextStyle(
              fontSize: 13,
              color: AppConfig.mutedTextColor(isDark),
            ),
          ),
          const Spacer(),
          Text(
            rank != null ? '#$rank' : '-',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: AppConfig.rankGold,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            'of $total',
            style: TextStyle(
              fontSize: 13,
              color: AppConfig.mutedTextColor(isDark),
            ),
          ),
        ],
      ),
    );
  }
}

class _LeaderboardRow extends StatelessWidget {
  final LeaderboardEntry entry;
  final bool isYou;
  final bool isDark;

  const _LeaderboardRow({
    required this.entry,
    required this.isYou,
    required this.isDark,
  });

  Color _rankColor(bool isDark) {
    if (entry.rank == 1) return AppConfig.rankGold;
    if (entry.rank == 2) return AppConfig.rankSilver;
    if (entry.rank == 3) return AppConfig.rankBronze;
    return AppConfig.mutedTextColor(isDark);
  }

  String get _rankLabel {
    if (entry.rank == 1) return '🥇';
    if (entry.rank == 2) return '🥈';
    if (entry.rank == 3) return '🥉';
    return '${entry.rank}';
  }

  @override
  Widget build(BuildContext context) {
    final rankC = _rankColor(isDark);
    final initial = entry.fullName.isNotEmpty
        ? entry.fullName[0].toUpperCase()
        : '?';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: isYou
            ? AppConfig.rankGold.withOpacity(0.08)
            : AppConfig.cardColor(isDark),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isYou
              ? AppConfig.rankGold.withOpacity(0.3)
              : AppConfig.subtleOverlay(isDark),
          width: isYou ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Text(
              _rankLabel,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: entry.rank <= 3 ? 18 : 13,
                fontWeight: FontWeight.w800,
                color: rankC,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isYou
                  ? AppConfig.rankGold.withOpacity(0.18)
                  : AppConfig.subtleOverlay(isDark),
              border: Border.all(
                color: isYou
                    ? AppConfig.rankGold.withOpacity(0.35)
                    : AppConfig.strongOverlay(isDark),
              ),
            ),
            child: Center(
              child: Text(
                initial,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isYou
                      ? AppConfig.rankGold
                      : AppConfig.bodyTextColor(isDark),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isYou ? '${entry.fullName} (You)' : entry.fullName,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isYou ? FontWeight.w800 : FontWeight.w600,
                color: isYou
                    ? AppConfig.rankGold
                    : AppConfig.bodyTextColor(isDark),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${entry.totalScore}',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: isYou
                      ? AppConfig.rankGold
                      : AppConfig.bodyTextColor(isDark),
                ),
              ),
              Text(
                'pts',
                style: TextStyle(
                  fontSize: 10,
                  color: AppConfig.mutedTextColor(isDark),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AutoAdvanceHint extends StatelessWidget {
  final bool isLast;
  final int secondsLeft;
  final bool isDark;

  const _AutoAdvanceHint({
    required this.isLast,
    required this.secondsLeft,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final label = isLast
        ? 'Results in $secondsLeft s...'
        : 'Next question in $secondsLeft s...';

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.timer_outlined,
            size: 14,
            color: AppConfig.mutedTextColor(isDark),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppConfig.mutedTextColor(isDark),
            ),
          ),
        ],
      ),
    );
  }
}
