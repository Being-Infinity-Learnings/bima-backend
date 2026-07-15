/// Shared reusable UI widgets used across the application.
///
/// This file contains common branding, button, divider, error, and dialog widgets.
import 'package:flutter/material.dart';
import '../../config/app_config.dart';

/// The app logo / wordmark shown on auth screens.
class AppBrandWidget extends StatelessWidget {
  final double size;
  final bool showTagline;

  const AppBrandWidget({super.key, this.size = 48, this.showTagline = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(AppConfig.logoAsset, width: size, height: size),

        const SizedBox(height: 12),

        Text(
          AppConfig.appName,

          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
        ),

        if (showTagline) ...[
          const SizedBox(height: 4),

          Text(
            AppConfig.appTagline,

            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}

/// A loading button that shows a spinner when [loading] is true.
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: loading ? null : onPressed,
      child: loading
          ? SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Theme.of(context).colorScheme.onPrimary,
              ),
            )
          : icon != null
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 20),
                const SizedBox(width: 8),
                Text(label),
              ],
            )
          : Text(label),
    );
  }
}

/// Thin horizontal divider with "or" label.
class OrDivider extends StatelessWidget {
  const OrDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        Expanded(child: Divider(color: cs.outlineVariant)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'or',
            style: TextStyle(
              fontSize: 13,
              color: cs.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(child: Divider(color: cs.outlineVariant)),
      ],
    );
  }
}

/// Inline error box shown beneath forms (red — for hard errors).
class ErrorBanner extends StatelessWidget {
  final String message;

  const ErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,

      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),

      decoration: BoxDecoration(
        color: isDark
            ? AppConfig.errorColor.withOpacity(0.10)
            : AppConfig.errorLightSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark
              ? AppConfig.errorColor.withOpacity(0.20)
              : AppConfig.errorBorderColor.withOpacity(0.12),
        ),
      ),

      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(
              Icons.error_outline_rounded,
              size: 18,
              color: AppConfig.errorBorderColor,
            ),
          ),

          const SizedBox(width: 10),

          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: isDark
                    ? AppConfig.errorDarkSurface
                    : AppConfig.errorBorderColor,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Inline banner shown when there is no internet connection (amber/warning).
class NoInternetBanner extends StatelessWidget {
  const NoInternetBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,

      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),

      decoration: BoxDecoration(
        color: isDark
            ? AppConfig.warningColor.withOpacity(0.10)
            : AppConfig.warningLightSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark
              ? AppConfig.warningColor.withOpacity(0.20)
              : AppConfig.warningColor.withOpacity(0.18),
        ),
      ),

      child: Row(
        children: [
          Icon(Icons.wifi_off_rounded, size: 18, color: AppConfig.warningColor),

          const SizedBox(width: 10),

          Expanded(
            child: Text(
              'No internet connection. Please check your network and try again.',
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: AppConfig.warningColor,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shows a stylish confirmation bottom-sheet modal.
///
/// Returns `true` if the user confirmed, `false` (or null) otherwise.
Future<bool?> showConfirmationSheet(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Cancel',
  bool isDestructive = false,
  IconData? icon,
}) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  final Color accentColor = isDestructive
      ? AppConfig.errorColor
      : AppConfig.successColor;
  final Color confirmTextColor = isDestructive
      ? AppConfig.whiteColor
      : AppConfig.bodyTextLight;

  return showModalBottomSheet<bool>(
    context: context,
    backgroundColor: AppConfig.transparentColor,
    barrierColor: AppConfig.blackColor.withOpacity(0.5),
    isScrollControlled: true,
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Container(
            decoration: BoxDecoration(
              color: isDark
                  ? AppConfig.darkSurfaceElevated
                  : AppConfig.whiteColor,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppConfig.borderColor(isDark)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppConfig.strongBorderColor(isDark),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
                  child: Column(
                    children: [
                      // Icon badge
                      if (icon != null) ...[
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: accentColor.withOpacity(0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(icon, size: 26, color: accentColor),
                        ),
                        const SizedBox(height: 16),
                      ],

                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                          color: AppConfig.bodyTextColor(isDark),
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 8),

                      Text(
                        message,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.5,
                          color: AppConfig.mutedTextColor(isDark),
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 24),

                      // Confirm button
                      GestureDetector(
                        onTap: () => Navigator.of(ctx).pop(true),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          decoration: BoxDecoration(
                            color: isDestructive ? accentColor : null,
                            gradient: isDestructive
                                ? null
                                : const LinearGradient(
                                    colors: [
                                      AppConfig.accentLime,
                                      AppConfig.accentLimeDeep,
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: accentColor.withOpacity(0.25),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              confirmLabel,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: confirmTextColor,
                              ),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 10),

                      // Cancel button
                      GestureDetector(
                        onTap: () => Navigator.of(ctx).pop(false),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppConfig.whiteColor.withOpacity(0.05)
                                : AppConfig.blackColor.withOpacity(0.04),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: Text(
                              cancelLabel,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppConfig.mutedTextColor(isDark),
                              ),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

/// Step indicator for multi-step forms.
class StepIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;

  const StepIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(totalSteps, (i) {
        final isActive = i == currentStep;
        final isDone = i < currentStep;
        return Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: isActive ? 24 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: isDone || isActive ? cs.primary : cs.outlineVariant,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            if (i < totalSteps - 1) const SizedBox(width: 4),
          ],
        );
      }),
    );
  }
}
