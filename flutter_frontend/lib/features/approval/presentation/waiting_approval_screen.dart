/// Screen shown while waiting for admin approval after registration.
///
/// Provides refresh and logout controls during the pending approval state.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../shared/enums/auth_status.dart';
import '../../../shared/widgets/shared_widgets.dart';
import '../../../config/app_config.dart';

class WaitingApprovalScreen extends ConsumerWidget {
  const WaitingApprovalScreen({super.key});

  @override
  /// Builds the waiting approval UI and offers refresh/logout actions.
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final isDark = theme.brightness == Brightness.dark;

    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (previous, next) {
      switch (next.status) {
        case AuthStatus.authenticated:
          context.go('/home');
          break;

        case AuthStatus.unauthenticated:
          context.go('/login');
          break;

        case AuthStatus.blocked:
          context.go('/blocked');
          break;

        default:
          break;
      }
    });

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: AppConfig.backgroundGradient(isDark),
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
                        color: theme.cardColor,
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: AppConfig.shadowColor(isDark),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDark
                                  ? AppConfig.approvalBadgeDark
                                  : AppConfig.successLightSurface,
                            ),
                            child: const Icon(
                              Icons.check_circle_rounded,
                              size: 42,
                              color: AppConfig.successColor,
                            ),
                          ),

                          const SizedBox(height: 20),

                          Text(
                            'Registration Submitted',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: cs.onSurface,
                            ),
                          ),

                          const SizedBox(height: 12),

                          Text(
                            'Your account has been created successfully.\n\nAn administrator must approve your account before you can access the platform.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: cs.onSurfaceVariant,
                              height: 1.5,
                            ),
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
