import 'dart:io';
import 'dart:ui';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';
import '../../../config/app_config.dart';
import '../../../core/network/api_client.dart';

class FcmService {
  FcmService._();

  static final _messaging = FirebaseMessaging.instance;
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  // This channel ID must match android.notification.channelId in the backend payload
  // and the meta-data in AndroidManifest.xml
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
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[FCM] Permission denied');
      return;
    }
    debugPrint('[FCM] Permission: ${settings.authorizationStatus}');

    // ── 2. Create Android notification channel ────────────────────────────
    // Must be done BEFORE initialize() so the channel exists when the first
    // notification arrives.
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();

    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDescription,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      ),
    );

    // ── 3. Init flutter_local_notifications (foreground display only) ─────
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );

    // ── 4. Disable FCM's own foreground display on iOS ────────────────────
    // We show via flutter_local_notifications for consistency.
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: false,
      badge: false,
      sound: false,
    );

    // ── 5. Register FCM token with backend ────────────────────────────────
    await _registerCurrentToken();
    _messaging.onTokenRefresh.listen(_sendTokenToBackend);

    // ── 6. Foreground message handler ─────────────────────────────────────
    // When app is in foreground, FCM does NOT show a system notification.
    // We show one manually via flutter_local_notifications.
    // NOTE: AppShell and NotificationsScreen also listen to onMessage to
    // update the badge and list — multiple listeners on a stream are fine.
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[FCM] Foreground message: ${message.messageId}');
      _showLocalNotification(message);
    });
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
      debugPrint('[FCM] Unregistered');
    } catch (e) {
      debugPrint('[FCM] Unregister error (non-fatal): $e');
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  static Future<void> _registerCurrentToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null) {
        debugPrint('[FCM] No token yet');
        return;
      }
      debugPrint('[FCM] Token: ${token.substring(0, 20)}...');
      await _sendTokenToBackend(token);
    } catch (e) {
      debugPrint('[FCM] Token registration error: $e');
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

      final headers = {'Authorization': 'Bearer $idToken'};
      if (method == 'POST') {
        await ApiClient.dio.post(
          path,
          data: body,
          options: Options(headers: headers),
        );
      } else if (method == 'DELETE') {
        await ApiClient.dio.delete(
          path,
          data: body,
          options: Options(headers: headers),
        );
      }
      debugPrint('[FCM] Backend call OK: $method $path');
    } on DioException catch (e) {
      debugPrint(
        '[FCM] Backend call failed ($path): ${e.response?.statusCode} ${e.response?.data ?? e.message}',
      );
    }
  }

  static Future<void> _showLocalNotification(RemoteMessage message) async {
    final title =
        message.notification?.title ?? message.data['title'] as String?;
    final body = message.notification?.body ?? message.data['body'] as String?;
    if (title == null && body == null) return;

    await _localNotifications.show(
      message.hashCode,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDescription,
          importance: Importance.max,
          priority: Priority.max,
          icon: '@mipmap/ic_launcher',
          color: AppConfig.accentLime,
          playSound: true,
          enableVibration: true,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['notificationId'] as String?,
    );
  }
}
