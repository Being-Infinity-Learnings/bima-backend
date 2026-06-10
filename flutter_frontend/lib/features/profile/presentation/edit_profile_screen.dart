import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _collegeCtrl;
  late final TextEditingController _rollCtrl;

  String? _selectedGender;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user!;
    _nameCtrl = TextEditingController(text: user.fullName);
    _emailCtrl = TextEditingController(text: user.email ?? '');
    _collegeCtrl = TextEditingController(text: user.collegeName);
    _rollCtrl = TextEditingController(text: user.rollNumber);
    _selectedGender = user.gender;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _collegeCtrl.dispose();
    _rollCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    try {
      await ref
          .read(authProvider.notifier)
          .updateProfile(
            fullName: _nameCtrl.text.trim(),
            email: _emailCtrl.text.trim(),
            gender: _selectedGender!,
            collegeName: _collegeCtrl.text.trim(),
            rollNumber: _rollCtrl.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile updated')));
      Navigator.pop(context);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authState = ref.watch(authProvider);

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
            children: [
              // ── Custom app bar ───────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 16,
                ),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        width: 40,
                        height: 40,
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
                        child: Icon(
                          Icons.arrow_back_rounded,
                          size: 20,
                          color: isDark
                              ? Colors.white
                              : const Color(0xFF0C0E14),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      'Edit Profile',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                        color: isDark ? Colors.white : const Color(0xFF0C0E14),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Form ────────────────────────────────────────────────
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 500),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _SectionLabel(
                              label: 'PERSONAL INFO',
                              isDark: isDark,
                            ),
                            const SizedBox(height: 14),

                            _InputCard(
                              isDark: isDark,
                              children: [
                                _FieldRow(
                                  isDark: isDark,
                                  icon: Icons.person_outline,
                                  iconColor: const Color(0xFFC8FF57),
                                  label: 'Full Name',
                                  child: TextFormField(
                                    controller: _nameCtrl,
                                    style: _inputStyle(isDark),
                                    decoration: _inputDecoration(
                                      isDark,
                                      hint: 'Your full name',
                                    ),
                                    validator: (v) =>
                                        (v == null || v.trim().isEmpty)
                                        ? 'Required'
                                        : null,
                                  ),
                                  isLast: false,
                                ),
                                _FieldRow(
                                  isDark: isDark,
                                  icon: Icons.email_outlined,
                                  iconColor: const Color(0xFF6C8EFF),
                                  label: 'Email',
                                  child: TextFormField(
                                    controller: _emailCtrl,
                                    keyboardType: TextInputType.emailAddress,
                                    style: _inputStyle(isDark),
                                    decoration: _inputDecoration(
                                      isDark,
                                      hint: 'your@email.com',
                                    ),
                                    validator: (v) =>
                                        (v == null || v.trim().isEmpty)
                                        ? 'Required'
                                        : null,
                                  ),
                                  isLast: true,
                                ),
                              ],
                            ),

                            const SizedBox(height: 24),

                            _SectionLabel(
                              label: 'ACADEMIC INFO',
                              isDark: isDark,
                            ),
                            const SizedBox(height: 14),

                            _InputCard(
                              isDark: isDark,
                              children: [
                                _FieldRow(
                                  isDark: isDark,
                                  icon: Icons.school_outlined,
                                  iconColor: const Color(0xFFFFD166),
                                  label: 'College',
                                  child: TextFormField(
                                    controller: _collegeCtrl,
                                    style: _inputStyle(isDark),
                                    decoration: _inputDecoration(
                                      isDark,
                                      hint: 'Your college name',
                                    ),
                                  ),
                                  isLast: false,
                                ),
                                _FieldRow(
                                  isDark: isDark,
                                  icon: Icons.badge_outlined,
                                  iconColor: const Color(0xFFFF6B6B),
                                  label: 'Roll Number',
                                  child: TextFormField(
                                    controller: _rollCtrl,
                                    style: _inputStyle(isDark),
                                    decoration: _inputDecoration(
                                      isDark,
                                      hint: 'e.g. 2022CSE042',
                                    ),
                                  ),
                                  isLast: false,
                                ),
                                _FieldRow(
                                  isDark: isDark,
                                  icon: Icons.person_outline,
                                  iconColor: const Color(0xFF6C8EFF),
                                  label: 'Gender',
                                  child: DropdownButtonFormField<String>(
                                    value: _selectedGender,
                                    style: _inputStyle(isDark),
                                    dropdownColor: isDark
                                        ? const Color(0xFF1E2535)
                                        : Colors.white,
                                    decoration: _inputDecoration(
                                      isDark,
                                      hint: 'Select gender',
                                    ),
                                    icon: Icon(
                                      Icons.keyboard_arrow_down_rounded,
                                      color: isDark
                                          ? const Color(0xFF7A8499)
                                          : const Color(0xFF9CA3AF),
                                    ),
                                    items: const [
                                      DropdownMenuItem(
                                        value: 'Male',
                                        child: Text('Male'),
                                      ),
                                      DropdownMenuItem(
                                        value: 'Female',
                                        child: Text('Female'),
                                      ),
                                      DropdownMenuItem(
                                        value: 'Other',
                                        child: Text('Other'),
                                      ),
                                    ],
                                    onChanged: (value) =>
                                        setState(() => _selectedGender = value),
                                  ),
                                  isLast: true,
                                ),
                              ],
                            ),

                            const SizedBox(height: 32),

                            // ── Save button ──────────────────────────
                            GestureDetector(
                              onTap: authState.isLoading ? null : _save,
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 16,
                                ),
                                decoration: BoxDecoration(
                                  gradient: authState.isLoading
                                      ? null
                                      : const LinearGradient(
                                          colors: [
                                            Color(0xFFC8FF57),
                                            Color(0xFF8AE600),
                                          ],
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                        ),
                                  color: authState.isLoading
                                      ? (isDark
                                            ? const Color(0xFF161B26)
                                            : const Color(0xFFE5E7EB))
                                      : null,
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: authState.isLoading
                                      ? null
                                      : [
                                          BoxShadow(
                                            color: const Color(
                                              0xFFC8FF57,
                                            ).withOpacity(0.3),
                                            blurRadius: 16,
                                            offset: const Offset(0, 6),
                                          ),
                                        ],
                                ),
                                child: Center(
                                  child: authState.isLoading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Color(0xFF7A8499),
                                          ),
                                        )
                                      : const Text(
                                          'Save Changes',
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF0C0E14),
                                            letterSpacing: -0.2,
                                          ),
                                        ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
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
// Input Card wrapper
// ─────────────────────────────────────────────────────────────────────────────

class _InputCard extends StatelessWidget {
  final bool isDark;
  final List<Widget> children;

  const _InputCard({required this.isDark, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161B26) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFFFFFF).withOpacity(0.06)
              : const Color(0xFF000000).withOpacity(0.06),
        ),
      ),
      child: Column(children: children),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Field Row — icon + label stacked above input
// ─────────────────────────────────────────────────────────────────────────────

class _FieldRow extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final Color iconColor;
  final String label;
  final Widget child;
  final bool isLast;

  const _FieldRow({
    required this.isDark,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.child,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
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
                    child,
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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

TextStyle _inputStyle(bool isDark) => TextStyle(
  fontSize: 14,
  fontWeight: FontWeight.w600,
  color: isDark ? Colors.white : const Color(0xFF0C0E14),
);

InputDecoration _inputDecoration(bool isDark, {required String hint}) =>
    InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: isDark
            ? const Color(0xFF7A8499).withOpacity(0.6)
            : const Color(0xFF9CA3AF),
      ),
      isDense: true,
      contentPadding: EdgeInsets.zero,
      border: InputBorder.none,
      enabledBorder: InputBorder.none,
      focusedBorder: InputBorder.none,
      errorBorder: InputBorder.none,
      focusedErrorBorder: InputBorder.none,
    );

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
