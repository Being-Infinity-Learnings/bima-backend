import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';

import '../../../shared/widgets/shared_widgets.dart';
import '../../../shared/enums/auth_status.dart';
import '../providers/auth_provider.dart';

import 'dart:async';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key});

  @override
  ConsumerState<OtpVerificationScreen> createState() =>
      _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _otpCtrl = TextEditingController();

  Timer? _timer;

  int _secondsRemaining = 30;

  void _startTimer() {
    _timer?.cancel();

    setState(() {
      _secondsRemaining = 30;
    });

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining == 0) {
        timer.cancel();
        return;
      }

      setState(() {
        _secondsRemaining--;
      });
    });
  }

  @override
  void initState() {
    super.initState();

    _otpCtrl.addListener(_clearError);

    _startTimer();
  }

  void _clearError() {
    ref.read(authProvider.notifier).clearError();
  }

  @override
  void dispose() {
    _timer?.cancel();

    _otpCtrl.removeListener(_clearError);
    _otpCtrl.dispose();

    super.dispose();
  }

  Future<void> _submit() async {
    if (_otpCtrl.text.trim().length != 6) {
      ref
          .read(authProvider.notifier)
          .setError('Please enter a valid 6 digit OTP.');
      return;
    }

    await ref.read(authProvider.notifier).verifyOtp(_otpCtrl.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final isDark = theme.brightness == Brightness.dark;

    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (previous, next) {
      switch (next.status) {
        case AuthStatus.profileIncomplete:
          context.go('/complete-profile');
          break;

        case AuthStatus.pendingApproval:
          context.go('/approval');
          break;

        case AuthStatus.authenticated:
          context.go('/home');
          break;
          
        case AuthStatus.blocked:
          context.go('/blocked');
          break;

        default:
          break;
      }
    });

    final defaultPinTheme = PinTheme(
      width: 52,
      height: 58,
      textStyle: theme.textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w600,
      ),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outline.withValues(alpha: 0.25)),
      ),
    );

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
                            color: isDark
                                ? Colors.black.withValues(alpha: 0.15)
                                : Colors.black.withValues(alpha: 0.04),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Verify OTP',
                            style: theme.textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),

                          const SizedBox(height: 8),

                          Text(
                            'Enter the code sent to',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: cs.onSurfaceVariant,
                            ),
                          ),

                          const SizedBox(height: 4),

                          Text(
                            authState.phoneNumber ?? 'your mobile number',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),

                          if (authState.errorMessage != null) ...[
                            const SizedBox(height: 20),

                            ErrorBanner(message: authState.errorMessage!),

                            const SizedBox(height: 20),
                          ],

                          const SizedBox(height: 28),

                          Center(
                            child: Pinput(
                              controller: _otpCtrl,
                              length: 6,
                              defaultPinTheme: defaultPinTheme,
                            ),
                          ),

                          const SizedBox(height: 32),

                          SizedBox(
                            width: double.infinity,
                            child: PrimaryButton(
                              label: 'Verify',
                              loading: authState.isLoading,
                              onPressed: _submit,
                            ),
                          ),

                          const SizedBox(height: 20),

                          Center(
                            child: _secondsRemaining > 0
                                ? Text(
                                    'Resend code in ${_secondsRemaining}s',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: cs.onSurfaceVariant,
                                    ),
                                  )
                                : TextButton(
                                    onPressed: () async {
                                      await ref
                                          .read(authProvider.notifier)
                                          .resendOtp();

                                      _startTimer();
                                    },
                                    child: const Text('Resend Code'),
                                  ),
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
