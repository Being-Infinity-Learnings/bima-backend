/// App configuration constants used across the Flutter app.
///
/// This file keeps static values such as the app name, colors and asset paths.
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

  static String get copyrightText => "$appName © ${DateTime.now().year}";
}
