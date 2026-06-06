/// Registration screen for creating a new account.
///
/// This screen presents email/password inputs and navigates to profile
/// completion when account creation succeeds.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/shared_widgets.dart';
import '../providers/auth_provider.dart';
import '../../../shared/enums/auth_status.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();

    _emailCtrl.addListener(_clearError);
    _passwordCtrl.addListener(_clearError);
    _confirmCtrl.addListener(_clearError);
  }

  /// Clears the current auth error when form fields change.
  void _clearError() {
    ref.read(authProvider.notifier).clearError();
  }

  @override
  void dispose() {
    _emailCtrl.removeListener(_clearError);
    _passwordCtrl.removeListener(_clearError);
    _confirmCtrl.removeListener(_clearError);

    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();

    super.dispose();
  }

  /// Validates the registration inputs and creates a Firebase account.
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    try {
      await ref
          .read(authProvider.notifier)
          .createFirebaseAccount(
            email: _emailCtrl.text.trim(),
            password: _passwordCtrl.text,
          );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  /// Builds the signup page UI and navigates when registration state changes.
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final isDark = theme.brightness == Brightness.dark;

    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (previous, next) {
      if (next.status == AuthStatus.profileIncomplete) {
        context.go('/complete-profile');
      }
    });

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? [const Color(0xFF0F1117), const Color(0xFF161B22)]
                : [const Color(0xFFF8F9FC), const Color(0xFFF2F4F9)],
          ),
        ),
        child: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),

              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),

                child: Column(
                  children: [
                    const AppBrandWidget(size: 72, showTagline: true),

                    const SizedBox(height: 32),

                    Container(
                      padding: const EdgeInsets.all(24),

                      decoration: BoxDecoration(
                        color: theme.cardColor,
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: isDark
                                ? Colors.black.withValues(alpha: 0.15)
                                : Colors.black.withValues(alpha: 0.04),
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
                              'Create Account',
                              style: Theme.of(context).textTheme.headlineMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),

                            const SizedBox(height: 8),

                            Text(
                              'Create your account to get started',

                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: cs.onSurfaceVariant),
                            ),

                            if (authState.errorMessage != null) ...[
                              const SizedBox(height: 20),

                              ErrorBanner(message: authState.errorMessage!),

                              const SizedBox(height: 20),
                            ],

                            const SizedBox(height: 28),

                            TextFormField(
                              controller: _emailCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Your Email',
                                prefixIcon: Icon(Icons.mail),
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Email required';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            TextFormField(
                              controller: _passwordCtrl,

                              obscureText: _obscurePassword,

                              decoration: InputDecoration(
                                labelText: 'Create Password',

                                prefixIcon: const Icon(Icons.lock),

                                suffixIcon: IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _obscurePassword = !_obscurePassword;
                                    });
                                  },

                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_off
                                        : Icons.visibility,
                                  ),
                                ),
                              ),

                              validator: (value) {
                                if (value == null || value.length < 6) {
                                  return 'Minimum 6 characters';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            TextFormField(
                              controller: _confirmCtrl,

                              obscureText: _obscureConfirm,

                              decoration: InputDecoration(
                                labelText: 'Confirm Password',

                                prefixIcon: const Icon(Icons.lock),

                                suffixIcon: IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _obscureConfirm = !_obscureConfirm;
                                    });
                                  },

                                  icon: Icon(
                                    _obscureConfirm
                                        ? Icons.visibility_off
                                        : Icons.visibility,
                                  ),
                                ),
                              ),

                              validator: (value) {
                                if (value != _passwordCtrl.text) {
                                  return 'Passwords do not match';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 24),

                            PrimaryButton(
                              label: 'Continue',
                              loading: authState.isLoading,
                              onPressed: _submit,
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Already have an account?',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            context.go('/login');
                          },
                          child: const Text('Sign In'),
                        ),
                      ],
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
