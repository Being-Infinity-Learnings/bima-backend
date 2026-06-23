import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/quiz_dummy_data.dart';
import '../../../config/app_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Providers (swap with real API providers when backend is ready)
// ─────────────────────────────────────────────────────────────────────────────

/// Simulates a live participant count that ticks up every few seconds.
final _participantCountProvider = StateProvider<int>((_) => 74);

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class QuizLobbyScreen extends ConsumerStatefulWidget {
  final String quizId;
  const QuizLobbyScreen({super.key, required this.quizId});

  @override
  ConsumerState<QuizLobbyScreen> createState() => _QuizLobbyScreenState();
}

class _QuizLobbyScreenState extends ConsumerState<QuizLobbyScreen>
    with TickerProviderStateMixin {
  late DemoQuiz _quiz;
  Duration _remaining = Duration.zero;
  Timer? _countdownTimer;
  Timer? _participantTimer;

  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;
  late AnimationController _entranceCtrl;
  late Animation<double> _entranceAnim;

  @override
  void initState() {
    super.initState();

    _quiz = demoUpcomingQuizzes.firstWhere(
      (q) => q.id == widget.quizId,
      orElse: () => demoUpcomingQuizzes.first,
    );

    _remaining = _parseScheduledAt(_quiz.scheduledAt);

    // Pulse animation for the countdown circle
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    // Entrance animation
    _entranceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _entranceAnim = CurvedAnimation(
      parent: _entranceCtrl,
      curve: Curves.easeOutCubic,
    );
    _entranceCtrl.forward();

    _startCountdown();
    _startParticipantTicker();
  }

  Duration _parseScheduledAt(String raw) {
    // Support "NOW+HH:MM:SS" for demo purposes
    if (raw.startsWith('NOW+')) {
      final parts = raw.substring(4).split(':');
      final h = int.parse(parts[0]);
      final m = int.parse(parts[1]);
      final s = int.parse(parts[2]);
      return Duration(hours: h, minutes: m, seconds: s);
    }
    try {
      final dt = DateTime.parse(raw);
      final diff = dt.difference(DateTime.now());
      return diff.isNegative ? Duration.zero : diff;
    } catch (_) {
      return const Duration(hours: 2, minutes: 14);
    }
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_remaining.inSeconds <= 1) {
        _countdownTimer?.cancel();
        // Navigate to play screen
        if (mounted) {
          context.push('/quiz/${widget.quizId}/play');
        }
      } else {
        setState(() => _remaining -= const Duration(seconds: 1));
      }
    });
  }

  void _startParticipantTicker() {
    _participantTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted) return;
      final current = ref.read(_participantCountProvider);
      if (current < demoTotalParticipants) {
        final add = (current < 100) ? 3 : 1;
        ref.read(_participantCountProvider.notifier).state =
            (current + add).clamp(0, demoTotalParticipants);
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _participantTimer?.cancel();
    _pulseCtrl.dispose();
    _entranceCtrl.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (h > 0) return '${h.toString().padLeft(2, '0')}:$m:$s';
    return '$m:$s';
  }

  Color _tagColor(QuizTag tag) {
    switch (tag) {
      case QuizTag.daily:     return const Color(0xFF6C8EFF);
      case QuizTag.challenge: return const Color(0xFFFF6B6B);
      case QuizTag.special:   return const Color(0xFFFFD166);
      case QuizTag.aptitude:  return const Color(0xFFC8FF57);
    }
  }

  @override
  Widget build(BuildContext context) {
    final participantCount = ref.watch(_participantCountProvider);
    final tag = _quiz.tag;
    final accent = _tagColor(tag);

    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: FadeTransition(
        opacity: _entranceAnim,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.04),
            end: Offset.zero,
          ).animate(_entranceAnim),
          child: SafeArea(
            child: Column(
              children: [
                // ── Top bar ──────────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(
                    children: [
                      _BackButton(onTap: () => context.pop()),
                      const Spacer(),
                      // Live badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF6B6B).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: const Color(0xFFFF6B6B).withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: Color(0xFFFF6B6B),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text(
                              'LOBBY OPEN',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFFF6B6B),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Main scrollable content ──────────────────────────────
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 32),
                    child: Column(
                      children: [
                        // Tag pill
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: accent.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: accent.withOpacity(0.25), width: 1),
                          ),
                          child: Text(
                            tag.label.toUpperCase(),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: accent,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Quiz title
                        Text(
                          _quiz.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.8,
                            color: Colors.white,
                          ),
                        ),

                        const SizedBox(height: 10),

                        Text(
                          _quiz.description,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 14,
                            height: 1.5,
                            color: Color(0xFF7A8499),
                          ),
                        ),

                        const SizedBox(height: 40),

                        // ── Countdown circle ─────────────────────────────
                        ScaleTransition(
                          scale: _pulseAnim,
                          child: _CountdownCircle(
                            timeString: _formatDuration(_remaining),
                            accent: accent,
                            isImminent: _remaining.inMinutes < 2,
                          ),
                        ),

                        const SizedBox(height: 36),

                        // ── Info row ─────────────────────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _InfoChip(
                              icon: Icons.help_outline_rounded,
                              label: '${_quiz.questionCount} Questions',
                              color: const Color(0xFF6C8EFF),
                            ),
                            const SizedBox(width: 12),
                            _InfoChip(
                              icon: Icons.timer_outlined,
                              label: 'Speed scoring',
                              color: const Color(0xFFFFD166),
                            ),
                          ],
                        ),

                        const SizedBox(height: 36),

                        // ── Participant count ─────────────────────────────
                        _ParticipantCounter(count: participantCount),

                        const SizedBox(height: 40),

                        // ── Tip box ───────────────────────────────────────
                        _TipBox(accent: accent),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),

                // ── Bottom: skip to demo button ──────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        _countdownTimer?.cancel();
                        context.push('/quiz/${widget.quizId}/play');
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: const Color(0xFF0C0E14),
                        minimumSize: const Size.fromHeight(56),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Start Now (Demo)',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown Circle
// ─────────────────────────────────────────────────────────────────────────────

class _CountdownCircle extends StatelessWidget {
  final String timeString;
  final Color accent;
  final bool isImminent;

  const _CountdownCircle({
    required this.timeString,
    required this.accent,
    required this.isImminent,
  });

  @override
  Widget build(BuildContext context) {
    final ringColor = isImminent ? const Color(0xFFFF6B6B) : accent;

    return Container(
      width: 200,
      height: 200,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: ringColor.withOpacity(0.07),
        border: Border.all(color: ringColor.withOpacity(0.3), width: 2),
        boxShadow: [
          BoxShadow(
            color: ringColor.withOpacity(0.15),
            blurRadius: 40,
            spreadRadius: 10,
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'STARTS IN',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: ringColor.withOpacity(0.7),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            timeString,
            style: TextStyle(
              fontSize: 40,
              fontWeight: FontWeight.w900,
              letterSpacing: -2,
              color: ringColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isImminent ? '⚡ Almost time!' : 'hh:mm:ss',
            style: TextStyle(
              fontSize: 12,
              color: ringColor.withOpacity(0.5),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Info Chip
// ─────────────────────────────────────────────────────────────────────────────

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 7),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Participant Counter
// ─────────────────────────────────────────────────────────────────────────────

class _ParticipantCounter extends StatelessWidget {
  final int count;
  const _ParticipantCounter({required this.count});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: const TextStyle(
            fontSize: 52,
            fontWeight: FontWeight.w900,
            letterSpacing: -2,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'players in the lobby',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF7A8499),
          ),
        ),
        const SizedBox(height: 12),
        // Mini avatar row
        SizedBox(
          height: 28,
          child: Stack(
            children: List.generate(
              6,
              (i) => Positioned(
                left: i * 20.0,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: [
                      const Color(0xFFC8FF57),
                      const Color(0xFF6C8EFF),
                      const Color(0xFFFFD166),
                      const Color(0xFFFF6B6B),
                      const Color(0xFF22C55E),
                      const Color(0xFF7A8499),
                    ][i],
                    border: Border.all(
                        color: const Color(0xFF0D1117), width: 2),
                  ),
                  child: Center(
                    child: Text(
                      ['R', 'A', 'S', 'D', 'P', '+'][i],
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0D1117),
                      ),
                    ),
                  ),
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
// Tip Box
// ─────────────────────────────────────────────────────────────────────────────

class _TipBox extends StatelessWidget {
  final Color accent;
  const _TipBox({required this.accent});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161B26),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: const Color(0xFFFFFFFF).withOpacity(0.06)),
      ),
      child: Row(
        children: [
          Text(
            '💡',
            style: TextStyle(fontSize: 22),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Answer faster to score more points. The first correct answer gets maximum speed bonus!',
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: Color(0xFF7A8499),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Back Button
// ─────────────────────────────────────────────────────────────────────────────

class _BackButton extends StatelessWidget {
  final VoidCallback onTap;
  const _BackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF).withOpacity(0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: const Color(0xFFFFFFFF).withOpacity(0.08)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 18,
          color: Color(0xFF7A8499),
        ),
      ),
    );
  }
}
