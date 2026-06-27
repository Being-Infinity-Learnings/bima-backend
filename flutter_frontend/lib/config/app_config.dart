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

  /// Success and status colors for small badges and banners.
  static const successColor = Color(0xFF22C55E);
  static const successLightSurface = Color(0xFFE8F5E9);

  /// Warning style colors for offline / informational banners.
  static const warningColor = Color(0xFFFFD166);
  static const warningLightSurface = Color(0xFFFFFBEB);

  /// Error style colors used for validation and error banners.
  static const errorColor = Color(0xFFFF6B6B);
  static const errorLightSurface = Color(0xFFFFF4F4);
  static const errorDarkSurface = Color(0xFFFF9999);
  static const errorBorderColor = Color(0xFFDC2626);

  /// Common text colors used in light and dark modes.
  static const bodyTextLight = Color(0xFF0C0E14);
  static const mutedTextLight = Color(0xFF9CA3AF);
  static const mutedTextDark = Color(0xFF7A8499);

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

  // ─────────────────────────────────────────────────────────────────────────
  // Gamification & Quiz Settings
  // ─────────────────────────────────────────────────────────────────────────

  static const rankGold = Color(0xFFFFD166);
  static const rankSilver = Color(0xFFBDBDBD);
  static const rankBronze = Color(0xFFCD7F32);

  static const quizAnswerColors = [
    Color(0xFF6C8EFF), // A
    Color(0xFFFF6B6B), // B
    Color(0xFFC8FF57), // C
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

  static Color cardColor(bool isDark) => isDark ? darkCardColor : Colors.white;

  static Color inputFillColor(bool isDark) =>
      isDark ? darkInputFillColor : Colors.white;

  static Color bodyTextColor(bool isDark) =>
      isDark ? Colors.white : bodyTextLight;

  static Color mutedTextColor(bool isDark) =>
      isDark ? mutedTextDark : mutedTextLight;

  static Color subtleOverlay(bool isDark) =>
      isDark ? Colors.white.withOpacity(0.06) : Colors.black.withOpacity(0.05);

  static Color strongOverlay(bool isDark) =>
      isDark ? Colors.white.withOpacity(0.12) : Colors.black.withOpacity(0.1);

  static Color emptyButtonColor(bool isDark) =>
      isDark ? const Color(0xFF2A2E3D) : const Color(0xFFE5E7EB);

  static Color highlightRankCardStart(bool isDark) =>
      isDark ? const Color(0xFF1C2440) : const Color(0xFFEEF2FF);

  static Color highlightRankCardEnd(bool isDark) =>
      isDark ? const Color(0xFF141A30) : const Color(0xFFE0E7FF);

  static String get copyrightText => "$appName © ${DateTime.now().year}";
}
