import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/quiz_models.dart';
import '../providers/quiz_providers.dart';
import '../../../config/app_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// How the reveal is synchronized with the server
// ─────────────────────────────────────────────────────────────────────────────
//
// The countdown ring is predicted locally (server only broadcasts once per
// phase change, not every tick). When the *local* clock hits zero we lock
// the tiles (no more taps) and, if the student has an unsubmitted pick,
// fire one best-effort `submitAnswer` — mirroring "locking in" whatever was
// selected the instant time runs out. That may race the server's own
// question-end and get rejected, which is fine: an unanswered question is
// scored as incorrect either way.
//
// The green/red "reveal" starts the instant `questionResults` arrives for
// the current question — the backend guarantees this fires for every
// question, including the last one. This screen does NOT decide where to
// go next or when: it just shows the reveal colors. `QuizPhaseSync` (see
// quiz_phase_sync.dart), wrapping this route, is the only thing that
// navigates, and it does so the moment the server actually flips the phase
// to LEADERBOARD/RESULTS — which the backend always does exactly
// `REVEAL_DELAY_MS` after `questionResults` was sent. That gives every
// client the same ~2s reveal window without this screen needing to guess
// or time anything itself.

class QuizPlayScreen extends ConsumerStatefulWidget {
  final String quizId;
  const QuizPlayScreen({super.key, required this.quizId});

  @override
  ConsumerState<QuizPlayScreen> createState() => _QuizPlayScreenState();
}

class _QuizPlayScreenState extends ConsumerState<QuizPlayScreen>
    with TickerProviderStateMixin {
  String? _trackedQuestionId;
  QuizQuestionPayload? _cachedQuestion;
  DateTime? _trackedPhaseEndsAt;

  bool _locked = false;
  bool _revealed = false;
  bool _autoSubmitAttempted = false;

  int _secondsLeft = 0;
  int _totalSeconds = 0;
  Timer? _secondsTimer;

  late AnimationController _questionSlideCtrl;
  late Animation<Offset> _questionSlide;
  late Animation<double> _questionFade;

  late AnimationController _timerCtrl;
  late AnimationController _submitPulseCtrl;
  late Animation<double> _submitPulse;

  @override
  void initState() {
    super.initState();

    _questionSlideCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );
    _questionSlide =
        Tween<Offset>(begin: const Offset(0.06, 0), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _questionSlideCtrl,
            curve: Curves.easeOutCubic,
          ),
        );
    _questionFade = CurvedAnimation(
      parent: _questionSlideCtrl,
      curve: Curves.easeOut,
    );

    _timerCtrl = AnimationController(vsync: this);

    _submitPulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _submitPulse = Tween<double>(begin: 1.0, end: 1.04).animate(
      CurvedAnimation(parent: _submitPulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _secondsTimer?.cancel();
    _questionSlideCtrl.dispose();
    _timerCtrl.dispose();
    _submitPulseCtrl.dispose();
    super.dispose();
  }

  QuizRuntimeController get _controller =>
      ref.read(quizRuntimeControllerProvider(widget.quizId).notifier);

  /// Resets all per-question local state whenever a new question comes in
  /// from the server, and (re)starts the local countdown clock.
  void _syncQuestion(
    QuizQuestionPayload question,
    DateTime? phaseEndsAt,
    int? remainingMs,
  ) {
    final sameQuestion = _trackedQuestionId == question.id;
    final sameDeadline = _trackedPhaseEndsAt == phaseEndsAt;
    if (sameQuestion) {
      // Ignore every socket update once reveal has started.
      if (_revealed) {
        return;
      }

      // Same question + same deadline = nothing changed.
      if (sameDeadline) {
        return;
      }

      // Same question but different deadline.
      // Ignore tiny deadline corrections (<500 ms)
      if (phaseEndsAt != null &&
          _trackedPhaseEndsAt != null &&
          (phaseEndsAt.difference(_trackedPhaseEndsAt!).inMilliseconds).abs() <
              500) {
        return;
      }
    }

    _trackedQuestionId = question.id;
    _trackedPhaseEndsAt = phaseEndsAt;
    _cachedQuestion = question;

    _locked = false;
    _revealed = false;
    _autoSubmitAttempted = false;

    final totalMs = question.durationMs ?? remainingMs ?? 20000;
    final leftMs =
        phaseEndsAt?.difference(DateTime.now()).inMilliseconds ??
        remainingMs ??
        totalMs;

    _totalSeconds = (totalMs / 1000).ceil().clamp(1, 999999).toInt();
    _secondsLeft = (leftMs / 1000).ceil().clamp(0, _totalSeconds).toInt();

    final elapsedFraction = totalMs <= 0
        ? 0.0
        : (1.0 - (leftMs / totalMs)).clamp(0.0, 1.0).toDouble();
    _timerCtrl.duration = Duration(milliseconds: totalMs);
    _timerCtrl.value = elapsedFraction;
    if (leftMs > 0) {
      _timerCtrl.animateTo(
        1.0,
        duration: Duration(milliseconds: leftMs),
        curve: Curves.linear,
      );
    } else {
      _timerCtrl.value = 1.0;
    }

    _questionSlideCtrl.reset();
    _questionSlideCtrl.forward();

    _secondsTimer?.cancel();
    _secondsTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final endsAt = _trackedPhaseEndsAt;
      final msLeft =
          endsAt?.difference(DateTime.now()).inMilliseconds ??
          _secondsLeft * 1000;
      final nextSeconds = (msLeft / 1000)
          .ceil()
          .clamp(0, _totalSeconds)
          .toInt();
      if (nextSeconds <= 0) {
        _secondsTimer?.cancel();
        setState(() => _secondsLeft = 0);
        _onLocalTimeUp();
      } else {
        setState(() => _secondsLeft = nextSeconds);
      }
    });
  }

  /// Local countdown reached zero. Lock the UI and best-effort submit
  /// whatever was selected — the server remains the source of truth.
  void _onLocalTimeUp() {
    if (!mounted) return;
    if (_locked) return;
    setState(() => _locked = true);

    final state = ref.read(quizRuntimeControllerProvider(widget.quizId));
    if (!_autoSubmitAttempted &&
        state.selectedOptionId != null &&
        state.submissionStatus == SubmissionStatus.none) {
      _autoSubmitAttempted = true;
      _controller.submitSelectedAnswer();
    }
  }

  /// Called whenever the controller's state changes. Starts the reveal the
  /// moment the real question result has arrived. Doesn't navigate anywhere
  /// — `QuizPhaseSync` (wrapping this route) takes care of moving on once
  /// the server actually advances the phase.
  void _maybeReveal(QuizRuntimeState state) {
    if (!mounted || _revealed) return;
    if (state.myQuestionResult == null) return;

    _secondsTimer?.cancel();

    setState(() {
      _locked = true;
      _revealed = true;
    });

    HapticFeedback.mediumImpact();
  }

  void _onAnswerTapped(String id) {
    if (_locked) return;
    final state = ref.read(quizRuntimeControllerProvider(widget.quizId));
    if (state.submissionStatus != SubmissionStatus.none) return;

    HapticFeedback.selectionClick();
    if (state.selectedOptionId == id) {
      _controller.clearSelection();
    } else {
      _controller.selectOption(id);
    }
  }

  void _onSubmitPressed() {
    final state = ref.read(quizRuntimeControllerProvider(widget.quizId));
    if (state.selectedOptionId == null) return;
    if (_locked || state.submissionStatus != SubmissionStatus.none) return;
    HapticFeedback.mediumImpact();
    _controller.submitSelectedAnswer();
  }

  static const _answerShapes = ['▲', '◆', '●', '■', '★', '♥'];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final quizState = ref.watch(quizRuntimeControllerProvider(widget.quizId));
    final quizDetail = ref.watch(myQuizDetailProvider(widget.quizId));

    ref.listen<QuizRuntimeState>(
      quizRuntimeControllerProvider(widget.quizId),
      (previous, next) => _maybeReveal(next),
    );

    final runtime = quizState.runtime;
    final question = runtime?.question ?? _cachedQuestion;

    if (quizState.connectionStatus != SocketConnectionStatus.connected ||
        question == null) {
      return Scaffold(
        backgroundColor: AppConfig.scaffoldColor(isDark),
        body: const Center(
          child: CircularProgressIndicator(color: AppConfig.primaryColor),
        ),
      );
    }

    // Sync local per-question state (idempotent — only acts on a new id).
    if (!_revealed && quizState.phase == QuizPhase.question) {
      _syncQuestion(question, runtime?.phaseEndsAt, runtime?.remainingTimeMs);
    }
    final totalQ = quizDetail.value?.questionCount ?? 0;
    final idx = runtime?.questionIndex ?? 0;
    final hasImage =
        question.questionImage != null && question.questionImage!.isNotEmpty;

    final hasSubmitted =
        quizState.submissionStatus == SubmissionStatus.submitted ||
        quizState.submissionStatus == SubmissionStatus.pending;
    final submitActive =
        quizState.selectedOptionId != null && !hasSubmitted && !_locked;
    final correctOptionIds =
        quizState.myQuestionResult?.correctOptionIds ?? const [];

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
      body: SafeArea(
        child: Column(
          children: [
            _HeaderBar(
              current: idx + 1,
              total: totalQ > 0 ? totalQ : (idx + 1),
              secondsLeft: _secondsLeft,
              totalSeconds: _totalSeconds,
              isSubmitted: hasSubmitted,
              timerCtrl: _timerCtrl,
              isDark: isDark,
            ),

            Expanded(
              child: FadeTransition(
                opacity: _questionFade,
                child: SlideTransition(
                  position: _questionSlide,
                  child: SingleChildScrollView(
                    physics: const ClampingScrollPhysics(),
                    child: Column(
                      children: [
                        _QuestionCard(
                          question: question,
                          hasImage: hasImage,
                          isDark: isDark,
                        ),

                        const SizedBox(height: 12),

                        _AnswerGrid(
                          options: question.options,
                          selectedId: quizState.selectedOptionId,
                          locked: _locked,
                          revealed: _revealed,
                          correctOptionIds: correctOptionIds,
                          onTap: _onAnswerTapped,
                          colors: AppConfig.quizAnswerColors,
                          shapes: _answerShapes,
                          isDark: isDark,
                        ),

                        const SizedBox(height: 80),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            _SubmitBar(
              isActive: submitActive,
              isSubmitted: hasSubmitted,
              timerExpired: _locked,
              pulseAnim: _submitPulse,
              onSubmit: _onSubmitPressed,
              isDark: isDark,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

class _HeaderBar extends StatelessWidget {
  final int current;
  final int total;
  final int secondsLeft;
  final int totalSeconds;
  final bool isSubmitted;
  final AnimationController timerCtrl;
  final bool isDark;

  const _HeaderBar({
    required this.current,
    required this.total,
    required this.secondsLeft,
    required this.totalSeconds,
    required this.isSubmitted,
    required this.timerCtrl,
    required this.isDark,
  });

  Color _timerColorFor(double fraction) {
    if (fraction <= 0) return AppConfig.errorColor;
    if (fraction > 0.5) return AppConfig.primaryColor;
    if (fraction > 0.25) return AppConfig.warningColor;
    return AppConfig.errorColor;
  }

  @override
  Widget build(BuildContext context) {
    final showPill = isSubmitted && secondsLeft > 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'QUESTION $current OF $total',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: AppConfig.mutedTextColor(isDark),
                ),
              ),
              const SizedBox(height: 6),
              SizedBox(
                width: 140,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: total > 0 ? current / total : 0,
                    minHeight: 5,
                    backgroundColor: AppConfig.subtleOverlay(isDark),
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      AppConfig.primaryColor,
                    ),
                  ),
                ),
              ),
            ],
          ),

          const Spacer(),

          SizedBox(
            height: 54,
            child: Align(
              alignment: Alignment.centerRight,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: ScaleTransition(scale: animation, child: child),
                ),
                child: showPill
                    ? _SubmittedPill(
                        key: const ValueKey('pill'),
                        secondsLeft: secondsLeft,
                        isDark: isDark,
                      )
                    : _TimerRing(
                        key: const ValueKey('ring'),
                        secondsLeft: secondsLeft,
                        totalSeconds: totalSeconds,
                        timerCtrl: timerCtrl,
                        colorFor: _timerColorFor,
                        isDark: isDark,
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimerRing extends StatelessWidget {
  final int secondsLeft;
  final int totalSeconds;
  final AnimationController timerCtrl;
  final Color Function(double fraction) colorFor;
  final bool isDark;

  const _TimerRing({
    super.key,
    required this.secondsLeft,
    required this.totalSeconds,
    required this.timerCtrl,
    required this.colorFor,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 54,
      height: 54,
      child: AnimatedBuilder(
        animation: timerCtrl,
        builder: (_, __) {
          final fraction = totalSeconds > 0
              ? (1.0 - timerCtrl.value).clamp(0.0, 1.0)
              : 0.0;
          final color = colorFor(fraction);
          return Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 54,
                height: 54,
                child: CircularProgressIndicator(
                  value: fraction,
                  strokeWidth: 4,
                  backgroundColor: AppConfig.subtleOverlay(isDark),
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
              Text(
                '$secondsLeft',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SubmittedPill extends StatelessWidget {
  final int secondsLeft;
  final bool isDark;

  const _SubmittedPill({
    super.key,
    required this.secondsLeft,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: AppConfig.successColor.withOpacity(isDark ? 0.12 : 0.18),
        borderRadius: BorderRadius.circular(27),
        border: Border.all(
          color: AppConfig.successColor.withOpacity(isDark ? 0.3 : 0.5),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.check_rounded,
            size: 16,
            color: AppConfig.successColor,
          ),
          const SizedBox(width: 6),
          const Text(
            'Submitted',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppConfig.successColor,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${secondsLeft}s',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppConfig.successColor.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Question card
// ─────────────────────────────────────────────────────────────────────────────

class _QuestionCard extends StatelessWidget {
  final QuizQuestionPayload question;
  final bool hasImage;
  final bool isDark;

  const _QuestionCard({
    required this.question,
    required this.hasImage,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      decoration: BoxDecoration(
        color: AppConfig.cardColor(isDark),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppConfig.subtleOverlay(isDark)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasImage)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                question.questionImage!,
                fit: BoxFit.cover,
                loadingBuilder: (_, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return Container(
                    color: AppConfig.cardColor(isDark),
                    child: Center(
                      child: CircularProgressIndicator(
                        value: loadingProgress.expectedTotalBytes != null
                            ? loadingProgress.cumulativeBytesLoaded /
                                  loadingProgress.expectedTotalBytes!
                            : null,
                        strokeWidth: 2,
                        color: AppConfig.primaryColor,
                      ),
                    ),
                  );
                },
                errorBuilder: (_, __, ___) => Container(
                  color: AppConfig.cardColor(isDark),
                  height: 160,
                  child: Center(
                    child: Icon(
                      Icons.image_not_supported_outlined,
                      color: AppConfig.mutedTextColor(isDark),
                      size: 32,
                    ),
                  ),
                ),
              ),
            ),

          Padding(
            padding: EdgeInsets.fromLTRB(24, hasImage ? 32 : 32, 24, 32),
            child: Text(
              question.questionText,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: hasImage ? 17 : 20,
                fontWeight: FontWeight.w700,
                color: AppConfig.bodyTextColor(isDark),
                height: 1.45,
                letterSpacing: -0.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Answers
// ─────────────────────────────────────────────────────────────────────────────

class _AnswerGrid extends StatelessWidget {
  final List<QuizOptionPayload> options;
  final String? selectedId;
  final bool locked;
  final bool revealed;
  final List<String> correctOptionIds;
  final void Function(String id) onTap;
  final List<Color> colors;
  final List<String> shapes;
  final bool isDark;

  const _AnswerGrid({
    required this.options,
    required this.selectedId,
    required this.locked,
    required this.revealed,
    required this.correctOptionIds,
    required this.onTap,
    required this.colors,
    required this.shapes,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final crossAxisCount = options.length <= 2 ? 1 : 2;
    final rows = <Widget>[];
    for (var i = 0; i < options.length; i += crossAxisCount) {
      final rowWidgets = <Widget>[];
      for (var j = i; j < i + crossAxisCount && j < options.length; j++) {
        final option = options[j];
        rowWidgets.add(
          Expanded(
            child: _AnswerTile(
              option: option,
              baseColor: colors[j % colors.length],
              shape: shapes[j % shapes.length],
              selectedId: selectedId,
              locked: locked,
              revealed: revealed,
              isCorrect: correctOptionIds.contains(option.id),
              onTap: onTap,
              revealStaggerIndex: correctOptionIds.contains(option.id)
                  ? options.length
                  : j,
              isDark: isDark,
            ),
          ),
        );
        if (j + 1 < i + crossAxisCount && j + 1 < options.length) {
          rowWidgets.add(const SizedBox(width: 10));
        }
      }
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: rowWidgets,
          ),
        ),
      );
      if (i + crossAxisCount < options.length) {
        rows.add(const SizedBox(height: 10));
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(children: rows),
    );
  }
}

class _AnswerTile extends StatefulWidget {
  final QuizOptionPayload option;
  final Color baseColor;
  final String shape;
  final String? selectedId;
  final bool locked;
  final bool revealed;
  final bool isCorrect;
  final void Function(String id) onTap;
  final int revealStaggerIndex;
  final bool isDark;

  const _AnswerTile({
    required this.option,
    required this.baseColor,
    required this.shape,
    required this.selectedId,
    required this.locked,
    required this.revealed,
    required this.isCorrect,
    required this.onTap,
    required this.revealStaggerIndex,
    required this.isDark,
  });

  @override
  State<_AnswerTile> createState() => _AnswerTileState();
}

class _AnswerTileState extends State<_AnswerTile>
    with TickerProviderStateMixin {
  late AnimationController _revealCtrl;
  late Animation<double> _scaleAnim;
  late Animation<double> _glowAnim;
  bool _revealedOnce = false;
  late AnimationController _pendingCtrl;

  @override
  void initState() {
    super.initState();
    _revealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _scaleAnim = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(
          begin: 1.0,
          end: widget.isCorrect ? 1.10 : 0.96,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween(
          begin: widget.isCorrect ? 1.10 : 0.96,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.elasticOut)),
        weight: 60,
      ),
    ]).animate(_revealCtrl);

    _glowAnim = CurvedAnimation(parent: _revealCtrl, curve: Curves.easeOut);

    _pendingCtrl = AnimationController(
      vsync: this,
      value: widget.selectedId == widget.option.id ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 70),
    );
  }

  @override
  void didUpdateWidget(_AnswerTile old) {
    super.didUpdateWidget(old);
    if (widget.revealed && !old.revealed && !_revealedOnce) {
      _revealedOnce = true;
      final delay = Duration(milliseconds: widget.revealStaggerIndex * 80);
      Future.delayed(delay, () {
        if (mounted) _revealCtrl.forward(from: 0);
      });
    }

    final wasPending = old.selectedId == widget.option.id;
    final isPending = widget.selectedId == widget.option.id;
    if (isPending != wasPending) {
      if (isPending) {
        _pendingCtrl.forward();
      } else {
        _pendingCtrl.reverse();
      }
    }
  }

  @override
  void dispose() {
    _revealCtrl.dispose();
    _pendingCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final option = widget.option;
    final baseColor = widget.baseColor;
    final isDark = widget.isDark;

    final isSelected = widget.selectedId == option.id;
    final isCorrect = widget.isCorrect;
    final locked = widget.locked;

    Color tileColor;
    Color textColor;
    Color bgColor;
    Color borderColor;
    double borderWidth;
    double tileOpacity;
    IconData? trailingIcon;
    Color? trailingIconColor;

    if (widget.revealed) {
      if (isCorrect) {
        tileColor = AppConfig.successColor;
        bgColor = AppConfig.successColor.withOpacity(isDark ? 0.18 : 0.25);
        textColor = AppConfig.successColor;
        borderColor = AppConfig.successColor;
        borderWidth = 2.0;
        tileOpacity = 1.0;
        trailingIcon = Icons.check_circle_rounded;
        trailingIconColor = AppConfig.successColor;
      } else if (isSelected && !isCorrect) {
        tileColor = AppConfig.errorColor;
        bgColor = AppConfig.errorColor.withOpacity(isDark ? 0.12 : 0.2);
        textColor = AppConfig.errorColor;
        borderColor = AppConfig.errorColor;
        borderWidth = 2.0;
        tileOpacity = 1.0;
        trailingIcon = Icons.cancel_rounded;
        trailingIconColor = AppConfig.errorColor;
      } else {
        tileColor = baseColor;
        bgColor = baseColor.withOpacity(isDark ? 0.06 : 0.1);
        textColor = baseColor.withOpacity(0.6);
        borderColor = baseColor.withOpacity(isDark ? 0.12 : 0.2);
        borderWidth = 1.0;
        tileOpacity = 1.0;
        trailingIcon = null;
        trailingIconColor = null;
      }
    } else if (locked) {
      // Locked (timer hit zero / already submitted) but the server hasn't
      // confirmed correctness yet — neutral dimmed state, no colors.
      tileColor = baseColor;
      bgColor = baseColor.withOpacity(isDark ? 0.06 : 0.1);
      textColor = baseColor.withOpacity(0.6);
      borderColor = baseColor.withOpacity(isDark ? 0.12 : 0.2);
      borderWidth = isSelected ? 1.5 : 1.0;
      tileOpacity = 1.0;
      trailingIcon = null;
      trailingIconColor = null;
    } else {
      tileColor = baseColor;
      textColor = isDark ? baseColor : baseColor.withOpacity(0.9);
      bgColor = baseColor.withOpacity(isDark ? 0.13 : 0.18);
      borderColor = baseColor.withOpacity(isDark ? 0.25 : 0.4);
      borderWidth = 1.0;
      tileOpacity = (isSelected == false && widget.selectedId != null)
          ? 0.55
          : 1.0;
      trailingIcon = null;
      trailingIconColor = null;
    }

    final showGlow = widget.revealed && isCorrect;
    final contrastText = isDark ? const Color(0xFF0C0E14) : Colors.white;

    return AnimatedBuilder(
      animation: Listenable.merge([_revealCtrl, _pendingCtrl]),
      builder: (_, child) {
        final scale = _revealedOnce ? _scaleAnim.value : 1.0;
        final glowOpacity = showGlow ? (_glowAnim.value * 0.45) : 0.0;
        final t = (locked || widget.revealed) ? 0.0 : _pendingCtrl.value;

        final effectiveBg = t == 0.0
            ? bgColor
            : Color.lerp(bgColor, baseColor, t)!;
        final effectiveBorderColor = t == 0.0
            ? borderColor
            : Color.lerp(borderColor, baseColor, t)!;
        final effectiveBorderWidth = borderWidth + (1.0 * t);
        final effectiveTextColor = t == 0.0
            ? textColor
            : Color.lerp(textColor, contrastText, t)!;
        final effectiveTileColor = t == 0.0
            ? tileColor
            : Color.lerp(tileColor, contrastText, t)!;
        final pendingGlowOpacity = (locked || widget.revealed) ? 0.0 : t * 0.22;

        return Transform.scale(
          scale: scale,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 350),
            opacity: tileOpacity,
            child: GestureDetector(
              onTap: locked ? null : () => widget.onTap(option.id),
              child: Container(
                constraints: BoxConstraints(
                  minHeight: option.optionText.length > 30 ? 100 : 90,
                ),
                decoration: BoxDecoration(
                  color: effectiveBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: effectiveBorderColor,
                    width: effectiveBorderWidth,
                  ),
                  boxShadow: [
                    if (pendingGlowOpacity > 0)
                      BoxShadow(
                        color: baseColor.withOpacity(pendingGlowOpacity),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    if (showGlow)
                      BoxShadow(
                        color: AppConfig.successColor.withOpacity(glowOpacity),
                        blurRadius: 22,
                        spreadRadius: 2,
                        offset: const Offset(0, 4),
                      ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      alignment: Alignment.center,
                      child: Text(
                        widget.shape,
                        style: TextStyle(
                          fontSize: 16,
                          color: effectiveTileColor,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if ((option.optionImage ?? '').isNotEmpty) ...[
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: AspectRatio(
                                  aspectRatio: 16 / 9,
                                  child: Image.network(
                                    option.optionImage!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) =>
                                        const SizedBox.shrink(),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                            ],
                            Text(
                              option.optionText,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: effectiveTextColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (trailingIcon != null)
                      Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: AnimatedScale(
                          scale: _revealedOnce ? 1.0 : 0.0,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.elasticOut,
                          child: Icon(
                            trailingIcon,
                            size: 18,
                            color: trailingIconColor,
                          ),
                        ),
                      )
                    else
                      const SizedBox(width: 12),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SubmitBar extends StatelessWidget {
  final bool isActive;
  final bool isSubmitted;
  final bool timerExpired;
  final Animation<double> pulseAnim;
  final VoidCallback onSubmit;
  final bool isDark;

  const _SubmitBar({
    required this.isActive,
    required this.isSubmitted,
    required this.timerExpired,
    required this.pulseAnim,
    required this.onSubmit,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    String label;
    Color bgColor;
    Color fgColor = const Color(0xFF0C0E14);
    bool tappable = false;

    if (timerExpired && !isSubmitted) {
      label = 'Time\'s up!';
      bgColor = AppConfig.emptyButtonColor(isDark);
      fgColor = AppConfig.mutedTextColor(isDark);
    } else if (isSubmitted) {
      label = '✓ Answer Submitted — Waiting for timer...';
      bgColor = AppConfig.successColor.withOpacity(isDark ? 0.15 : 0.2);
      fgColor = AppConfig.successColor;
    } else if (isActive) {
      label = 'Submit Answer';
      bgColor = AppConfig.primaryColor;
      tappable = true;
    } else {
      label = 'Select an answer first';
      bgColor = AppConfig.emptyButtonColor(isDark);
      fgColor = AppConfig.mutedTextColor(isDark);
    }

    final button = GestureDetector(
      onTap: tappable ? onSubmit : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        height: 56,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(18),
          boxShadow: tappable
              ? [
                  BoxShadow(
                    color: AppConfig.primaryColor.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ]
              : null,
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: fgColor,
            ),
          ),
        ),
      ),
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: BoxDecoration(
        color: AppConfig.scaffoldColor(isDark),
        border: Border(top: BorderSide(color: AppConfig.subtleOverlay(isDark))),
      ),
      child: tappable
          ? ScaleTransition(scale: pulseAnim, child: button)
          : button,
    );
  }
}
