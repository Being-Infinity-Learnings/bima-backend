import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────────────

enum _NotifType { quizReminder, announcement, result, contest }

class _Notif {
  final String id;
  final String title;
  final String body;
  final String timeLabel;
  final _NotifType type;

  const _Notif({
    required this.id,
    required this.title,
    required this.body,
    required this.timeLabel,
    required this.type,
  });

  factory _Notif.fromJson(Map<String, dynamic> json) {
    final typeStr = (json['type'] as String? ?? 'ANNOUNCEMENT').toUpperCase();
    _NotifType type;
    switch (typeStr) {
      case 'QUIZ_REMINDER':
        type = _NotifType.quizReminder;
        break;
      case 'RESULT':
        type = _NotifType.result;
        break;
      case 'CONTEST':
        type = _NotifType.contest;
        break;
      default:
        type = _NotifType.announcement;
    }

    final sentAt =
        json['sentAt'] != null ? DateTime.tryParse(json['sentAt']) : null;
    final timeLabel =
        sentAt != null ? _formatRelativeTime(sentAt) : 'Just now';

    return _Notif(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      timeLabel: timeLabel,
      type: type,
    );
  }

  static String _formatRelativeTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State notifier — replaces the old FutureProvider so we can push new items
// in without the user having to tap Refresh.
// ─────────────────────────────────────────────────────────────────────────────

class _NotifState {
  final List<_Notif> items;
  final bool isLoading;
  final String? error;

  const _NotifState({
    this.items = const [],
    this.isLoading = false,
    this.error,
  });

  _NotifState copyWith({
    List<_Notif>? items,
    bool? isLoading,
    String? error,
  }) =>
      _NotifState(
        items: items ?? this.items,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class _NotifNotifier extends StateNotifier<_NotifState> {
  _NotifNotifier() : super(const _NotifState(isLoading: true)) {
    _load();
  }

  Future<void> _load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final idToken =
          await FirebaseAuth.instance.currentUser?.getIdToken();
      if (idToken == null) {
        state = state.copyWith(isLoading: false, items: []);
        return;
      }
      final response = await ApiClient.dio.get(
        '/notifications/my',
        options: Options(headers: {'Authorization': 'Bearer $idToken'}),
      );
      final List data = response.data['data'] ?? [];
      final items =
          data.map((e) => _Notif.fromJson(e as Map<String, dynamic>)).toList();
      state = state.copyWith(isLoading: false, items: items);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Called by the shell when a foreground FCM message arrives.
  /// Re-fetches the list so the new notification shows up instantly.
  Future<void> refresh() => _load();

  /// Prepend a notification from an incoming FCM message immediately,
  /// before the network round-trip, so the UI updates in <1 frame.
  void prependFromMessage(RemoteMessage message) {
    final title =
        message.notification?.title ?? message.data['title'] as String?;
    final body =
        message.notification?.body ?? message.data['body'] as String?;
    if (title == null && body == null) return;

    final notif = _Notif(
      id: message.data['notificationId'] as String? ??
          message.messageId ??
          DateTime.now().millisecondsSinceEpoch.toString(),
      title: title ?? '',
      body: body ?? '',
      timeLabel: 'Just now',
      type: _NotifType.announcement,
    );

    // Avoid duplicate if already in list
    final alreadyPresent = state.items.any((n) => n.id == notif.id);
    if (!alreadyPresent) {
      state = state.copyWith(items: [notif, ...state.items]);
    }

    // Then do a real fetch to get correct server data (type, sentAt, etc.)
    _load();
  }
}

final notificationsProvider =
    StateNotifierProvider<_NotifNotifier, _NotifState>(
  (_) => _NotifNotifier(),
);

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
    with WidgetsBindingObserver {
  StreamSubscription<RemoteMessage>? _fgSub;
  StreamSubscription<RemoteMessage>? _tapSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Refresh when a foreground message arrives while this screen is active.
    _fgSub = FirebaseMessaging.onMessage.listen((msg) {
      ref.read(notificationsProvider.notifier).prependFromMessage(msg);
    });

    // Also refresh when user taps a notification and app comes to foreground.
    _tapSub = FirebaseMessaging.onMessageOpenedApp.listen((_) {
      ref.read(notificationsProvider.notifier).refresh();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh when the user brings the app back from background —
    // this catches the case where a background/killed notification was received
    // and the user opens the app manually without tapping the notification.
    if (state == AppLifecycleState.resumed) {
      ref.read(notificationsProvider.notifier).refresh();
    }
  }

  @override
  void dispose() {
    _fgSub?.cancel();
    _tapSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final notifState = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor:
          isDark ? const Color(0xFF0C0E14) : const Color(0xFFF5F6FA),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [
                    const Color(0xFF0C0E14),
                    const Color(0xFF131720),
                    const Color(0xFF0F1219),
                  ]
                : [const Color(0xFFF5F6FA), const Color(0xFFEEF0F7)],
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header ──────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Notifications',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                              color: isDark
                                  ? Colors.white
                                  : const Color(0xFF0C0E14),
                            ),
                          ),
                          const SizedBox(height: 4),
                          if (!notifState.isLoading)
                            Text(
                              '${notifState.items.length} notification${notifState.items.length == 1 ? '' : 's'}',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: isDark
                                    ? const Color(0xFF7A8499)
                                    : const Color(0xFF6B7280),
                              ),
                            ),
                        ],
                      ),
                    ),
                    // Refresh button
                    GestureDetector(
                      onTap: () =>
                          ref.read(notificationsProvider.notifier).refresh(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF161B26)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark
                                ? const Color(0xFFFFFFFF).withOpacity(0.06)
                                : const Color(0xFF000000).withOpacity(0.06),
                          ),
                        ),
                        child: notifState.isLoading
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFFC8FF57),
                                ),
                              )
                            : const Text(
                                'Refresh',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFC8FF57),
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── Body ────────────────────────────────────────────────
              Expanded(
                child: _buildBody(isDark, notifState),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(bool isDark, _NotifState state) {
    if (state.isLoading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.wifi_off_outlined,
                size: 48,
                color:
                    isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
              ),
              const SizedBox(height: 16),
              Text(
                'Could not load notifications',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : const Color(0xFF0C0E14),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Check your connection and tap Refresh.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: isDark
                      ? const Color(0xFF7A8499)
                      : const Color(0xFF6B7280),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.notifications_none_outlined,
              size: 48,
              color:
                  isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
            ),
            const SizedBox(height: 16),
            Text(
              'No notifications yet',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : const Color(0xFF0C0E14),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Quiz reminders and announcements will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? const Color(0xFF7A8499)
                    : const Color(0xFF6B7280),
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      itemCount: state.items.length,
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: _NotifCard(isDark: isDark, notif: state.items[index]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Card
// ─────────────────────────────────────────────────────────────────────────────

class _NotifCard extends StatelessWidget {
  final bool isDark;
  final _Notif notif;

  const _NotifCard({required this.isDark, required this.notif});

  _TypeMeta get _meta {
    switch (notif.type) {
      case _NotifType.quizReminder:
        return _TypeMeta(
          icon: Icons.timer_outlined,
          color: const Color(0xFFC8FF57),
          label: 'Quiz',
        );
      case _NotifType.result:
        return _TypeMeta(
          icon: Icons.emoji_events_outlined,
          color: const Color(0xFFFFD166),
          label: 'Result',
        );
      case _NotifType.contest:
        return _TypeMeta(
          icon: Icons.code_rounded,
          color: const Color(0xFFFF6B6B),
          label: 'Contest',
        );
      case _NotifType.announcement:
        return _TypeMeta(
          icon: Icons.campaign_outlined,
          color: const Color(0xFF6C8EFF),
          label: 'Update',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final meta = _meta;
    final cardBg = isDark ? const Color(0xFF161B26) : Colors.white;
    final borderColor = isDark
        ? const Color(0xFFFFFFFF).withOpacity(0.06)
        : const Color(0xFF000000).withOpacity(0.06);

    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon badge
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: meta.color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(meta.icon, size: 20, color: meta.color),
            ),

            const SizedBox(width: 12),

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notif.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.1,
                      color:
                          isDark ? Colors.white : const Color(0xFF0C0E14),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notif.body,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: isDark
                          ? const Color(0xFF7A8499)
                          : const Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: meta.color.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          meta.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: meta.color,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        notif.timeLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: isDark
                              ? const Color(0xFF7A8499)
                              : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeMeta {
  final IconData icon;
  final Color color;
  final String label;
  const _TypeMeta({
    required this.icon,
    required this.color,
    required this.label,
  });
}