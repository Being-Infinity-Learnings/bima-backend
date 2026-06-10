import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final user = ref.watch(authProvider).user;

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
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 700),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header ──────────────────────────────────────────
                    _Header(
                      isDark: isDark,
                      userName: user?.fullName ?? 'Student',
                    ),

                    const SizedBox(height: 28),

                    // ── Stats row ────────────────────────────────────────
                    _StatsRow(isDark: isDark),

                    const SizedBox(height: 32),

                    // ── Section label ────────────────────────────────────
                    _SectionLabel(label: 'UPCOMING QUIZZES', isDark: isDark),

                    const SizedBox(height: 14),

                    _QuizCard(
                      isDark: isDark,
                      title: 'Daily Quiz #14',
                      startsIn: '2h 14m',
                      questions: 20,
                      tag: 'Daily',
                      urgency: _Urgency.soon,
                    ),

                    const SizedBox(height: 12),

                    _QuizCard(
                      isDark: isDark,
                      title: 'Aptitude Challenge',
                      startsIn: '5h 40m',
                      questions: 15,
                      tag: 'Challenge',
                      urgency: _Urgency.later,
                    ),

                    const SizedBox(height: 32),

                    // ── Recent Activity ──────────────────────────────────
                    _SectionLabel(label: 'RECENT ACTIVITY', isDark: isDark),

                    const SizedBox(height: 14),

                    _LastResultCard(isDark: isDark),

                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final bool isDark;
  final String userName;

  const _Header({required this.isDark, required this.userName});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Good Afternoon 👋',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                  color: isDark ? Colors.white : const Color(0xFF0C0E14),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                userName,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: isDark
                      ? const Color(0xFF7A8499)
                      : const Color(0xFF6B7280),
                ),
              ),
            ],
          ),
        ),
        // Avatar
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFFC8FF57), Color(0xFF8AE600)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFC8FF57).withOpacity(0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Center(
            child: Text(
              'G',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0C0E14),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Row
// ─────────────────────────────────────────────────────────────────────────────

class _StatsRow extends StatelessWidget {
  final bool isDark;

  const _StatsRow({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatChip(
            isDark: isDark,
            label: 'Quizzes Done',
            value: '13',
            icon: Icons.check_circle_outline_rounded,
            iconColor: const Color(0xFFC8FF57),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatChip(
            isDark: isDark,
            label: 'Best Rank',
            value: '#2',
            icon: Icons.emoji_events_outlined,
            iconColor: const Color(0xFFFFD166),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatChip(
            isDark: isDark,
            label: 'Streak',
            value: '7d 🔥',
            icon: Icons.local_fire_department_outlined,
            iconColor: const Color(0xFFFF6B6B),
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final bool isDark;
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;

  const _StatChip({
    required this.isDark,
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161B26) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF0C0E14),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: isDark ? const Color(0xFF7A8499) : const Color(0xFF6B7280),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Label
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

// ─────────────────────────────────────────────────────────────────────────────
// Quiz Card
// ─────────────────────────────────────────────────────────────────────────────

enum _Urgency { soon, later }

class _QuizCard extends StatelessWidget {
  final bool isDark;
  final String title;
  final String startsIn;
  final int questions;
  final String tag;
  final _Urgency urgency;

  const _QuizCard({
    required this.isDark,
    required this.title,
    required this.startsIn,
    required this.questions,
    required this.tag,
    required this.urgency,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = urgency == _Urgency.soon
        ? const Color(0xFFC8FF57)
        : const Color(0xFF6C8EFF);

    final tagBg = accentColor.withOpacity(0.12);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: isDark
            ? Color.alphaBlend(
                accentColor.withOpacity(0.05),
                const Color(0xFF161B26),
              )
            : Color.alphaBlend(accentColor.withOpacity(0.06), Colors.white),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: accentColor.withOpacity(isDark ? 0.12 : 0.18),
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Tag pill
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: tagBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    tag,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: accentColor,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                const Spacer(),
                // Time urgency chip
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFFFFFFFF).withOpacity(0.05)
                        : const Color(0xFF000000).withOpacity(0.04),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.schedule_rounded,
                        size: 13,
                        color: isDark
                            ? const Color(0xFF7A8499)
                            : const Color(0xFF9CA3AF),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        startsIn,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? const Color(0xFF7A8499)
                              : const Color(0xFF6B7280),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
                color: isDark ? Colors.white : const Color(0xFF0C0E14),
              ),
            ),

            const SizedBox(height: 8),

            Row(
              children: [
                Icon(
                  Icons.help_outline_rounded,
                  size: 14,
                  color: isDark
                      ? const Color(0xFF7A8499)
                      : const Color(0xFF9CA3AF),
                ),
                const SizedBox(width: 5),
                Text(
                  '$questions Questions',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? const Color(0xFF7A8499)
                        : const Color(0xFF6B7280),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Last Result Card
// ─────────────────────────────────────────────────────────────────────────────

class _LastResultCard extends StatelessWidget {
  final bool isDark;

  const _LastResultCard({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1C2440), Color(0xFF141A30)],
        ),
        border: Border.all(
          color: const Color(0xFFFFD166).withOpacity(0.2),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD166).withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'LAST QUIZ RESULT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.4,
                      color: const Color(0xFFFFD166).withOpacity(0.7),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Rank #4',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1,
                      color: Color(0xFFFFD166),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'out of 127 participants',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF7A8499),
                    ),
                  ),
                ],
              ),
            ),

            // Trophy
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFFFD166).withOpacity(0.1),
                border: Border.all(
                  color: const Color(0xFFFFD166).withOpacity(0.2),
                  width: 1.5,
                ),
              ),
              child: const Center(
                child: Text('🏆', style: TextStyle(fontSize: 28)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
