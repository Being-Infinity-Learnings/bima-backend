/// Splash screen — checks auth state on startup and routes accordingly.
/// Shows a branded animated UI instead of a bare spinner, and handles
/// the case where there is no internet by surfacing a retry prompt.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../shared/enums/auth_status.dart';
import '../../../config/app_config.dart';
import '../../../core/services/connectivity_service.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animCtrl;
  late final Animation<double> _fadeAnim;
  late final Animation<double> _scaleAnim;

  bool _noInternet = false;
  bool _retrying = false;

  @override
  void initState() {
    super.initState();

    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _scaleAnim = Tween<double>(
      begin: 0.80,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutBack));

    _animCtrl.forward();

    Future.microtask(_checkAndLoad);
  }

  Future<void> _checkAndLoad() async {
    // Small delay so the brand animation has time to play
    await Future.delayed(const Duration(milliseconds: 600));

    if (!mounted) return;

    final hasInternet = await ConnectivityService.hasInternet();

    if (!mounted) return;

    if (!hasInternet) {
      setState(() {
        _noInternet = true;
        _retrying = false;
      });
      return;
    }

    setState(() => _noInternet = false);
    ref.read(authProvider.notifier).checkAuth();
  }

  Future<void> _retry() async {
    setState(() {
      _retrying = true;
      _noInternet = false;
    });

    await _checkAndLoad();

    if (mounted && _noInternet) {
      setState(() => _retrying = false);
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    ref.listen(authProvider, (previous, next) {
      switch (next.status) {
        case AuthStatus.unauthenticated:
          context.go('/login');
          break;
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
        case AuthStatus.error:
          context.go('/login');
          break;
        case AuthStatus.loading:
          break;
      }
    });

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? [const Color(0xFF0C0E14), const Color(0xFF131720)]
                : [const Color(0xFFF5F6FA), const Color(0xFFEEF0F7)],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              // ── Brand centre ─────────────────────────────────────────
              Center(
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: ScaleTransition(
                    scale: _scaleAnim,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Logo with glow ring
                        Container(
                          width: 96,
                          height: 96,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isDark
                                ? const Color(0xFF1A1F2E)
                                : Colors.white,
                            boxShadow: [
                              BoxShadow(
                                color: AppConfig.primaryColor.withOpacity(
                                  isDark ? 0.30 : 0.18,
                                ),
                                blurRadius: 40,
                                spreadRadius: 4,
                              ),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Image.asset(AppConfig.logoAsset),
                          ),
                        ),

                        const SizedBox(height: 20),

                        // App name
                        Text(
                          AppConfig.appName,
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                            color: isDark
                                ? Colors.white
                                : const Color(0xFF0C0E14),
                          ),
                        ),

                        const SizedBox(height: 6),

                        // Tagline
                        Text(
                          AppConfig.appTagline,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.2,
                            color: isDark
                                ? const Color(0xFF7A8499)
                                : const Color(0xFF9CA3AF),
                          ),
                        ),

                        const SizedBox(height: 48),

                        // Loading indicator or no-internet state
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 350),
                          child: _noInternet
                              ? _NoInternetWidget(
                                  key: const ValueKey('no_internet'),
                                  isDark: isDark,
                                  onRetry: _retry,
                                )
                              : _LoadingDots(
                                  key: const ValueKey('loading'),
                                  isDark: isDark,
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // ── Version tag bottom ───────────────────────────────────
              Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Text(
                    'Being Infinity © 2025',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark
                          ? const Color(0xFF3D4455)
                          : const Color(0xFFD1D5DB),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated loading dots
// ─────────────────────────────────────────────────────────────────────────────

class _LoadingDots extends StatefulWidget {
  final bool isDark;

  const _LoadingDots({super.key, required this.isDark});

  @override
  State<_LoadingDots> createState() => _LoadingDotsState();
}

class _LoadingDotsState extends State<_LoadingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            // Each dot phases in 0.2 apart
            final phase = ((_ctrl.value - i * 0.2) % 1.0);
            final scale = 0.6 + 0.4 * _bounce(phase);

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Transform.scale(
                scale: scale,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppConfig.primaryColor.withOpacity(
                      0.4 + 0.6 * _bounce(phase),
                    ),
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }

  double _bounce(double t) {
    // Simple sine-based bounce in [0, 1]
    if (t > 0.5) return 0;
    return (t / 0.5) < 0.5
        ? 2 * (t / 0.5) * (t / 0.5)
        : -1 + (4 - 2 * (t / 0.5)) * (t / 0.5);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// No-internet widget
// ─────────────────────────────────────────────────────────────────────────────

class _NoInternetWidget extends StatelessWidget {
  final bool isDark;
  final VoidCallback onRetry;

  const _NoInternetWidget({
    super.key,
    required this.isDark,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Icon badge
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFFFFD166).withOpacity(0.10)
                : const Color(0xFFFFFBEB),
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xFFD97706).withOpacity(isDark ? 0.25 : 0.20),
            ),
          ),
          child: Icon(
            Icons.wifi_off_rounded,
            size: 24,
            color: isDark ? const Color(0xFFFFD166) : const Color(0xFFD97706),
          ),
        ),

        const SizedBox(height: 14),

        Text(
          'No Internet Connection',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : const Color(0xFF0C0E14),
          ),
        ),

        const SizedBox(height: 6),

        Text(
          'Please check your network and try again.',
          style: TextStyle(
            fontSize: 13,
            color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
          ),
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: 20),

        // Retry button
        GestureDetector(
          onTap: onRetry,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFC8FF57), Color(0xFF8AE600)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(50),
              boxShadow: [
                BoxShadow(
                  color: AppConfig.primaryColor.withOpacity(0.30),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Text(
              'Try Again',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0C0E14),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
