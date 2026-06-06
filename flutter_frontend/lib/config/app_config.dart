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

  /// Default surface color for cards and backgrounds.
  static const surfaceColor = Color(0xFFF8F9FC);

  /// Path to the app logo asset used on auth and welcome screens.
  static const logoAsset = "lib/config/assets/logo.png";
}
