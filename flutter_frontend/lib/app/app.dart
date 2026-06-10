/// Main application widget.
///
/// The [App] class configures the MaterialApp router, themes, and app-wide UI
/// behavior.
import 'package:flutter/material.dart';


import 'router.dart';

import 'theme.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  /// Builds the root MaterialApp router with light/dark theme configuration.
  Widget build(BuildContext context) {
    return MaterialApp.router(
      // scrollBehavior: const AppScrollBehavior(),
      debugShowCheckedModeBanner: false,

      theme: AppTheme.lightTheme,

      darkTheme: AppTheme.darkTheme,

      routerConfig: appRouter,
    );
  }
}
