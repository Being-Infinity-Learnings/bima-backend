import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:dio/dio.dart';
import '../../../config/environment.dart';

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

    final sentAt = json['sentAt'] != null
        ? DateTime.tryParse(json['sentAt'])
        : null;
    final timeLabel = sentAt != null ? _formatRelativeTime(sentAt) : 'Just now';

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
// Provider
// ─────────────────────────────────────────────────────────────────────────────

final _notificationsProvider = FutureProvider<List<_Notif>>((ref) async {
  final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
  if (idToken == null) return [];

  final dio = Dio(BaseOptions(
    baseUrl: Environment.apiBaseUrl,
    headers: {'Authorization': 'Bearer $idToken'},
  ));

  final response = await dio.get('/notifications/my');
  final List data = response.data['data'] ?? [];
  return data.map((e) => _Notif.fromJson(e as Map<String, dynamic>)).toList();
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final asyncNotifs = ref.watch(_notificationsProvider);

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF0C0E14)
          : const Color(0xFFF5F6FA),
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
                              color: isDark ? Colors.white : const Color(0xFF0C0E14),
                            ),
                          ),
                          const SizedBox(height: 4),
                          asyncNotifs.when(
                            data: (notifs) => Text(
                              '${notifs.length} notification${notifs.length == 1 ? '' : 's'}',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: isDark
                                    ? const Color(0xFF7A8499)
                                    : const Color(0xFF6B7280),
                              ),
                            ),
                            loading: () => const SizedBox.shrink(),
                            error: (_, __) => const SizedBox.shrink(),
                          ),
                        ],
                      ),
                    ),
                    // Refresh button
                    GestureDetector(
                      onTap: () => ref.refresh(_notificationsProvider),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF161B26) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark
                                ? const Color(0xFFFFFFFF).withOpacity(0.06)
                                : const Color(0xFF000000).withOpacity(0.06),
                          ),
                        ),
                        child: Text(
                          'Refresh',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFFC8FF57),
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
                child: asyncNotifs.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (error, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.wifi_off_outlined,
                              size: 48,
                              color: isDark
                                  ? const Color(0xFF7A8499)
                                  : const Color(0xFF9CA3AF)),
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
                  ),
                  data: (notifs) {
                    if (notifs.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.notifications_none_outlined,
                                size: 48,
                                color: isDark
                                    ? const Color(0xFF7A8499)
                                    : const Color(0xFF9CA3AF)),
                            const SizedBox(height: 16),
                            Text(
                              'No notifications yet',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? Colors.white
                                    : const Color(0xFF0C0E14),
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
                      itemCount: notifs.length,
                      itemBuilder: (context, index) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _NotifCard(isDark: isDark, notif: notifs[index]),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Card — same visual style as before
// ─────────────────────────────────────────────────────────────────────────────

class _NotifCard extends StatelessWidget {
  final bool isDark;
  final _Notif notif;

  const _NotifCard({required this.isDark, required this.notif});

  _TypeMeta get _meta {
    switch (notif.type) {
      case _NotifType.quizReminder:
        return _TypeMeta(icon: Icons.timer_outlined, color: const Color(0xFFC8FF57), label: 'Quiz');
      case _NotifType.result:
        return _TypeMeta(icon: Icons.emoji_events_outlined, color: const Color(0xFFFFD166), label: 'Result');
      case _NotifType.contest:
        return _TypeMeta(icon: Icons.code_rounded, color: const Color(0xFFFF6B6B), label: 'Contest');
      case _NotifType.announcement:
        return _TypeMeta(icon: Icons.campaign_outlined, color: const Color(0xFF6C8EFF), label: 'Update');
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
                      color: isDark ? Colors.white : const Color(0xFF0C0E14),
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
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
  const _TypeMeta({required this.icon, required this.color, required this.label});
}