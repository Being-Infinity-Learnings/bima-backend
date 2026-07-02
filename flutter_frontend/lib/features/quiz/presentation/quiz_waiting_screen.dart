/// Shown when a student opens a quiz whose lobby the host hasn't opened yet
/// (no runtime, or runtime still in the WAITING phase). This screen does
/// **not** hold a socket connection — it polls `GET /quiz/my/:quizId` on a
/// timer until the host opens the lobby, then hands off to
/// [QuizLobbyScreen], which is the screen that actually forms the socket
/// connection.
import 'dart:async';

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

class _QuizWaitingScreenState extends ConsumerState<QuizWaitingScreen> {
  static const _pollInterval = Duration(seconds: 4);

  MyQuizDetail? _quiz;
  String? _error;
  bool _loading = true;
  bool _navigated = false;

  Timer? _pollTimer;
  Timer? _clockTimer;

  @override
  void initState() {
    super.initState();
    _fetch(initial: true);
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _clockTimer?.cancel();
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
                      ? const CircularProgressIndicator(
                          color: AppConfig.primaryColor,
                        )
                      : _buildContent(isDark),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(bool isDark) {
    final quiz = _quiz;

    final remaining = quiz == null
        ? Duration.zero
        : quiz.scheduledStartTime.difference(DateTime.now());

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppConfig.primaryColor.withOpacity(0.12),
            border: Border.all(color: AppConfig.primaryColor.withOpacity(0.3)),
          ),
          child: const Center(
            child: SizedBox(
              width: 44,
              height: 44,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppConfig.primaryColor,
              ),
            ),
          ),
        ),
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
        const SizedBox(height: 10),
        Text(
          'Waiting for the host to open the lobby…',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            height: 1.5,
            color: AppConfig.mutedTextColor(isDark),
          ),
        ),
        const SizedBox(height: 24),
        if (quiz != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: BoxDecoration(
              color: AppConfig.cardColor(isDark),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppConfig.subtleOverlay(isDark)),
            ),
            child: Column(
              children: [
                Text(
                  'SCHEDULED FOR',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.0,
                    color: AppConfig.mutedTextColor(isDark),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${quiz.scheduledStartTime.hour.toString().padLeft(2, '0')}:'
                  '${quiz.scheduledStartTime.minute.toString().padLeft(2, '0')}'
                  '  •  starts in ${_formatCountdown(remaining)}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppConfig.bodyTextColor(isDark),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '${quiz.questionCount} questions • the quiz begins as soon as the host starts it',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: AppConfig.mutedTextColor(isDark),
            ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 20),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              color: AppConfig.errorColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
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
