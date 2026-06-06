/// Splash screen that checks authentication state before routing.
///
/// This screen is shown on startup while auth status is validated.
import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';

import '../../../shared/enums/auth_status.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();

    Future.microtask(() async {
      ref.read(authProvider.notifier).checkAuth();
    });
  }

  @override
  /// Builds the splash UI and routes the user once auth state resolves.
  Widget build(BuildContext context) {
    ref.listen(authProvider, (previous, next) {
      switch (next.status) {
        case AuthStatus.unauthenticated:
          context.go('/login');
          break;

        case AuthStatus.profileIncomplete:
          context.go('/signup');
          break;

        case AuthStatus.pendingApproval:
          context.go('/approval');
          break;

        case AuthStatus.authenticated:
          context.go('/home');
          break;

        case AuthStatus.blocked:
          context.go('/login');
          break;

        case AuthStatus.loading:
          break;

        case AuthStatus.error:
          context.go('/login');
          break;
      }
    });

    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
