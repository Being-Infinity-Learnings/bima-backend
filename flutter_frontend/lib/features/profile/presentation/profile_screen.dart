import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../shared/enums/auth_status.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (previous, next) {
      if (next.status == AuthStatus.unauthenticated) {
        context.go('/login');
      }
    });

    final user = authState.user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final initial = user.fullName.isNotEmpty
        ? user.fullName[0].toUpperCase()
        : '?';

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
                constraints: const BoxConstraints(maxWidth: 500),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Page title ───────────────────────────────────────
                    Text(
                      'Profile',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: isDark ? Colors.white : const Color(0xFF0C0E14),
                      ),
                    ),

                    const SizedBox(height: 28),

                    // ── Avatar + name card ───────────────────────────────
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF161B26) : Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: isDark
                              ? const Color(0xFFFFFFFF).withOpacity(0.06)
                              : const Color(0xFF000000).withOpacity(0.06),
                        ),
                      ),
                      child: Row(
                        children: [
                          // Avatar
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: const LinearGradient(
                                colors: [Color(0xFFC8FF57), Color(0xFF8AE600)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(
                                    0xFFC8FF57,
                                  ).withOpacity(0.25),
                                  blurRadius: 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Center(
                              child: Text(
                                initial,
                                style: const TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0C0E14),
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(width: 16),

                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  user.fullName,
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.3,
                                    color: isDark
                                        ? Colors.white
                                        : const Color(0xFF0C0E14),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                // Role badge
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(
                                      0xFFC8FF57,
                                    ).withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    user.role.toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.8,
                                      color: Color(0xFFC8FF57),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // ── Info section label ───────────────────────────────
                    _SectionLabel(label: 'DETAILS', isDark: isDark),

                    const SizedBox(height: 14),

                    // ── Info tiles ───────────────────────────────────────
                    Container(
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF161B26) : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isDark
                              ? const Color(0xFFFFFFFF).withOpacity(0.06)
                              : const Color(0xFF000000).withOpacity(0.06),
                        ),
                      ),
                      child: Column(
                        children: [
                          _InfoTile(
                            isDark: isDark,
                            icon: Icons.email_outlined,
                            iconColor: const Color(0xFF6C8EFF),
                            label: 'Email',
                            value: user.email ?? '-',
                            isLast: false,
                          ),
                          _InfoTile(
                            isDark: isDark,
                            icon: Icons.phone_outlined,
                            iconColor: const Color(0xFFC8FF57),
                            label: 'Phone',
                            value: user.phone ?? '-',
                            isLast: false,
                          ),
                          _InfoTile(
                            isDark: isDark,
                            icon: Icons.school_outlined,
                            iconColor: const Color(0xFFFFD166),
                            label: 'College',
                            value: user.collegeName,
                            isLast: false,
                          ),
                          _InfoTile(
                            isDark: isDark,
                            icon: Icons.badge_outlined,
                            iconColor: const Color(0xFFFF6B6B),
                            label: 'Roll Number',
                            value: user.rollNumber,
                            isLast: false,
                          ),
                          _InfoTile(
                            isDark: isDark,
                            icon: Icons.person_outline,
                            iconColor: const Color(0xFF6C8EFF),
                            label: 'Gender',
                            value: user.gender,
                            isLast: true,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 28),

                    // ── Section label ────────────────────────────────────
                    _SectionLabel(label: 'ACCOUNT', isDark: isDark),

                    const SizedBox(height: 14),

                    // ── Edit Profile button ──────────────────────────────
                    _ActionButton(
                      isDark: isDark,
                      icon: Icons.edit_outlined,
                      label: 'Edit Profile',
                      iconColor: const Color(0xFFC8FF57),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const EditProfileScreen(),
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 10),

                    // ── Logout button ────────────────────────────────────
                    _ActionButton(
                      isDark: isDark,
                      icon: Icons.logout_rounded,
                      label: 'Log Out',
                      iconColor: const Color(0xFFFF6B6B),
                      isDestructive: true,
                      onTap: () async {
                        await ref.read(authProvider.notifier).logout();
                      },
                    ),

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
// Info Tile
// ─────────────────────────────────────────────────────────────────────────────

class _InfoTile extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final bool isLast;

  const _InfoTile({
    required this.isDark,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              // Icon badge
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: iconColor),
              ),

              const SizedBox(width: 14),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                        color: isDark
                            ? const Color(0xFF7A8499)
                            : const Color(0xFF9CA3AF),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : const Color(0xFF0C0E14),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (!isLast)
          Divider(
            height: 1,
            indent: 66,
            endIndent: 16,
            color: isDark
                ? const Color(0xFFFFFFFF).withOpacity(0.06)
                : const Color(0xFF000000).withOpacity(0.06),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Button
// ─────────────────────────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final String label;
  final Color iconColor;
  final bool isDestructive;
  final VoidCallback onTap;

  const _ActionButton({
    required this.isDark,
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isDestructive
              ? (isDark
                    ? Color.alphaBlend(
                        const Color(0xFFFF6B6B).withOpacity(0.05),
                        const Color(0xFF161B26),
                      )
                    : Color.alphaBlend(
                        const Color(0xFFFF6B6B).withOpacity(0.04),
                        Colors.white,
                      ))
              : (isDark ? const Color(0xFF161B26) : Colors.white),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDestructive
                ? const Color(0xFFFF6B6B).withOpacity(isDark ? 0.15 : 0.18)
                : (isDark
                      ? const Color(0xFFFFFFFF).withOpacity(0.06)
                      : const Color(0xFF000000).withOpacity(0.06)),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(width: 14),
            Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: isDestructive
                    ? const Color(0xFFFF6B6B)
                    : (isDark ? Colors.white : const Color(0xFF0C0E14)),
              ),
            ),
            const Spacer(),
            Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: isDark ? const Color(0xFF7A8499) : const Color(0xFF9CA3AF),
            ),
          ],
        ),
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
