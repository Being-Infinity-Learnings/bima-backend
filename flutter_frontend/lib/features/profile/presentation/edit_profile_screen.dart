import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/app_config.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../shared/widgets/shared_widgets.dart';

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

  // Track whether the form has been changed from the original values
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user!;
    _nameCtrl = TextEditingController(text: user.fullName);
    _emailCtrl = TextEditingController(text: user.email ?? '');
    _collegeCtrl = TextEditingController(text: user.collegeName);
    _rollCtrl = TextEditingController(text: user.rollNumber);
    _selectedGender = user.gender;

    // Listen for changes to enable the save button
    for (final ctrl in [_nameCtrl, _emailCtrl, _collegeCtrl, _rollCtrl]) {
      ctrl.addListener(_onFieldChanged);
    }
  }

  void _onFieldChanged() {
    final user = ref.read(authProvider).user!;
    final changed =
        _nameCtrl.text.trim() != user.fullName ||
        _emailCtrl.text.trim() != (user.email ?? '') ||
        _collegeCtrl.text.trim() != user.collegeName ||
        _rollCtrl.text.trim() != user.rollNumber ||
        _selectedGender != user.gender;

    if (changed != _hasChanges) {
      setState(() => _hasChanges = changed);
    }

    // Clear error on typing
    if (ref.read(authProvider).errorMessage != null) {
      ref.read(authProvider.notifier).clearError();
    }
  }

  @override
  void dispose() {
    for (final ctrl in [_nameCtrl, _emailCtrl, _collegeCtrl, _rollCtrl]) {
      ctrl.removeListener(_onFieldChanged);
      ctrl.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    // Ask for confirmation before saving changes
    final confirmed = await showConfirmationSheet(
      context,
      title: 'Save Changes?',
      message: 'Your profile information will be updated.',
      confirmLabel: 'Save Changes',
      icon: Icons.save_outlined,
    );

    if (confirmed != true) return;

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

      // Show success snackbar
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(
                Icons.check_circle_outline_rounded,
                color: AppConfig.whiteColor,
                size: 18,
              ),
              SizedBox(width: 10),
              Text('Profile updated successfully'),
            ],
          ),
          backgroundColor: AppConfig.successColor,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          margin: const EdgeInsets.all(16),
        ),
      );

      Navigator.pop(context);
    } catch (_) {
      // Error is already set in the provider state — displayed via ErrorBanner
    }
  }

  /// Handles back navigation, prompting user if they have unsaved changes.
  Future<void> _handleBack() async {
    if (!_hasChanges) {
      Navigator.pop(context);
      return;
    }

    final confirmed = await showConfirmationSheet(
      context,
      title: 'Discard Changes?',
      message: 'You have unsaved changes. If you leave now, they will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep Editing',
      icon: Icons.warning_amber_rounded,
      isDestructive: true,
    );

    if (confirmed == true && mounted) {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authState = ref.watch(authProvider);

    final isNoInternet =
        authState.errorMessage?.toLowerCase().contains('internet') ?? false;

    return PopScope(
      canPop: !_hasChanges,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          await _handleBack();
        }
      },
      child: Scaffold(
        backgroundColor: isDark
            ? AppConfig.bodyTextLight
            : AppConfig.lightSurfaceAlt,
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [
                      AppConfig.bodyTextLight,
                      AppConfig.darkSurfaceElevatedAlt,
                      AppConfig.lightSurfaceAlt3,
                    ]
                  : [AppConfig.lightSurfaceAlt, AppConfig.lightSurfaceAlt2],
            ),
          ),
          child: SafeArea(
            child: Column(
              children: [
                const AppBrandBar(
                  logoSize: 15,
                  padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
                ),

                // ── Custom app bar ───────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 16,
                  ),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: _handleBack,
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppConfig.darkSurfaceElevated
                                : AppConfig.whiteColor,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark
                                  ? AppConfig.whiteColor.withOpacity(0.06)
                                  : AppConfig.blackColor.withOpacity(0.06),
                            ),
                          ),
                          child: Icon(
                            Icons.arrow_back_rounded,
                            size: 20,
                            color: isDark
                                ? AppConfig.whiteColor
                                : AppConfig.bodyTextLight,
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
                          color: AppConfig.bodyTextColor(isDark),
                        ),
                      ),

                      // Unsaved-changes indicator dot
                      if (_hasChanges) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(
                            color: AppConfig.accentLime,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Error banner (outside scroll to stay visible)
                if (authState.errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                    child: isNoInternet
                        ? const NoInternetBanner()
                        : ErrorBanner(message: authState.errorMessage!),
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
                                    iconColor: AppConfig.accentLime,
                                    label: 'Full Name',
                                    child: TextFormField(
                                      controller: _nameCtrl,
                                      textCapitalization:
                                          TextCapitalization.words,
                                      style: _inputStyle(isDark),
                                      decoration: _inputDecoration(
                                        isDark,
                                        hint: 'Your full name',
                                      ),
                                      validator: (v) {
                                        if (v == null || v.trim().isEmpty) {
                                          return 'Full name is required';
                                        }
                                        if (v.trim().length < 2) {
                                          return 'Name must be at least 2 characters';
                                        }
                                        return null;
                                      },
                                    ),
                                    isLast: false,
                                  ),
                                  _FieldRow(
                                    isDark: isDark,
                                    icon: Icons.email_outlined,
                                    iconColor: AppConfig.accentBlue,
                                    label: 'Email',
                                    child: TextFormField(
                                      controller: _emailCtrl,
                                      keyboardType: TextInputType.emailAddress,
                                      autocorrect: false,
                                      style: _inputStyle(isDark),
                                      decoration: _inputDecoration(
                                        isDark,
                                        hint: 'your@email.com',
                                      ),
                                      validator: (v) {
                                        if (v == null || v.trim().isEmpty) {
                                          return 'Email is required';
                                        }
                                        if (!RegExp(
                                          r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                                        ).hasMatch(v.trim())) {
                                          return 'Enter a valid email address';
                                        }
                                        return null;
                                      },
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
                                    iconColor: AppConfig.accentGold,
                                    label: 'College',
                                    child: TextFormField(
                                      controller: _collegeCtrl,
                                      textCapitalization:
                                          TextCapitalization.words,
                                      style: _inputStyle(isDark),
                                      decoration: _inputDecoration(
                                        isDark,
                                        hint: 'Your college name',
                                      ),
                                      validator: (v) =>
                                          (v == null || v.trim().isEmpty)
                                          ? 'College name is required'
                                          : null,
                                    ),
                                    isLast: false,
                                  ),
                                  _FieldRow(
                                    isDark: isDark,
                                    icon: Icons.badge_outlined,
                                    iconColor: AppConfig.accentCoral,
                                    label: 'Roll Number',
                                    child: TextFormField(
                                      controller: _rollCtrl,
                                      textCapitalization:
                                          TextCapitalization.characters,
                                      style: _inputStyle(isDark),
                                      decoration: _inputDecoration(
                                        isDark,
                                        hint: 'e.g. 2022CSE042',
                                      ),
                                      validator: (v) =>
                                          (v == null || v.trim().isEmpty)
                                          ? 'Roll number is required'
                                          : null,
                                    ),
                                    isLast: false,
                                  ),
                                  _FieldRow(
                                    isDark: isDark,
                                    icon: Icons.person_outline,
                                    iconColor: AppConfig.accentBlue,
                                    label: 'Gender',
                                    child: DropdownButtonFormField<String>(
                                      value: _selectedGender,
                                      style: _inputStyle(isDark),
                                      dropdownColor: isDark
                                          ? AppConfig.darkSurfaceElevatedAlt
                                          : AppConfig.whiteColor,
                                      decoration: _inputDecoration(
                                        isDark,
                                        hint: 'Select gender',
                                      ),
                                      icon: Icon(
                                        Icons.keyboard_arrow_down_rounded,
                                        color: AppConfig.mutedTextColor(isDark),
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
                                      onChanged: (value) {
                                        setState(() {
                                          _selectedGender = value;
                                        });
                                        _onFieldChanged();
                                      },
                                    ),
                                    isLast: true,
                                  ),
                                ],
                              ),

                              const SizedBox(height: 32),

                              // ── Save button ──────────────────────────
                              GestureDetector(
                                onTap: (authState.isLoading || !_hasChanges)
                                    ? null
                                    : _save,
                                child: AnimatedOpacity(
                                  opacity: _hasChanges ? 1.0 : 0.4,
                                  duration: const Duration(milliseconds: 200),
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
                                                AppConfig.accentLime,
                                                AppConfig.accentLimeDeep,
                                              ],
                                              begin: Alignment.topLeft,
                                              end: Alignment.bottomRight,
                                            ),
                                      color: authState.isLoading
                                          ? (isDark
                                                ? AppConfig.darkSurfaceElevated
                                                : AppConfig.borderLight)
                                          : null,
                                      borderRadius: BorderRadius.circular(16),
                                      boxShadow:
                                          authState.isLoading || !_hasChanges
                                          ? null
                                          : [
                                              BoxShadow(
                                                color: AppConfig.accentLime
                                                    .withOpacity(0.3),
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
                                                color: AppConfig.mutedTextDark,
                                              ),
                                            )
                                          : const Text(
                                              'Save Changes',
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w800,
                                                color: AppConfig.bodyTextLight,
                                                letterSpacing: -0.2,
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
                    ),
                  ),
                ),
              ],
            ),
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
        color: isDark ? AppConfig.darkSurfaceElevated : AppConfig.whiteColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppConfig.borderColor(isDark)),
      ),
      child: Column(children: children),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Field Row
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
                        color: AppConfig.mutedTextColor(isDark),
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
            color: AppConfig.borderColor(isDark),
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
  color: AppConfig.bodyTextColor(isDark),
);

InputDecoration _inputDecoration(bool isDark, {required String hint}) =>
    InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: isDark
            ? AppConfig.mutedTextDark.withOpacity(0.6)
            : AppConfig.mutedTextLight,
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
        color: AppConfig.mutedTextColor(isDark),
      ),
    );
  }
}
