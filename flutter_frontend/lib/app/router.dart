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

/// The global router configuration for the app.
///
/// This GoRouter instance maps paths to their corresponding screens.
final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (context, state) => const SplashScreen()),

    // GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
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
  ],
);
