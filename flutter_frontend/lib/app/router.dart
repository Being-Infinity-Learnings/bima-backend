/// Application route definitions.
///
/// This file defines the URL routes and corresponding screens used by the app.
import 'package:flutter_frontend/features/auth/presentation/phone_login_screen.dart';
import 'package:go_router/go_router.dart';

import '../features/splash/presentation/splash_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/approval/presentation/waiting_approval_screen.dart';
import '../features/auth/presentation/complete_profile_screen.dart';
import '../features/auth/presentation/otp_verification_screen.dart';
import '../features/auth/presentation/blocked_screen.dart';
import '../core/navigation/app_shell.dart';
import '../core/navigation/route_observer.dart';

// Quiz screens
import '../features/quiz/presentation/quiz_waiting_screen.dart';
import '../features/quiz/presentation/quiz_lobby_screen.dart';
import '../features/quiz/presentation/quiz_play_screen.dart';
import '../features/quiz/presentation/quiz_leaderboard_screen.dart';
import '../features/quiz/presentation/quiz_results_screen.dart';
import '../features/quiz/presentation/quiz_phase_sync.dart';

/// The global router configuration for the app.
///
/// This GoRouter instance maps paths to their corresponding screens.
final appRouter = GoRouter(
  initialLocation: '/',
  observers: [routeObserver],
  routes: [
    GoRoute(path: '/', builder: (context, state) => const SplashScreen()),

    GoRoute(
      path: '/login',
      builder: (context, state) => const PhoneLoginScreen(),
    ),

    GoRoute(
      path: '/complete-profile',
      builder: (context, state) => const CompleteProfileScreen(),
    ),

    GoRoute(
      path: '/approval',
      builder: (context, state) => const WaitingApprovalScreen(),
    ),

    GoRoute(path: '/home', builder: (context, state) => const AppShell()),

    GoRoute(
      path: '/otp',
      builder: (context, state) => const OtpVerificationScreen(),
    ),

    GoRoute(
      path: '/blocked',
      builder: (context, state) => const BlockedScreen(),
    ),

    // ── Quiz flow ────────────────────────────────────────────────────────────
    //
    // /quiz/:quizId/waiting      → polls the backend until the host opens the
    //                              lobby (no socket connection yet)
    // /quiz/:quizId/lobby        → opens the socket connection, joins the
    //                              quiz room, live countdown + participants
    // /quiz/:quizId/play         → active question screen
    // /quiz/:quizId/leaderboard  → per-question leaderboard
    // /quiz/:quizId/results      → final podium screen
    //
    GoRoute(
      path: '/quiz/:quizId/waiting',
      builder: (context, state) =>
          QuizWaitingScreen(quizId: state.pathParameters['quizId']!),
    ),

    // Every gameplay route below is wrapped in `QuizPhaseSync`, which is the
    // single place in the app that decides when to move from one quiz
    // screen to the next (driven purely by the server's `runtime.phase`).
    // The screens themselves no longer navigate on phase changes.
    GoRoute(
      path: '/quiz/:quizId/lobby',
      builder: (context, state) {
        final quizId = state.pathParameters['quizId']!;
        return QuizPhaseSync(
          quizId: quizId,
          child: QuizLobbyScreen(quizId: quizId),
        );
      },
    ),

    GoRoute(
      path: '/quiz/:quizId/play',
      builder: (context, state) {
        final quizId = state.pathParameters['quizId']!;
        return QuizPhaseSync(
          quizId: quizId,
          child: QuizPlayScreen(quizId: quizId),
        );
      },
    ),

    GoRoute(
      path: '/quiz/:quizId/leaderboard',
      builder: (context, state) {
        final quizId = state.pathParameters['quizId']!;
        return QuizPhaseSync(
          quizId: quizId,
          child: QuizLeaderboardScreen(quizId: quizId),
        );
      },
    ),

    GoRoute(
      path: '/quiz/:quizId/results',
      builder: (context, state) {
        final quizId = state.pathParameters['quizId']!;
        return QuizPhaseSync(
          quizId: quizId,
          child: QuizResultsScreen(quizId: quizId),
        );
      },
    ),
  ],
);
