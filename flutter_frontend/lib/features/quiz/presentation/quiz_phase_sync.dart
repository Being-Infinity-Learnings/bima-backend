/// ════════════════════════════════════════════════════════════════════════════
/// Centralized phase → route navigation for the live quiz flow.
/// ════════════════════════════════════════════════════════════════════════════
///
/// Previously each of the four gameplay screens (lobby / play / leaderboard)
/// implemented its OWN copy of "if the phase changes, push the next route",
/// with slightly different bugs in each copy:
///   • some only reacted to *changes* (`ref.listen`) and never checked the
///     phase already in effect when the screen first mounted, so a phase
///     change that happened while the previous screen was navigating away
///     was silently missed → the new screen never advanced and sat on its
///     loading spinner forever;
///   • the play screen additionally tried to *guess* where to go next from
///     a snapshot of `state.phase` taken at the moment the reveal started,
///     which is racy because the server intentionally reports the new phase
///     ~2s after the reveal begins — so it usually guessed "leaderboard"
///     even when the real next phase was "results".
///
/// This widget is now the ONLY code in the app that navigates between quiz
/// phases. It is driven purely by `runtime.phase`, which is the server's
/// single source of truth, and it checks that phase both:
///   1. on every rebuild (covers "phase already moved on before we mounted"
///      / reconnect landing us on a stale route), and
///   2. on every subsequent change (covers live transitions).
///
/// Individual screens keep all of their own presentational state (reveal
/// colors, local countdown, animations) but never call
/// `context.go`/`pushReplacement` themselves for phase transitions.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/quiz_models.dart';
import '../providers/quiz_providers.dart';

/// The single mapping from server phase to route. Keep this in sync with
/// `router.dart`'s `/quiz/:quizId/...` routes — there should never be a
/// second place in the app that encodes this mapping.
String? quizRouteForPhase(String quizId, QuizPhase phase) {
  switch (phase) {
    case QuizPhase.lobby:
      return '/quiz/$quizId/lobby';
    case QuizPhase.question:
      return '/quiz/$quizId/play';
    case QuizPhase.leaderboard:
      return '/quiz/$quizId/leaderboard';
    case QuizPhase.results:
    case QuizPhase.completed:
      return '/quiz/$quizId/results';
    case QuizPhase.waiting:
    case QuizPhase.unknown:
      // The waiting screen manages its own pre-lobby polling and isn't
      // driven by the socket runtime, so there's nothing to navigate to.
      return null;
  }
}

/// Wrap the body of every live-quiz screen (lobby/play/leaderboard/results)
/// with this. It's a no-op visually — it just keeps the visible route in
/// lockstep with the server's authoritative phase.
class QuizPhaseSync extends ConsumerStatefulWidget {
  final String quizId;
  final Widget child;

  const QuizPhaseSync({super.key, required this.quizId, required this.child});

  @override
  ConsumerState<QuizPhaseSync> createState() => _QuizPhaseSyncState();
}

class _QuizPhaseSyncState extends ConsumerState<QuizPhaseSync> {
  bool _navigating = false;
  String? _lastTarget;

  @override
  void initState() {
    super.initState();
    // Covers the phase having already moved on by the time this screen
    // mounted (e.g. slow navigation, backgrounded app, reconnect). Runs
    // exactly once, after the first frame — never inside build().
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final phase = ref.read(
        quizRuntimeControllerProvider(widget.quizId).select((s) => s.phase),
      );
      _syncRoute(phase);
    });
  }

  void _syncRoute(QuizPhase phase) {
    final target = quizRouteForPhase(widget.quizId, phase);
    // Skip if there's nothing to do, we're already mid-navigation, or we'd
    // just be repeating the same push we already issued.
    if (target == null || _navigating || target == _lastTarget) return;

    final current = GoRouterState.of(context).uri.toString();
    if (current == target) return;

    _navigating = true;
    _lastTarget = target;
    // Defer to the next frame: we're reacting from inside ref.listen and
    // GoRouter doesn't allow navigating mid-build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigating = false;
      if (!mounted) return;
      final stillCurrent = GoRouterState.of(context).uri.toString();
      if (stillCurrent == target) return;
      context.pushReplacement(target);
    });
  }

  @override
  Widget build(BuildContext context) {
    // Covers live transitions that happen while this screen is mounted.
    // This is the ONLY thing that runs on every build — no unconditional
    // navigation check here, so a normal rebuild (e.g. leaderboard scores
    // updating) never re-triggers a route push.
    ref.listen<QuizPhase>(
      quizRuntimeControllerProvider(widget.quizId).select((s) => s.phase),
      (previous, next) => _syncRoute(next),
    );

    return widget.child;
  }
}
