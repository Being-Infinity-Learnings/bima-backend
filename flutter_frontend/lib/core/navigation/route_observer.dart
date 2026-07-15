import 'package:flutter/material.dart';

/// App-wide RouteObserver, registered on GoRouter (see app/router.dart).
///
/// Screens that are kept alive but hidden — e.g. HomeScreen sitting inside
/// AppShell's IndexedStack while a quiz flow (/quiz/:id/waiting, /lobby,
/// /play, ...) is pushed as a NEW top-level route on top of AppShell — never
/// get disposed just because the user navigated away. Anything like a
/// periodic auto-refresh Timer started in initState() would otherwise keep
/// firing for as long as the app runs, even while the user is mid-quiz.
///
/// RouteAware (didPush/didPushNext/didPopNext/didPop) lets such a screen know
/// exactly when it stops being the topmost visible route and when it becomes
/// topmost again, so it can pause/resume that kind of work.
final RouteObserver<PageRoute<dynamic>> routeObserver =
    RouteObserver<PageRoute<dynamic>>();
