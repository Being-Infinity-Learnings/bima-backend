import 'dart:io';
import 'dart:ui';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';
import '../../config/environment.dart';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';

class FcmService {
  FcmService._();

  static final _messaging = FirebaseMessaging.instance;
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  static const _channelId = 'bima_default';
  static const _channelName = 'BIMA Notifications';
  static const _channelDescription =
      'Quiz reminders and announcements from Being Infinity';

  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    // ── 1. Request permission ──────────────────────────────────────────────
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[FCM] Permission denied by user');
      return;
    }

    debugPrint('[FCM] Permission status: ${settings.authorizationStatus}');

    // ── 2. Setup flutter_local_notifications ──────────────────────────────
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _localNotifications.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );

    // ── 3. Create Android notification channel ────────────────────────────
    // NOTE: AndroidNotificationChannel must NOT be const here because
    // it is passed to a platform method, not used as a compile-time constant.
    final channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: _channelDescription,
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );

    // resolvePlatformSpecificImplementation returns T? but on Android it is
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.createNotificationChannel(channel);

    // ── 4. Register token with backend ────────────────────────────────────
    await _registerCurrentToken();

    _messaging.onTokenRefresh.listen((newToken) async {
      debugPrint('[FCM] Token refreshed');
      await _sendTokenToBackend(newToken);
    });

    // ── 5. Foreground message listener ────────────────────────────────────
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[FCM] Foreground message: ${message.messageId}');
      _showLocalNotification(message);
    });

    // ── 6. Background tap (app was in background, user tapped notification)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint(
        '[FCM] Notification tapped (background): ${message.messageId}',
      );
    });

    // ── 7. Terminated state tap ───────────────────────────────────────────
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      debugPrint(
        '[FCM] App launched from notification: ${initialMessage.messageId}',
      );
    }
  }

  static Future<void> unregister() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _callBackend('DELETE', '/notifications/fcm-token', {
          'token': token,
        });
      }
      await _messaging.deleteToken();
      _initialized = false;
      debugPrint('[FCM] Token unregistered');
    } catch (e) {
      debugPrint('[FCM] Unregister error (non-fatal): $e');
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  static Future<void> _registerCurrentToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null) {
        debugPrint('[FCM] No token available yet');
        return;
      }
      debugPrint('[FCM] Registering token: ${token.substring(0, 20)}...');
      await _sendTokenToBackend(token);
    } catch (e) {
      debugPrint('[FCM] Token registration error (non-fatal): $e');
    }
  }

  static Future<void> _sendTokenToBackend(String token) async {
    await _callBackend('POST', '/notifications/fcm-token', {
      'token': token,
      'platform': Platform.isAndroid ? 'android' : 'ios',
    });
  }

  static Future<void> _callBackend(
    String method,
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (idToken == null) return;

      // Reuse the singleton ApiClient instead of creating a new Dio instance.
      // This ensures the correct baseUrl and avoids double-slash issues.
      final dio = ApiClient.dio;
      final headers = {'Authorization': 'Bearer $idToken'};

      if (method == 'POST') {
        await dio.post(
          path,
          data: body,
          options: Options(headers: headers),
        );
      } else if (method == 'DELETE') {
        await dio.delete(
          path,
          data: body,
          options: Options(headers: headers),
        );
      }
    } on DioException catch (e) {
      debugPrint(
        '[FCM] Backend call failed ($path): ${e.response?.data ?? e.message}',
      );
    }
  }

  static void _showLocalNotification(RemoteMessage message) {
    // Title/body can come from message.notification OR message.data
    final title = message.notification?.title ?? message.data['title'];
    final body = message.notification?.body ?? message.data['body'];

    if (title == null && body == null) return;

    _localNotifications.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDescription,
          importance:
              Importance.max, // max, not high — this forces heads-up popup
          priority:
              Priority.max, // max forces the notification to pop over the app
          icon: '@mipmap/ic_launcher',
          color: const Color(0xFFC8FF57),
          playSound: true,
          enableVibration: true,
          fullScreenIntent: false,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['notificationId'],
    );
  }
}
