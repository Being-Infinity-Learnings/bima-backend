import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'app/app.dart';

// ── Background / killed-state handler ────────────────────────────────────────
// Must be a top-level function. Android calls this in a separate isolate.
//
// IMPORTANT: When FCM sends a message with a `notification` block (which our
// backend does), Android shows the system notification AUTOMATICALLY in
// background/killed state. We do NOT need flutter_local_notifications here.
// Calling it in a background isolate with v18 actually causes a race condition
// that can suppress the notification. Keep this handler minimal.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase is already initialised by the plugin before this is invoked.
  // Nothing else needed — the OS handles display from the `notification` block.
  debugPrint('[FCM-BG] Background message received: ${message.messageId}');
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Must be registered BEFORE runApp.
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(const ProviderScope(child: App()));
}