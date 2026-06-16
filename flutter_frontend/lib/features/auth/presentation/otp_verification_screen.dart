import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';

import '../../../shared/widgets/shared_widgets.dart';
import '../../../shared/enums/auth_status.dart';
import '../providers/auth_provider.dart';
import '../../../config/app_config.dart';
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

  bool _hasSubmittedOnce = false;

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

    _otpCtrl.addListener(_onOtpChanged);

    _startTimer();
  }

  void _onOtpChanged() {
    // Clear error as user types, but only after they've tried once
    if (_hasSubmittedOnce) {
      ref.read(authProvider.notifier).clearError();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();

    _otpCtrl.removeListener(_onOtpChanged);
    _otpCtrl.dispose();

    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _hasSubmittedOnce = true);

    final otp = _otpCtrl.text.trim();

    if (otp.length != 6) {
      ref
          .read(authProvider.notifier)
          .setError('Please enter the full 6-digit OTP.');
      return;
    }

    await ref.read(authProvider.notifier).verifyOtp(otp);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final isDark = theme.brightness == Brightness.dark;

    final authState = ref.watch(authProvider);

    final isNoInternet =
        authState.errorMessage?.toLowerCase().contains('internet') ?? false;

    // Detect OTP-specific error types to show contextual hint
    final isExpiredOtp =
        authState.errorMessage?.toLowerCase().contains('expired') ?? false;

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

    final errorPinTheme = defaultPinTheme.copyWith(
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFFFF6B6B).withOpacity(0.08)
            : const Color(0xFFFFF4F4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDC2626).withOpacity(0.5)),
      ),
    );

    final focusedPinTheme = defaultPinTheme.copyWith(
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.primary, width: 2),
      ),
    );

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
                            'Enter the 6-digit code sent to',
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

                            if (isNoInternet)
                              const NoInternetBanner()
                            else
                              ErrorBanner(message: authState.errorMessage!),

                            // If OTP expired, give actionable hint to resend
                            if (isExpiredOtp) ...[
                              const SizedBox(height: 10),
                              _ExpiredOtpHint(
                                isDark: isDark,
                                onResend: () async {
                                  await ref
                                      .read(authProvider.notifier)
                                      .resendOtp();
                                  _startTimer();
                                },
                              ),
                            ],

                            const SizedBox(height: 20),
                          ],

                          const SizedBox(height: 28),

                          Center(
                            child: Pinput(
                              controller: _otpCtrl,
                              length: 6,
                              defaultPinTheme: defaultPinTheme,
                              focusedPinTheme: focusedPinTheme,
                              errorPinTheme: errorPinTheme,
                              // Auto-submit when all 6 digits entered
                              onCompleted: (_) => _submit(),
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
                                ? RichText(
                                    text: TextSpan(
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                            color: cs.onSurfaceVariant,
                                          ),
                                      children: [
                                        const TextSpan(text: 'Resend code in '),
                                        TextSpan(
                                          text: '$_secondsRemaining s',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: cs.primary,
                                          ),
                                        ),
                                      ],
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

/// Small hint shown when OTP has expired, with a quick resend tap target.
class _ExpiredOtpHint extends StatelessWidget {
  final bool isDark;
  final VoidCallback onResend;

  const _ExpiredOtpHint({required this.isDark, required this.onResend});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onResend,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isDark
              ? const Color(0xFF6C8EFF).withOpacity(0.08)
              : const Color(0xFFEEF2FF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF6C8EFF).withOpacity(0.20)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.refresh_rounded,
              size: 16,
              color: Color(0xFF6C8EFF),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Tap here to request a new OTP',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isDark
                      ? const Color(0xFF9BB3FF)
                      : const Color(0xFF4B6BF5),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
