/// Login screen for users to sign into the application via phone OTP.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/shared_widgets.dart';
import '../providers/auth_provider.dart';
import '../../../config/app_config.dart';
import '../../../shared/enums/auth_status.dart';

class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _formKey = GlobalKey<FormState>();

  final _phoneCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();

    _phoneCtrl.addListener(_clearError);
  }

  /// Clears the current auth error once the user edits any of the fields.
  void _clearError() {
    ref.read(authProvider.notifier).clearError();
  }

  @override
  void dispose() {
    _phoneCtrl.removeListener(_clearError);
    _phoneCtrl.dispose();

    super.dispose();
  }

  /// Validates the login form and sends the OTP request.
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final phone = _phoneCtrl.text.trim();

    await ref.read(authProvider.notifier).sendOtp('+91$phone');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final isDark = theme.brightness == Brightness.dark;

    final authState = ref.watch(authProvider);

    // Detect if the error is a connectivity error so we show the right banner
    final isNoInternet =
        authState.errorMessage?.toLowerCase().contains('internet') ?? false;

    ref.listen(authProvider, (previous, next) {
      if (next.verificationId != null) {
        context.go('/otp');
        return;
      }
      switch (next.status) {
        case AuthStatus.pendingApproval:
          context.go('/approval');
          break;

        case AuthStatus.authenticated:
          context.go('/home');
          break;

        case AuthStatus.profileIncomplete:
          context.go('/complete-profile');
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
          child: Align(
            alignment: Alignment.topCenter,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),
                child: Column(
                  children: [
                    const SizedBox(height: 12),

                    const AppBrandWidget(size: 72, showTagline: true),

                    const SizedBox(height: 32),

                    Container(
                      padding: const EdgeInsets.all(24),
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
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome',
                              style: theme.textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: cs.onSurface,
                              ),
                            ),

                            const SizedBox(height: 8),

                            Text(
                              'Continue with your mobile number',
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: cs.onSurfaceVariant),
                            ),

                            if (authState.errorMessage != null) ...[
                              const SizedBox(height: 20),

                              // Show the right banner based on error type
                              if (isNoInternet)
                                const NoInternetBanner()
                              else
                                ErrorBanner(message: authState.errorMessage!),

                              const SizedBox(height: 20),
                            ],

                            const SizedBox(height: 28),

                            TextFormField(
                              controller: _phoneCtrl,
                              keyboardType: TextInputType.phone,
                              maxLength: 10,
                              decoration: const InputDecoration(
                                labelText: 'Mobile Number',
                                prefixIcon: Icon(Icons.phone_outlined),
                                prefixText: '+91 ',
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Mobile number is required';
                                }

                                if (!RegExp(
                                  r'^[6-9]\d{9}$',
                                ).hasMatch(value.trim())) {
                                  return 'Enter a valid 10-digit Indian mobile number';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 8),

                            SizedBox(
                              width: double.infinity,
                              child: PrimaryButton(
                                label: 'Send OTP',
                                loading: authState.isLoading,
                                onPressed: _submit,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),
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
