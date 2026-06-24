import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/quiz_dummy_data.dart';

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/// Tracks everything for the current question.
class _QuizPlayState {
  /// Index into [DemoQuiz.questions].
  final int questionIndex;

  /// The answer the user has tapped but NOT yet submitted.
  final String? pendingAnswerId;

  /// The answer that was locked in by pressing Submit (or by timer expiry).
  final String? submittedAnswerId;

  /// True once the timer has fully elapsed — triggers answer reveal.
  final bool timerExpired;

  /// Current seconds remaining on the timer.
  final int secondsLeft;

  const _QuizPlayState({
    required this.questionIndex,
    this.pendingAnswerId,
    this.submittedAnswerId,
    this.timerExpired = false,
    required this.secondsLeft,
  });

  /// Whether the user has already submitted (not just selected).
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

  // ── Timer ──────────────────────────────────────────────────────────────────

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
        // Timer hit zero: lock with whatever is submitted (or nothing)
        setState(() {
          _state = _state.copyWith(
            timerExpired: true,
            secondsLeft: 0,
            // If user never submitted, auto-submit their pending selection
            // (or null if they never selected anything)
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

  // ── Question helpers ───────────────────────────────────────────────────────

  DemoQuestion get _currentQuestion => _quiz.questions[_state.questionIndex];

  // ── User actions ───────────────────────────────────────────────────────────

  /// Tapping an answer tile only sets a pending selection — does NOT lock.
  void _onAnswerTapped(String id) {
    if (_state.hasSubmitted || _state.timerExpired) return;
    HapticFeedback.selectionClick();
    setState(() {
      if (_state.pendingAnswerId == id) {
        // Tapping the already-selected option again deselects it.
        _state = _state.copyWith(clearPending: true);
      } else {
        _state = _state.copyWith(pendingAnswerId: id);
      }
    });
  }

  /// Submit button confirms the pending selection and locks the answer.
  /// Timer keeps running after this — answer reveal happens when timer ends.
  void _onSubmitPressed() {
    if (_state.pendingAnswerId == null) return;
    if (_state.hasSubmitted || _state.timerExpired) return;
    HapticFeedback.mediumImpact();
    setState(() {
      _state = _state.copyWith(submittedAnswerId: _state.pendingAnswerId);
    });
    // Timer continues running — we do NOT call _goToLeaderboard() yet.
    // The timer's own callback will trigger navigation when it reaches 0.
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  void _goToLeaderboard() {
    if (_navigatingToLeaderboard || !mounted) return;
    _navigatingToLeaderboard = true;
    _timer?.cancel();

    final isLast = _state.questionIndex >= _quiz.questions.length - 1;

    // Last question → skip the leaderboard, go straight to final results.
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

  // ── Answer colors & shapes ─────────────────────────────────────────────────

  static const _answerColors = [
    Color(0xFF6C8EFF), // A
    Color(0xFFFF6B6B), // B
    Color(0xFFC8FF57), // C
    Color(0xFFFFD166), // D
    Color(0xFFFF9F43), // E
    Color(0xFF48CFAD), // F
  ];

  static const _answerShapes = ['▲', '◆', '●', '■', '★', '♥'];

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final q = _currentQuestion;
    final totalQ = _quiz.questions.length;
    final idx = _state.questionIndex;
    final hasImage = q.imageUrl != null && q.imageUrl!.isNotEmpty;

    // Whether the submit button should be active
    final submitActive = _state.pendingAnswerId != null && !_state.hasSubmitted;

    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ────────────────────────────────────────────────
            _HeaderBar(
              current: idx + 1,
              total: totalQ,
              secondsLeft: _state.secondsLeft,
              totalSeconds: q.timerSeconds,
              isSubmitted: _state.hasSubmitted,
              timerCtrl: _timerCtrl,
            ),

            // ── Question + answers (scrollable if image present) ──────
            Expanded(
              child: FadeTransition(
                opacity: _questionFade,
                child: SlideTransition(
                  position: _questionSlide,
                  child: SingleChildScrollView(
                    physics: const ClampingScrollPhysics(),
                    child: Column(
                      children: [
                        // Question card (with optional image)
                        _QuestionCard(question: q, hasImage: hasImage),

                        const SizedBox(height: 12),

                        // Answer tiles
                        _AnswerGrid(
                          answers: q.answers,
                          pendingId: _state.pendingAnswerId,
                          submittedId: _state.submittedAnswerId,
                          timerExpired: _state.timerExpired,
                          onTap: _onAnswerTapped,
                          colors: _answerColors,
                          shapes: _answerShapes,
                        ),

                        // Space for the fixed submit button
                        const SizedBox(height: 80),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Submit button (fixed at bottom) ───────────────────────
            _SubmitBar(
              isActive: submitActive,
              isSubmitted: _state.hasSubmitted,
              timerExpired: _state.timerExpired,
              pulseAnim: _submitPulse,
              onSubmit: _onSubmitPressed,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header Bar
// ─────────────────────────────────────────────────────────────────────────────

class _HeaderBar extends StatelessWidget {
  final int current;
  final int total;
  final int secondsLeft;
  final int totalSeconds;
  final bool isSubmitted;
  final AnimationController timerCtrl;

  const _HeaderBar({
    required this.current,
    required this.total,
    required this.secondsLeft,
    required this.totalSeconds,
    required this.isSubmitted,
    required this.timerCtrl,
  });

  Color _timerColorFor(double fraction) {
    if (fraction <= 0) return const Color(0xFFFF6B6B);
    if (fraction > 0.5) return const Color(0xFFC8FF57);
    if (fraction > 0.25) return const Color(0xFFFFD166);
    return const Color(0xFFFF6B6B);
  }

  @override
  Widget build(BuildContext context) {
    final showPill = isSubmitted && secondsLeft > 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          // Question counter + progress bar
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'QUESTION $current OF $total',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF7A8499),
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
                    backgroundColor: const Color(0xFFFFFFFF).withOpacity(0.08),
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      Color(0xFFC8FF57),
                    ),
                  ),
                ),
              ),
            ],
          ),

          const Spacer(),

          // Fixed-size slot: identical footprint for both the timer ring and
          // the "Submitted" pill, so swapping between them never reflows
          // the rest of the page.
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
                      )
                    : _TimerRing(
                        key: const ValueKey('ring'),
                        secondsLeft: secondsLeft,
                        totalSeconds: totalSeconds,
                        timerCtrl: timerCtrl,
                        colorFor: _timerColorFor,
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timer Ring — smooth, continuous progress driven directly by the
// AnimationController's elapsed value rather than the once-per-second tick.
// ─────────────────────────────────────────────────────────────────────────────

class _TimerRing extends StatelessWidget {
  final int secondsLeft;
  final int totalSeconds;
  final AnimationController timerCtrl;
  final Color Function(double fraction) colorFor;

  const _TimerRing({
    super.key,
    required this.secondsLeft,
    required this.totalSeconds,
    required this.timerCtrl,
    required this.colorFor,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 54,
      height: 54,
      child: AnimatedBuilder(
        animation: timerCtrl,
        builder: (_, __) {
          // timerCtrl runs 0 → 1 over totalSeconds, so remaining fraction
          // is the complement — this updates every frame, not every second.
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
                  backgroundColor: const Color(0xFFFFFFFF).withOpacity(0.08),
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

// ─────────────────────────────────────────────────────────────────────────────
// Submitted Pill — same 54px height as the timer ring so the header never
// resizes when switching between the two states.
// ─────────────────────────────────────────────────────────────────────────────

class _SubmittedPill extends StatelessWidget {
  final int secondsLeft;

  const _SubmittedPill({super.key, required this.secondsLeft});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF22C55E).withOpacity(0.12),
        borderRadius: BorderRadius.circular(27),
        border: Border.all(color: const Color(0xFF22C55E).withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_rounded, size: 16, color: Color(0xFF22C55E)),
          const SizedBox(width: 6),
          const Text(
            'Submitted',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF22C55E),
            ),
          ),
          const SizedBox(width: 8),
          // Still shows the countdown even after submit
          Text(
            '${secondsLeft}s',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF22C55E).withOpacity(0.6),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Card  (with optional image)
// ─────────────────────────────────────────────────────────────────────────────

class _QuestionCard extends StatelessWidget {
  final DemoQuestion question;
  final bool hasImage;

  const _QuestionCard({required this.question, required this.hasImage});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      decoration: BoxDecoration(
        color: const Color(0xFF161B26),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFFFFFF).withOpacity(0.07)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      // Clip so the image fills the rounded corners cleanly
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Image (only when imageUrl is set) ───────────────────────
          if (hasImage)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                question.imageUrl!,
                fit: BoxFit.cover,
                // Loading placeholder
                loadingBuilder: (_, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return Container(
                    color: const Color(0xFF0D1117),
                    child: Center(
                      child: CircularProgressIndicator(
                        value: loadingProgress.expectedTotalBytes != null
                            ? loadingProgress.cumulativeBytesLoaded /
                                  loadingProgress.expectedTotalBytes!
                            : null,
                        strokeWidth: 2,
                        color: const Color(0xFFC8FF57),
                      ),
                    ),
                  );
                },
                // Error fallback — shows nothing so question still works
                errorBuilder: (_, __, ___) => Container(
                  color: const Color(0xFF0D1117),
                  height: 160,
                  child: const Center(
                    child: Icon(
                      Icons.image_not_supported_outlined,
                      color: Color(0xFF7A8499),
                      size: 32,
                    ),
                  ),
                ),
              ),
            ),

          // ── Question text ────────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(24, hasImage ? 32 : 32, 24, 32),
            child: Text(
              question.text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: hasImage ? 17 : 20,
                fontWeight: FontWeight.w700,
                color: Colors.white,
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
// Answer Grid
// ─────────────────────────────────────────────────────────────────────────────

class _AnswerGrid extends StatelessWidget {
  final List<DemoAnswer> answers;
  final String? pendingId;
  final String? submittedId;
  final bool timerExpired;
  final void Function(String id) onTap;
  final List<Color> colors;
  final List<String> shapes;

  const _AnswerGrid({
    required this.answers,
    required this.pendingId,
    required this.submittedId,
    required this.timerExpired,
    required this.onTap,
    required this.colors,
    required this.shapes,
  });

  @override
  Widget build(BuildContext context) {
    final crossAxisCount = answers.length <= 2 ? 1 : 2;
    // Build rows manually so we can stagger per-tile reveal animations
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
              // Stagger index: correct answer tile always animates last
              // so wrong tiles dim first, then correct lights up.
              revealStaggerIndex: answers[j].isCorrect
                  ? answers
                        .length // correct always last
                  : j,
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

// ─────────────────────────────────────────────────────────────────────────────
// Answer Tile  (handles its own reveal animation)
// ─────────────────────────────────────────────────────────────────────────────

class _AnswerTile extends StatefulWidget {
  final DemoAnswer answer;
  final Color baseColor;
  final String shape;
  final String? pendingId;
  final String? submittedId;
  final bool timerExpired;
  final void Function(String id) onTap;

  /// Lower index = animates sooner. Correct tile uses a higher index
  /// so it "lights up" after wrong tiles have already dimmed.
  final int revealStaggerIndex;

  const _AnswerTile({
    required this.answer,
    required this.baseColor,
    required this.shape,
    required this.pendingId,
    required this.submittedId,
    required this.timerExpired,
    required this.onTap,
    required this.revealStaggerIndex,
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

  // Drives the selected/unselected ("pending") glow smoothly — separate
  // from AnimatedContainer's implicit decoration tween, which jumps when
  // several properties (color, border, shadow) change in the same frame.
  late AnimationController _pendingCtrl;

  @override
  void initState() {
    super.initState();
    _revealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    // Correct tile: bouncy scale-up punch
    // Wrong/dim tiles: quick scale-down settle
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
    // Trigger reveal animation when timerExpired flips to true
    if (widget.timerExpired && !old.timerExpired && !_revealed) {
      _revealed = true;
      final delay = Duration(milliseconds: widget.revealStaggerIndex * 80);
      Future.delayed(delay, () {
        if (mounted) _revealCtrl.forward(from: 0);
      });
    }

    // Smoothly glow in/out as this tile becomes (or stops being) the
    // pending selection — handles both "tap to select" and "tap a
    // different tile" cases with the same easing curve.
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

    final isSubmitted = widget.submittedId == answer.id;
    final isCorrect = answer.isCorrect;
    final locked = widget.submittedId != null || widget.timerExpired;

    // ── Reveal-phase visual properties (unaffected by pending glow) ────────
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
        tileColor = const Color(0xFF22C55E);
        bgColor = const Color(0xFF22C55E).withOpacity(0.18);
        textColor = const Color(0xFF22C55E);
        borderColor = const Color(0xFF22C55E);
        borderWidth = 2.0;
        tileOpacity = 1.0;
        trailingIcon = Icons.check_circle_rounded;
        trailingIconColor = const Color(0xFF22C55E);
      } else if (isSubmitted && !isCorrect) {
        tileColor = const Color(0xFFFF6B6B);
        bgColor = const Color(0xFFFF6B6B).withOpacity(0.12);
        textColor = const Color(0xFFFF6B6B);
        borderColor = const Color(0xFFFF6B6B);
        borderWidth = 2.0;
        tileOpacity = 1.0;
        trailingIcon = Icons.cancel_rounded;
        trailingIconColor = const Color(0xFFFF6B6B);
      } else {
        // Incorrect, not selected — dim
        tileColor = baseColor;
        bgColor = baseColor.withOpacity(0.06);
        textColor = baseColor.withOpacity(0.4);
        borderColor = baseColor.withOpacity(0.12);
        borderWidth = 1.0;
        tileOpacity = 1.0;
        trailingIcon = null;
        trailingIconColor = null;
      }
    } else {
      // Pre-reveal base values at rest (pending glow handled separately
      // below via _pendingCtrl so selecting/deselecting animates smoothly).
      tileColor = baseColor;
      textColor = baseColor;
      bgColor = baseColor.withOpacity(0.13);
      borderColor = baseColor.withOpacity(0.25);
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

    // ── Glow shadow only on correct tile during reveal ─────────────────────
    final showGlow = widget.timerExpired && isCorrect;
    const darkText = Color(0xFF0C0E14);

    return AnimatedBuilder(
      animation: Listenable.merge([_revealCtrl, _pendingCtrl]),
      builder: (_, child) {
        final scale = _revealed ? _scaleAnim.value : 1.0;
        final glowOpacity = showGlow ? (_glowAnim.value * 0.45) : 0.0;

        // t = 0 → resting/unselected, t = 1 → fully selected (pending).
        // Animates continuously in both directions, so selecting a new
        // tile and the previous tile losing its glow look identical in
        // smoothness — no abrupt jump.
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
            : Color.lerp(textColor, darkText, t)!;
        final effectiveTileColor = t == 0.0
            ? tileColor
            : Color.lerp(tileColor, darkText, t)!;
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
                        color: const Color(0xFF22C55E).withOpacity(glowOpacity),
                        blurRadius: 22,
                        spreadRadius: 2,
                        offset: const Offset(0, 4),
                      ),
                  ],
                ),
                child: Row(
                  children: [
                    // Shape
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
                    // Text
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
                    // Trailing icon (reveal phase only)
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

// ─────────────────────────────────────────────────────────────────────────────
// Submit Bar
// ─────────────────────────────────────────────────────────────────────────────

class _SubmitBar extends StatelessWidget {
  final bool isActive;
  final bool isSubmitted;
  final bool timerExpired;
  final Animation<double> pulseAnim;
  final VoidCallback onSubmit;

  const _SubmitBar({
    required this.isActive,
    required this.isSubmitted,
    required this.timerExpired,
    required this.pulseAnim,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    // Determine button state and label
    String label;
    Color bgColor;
    Color fgColor = const Color(0xFF0C0E14);
    bool tappable = false;

    if (timerExpired) {
      label = 'Time\'s up!';
      bgColor = const Color(0xFF2A2E3D);
      fgColor = const Color(0xFF7A8499);
    } else if (isSubmitted) {
      label = '✓ Answer Submitted — Waiting for timer...';
      bgColor = const Color(0xFF22C55E).withOpacity(0.15);
      fgColor = const Color(0xFF22C55E);
    } else if (isActive) {
      label = 'Submit Answer';
      bgColor = const Color(0xFFC8FF57);
      tappable = true;
    } else {
      label = 'Select an answer first';
      bgColor = const Color(0xFF2A2E3D);
      fgColor = const Color(0xFF7A8499);
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
                    color: const Color(0xFFC8FF57).withOpacity(0.3),
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
        color: const Color(0xFF0D1117),
        border: Border(
          top: BorderSide(color: const Color(0xFFFFFFFF).withOpacity(0.05)),
        ),
      ),
      child: tappable
          ? ScaleTransition(scale: pulseAnim, child: button)
          : button,
    );
  }
}
