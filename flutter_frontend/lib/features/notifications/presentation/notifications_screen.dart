import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Dummy data model
// ─────────────────────────────────────────────────────────────────────────────

enum _NotifType { quizReminder, announcement, result, contest }

class _Notif {
  final String title;
  final String body;
  final String time;
  final _NotifType type;
  final bool isUnread;

  const _Notif({
    required this.title,
    required this.body,
    required this.time,
    required this.type,
    this.isUnread = false,
  });
}

const _dummyNotifs = [
  _Notif(
    title: 'Daily Quiz #14 starts in 30 min!',
    body: 'Get ready — 20 questions, autopilot mode. Lobby is now open.',
    time: 'Just now',
    type: _NotifType.quizReminder,
    isUnread: true,
  ),
  _Notif(
    title: 'You ranked #4 in Daily Quiz #13',
    body: 'Great performance! You scored 860 pts out of 127 participants.',
    time: '2h ago',
    type: _NotifType.result,
    isUnread: true,
  ),
  _Notif(
    title: 'Daily Quiz #14 tonight at 9:00 PM',
    body: 'Tonight\'s quiz covers Aptitude & Reasoning. Set a reminder!',
    time: '9:00 AM',
    type: _NotifType.quizReminder,
    isUnread: true,
  ),
  _Notif(
    title: 'CodeChef Starters 140 — Register Now',
    body:
        'CodeChef\'s weekly rated contest is live. Don\'t miss it this Wednesday.',
    time: 'Yesterday',
    type: _NotifType.contest,
    isUnread: false,
  ),
  _Notif(
    title: 'Weekly Special Quiz this Friday!',
    body:
        'A special 25-question challenge with a bigger leaderboard is scheduled for Friday 7 PM.',
    time: '2 days ago',
    type: _NotifType.announcement,
    isUnread: false,
  ),
  _Notif(
    title: 'You ranked #2 in Aptitude Challenge',
    body: 'Outstanding! 1240 pts. You came within 80 pts of first place.',
    time: '3 days ago',
    type: _NotifType.result,
    isUnread: false,
  ),
  _Notif(
    title: 'Codeforces Round 1020 — Announced',
    body:
        'Codeforces Div. 2 round scheduled this Saturday. Practice problems are live.',
    time: '4 days ago',
    type: _NotifType.contest,
    isUnread: false,
  ),
  _Notif(
    title: 'Platform update — Streak tracking is live',
    body:
        'You can now see your daily quiz streak on the home screen. Keep it going!',
    time: '5 days ago',
    type: _NotifType.announcement,
    isUnread: false,
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  int get _unreadCount => _dummyNotifs.where((n) => n.isUnread).length;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final unread = _dummyNotifs.where((n) => n.isUnread).toList();
    final read = _dummyNotifs.where((n) => !n.isUnread).toList();

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
              // ── Page header ──────────────────────────────────────────
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
                          Text(
                            '$_unreadCount unread',
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
                    // Mark all read button
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
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
                        'Mark all read',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFC8FF57),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── List ────────────────────────────────────────────────
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  children: [
                    if (unread.isNotEmpty) ...[
                      _SectionLabel(label: 'NEW', isDark: isDark),
                      const SizedBox(height: 12),
                      ...unread.map(
                        (n) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _NotifCard(isDark: isDark, notif: n),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                    if (read.isNotEmpty) ...[
                      _SectionLabel(label: 'EARLIER', isDark: isDark),
                      const SizedBox(height: 12),
                      ...read.map(
                        (n) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _NotifCard(isDark: isDark, notif: n),
                        ),
                      ),
                    ],
                  ],
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
    final cardBg = notif.isUnread
        ? (isDark
              ? Color.alphaBlend(
                  meta.color.withOpacity(0.05),
                  const Color(0xFF161B26),
                )
              : Color.alphaBlend(meta.color.withOpacity(0.05), Colors.white))
        : (isDark ? const Color(0xFF161B26) : Colors.white);

    final borderColor = notif.isUnread
        ? meta.color.withOpacity(isDark ? 0.15 : 0.2)
        : (isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06));

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

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          notif.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: notif.isUnread
                                ? FontWeight.w700
                                : FontWeight.w600,
                            letterSpacing: -0.1,
                            color: isDark
                                ? Colors.white
                                : const Color(0xFF0C0E14),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Unread dot
                      if (notif.isUnread)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: meta.color,
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 4),

                  Text(
                    notif.body,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      height: 1.4,
                      color: isDark
                          ? const Color(0xFF7A8499)
                          : const Color(0xFF6B7280),
                    ),
                  ),

                  const SizedBox(height: 8),

                  Row(
                    children: [
                      // Type pill
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
                        notif.time,
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

// ─────────────────────────────────────────────────────────────────────────────
// Type metadata helper
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Shared section label
// ─────────────────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  final bool isDark;

  const _SectionLabel({required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.4,
        color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
      ),
    );
  }
}
