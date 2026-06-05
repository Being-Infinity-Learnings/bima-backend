import 'package:go_router/go_router.dart';

import '../features/splash/presentation/splash_screen.dart';

import '../features/auth/presentation/login_screen.dart';

import '../features/home/presentation/home_screen.dart';

import '../features/approval/presentation/waiting_approval_screen.dart';

import '../features/auth/presentation/complete_profile_screen.dart';
import '../features/auth/presentation/register_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (context, state) => const SplashScreen()),

    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),

    GoRoute(
      path: '/signup',
      builder: (context, state) => const RegisterScreen(),
    ),

    GoRoute(
      path: '/complete-profile',
      builder: (context, state) => const CompleteProfileScreen(),
    ),

    GoRoute(
      path: '/approval',
      builder: (context, state) => const WaitingApprovalScreen(),
    ),

    GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
  ],
);
