/// Entry point for the Flutter application.
///
/// This file initializes Flutter bindings, sets up Firebase, and starts the
/// app inside a Riverpod provider scope.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:firebase_core/firebase_core.dart';

import 'firebase_options.dart';

import 'app/app.dart';

/// Bootstrap the application by initializing Firebase and launching [App].
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  runApp(const ProviderScope(child: App()));
}
