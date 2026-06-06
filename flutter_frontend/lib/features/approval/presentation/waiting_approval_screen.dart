/// Screen shown while waiting for admin approval after registration.
///
/// Provides refresh and logout controls during the pending approval state.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../shared/enums/auth_status.dart';
import '../../../shared/widgets/shared_widgets.dart';

class WaitingApprovalScreen extends ConsumerWidget {
  const WaitingApprovalScreen({super.key});

  @override
  /// Builds the waiting approval UI and offers refresh/logout actions.
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (previous, next) {
      switch (next.status) {
        case AuthStatus.authenticated:
          context.go('/home');
          break;

        case AuthStatus.unauthenticated:
          context.go('/login');
          break;

        default:
          break;
      }
    });

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF8F9FC), Color(0xFFF2F4F9)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),
                child: Column(
                  children: [
                    const AppBrandWidget(size: 72, showTagline: true),

                    const SizedBox(height: 32),

                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFFE8F5E9),
                            ),
                            child: const Icon(
                              Icons.check_circle_rounded,
                              size: 42,
                              color: Colors.green,
                            ),
                          ),

                          const SizedBox(height: 20),

                          Text(
                            'Registration Submitted',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),

                          const SizedBox(height: 12),

                          Text(
                            'Your account has been created successfully.\n\nAn administrator must approve your account before you can access the platform.',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),

                          const SizedBox(height: 32),

                          PrimaryButton(
                            label: 'Refresh',
                            loading: authState.isLoading,
                            onPressed: () async {
                              await ref.read(authProvider.notifier).checkAuth();
                            },
                          ),

                          const SizedBox(height: 12),

                          TextButton(
                            onPressed: () async {
                              await ref.read(authProvider.notifier).logout();
                            },
                            child: const Text('Logout'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
