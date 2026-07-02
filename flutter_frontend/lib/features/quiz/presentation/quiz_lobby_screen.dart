import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/quiz_models.dart';
import '../providers/quiz_providers.dart';
import '../../../config/app_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
//
// Same look & animations as the original design — the difference is that the
// countdown, participant count, and "lobby open" state now come straight off
// the socket connection (opened here, in `initState`) instead of a fake demo
// timer. Navigation onward happens automatically the moment the server moves
// the phase past LOBBY.

class QuizLobbyScreen extends ConsumerStatefulWidget {
  final String quizId;
  const QuizLobbyScreen({super.key, required this.quizId});

  @override
  ConsumerState<QuizLobbyScreen> createState() => _QuizLobbyScreenState();
}

class _QuizLobbyScreenState extends ConsumerState<QuizLobbyScreen>
    with TickerProviderStateMixin {
  bool _navigatedForward = false;
  Timer? _tickTimer;
  Timer? _clockTimer;
  int _secondsLeft = 0;
  int _totalSeconds = 0;

  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;
  late AnimationController _entranceCtrl;
  late Animation<double> _entranceAnim;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(
      begin: 0.95,
      end: 1.05,
    ).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _entranceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _entranceAnim = CurvedAnimation(
      parent: _entranceCtrl,
      curve: Curves.easeOutCubic,
    );
    _entranceCtrl.forward();

    // Local 1s ticker just keeps the countdown text fresh between the
    // server's `runtimeUpdated` broadcasts.
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });

    Future.microtask(() {
      ref
          .read(quizRuntimeControllerProvider(widget.quizId).notifier)
          .connectAndJoin();
    });
  }

  @override
  void dispose() {
    _tickTimer?.cancel();
    _clockTimer?.cancel();
    _pulseCtrl.dispose();
    _entranceCtrl.dispose();
    super.dispose();
  }

  Duration _remainingFromRuntime(QuizRuntimeState quizState) {
    final endsAt = quizState.runtime?.phaseEndsAt;
    if (endsAt == null) return Duration.zero;
    final remaining = endsAt.difference(DateTime.now());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  void _refreshClock() {
    if (!mounted) return;
    setState(() {});
  }

  void _navigateForPhase(QuizPhase phase) {
    if (_navigatedForward || !mounted) return;
    switch (phase) {
      case QuizPhase.question:
        _navigatedForward = true;
        context.pushReplacement('/quiz/${widget.quizId}/play');
        break;
      case QuizPhase.leaderboard:
        _navigatedForward = true;
        context.pushReplacement('/quiz/${widget.quizId}/leaderboard');
        break;
      case QuizPhase.results:
      case QuizPhase.completed:
        _navigatedForward = true;
        context.pushReplacement('/quiz/${widget.quizId}/results');
        break;
      default:
        break;
    }
  }

  void _leaveLobby() {
    ref.read(quizRuntimeControllerProvider(widget.quizId).notifier).leaveQuiz();
    if (mounted) context.pop();
  }

  String _formatDuration(Duration d) {
    if (d.isNegative) d = Duration.zero;
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (h > 0) return '${h.toString().padLeft(2, '0')}:$m:$s';
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final quizAsync = ref.watch(myQuizDetailProvider(widget.quizId));
    final quizState = ref.watch(quizRuntimeControllerProvider(widget.quizId));

    ref.listen<QuizRuntimeState>(
      quizRuntimeControllerProvider(widget.quizId),
      (previous, next) => _navigateForPhase(next.phase),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigateForPhase(quizState.phase);
    });

    const accent = AppConfig.primaryColor;

    final phaseEndsAt =
        quizState.runtime?.phaseEndsAt ?? quizAsync.value?.runtime?.phaseEndsAt;
    final remaining = phaseEndsAt == null
        ? Duration.zero
        : phaseEndsAt.difference(DateTime.now()).isNegative
        ? Duration.zero
        : phaseEndsAt.difference(DateTime.now());
    final connectedUsers = quizState.runtime?.connectedUsers ?? 0;

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
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
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(
                    children: [
                      _BackButton(onTap: _leaveLobby, isDark: isDark),
                      const Spacer(),
                      _ConnectionPill(status: quizState.connectionStatus),
                    ],
                  ),
                ),

                Expanded(
                  child:
                      quizState.connectionStatus == SocketConnectionStatus.error
                      ? Center(
                          child: _ErrorState(
                            message:
                                quizState.connectionError ??
                                'Something went wrong.',
                            isDark: isDark,
                            onRetry: () => ref
                                .read(
                                  quizRuntimeControllerProvider(
                                    widget.quizId,
                                  ).notifier,
                                )
                                .connectAndJoin(),
                          ),
                        )
                      : SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 32,
                          ),
                          child: Column(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: accent.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: accent.withOpacity(0.25),
                                    width: 1,
                                  ),
                                ),
                                child: const Text(
                                  'LIVE QUIZ',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: accent,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                              ),

                              const SizedBox(height: 16),

                              Text(
                                quizAsync.value?.title ?? 'Quiz',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.8,
                                  color: AppConfig.bodyTextColor(isDark),
                                ),
                              ),

                              const SizedBox(height: 10),

                              if ((quizAsync.value?.description ?? '')
                                  .isNotEmpty)
                                Text(
                                  quizAsync.value!.description!,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 1.5,
                                    color: AppConfig.mutedTextColor(isDark),
                                  ),
                                ),

                              const SizedBox(height: 40),

                              if (quizState.connectionStatus !=
                                  SocketConnectionStatus.connected)
                                Column(
                                  children: [
                                    const CircularProgressIndicator(
                                      color: AppConfig.primaryColor,
                                    ),
                                    const SizedBox(height: 16),
                                    Text(
                                      'Connecting to the quiz…',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: AppConfig.mutedTextColor(isDark),
                                      ),
                                    ),
                                  ],
                                )
                              else
                                ScaleTransition(
                                  scale: _pulseAnim,
                                  child: _CountdownCircle(
                                    timeString: _formatDuration(remaining),
                                    accent: accent,
                                    isImminent: remaining.inSeconds < 10,
                                    isDark: isDark,
                                  ),
                                ),

                              const SizedBox(height: 36),

                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  _InfoChip(
                                    icon: Icons.help_outline_rounded,
                                    label:
                                        '${quizAsync.value?.questionCount ?? "…"} Questions',
                                    color: AppConfig.quizAnswerColors[0],
                                    isDark: isDark,
                                  ),
                                  const SizedBox(width: 12),
                                  _InfoChip(
                                    icon: Icons.timer_outlined,
                                    label: 'Speed scoring',
                                    color: AppConfig.warningColor,
                                    isDark: isDark,
                                  ),
                                ],
                              ),

                              const SizedBox(height: 36),

                              _ParticipantCounter(
                                count: connectedUsers,
                                isDark: isDark,
                              ),

                              const SizedBox(height: 40),

                              _TipBox(accent: accent, isDark: isDark),

                              const SizedBox(height: 24),
                            ],
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

class _ConnectionPill extends StatelessWidget {
  final SocketConnectionStatus status;
  const _ConnectionPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      SocketConnectionStatus.connected => ('LOBBY OPEN', AppConfig.errorColor),
      SocketConnectionStatus.connecting => (
        'CONNECTING',
        AppConfig.warningColor,
      ),
      SocketConnectionStatus.error => ('ERROR', AppConfig.errorColor),
      SocketConnectionStatus.disconnected => (
        'RECONNECTING',
        AppConfig.warningColor,
      ),
      SocketConnectionStatus.idle => ('CONNECTING', AppConfig.warningColor),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final bool isDark;
  final VoidCallback onRetry;

  const _ErrorState({
    required this.message,
    required this.isDark,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 48,
            color: AppConfig.errorColor,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: AppConfig.mutedTextColor(isDark),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppConfig.primaryColor,
              foregroundColor: AppConfig.bodyTextLight,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _CountdownCircle extends StatelessWidget {
  final String timeString;
  final Color accent;
  final bool isImminent;
  final bool isDark;

  const _CountdownCircle({
    required this.timeString,
    required this.accent,
    required this.isImminent,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final ringColor = isImminent ? AppConfig.errorColor : accent;

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
            style: TextStyle(fontSize: 12, color: ringColor.withOpacity(0.5)),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool isDark;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(isDark ? 0.08 : 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(isDark ? 0.2 : 0.3)),
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

class _ParticipantCounter extends StatelessWidget {
  final int count;
  final bool isDark;

  const _ParticipantCounter({required this.count, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: TextStyle(
            fontSize: 52,
            fontWeight: FontWeight.w900,
            letterSpacing: -2,
            color: AppConfig.bodyTextColor(isDark),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'players in the lobby',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppConfig.mutedTextColor(isDark),
          ),
        ),
        const SizedBox(height: 12),
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
                    color: AppConfig.quizConfettiColors[i],
                    border: Border.all(
                      color: AppConfig.scaffoldColor(isDark),
                      width: 2,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      ['R', 'A', 'S', 'D', 'P', '+'][i],
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppConfig.bodyTextLight,
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

class _TipBox extends StatelessWidget {
  final Color accent;
  final bool isDark;
  const _TipBox({required this.accent, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppConfig.cardColor(isDark),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppConfig.subtleOverlay(isDark)),
      ),
      child: Row(
        children: [
          const Text('💡', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Answer faster to score more points. The first correct answer gets maximum speed bonus!',
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: AppConfig.mutedTextColor(isDark),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  final VoidCallback onTap;
  final bool isDark;
  const _BackButton({required this.onTap, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppConfig.subtleOverlay(isDark),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppConfig.strongOverlay(isDark)),
        ),
        child: Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 18,
          color: AppConfig.mutedTextColor(isDark),
        ),
      ),
    );
  }
}
