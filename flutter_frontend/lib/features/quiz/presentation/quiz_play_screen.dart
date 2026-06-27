import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/quiz_dummy_data.dart';
import '../../../config/app_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

class _QuizPlayState {
  final int questionIndex;
  final String? pendingAnswerId;
  final String? submittedAnswerId;
  final bool timerExpired;
  final int secondsLeft;

  const _QuizPlayState({
    required this.questionIndex,
    this.pendingAnswerId,
    this.submittedAnswerId,
    this.timerExpired = false,
    required this.secondsLeft,
  });

  bool get hasSubmitted => submittedAnswerId != null;

  _QuizPlayState copyWith({
    int? questionIndex,
    String? pendingAnswerId,
    bool clearPending = false,
    String? submittedAnswerId,
    bool? timerExpired,
    int? secondsLeft,
  }) {
    return _QuizPlayState(
      questionIndex: questionIndex ?? this.questionIndex,
      pendingAnswerId: clearPending
          ? null
          : (pendingAnswerId ?? this.pendingAnswerId),
      submittedAnswerId: submittedAnswerId ?? this.submittedAnswerId,
      timerExpired: timerExpired ?? this.timerExpired,
      secondsLeft: secondsLeft ?? this.secondsLeft,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class QuizPlayScreen extends ConsumerStatefulWidget {
  final String quizId;
  const QuizPlayScreen({super.key, required this.quizId});

  @override
  ConsumerState<QuizPlayScreen> createState() => _QuizPlayScreenState();
}

class _QuizPlayScreenState extends ConsumerState<QuizPlayScreen>
    with TickerProviderStateMixin {
  late DemoQuiz _quiz;
  late _QuizPlayState _state;
  Timer? _timer;
  bool _navigatingToLeaderboard = false;

  late AnimationController _questionSlideCtrl;
  late Animation<Offset> _questionSlide;
  late Animation<double> _questionFade;

  late AnimationController _timerCtrl;
  late AnimationController _submitPulseCtrl;
  late Animation<double> _submitPulse;

  @override
  void initState() {
    super.initState();
    _quiz = demoUpcomingQuizzes.firstWhere(
      (q) => q.id == widget.quizId,
      orElse: () => demoUpcomingQuizzes.first,
    );
    _state = _QuizPlayState(
      questionIndex: 0,
      secondsLeft: _quiz.questions.first.timerSeconds,
    );

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

    _questionSlideCtrl.forward();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _navigatingToLeaderboard = false;
    final q = _currentQuestion;
    _timerCtrl.duration = Duration(seconds: q.timerSeconds);
    _timerCtrl.forward(from: 0);

    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final left = _state.secondsLeft - 1;
      if (left <= 0) {
        _timer?.cancel();
        setState(() {
          _state = _state.copyWith(
            timerExpired: true,
            secondsLeft: 0,
            submittedAnswerId:
                _state.submittedAnswerId ?? _state.pendingAnswerId,
          );
        });
        Future.delayed(const Duration(seconds: 2), () {
          if (!mounted) return;
          _goToLeaderboard();
        });
      } else {
        setState(() => _state = _state.copyWith(secondsLeft: left));
      }
    });
  }

  DemoQuestion get _currentQuestion => _quiz.questions[_state.questionIndex];

  void _onAnswerTapped(String id) {
    if (_state.hasSubmitted || _state.timerExpired) return;
    HapticFeedback.selectionClick();
    setState(() {
      if (_state.pendingAnswerId == id) {
        _state = _state.copyWith(clearPending: true);
      } else {
        _state = _state.copyWith(pendingAnswerId: id);
      }
    });
  }

  void _onSubmitPressed() {
    if (_state.pendingAnswerId == null) return;
    if (_state.hasSubmitted || _state.timerExpired) return;
    HapticFeedback.mediumImpact();
    setState(() {
      _state = _state.copyWith(submittedAnswerId: _state.pendingAnswerId);
    });
  }

  void _goToLeaderboard() {
    if (_navigatingToLeaderboard || !mounted) return;
    _navigatingToLeaderboard = true;
    _timer?.cancel();

    final isLast = _state.questionIndex >= _quiz.questions.length - 1;

    if (isLast) {
      context.pushReplacement('/quiz/${widget.quizId}/results');
      return;
    }

    final correctId = _currentQuestion.answers
        .firstWhere((a) => a.isCorrect)
        .id;

    context
        .push(
          '/quiz/${widget.quizId}/leaderboard',
          extra: {
            'questionIndex': _state.questionIndex,
            'isLast': false,
            'submittedAnswerId': _state.submittedAnswerId,
            'correctAnswerId': correctId,
          },
        )
        .then((_) {
          if (!mounted) return;
          _advanceQuestion();
        });
  }

  void _advanceQuestion() {
    final next = _state.questionIndex + 1;
    if (next >= _quiz.questions.length) {
      context.pushReplacement('/quiz/${widget.quizId}/results');
      return;
    }
    _questionSlideCtrl.reset();
    setState(() {
      _state = _QuizPlayState(
        questionIndex: next,
        secondsLeft: _quiz.questions[next].timerSeconds,
      );
    });
    _questionSlideCtrl.forward();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _questionSlideCtrl.dispose();
    _timerCtrl.dispose();
    _submitPulseCtrl.dispose();
    super.dispose();
  }

  static const _answerShapes = ['▲', '◆', '●', '■', '★', '♥'];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final q = _currentQuestion;
    final totalQ = _quiz.questions.length;
    final idx = _state.questionIndex;
    final hasImage = q.imageUrl != null && q.imageUrl!.isNotEmpty;

    final submitActive = _state.pendingAnswerId != null && !_state.hasSubmitted;

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
      body: SafeArea(
        child: Column(
          children: [
            _HeaderBar(
              current: idx + 1,
              total: totalQ,
              secondsLeft: _state.secondsLeft,
              totalSeconds: q.timerSeconds,
              isSubmitted: _state.hasSubmitted,
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
                          question: q,
                          hasImage: hasImage,
                          isDark: isDark,
                        ),

                        const SizedBox(height: 12),

                        _AnswerGrid(
                          answers: q.answers,
                          pendingId: _state.pendingAnswerId,
                          submittedId: _state.submittedAnswerId,
                          timerExpired: _state.timerExpired,
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
              isSubmitted: _state.hasSubmitted,
              timerExpired: _state.timerExpired,
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
                    value: current / total,
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

class _QuestionCard extends StatelessWidget {
  final DemoQuestion question;
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
                question.imageUrl!,
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
              question.text,
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

class _AnswerGrid extends StatelessWidget {
  final List<DemoAnswer> answers;
  final String? pendingId;
  final String? submittedId;
  final bool timerExpired;
  final void Function(String id) onTap;
  final List<Color> colors;
  final List<String> shapes;
  final bool isDark;

  const _AnswerGrid({
    required this.answers,
    required this.pendingId,
    required this.submittedId,
    required this.timerExpired,
    required this.onTap,
    required this.colors,
    required this.shapes,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final crossAxisCount = answers.length <= 2 ? 1 : 2;
    final rows = <Widget>[];
    for (var i = 0; i < answers.length; i += crossAxisCount) {
      final rowWidgets = <Widget>[];
      for (var j = i; j < i + crossAxisCount && j < answers.length; j++) {
        rowWidgets.add(
          Expanded(
            child: _AnswerTile(
              answer: answers[j],
              baseColor: colors[j % colors.length],
              shape: shapes[j % shapes.length],
              pendingId: pendingId,
              submittedId: submittedId,
              timerExpired: timerExpired,
              onTap: onTap,
              revealStaggerIndex: answers[j].isCorrect ? answers.length : j,
              isDark: isDark,
            ),
          ),
        );
        if (j + 1 < i + crossAxisCount && j + 1 < answers.length) {
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
      if (i + crossAxisCount < answers.length) {
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
  final DemoAnswer answer;
  final Color baseColor;
  final String shape;
  final String? pendingId;
  final String? submittedId;
  final bool timerExpired;
  final void Function(String id) onTap;
  final int revealStaggerIndex;
  final bool isDark;

  const _AnswerTile({
    required this.answer,
    required this.baseColor,
    required this.shape,
    required this.pendingId,
    required this.submittedId,
    required this.timerExpired,
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
  bool _revealed = false;
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
          end: widget.answer.isCorrect ? 1.10 : 0.96,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween(
          begin: widget.answer.isCorrect ? 1.10 : 0.96,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.elasticOut)),
        weight: 60,
      ),
    ]).animate(_revealCtrl);

    _glowAnim = CurvedAnimation(parent: _revealCtrl, curve: Curves.easeOut);

    _pendingCtrl = AnimationController(
      vsync: this,
      value: widget.pendingId == widget.answer.id ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 70),
    );
  }

  @override
  void didUpdateWidget(_AnswerTile old) {
    super.didUpdateWidget(old);
    if (widget.timerExpired && !old.timerExpired && !_revealed) {
      _revealed = true;
      final delay = Duration(milliseconds: widget.revealStaggerIndex * 80);
      Future.delayed(delay, () {
        if (mounted) _revealCtrl.forward(from: 0);
      });
    }

    final wasPending = old.pendingId == widget.answer.id;
    final isPending = widget.pendingId == widget.answer.id;
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
    final answer = widget.answer;
    final baseColor = widget.baseColor;
    final isDark = widget.isDark;

    final isSubmitted = widget.submittedId == answer.id;
    final isCorrect = answer.isCorrect;
    final locked = widget.submittedId != null || widget.timerExpired;

    Color tileColor;
    Color textColor;
    Color bgColor;
    Color borderColor;
    double borderWidth;
    double tileOpacity;
    IconData? trailingIcon;
    Color? trailingIconColor;

    if (widget.timerExpired) {
      if (isCorrect) {
        tileColor = AppConfig.successColor;
        bgColor = AppConfig.successColor.withOpacity(isDark ? 0.18 : 0.25);
        textColor = AppConfig.successColor;
        borderColor = AppConfig.successColor;
        borderWidth = 2.0;
        tileOpacity = 1.0;
        trailingIcon = Icons.check_circle_rounded;
        trailingIconColor = AppConfig.successColor;
      } else if (isSubmitted && !isCorrect) {
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
    } else {
      tileColor = baseColor;
      textColor = isDark ? baseColor : baseColor.withOpacity(0.9);
      bgColor = baseColor.withOpacity(isDark ? 0.13 : 0.18);
      borderColor = baseColor.withOpacity(isDark ? 0.25 : 0.4);
      borderWidth = 1.0;
      tileOpacity =
          (isSubmitted &&
              widget.submittedId != null &&
              widget.pendingId != answer.id)
          ? 0.55
          : 1.0;
      trailingIcon = null;
      trailingIconColor = null;
    }

    final showGlow = widget.timerExpired && isCorrect;
    final contrastText = isDark ? const Color(0xFF0C0E14) : Colors.white;

    return AnimatedBuilder(
      animation: Listenable.merge([_revealCtrl, _pendingCtrl]),
      builder: (_, child) {
        final scale = _revealed ? _scaleAnim.value : 1.0;
        final glowOpacity = showGlow ? (_glowAnim.value * 0.45) : 0.0;
        final t = widget.timerExpired ? 0.0 : _pendingCtrl.value;

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
        final pendingGlowOpacity = widget.timerExpired ? 0.0 : t * 0.22;

        return Transform.scale(
          scale: scale,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 350),
            opacity: tileOpacity,
            child: GestureDetector(
              onTap: locked ? null : () => widget.onTap(answer.id),
              child: Container(
                constraints: BoxConstraints(
                  minHeight: widget.answer.text.length > 30 ? 100 : 90,
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
                      child: Text(
                        answer.text,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: effectiveTextColor,
                        ),
                      ),
                    ),
                    if (trailingIcon != null)
                      Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: AnimatedScale(
                          scale: _revealed ? 1.0 : 0.0,
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

    if (timerExpired) {
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
