/// Shared reusable UI widgets used across the application.
///
/// This file contains common branding, button, divider, and error widgets.
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

/// Inline error box shown beneath forms.
class ErrorBanner extends StatelessWidget {
  final String message;

  const ErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,

      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),

      decoration: BoxDecoration(
        color: const Color(0xFFFFF4F4),

        borderRadius: BorderRadius.circular(14),
      ),

      child: Row(
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: Color(0xFFDC2626),
          ),

          const SizedBox(width: 10),

          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 13,
                height: 1.3,
                color: Color(0xFFB91C1C),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
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
