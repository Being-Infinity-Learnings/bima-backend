/// Shown when a student opens a quiz whose lobby the host hasn't opened yet
/// (no runtime, or runtime still in the WAITING phase). This screen does
/// **not** hold a socket connection — it polls `GET /quiz/my/:quizId` on a
/// timer until the host opens the lobby, then hands off to
/// [QuizLobbyScreen], which is the screen that actually forms the socket
/// connection.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';

import '../data/quiz_models.dart';
import '../providers/quiz_providers.dart';
import '../../../config/app_config.dart';

class QuizWaitingScreen extends ConsumerStatefulWidget {
  final String quizId;
  const QuizWaitingScreen({super.key, required this.quizId});

  @override
  ConsumerState<QuizWaitingScreen> createState() => _QuizWaitingScreenState();
}

class _QuizWaitingScreenState extends ConsumerState<QuizWaitingScreen>
    with TickerProviderStateMixin {
  static const _pollInterval = Duration(seconds: 4);

  MyQuizDetail? _quiz;
  String? _error;
  bool _loading = true;
  bool _navigated = false;

  Timer? _pollTimer;
  Timer? _clockTimer;

  late final AnimationController _pulseController;
  late final AnimationController _floatController;
  late final AnimationController _ambientController;

  @override
  void initState() {
    super.initState();
    _fetch(initial: true);
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);

    _ambientController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _clockTimer?.cancel();
    _pulseController.dispose();
    _floatController.dispose();
    _ambientController.dispose();
    super.dispose();
  }

  Future<void> _fetch({bool initial = false}) async {
    try {
      final detail = await ref
          .read(quizRepositoryProvider)
          .getMyQuizById(widget.quizId);

      if (!mounted) return;

      setState(() {
        _quiz = detail;
        _error = null;
        _loading = false;
      });

      if (detail.lobbyIsOpen) {
        _goToLobby();
        return;
      }

      _pollTimer ??= Timer.periodic(_pollInterval, (_) => _fetch());
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.response?.statusCode == 404
            ? 'This quiz is no longer available.'
            : 'Could not reach the server. Retrying…';
      });
      _pollTimer ??= Timer.periodic(_pollInterval, (_) => _fetch());
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Something went wrong. Retrying…';
      });
      _pollTimer ??= Timer.periodic(_pollInterval, (_) => _fetch());
    }
  }

  void _goToLobby() {
    if (_navigated || !mounted) return;
    _navigated = true;
    _pollTimer?.cancel();
    context.pushReplacement('/quiz/${widget.quizId}/lobby');
  }

  String _formatCountdown(Duration d) {
    if (d.isNegative || d.inSeconds <= 0) return 'Any moment now';
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (h > 0) return '${h.toString().padLeft(2, '0')}:$m:$s';
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  _RoundIconButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    isDark: isDark,
                    onTap: () => context.pop(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: _loading
                      ? _buildInitialLoading(isDark)
                      : _buildContent(isDark),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInitialLoading(bool isDark) {
    // Even the very first load (before we have quiz details) gets the same
    // breathing hero treatment instead of a bare spinner.
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildHero(isDark),
        const SizedBox(height: 24),
        Text(
          'Loading quiz…',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppConfig.mutedTextColor(isDark),
          ),
        ),
      ],
    );
  }

  Widget _buildHero(bool isDark) {
    return AnimatedBuilder(
      animation: Listenable.merge([
        _pulseController,
        _floatController,
        _ambientController,
      ]),
      builder: (context, _) {
        final pulse = 0.85 + (_pulseController.value * 0.15); // 0.85–1.0
        final float = math.sin(_floatController.value * math.pi) * 6; // 0..6
        final t = _ambientController.value; // 0..1 loop

        return Transform.translate(
          offset: Offset(0, -float),
          child: SizedBox(
            width: 160,
            height: 160,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Ambient drifting dots — purely decorative texture, no
                // numeric meaning attached to their motion.
                ..._buildAmbientDots(isDark, t),

                // Soft outer glow that breathes
                Opacity(
                  opacity: 0.35 * pulse,
                  child: Container(
                    width: 132,
                    height: 132,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppConfig.primaryColor.withOpacity(0.25),
                    ),
                  ),
                ),
                // Inner circle with icon
                Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppConfig.cardColor(isDark),
                    border: Border.all(
                      color: AppConfig.primaryColor.withOpacity(0.3),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppConfig.primaryColor.withOpacity(0.15 * pulse),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.hourglass_top_rounded,
                    size: 36,
                    color: AppConfig.primaryColor.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// A handful of small dots drifting slowly around the hero on staggered
  /// orbits. `t` is a 0..1 loop value; each dot gets a phase offset so they
  /// don't move in lockstep. Kept subtle — this is texture, not a data viz.
  List<Widget> _buildAmbientDots(bool isDark, double t) {
    const dotCount = 5;
    return List.generate(dotCount, (i) {
      final phase = i / dotCount;
      final angle = (t + phase) * 2 * math.pi;
      final radius = 66.0 + (i.isEven ? 6 : -6);
      final dx = math.cos(angle) * radius;
      final dy = math.sin(angle) * radius;

      // Fade each dot in/out as it passes behind vs. in front, purely for
      // a bit of depth — cheap trick, not real 3D.
      final depth = (math.sin(angle) + 1) / 2; // 0..1
      final opacity = 0.15 + depth * 0.35;
      final size = 5.0 + depth * 3.0;

      return Transform.translate(
        offset: Offset(dx, dy),
        child: Opacity(
          opacity: opacity,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppConfig.primaryColor,
            ),
          ),
        ),
      );
    });
  }

  Widget _buildContent(bool isDark) {
    final quiz = _quiz;

    final remaining = quiz == null
        ? Duration.zero
        : quiz.scheduledStartTime.difference(DateTime.now());

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildHero(isDark),
        const SizedBox(height: 28),
        Text(
          quiz?.title ?? 'Quiz',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            color: AppConfig.bodyTextColor(isDark),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'The host hasn\u2019t opened the lobby yet',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            height: 1.5,
            color: AppConfig.mutedTextColor(isDark),
          ),
        ),
        const SizedBox(height: 28),
        if (quiz != null) ...[
          // Big countdown chip — the headline number people actually came
          // here to watch.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            decoration: BoxDecoration(
              color: AppConfig.cardColor(isDark),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppConfig.subtleOverlay(isDark)),
            ),
            child: Column(
              children: [
                Text(
                  'STARTS IN',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: AppConfig.mutedTextColor(isDark),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _formatCountdown(remaining),
                  style: TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                    color: AppConfig.primaryColor,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 10),
                Container(height: 1, color: AppConfig.subtleOverlay(isDark)),
                const SizedBox(height: 10),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.schedule_rounded,
                      size: 14,
                      color: AppConfig.mutedTextColor(isDark),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Scheduled for '
                      '${quiz.scheduledStartTime.hour.toString().padLeft(2, '0')}:'
                      '${quiz.scheduledStartTime.minute.toString().padLeft(2, '0')}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppConfig.bodyTextColor(isDark),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Info pills row
          Wrap(
            spacing: 10,
            runSpacing: 10,
            alignment: WrapAlignment.center,
            children: [
              _InfoPill(
                icon: Icons.quiz_rounded,
                label: '${quiz.questionCount} questions',
                isDark: isDark,
              ),
              _InfoPill(
                icon: Icons.meeting_room_rounded,
                label: 'Lobby opens 10 min prior',
                isDark: isDark,
              ),
            ],
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppConfig.errorColor.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppConfig.errorColor.withOpacity(0.25)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.wifi_off_rounded,
                  size: 16,
                  color: AppConfig.errorColor,
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppConfig.errorColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _InfoPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isDark;

  const _InfoPill({
    required this.icon,
    required this.label,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: AppConfig.cardColor(isDark),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppConfig.subtleOverlay(isDark)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppConfig.primaryColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppConfig.bodyTextColor(isDark),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  final IconData icon;
  final bool isDark;
  final VoidCallback onTap;

  const _RoundIconButton({
    required this.icon,
    required this.isDark,
    required this.onTap,
  });

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
        child: Icon(icon, size: 18, color: AppConfig.mutedTextColor(isDark)),
      ),
    );
  }
}
