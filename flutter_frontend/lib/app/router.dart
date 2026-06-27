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

// Quiz screens
import '../features/quiz/presentation/quiz_lobby_screen.dart';
import '../features/quiz/presentation/quiz_play_screen.dart';
import '../features/quiz/presentation/quiz_leaderboard_screen.dart';
import '../features/quiz/presentation/quiz_results_screen.dart';

/// The global router configuration for the app.
///
/// This GoRouter instance maps paths to their corresponding screens.
final appRouter = GoRouter(
  initialLocation: '/',
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
    // /quiz/:quizId/lobby        → waiting room with live countdown
    // /quiz/:quizId/play         → active question screen
    // /quiz/:quizId/leaderboard  → per-question leaderboard (pushed on top of play)
    // /quiz/:quizId/results      → final podium screen
    //
    GoRoute(
      path: '/quiz/:quizId/lobby',
      builder: (context, state) =>
          QuizLobbyScreen(quizId: state.pathParameters['quizId']!),
    ),

    GoRoute(
      path: '/quiz/:quizId/play',
      builder: (context, state) =>
          QuizPlayScreen(quizId: state.pathParameters['quizId']!),
    ),

    GoRoute(
      path: '/quiz/:quizId/leaderboard',
      builder: (context, state) => QuizLeaderboardScreen(
        quizId: state.pathParameters['quizId']!,
        extra: state.extra as Map<String, dynamic>?,
      ),
    ),

    GoRoute(
      path: '/quiz/:quizId/results',
      builder: (context, state) =>
          QuizResultsScreen(quizId: state.pathParameters['quizId']!),
    ),
  ],
);
