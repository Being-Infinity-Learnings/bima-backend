import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/quiz_dummy_data.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

/// Live running leaderboard shown after each question.
///
/// Navigation flow:
///   1. QuizPlayScreen pushes this via context.push() when timer hits 0.
///   2. This screen counts down [demoLeaderboardDisplaySeconds] automatically.
///   3. On countdown end it calls context.pop() — QuizPlayScreen's .then()
///      handles advancing to the next question or results screen.
///
/// There is NO manual "Next Question" button — the flow is fully automatic.
class QuizLeaderboardScreen extends StatefulWidget {
  final String quizId;
  final Map<String, dynamic>? extra;

  const QuizLeaderboardScreen({super.key, required this.quizId, this.extra});

  @override
  State<QuizLeaderboardScreen> createState() => _QuizLeaderboardScreenState();
}

class _QuizLeaderboardScreenState extends State<QuizLeaderboardScreen>
    with TickerProviderStateMixin {
  late AnimationController _entranceCtrl;
  late List<Animation<double>> _rowAnims;
  late AnimationController _countdownRingCtrl;

  Timer? _autoAdvance;
  late int _secondsLeft;

  bool get _isLast => widget.extra?['isLast'] == true;
  String? get _submittedId => widget.extra?['submittedAnswerId'] as String?;
  String? get _correctId => widget.extra?['correctAnswerId'] as String?;
  bool get _wasCorrect => _submittedId != null && _submittedId == _correctId;
  bool get _didNotAnswer => _submittedId == null;

  @override
  void initState() {
    super.initState();
    _secondsLeft = demoLeaderboardDisplaySeconds;

    // Staggered entrance animations for leaderboard rows
    _entranceCtrl = AnimationController(
      vsync: this,
      duration: Duration(
        milliseconds: 300 + demoLeaderboardEntries.length * 55,
      ),
    );
    _rowAnims = List.generate(demoLeaderboardEntries.length, (i) {
      final start = (i / demoLeaderboardEntries.length) * 0.65;
      final end = ((i + 1) / demoLeaderboardEntries.length) * 0.65 + 0.35;
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

    // Countdown ring — drives the circular progress indicator
    _countdownRingCtrl = AnimationController(
      vsync: this,
      duration: Duration(seconds: demoLeaderboardDisplaySeconds),
    )..forward();

    _entranceCtrl.forward();
    _startAutoAdvance();
  }

  void _startAutoAdvance() {
    _autoAdvance = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final left = _secondsLeft - 1;
      if (left <= 0) {
        _autoAdvance?.cancel();
        if (mounted) context.pop();
      } else {
        setState(() => _secondsLeft = left);
      }
    });
  }

  @override
  void dispose() {
    _autoAdvance?.cancel();
    _entranceCtrl.dispose();
    _countdownRingCtrl.dispose();
    super.dispose();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Top bar ──────────────────────────────────────────────
            _TopBar(
              isLast: _isLast,
              secondsLeft: _secondsLeft,
              totalSeconds: demoLeaderboardDisplaySeconds,
              countdownCtrl: _countdownRingCtrl,
            ),

            const SizedBox(height: 12),

            // ── Answer result banner ──────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _AnswerResultBanner(
                wasCorrect: _wasCorrect,
                didNotAnswer: _didNotAnswer,
              ),
            ),

            const SizedBox(height: 14),

            // ── Your rank callout ─────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _YourRankCallout(rank: demoUserRank),
            ),

            const SizedBox(height: 14),

            // ── Section label ─────────────────────────────────────────
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'LIVE STANDINGS',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: Color(0xFF7A8499),
                ),
              ),
            ),

            const SizedBox(height: 10),

            // ── Leaderboard list (full, scrollable) ───────────────────
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                itemCount: demoLeaderboardEntries.length,
                itemBuilder: (_, i) {
                  final entry = demoLeaderboardEntries[i];
                  final isYou = entry.name == 'You';
                  return AnimatedBuilder(
                    animation: _rowAnims[i],
                    builder: (_, child) => Opacity(
                      opacity: _rowAnims[i].value,
                      child: Transform.translate(
                        offset: Offset(0, 18 * (1 - _rowAnims[i].value)),
                        child: child,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _LeaderboardRow(entry: entry, isYou: isYou),
                    ),
                  );
                },
              ),
            ),

            // ── Auto-advance hint (no button) ─────────────────────────
            _AutoAdvanceHint(isLast: _isLast, secondsLeft: _secondsLeft),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Bar
// ─────────────────────────────────────────────────────────────────────────────

class _TopBar extends StatelessWidget {
  final bool isLast;
  final int secondsLeft;
  final int totalSeconds;
  final AnimationController countdownCtrl;

  const _TopBar({
    required this.isLast,
    required this.secondsLeft,
    required this.totalSeconds,
    required this.countdownCtrl,
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
              const Text(
                'LEADERBOARD',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: Color(0xFF7A8499),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                isLast ? 'Final standings' : 'Live standings',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const Spacer(),
          // Auto-advance ring — purely informational, not tappable
          AnimatedBuilder(
            animation: countdownCtrl,
            builder: (_, __) {
              final progress = (secondsLeft / totalSeconds).clamp(0.0, 1.0);
              return Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 52,
                    height: 52,
                    child: CircularProgressIndicator(
                      value: progress,
                      strokeWidth: 3.5,
                      backgroundColor: const Color(
                        0xFFFFFFFF,
                      ).withOpacity(0.07),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        Color(0xFFC8FF57),
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
                          color: Color(0xFFC8FF57),
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

// ─────────────────────────────────────────────────────────────────────────────
// Answer Result Banner
// ─────────────────────────────────────────────────────────────────────────────

class _AnswerResultBanner extends StatelessWidget {
  final bool wasCorrect;
  final bool didNotAnswer;

  const _AnswerResultBanner({
    required this.wasCorrect,
    required this.didNotAnswer,
  });

  @override
  Widget build(BuildContext context) {
    final Color color;
    final IconData icon;
    final String headline;
    final String sub;

    if (didNotAnswer) {
      color = const Color(0xFF7A8499);
      icon = Icons.timer_off_rounded;
      headline = 'No answer — time ran out';
      sub = 'Submit before the timer ends next time';
    } else if (wasCorrect) {
      color = const Color(0xFF22C55E);
      icon = Icons.check_circle_rounded;
      headline = 'Correct! +860 pts';
      sub = 'Speed bonus applied — great timing!';
    } else {
      color = const Color(0xFFFF6B6B);
      icon = Icons.cancel_rounded;
      headline = 'Wrong answer';
      sub = 'You selected the wrong option, 0 points awarded';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.09),
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
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF7A8499),
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

// ─────────────────────────────────────────────────────────────────────────────
// Your Rank Callout
// ─────────────────────────────────────────────────────────────────────────────

class _YourRankCallout extends StatelessWidget {
  final int rank;
  const _YourRankCallout({required this.rank});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1C2440), Color(0xFF141A30)],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFFD166).withOpacity(0.2)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.emoji_events_rounded,
            size: 20,
            color: Color(0xFFFFD166),
          ),
          const SizedBox(width: 10),
          const Text(
            'Your current rank',
            style: TextStyle(fontSize: 13, color: Color(0xFF7A8499)),
          ),
          const Spacer(),
          Text(
            '#$rank',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: Color(0xFFFFD166),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            'of $demoTotalParticipants',
            style: const TextStyle(fontSize: 13, color: Color(0xFF7A8499)),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard Row
// ─────────────────────────────────────────────────────────────────────────────

class _LeaderboardRow extends StatelessWidget {
  final DemoLeaderboardEntry entry;
  final bool isYou;

  const _LeaderboardRow({required this.entry, required this.isYou});

  Color get _rankColor {
    if (entry.rank == 1) return const Color(0xFFFFD166);
    if (entry.rank == 2) return const Color(0xFFBDBDBD);
    if (entry.rank == 3) return const Color(0xFFCD7F32);
    return const Color(0xFF7A8499);
  }

  String get _rankLabel {
    if (entry.rank == 1) return '🥇';
    if (entry.rank == 2) return '🥈';
    if (entry.rank == 3) return '🥉';
    return '${entry.rank}';
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: isYou
            ? const Color(0xFFFFD166).withOpacity(0.08)
            : const Color(0xFF161B26),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isYou
              ? const Color(0xFFFFD166).withOpacity(0.28)
              : const Color(0xFFFFFFFF).withOpacity(0.05),
          width: isYou ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          // Rank
          SizedBox(
            width: 34,
            child: Text(
              _rankLabel,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: entry.rank <= 3 ? 18 : 13,
                fontWeight: FontWeight.w800,
                color: _rankColor,
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Avatar circle
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isYou
                  ? const Color(0xFFFFD166).withOpacity(0.18)
                  : const Color(0xFFFFFFFF).withOpacity(0.06),
              border: Border.all(
                color: isYou
                    ? const Color(0xFFFFD166).withOpacity(0.35)
                    : const Color(0xFFFFFFFF).withOpacity(0.08),
              ),
            ),
            child: Center(
              child: Text(
                entry.name[0],
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isYou ? const Color(0xFFFFD166) : Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Name + batch label
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.name,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: isYou ? FontWeight.w800 : FontWeight.w600,
                    color: isYou ? const Color(0xFFFFD166) : Colors.white,
                  ),
                ),
                if (entry.label != null && entry.label!.isNotEmpty) ...[
                  const SizedBox(height: 1),
                  Text(
                    entry.label!,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF7A8499),
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Score
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${entry.score}',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: isYou ? const Color(0xFFFFD166) : Colors.white,
                ),
              ),
              const Text(
                'pts',
                style: TextStyle(fontSize: 10, color: Color(0xFF7A8499)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Advance Hint  (no button — purely informational)
// ─────────────────────────────────────────────────────────────────────────────

class _AutoAdvanceHint extends StatelessWidget {
  final bool isLast;
  final int secondsLeft;

  const _AutoAdvanceHint({required this.isLast, required this.secondsLeft});

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
          const Icon(Icons.timer_outlined, size: 14, color: Color(0xFF7A8499)),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF7A8499),
            ),
          ),
        ],
      ),
    );
  }
}
