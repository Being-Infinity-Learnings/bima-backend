/// App configuration constants used across the Flutter app.
///
/// This file keeps static values such as the app name, colours, asset paths,
/// and feature-specific settings (e.g. notification pagination).
/// Nothing in the app is hardcoded elsewhere — all tunable values live here.
import 'package:flutter/material.dart';

class AppConfig {
  static const appName = "Being Infinity";

  static const appTagline = "Learn. Compete. Grow.";

  /// Primary brand color used throughout the app.
  static const primaryColor = Color(0xFFB5E82C);

  /// Secondary color to complement the brand palette.
  static const secondaryColor = Color.fromARGB(255, 189, 235, 63);

  /// Default surface color for the light theme.
  static const surfaceColor = Color(0xFFF8F9FC);

  static const whiteColor = Color(0xFFFFFFFF);
  static const blackColor = Color(0xFF000000);
  static const transparentColor = Color(0x00000000);

  /// Standard scaffold background in light mode.
  static const scaffoldLight = Color(0xFFF7F8FC);

  /// Light border and divider color for elevated surfaces.
  static const borderLight = Color(0xFFE5E7EB);
  static const dividerLight = Color(0xFFE5E7EB);

  /// Alternate neutral surface for cards and input fields.
  static const surfaceLight = Color(0xFFFFFFFF);

  /// Standard dark background colors used in auth & welcome screens.
  static const backgroundDarkStart = Color(0xFF0F1117);
  static const backgroundDarkEnd = Color(0xFF161B22);

  /// Standard light background colors used in auth & welcome screens.
  static const backgroundLightStart = Color(0xFFF8F9FC);
  static const backgroundLightEnd = Color(0xFFF2F4F9);

  /// Dark card and input fill colors to keep the theme consistent.
  static const darkCardColor = Color(0xFF1A1D24);
  static const darkInputFillColor = Color(0xFF232733);
  static const darkSurfaceElevated = Color(0xFF161B26);
  static const darkSurfaceElevatedAlt = Color(0xFF1E2535);
  static const darkSurfaceSubtle = Color(0xFF1A1F2E);
  static const lightSurfaceAlt = Color(0xFFF5F6FA);
  static const lightSurfaceAlt2 = Color(0xFFEEF0F7);
  static const lightSurfaceAlt3 = Color(0xFF0F1219);

  /// Success and status colors for small badges and banners.
  static const successColor = Color(0xFF22C55E);
  static const successLightSurface = Color(0xFFE8F5E9);

  /// Warning style colors for offline / informational banners.
  static const warningColor = Color(0xFFFFD166);
  static const warningLightSurface = Color(0xFFFFFBEB);
  static const warningAccentDark = Color(0xFFD97706);

  /// Error style colors used for validation and error banners.
  static const errorColor = Color(0xFFFF6B6B);
  static const errorLightSurface = Color(0xFFFFF4F4);
  static const errorDarkSurface = Color(0xFFFF9999);
  static const errorBorderColor = Color(0xFFDC2626);

  /// Common text colors used in light and dark modes.
  static const bodyTextLight = Color(0xFF0C0E14);

  /// Was too light (0xFF9CA3AF) to read comfortably on light backgrounds —
  /// darkened to meet contrast on white/near-white surfaces.
  static const mutedTextLight = Color(0xFF6B7280);
  static const mutedTextDark = Color(0xFF7A8499);
  static const mutedTextSecondary = Color(0xFF6B7280);
  static const splashVersionTextLight = Color(0xFFD1D5DB);
  static const splashVersionTextDark = Color(0xFF3D4455);

  /// Path to the app logo asset used on auth and welcome screens.
  static const logoAsset = "lib/config/assets/logo.png";

  // ─────────────────────────────────────────────────────────────────────────
  // Notification feed settings
  // ─────────────────────────────────────────────────────────────────────────

  static const notificationPageSize = 20;

  static const notifColorQuiz = Color(0xFFC8FF57);
  static const notifColorResult = Color(0xFFFFD166);
  static const notifColorContest = Color(0xFFFF6B6B);
  static const notifColorAnnouncement = Color(0xFF6C8EFF);
  static const accentLime = Color(0xFFC8FF57);
  static const accentLimeDeep = Color(0xFF8AE600);
  static const accentBlue = Color(0xFF6C8EFF);
  static const accentAmber = Color(0xFFFFB020);
  static const accentGold = Color(0xFFFFD166);
  static const accentCoral = Color(0xFFFF6B6B);
  static const accentOrange = Color(0xFFFF9F43);
  static const accentMint = Color(0xFF48CFAD);
  static const accentPink = Color(0xFFFF6BFF);

  // ─────────────────────────────────────────────────────────────────────────
  // Gamification & Quiz Settings
  // ─────────────────────────────────────────────────────────────────────────

  static const rankGold = Color(0xFFFFD166);
  static const rankSilver = Color(0xFFBDBDBD);
  static const rankBronze = Color(0xFFCD7F32);
  static const approvalBadgeDark = Color(0xFF1B3A24);

  static const quizAnswerColors = [
    Color(0xFF6C8EFF), // A - blue
    Color(0xFF9B7EDE), // B - purple (was red — read as "wrong")
    Color(0xFF3FB6E8), // C - sky blue (was lime green — read as "correct")
    Color(0xFFFFD166), // D
    Color(0xFFFF9F43), // E
    Color(0xFF48CFAD), // F
  ];

  static const quizConfettiColors = [
    Color(0xFFC8FF57),
    Color(0xFFFFD166),
    Color(0xFF6C8EFF),
    Color(0xFFFF6B6B),
    Color(0xFF22C55E),
    Color(0xFFFF9F43),
    Color(0xFFFF6BFF),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  static List<Color> backgroundGradient(bool isDark) {
    return isDark
        ? [backgroundDarkStart, backgroundDarkEnd]
        : [backgroundLightStart, backgroundLightEnd];
  }

  static Color scaffoldColor(bool isDark) =>
      isDark ? backgroundDarkStart : scaffoldLight;

  static Color cardColor(bool isDark) => isDark ? darkCardColor : whiteColor;

  static Color inputFillColor(bool isDark) =>
      isDark ? darkInputFillColor : whiteColor;

  static Color bodyTextColor(bool isDark) =>
      isDark ? whiteColor : bodyTextLight;

  static Color mutedTextColor(bool isDark) =>
      isDark ? mutedTextDark : mutedTextLight;

  static Color subtleOverlay(bool isDark) =>
      isDark ? whiteColor.withOpacity(0.06) : blackColor.withOpacity(0.05);

  static Color strongOverlay(bool isDark) =>
      isDark ? whiteColor.withOpacity(0.12) : blackColor.withOpacity(0.1);

  static Color borderColor(bool isDark) =>
      isDark ? whiteColor.withOpacity(0.06) : blackColor.withOpacity(0.06);

  static Color strongBorderColor(bool isDark) =>
      isDark ? whiteColor.withOpacity(0.12) : blackColor.withOpacity(0.1);

  static Color shadowColor(
    bool isDark, {
    double lightOpacity = 0.04,
    double darkOpacity = 0.15,
  }) => isDark
      ? blackColor.withOpacity(darkOpacity)
      : blackColor.withOpacity(lightOpacity);

  static Color overlayFillColor(bool isDark, {double alpha = 0.08}) =>
      isDark ? whiteColor.withOpacity(alpha) : blackColor.withOpacity(alpha);

  static Color emptyButtonColor(bool isDark) =>
      isDark ? const Color(0xFF2A2E3D) : const Color(0xFFE5E7EB);

  /// Many accent colors in this palette (rankGold, primaryColor/accentLime,
  /// warningColor, accentAmber, and the quiz answer palette) are tuned to
  /// pop on dark backgrounds but are far too pale to read as text/icons on
  /// light surfaces. This maps a known bright accent to a deeper, legible
  /// equivalent in light mode, while leaving it untouched in dark mode.
  static Color accentOnSurface(bool isDark, Color base) {
    if (isDark) return base;
    if (base == rankGold ||
        base == warningColor ||
        base == accentGold ||
        base == accentAmber) {
      return warningAccentDark;
    }
    if (base == rankSilver) return const Color(0xFF6B7280);
    if (base == rankBronze) return const Color(0xFF8A4A1E);
    if (base == primaryColor || base == secondaryColor || base == accentLime) {
      return const Color(0xFF4F7A00);
    }
    // Quiz answer palette — indices A..F.
    if (base == quizAnswerColors[0]) return const Color(0xFF3355D6); // blue
    if (base == quizAnswerColors[1]) return const Color(0xFF6B3FC2); // purple
    if (base == quizAnswerColors[2]) return const Color(0xFF0A7EA8); // sky
    if (base == quizAnswerColors[4]) return const Color(0xFFC2570F); // orange
    if (base == quizAnswerColors[5]) return const Color(0xFF15805F); // teal
    if (base == accentPink) return const Color(0xFFC23FC2);
    if (base == accentBlue) return const Color(0xFF3355D6);
    if (base == accentMint) return const Color(0xFF15805F);
    if (base == accentOrange) return const Color(0xFFC2570F);
    if (base == accentCoral) return const Color(0xFFD1453A);
    return base;
  }

  static Color highlightRankCardStart(bool isDark) =>
      isDark ? const Color(0xFF1C2440) : const Color(0xFFEEF2FF);

  static Color highlightRankCardEnd(bool isDark) =>
      isDark ? const Color(0xFF141A30) : const Color(0xFFE0E7FF);

  /// Gradient for the "last quiz result" / recent activity highlight card.
  /// Previously hardcoded to the dark palette so it never adapted to the
  /// light theme, leaving it looking dark on a light background.
  static List<Color> lastResultCardGradient(bool isDark) => isDark
      ? [darkSurfaceElevatedAlt, lightSurfaceAlt3]
      : [const Color(0xFFFFF8E7), const Color(0xFFFFF0D1)];

  /// Accent color for the rank/score text on the last-result card.
  /// `warningColor` (0xFFFFD166) is far too light to read on a light
  /// background, so a deeper amber is used there instead.
  static Color lastResultAccentColor(bool isDark) =>
      isDark ? warningColor : warningAccentDark;

  /// Secondary/muted text color for the last-result card.
  static Color lastResultMutedText(bool isDark) =>
      isDark ? mutedTextDark : mutedTextSecondary;

  static String get copyrightText => "$appName © ${DateTime.now().year}";
}
