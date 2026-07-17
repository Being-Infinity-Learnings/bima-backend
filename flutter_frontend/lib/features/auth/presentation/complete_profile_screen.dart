/// Screen for collecting the remaining profile data after signup.
///
/// The user enters name, gender, college, roll number, and email here.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/shared_widgets.dart';
import '../../../shared/enums/auth_status.dart';
import '../../../config/app_config.dart';
import '../providers/auth_provider.dart';

class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() =>
      _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameCtrl = TextEditingController();

  final _collegeCtrl = TextEditingController();

  final _rollCtrl = TextEditingController();

  final _emailCtrl = TextEditingController();

  String? _selectedGender;

  @override
  void initState() {
    super.initState();

    _nameCtrl.addListener(_clearError);
    _collegeCtrl.addListener(_clearError);
    _rollCtrl.addListener(_clearError);
    _emailCtrl.addListener(_clearError);
  }

  /// Clears auth errors when any input value changes.
  void _clearError() {
    ref.read(authProvider.notifier).clearError();
  }

  @override
  void dispose() {
    _nameCtrl.removeListener(_clearError);
    _collegeCtrl.removeListener(_clearError);
    _rollCtrl.removeListener(_clearError);
    _emailCtrl.removeListener(_clearError);

    _nameCtrl.dispose();
    _collegeCtrl.dispose();
    _rollCtrl.dispose();
    _emailCtrl.dispose();

    super.dispose();
  }

  /// Submits the completed profile data to the auth notifier.
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final confirmed = await showConfirmationSheet(
      context,
      title: 'Submit Profile?',
      message: 'Your profile details will be saved and submitted.',
      confirmLabel: 'Submit',
      icon: Icons.send_outlined,
    );

    if (confirmed != true) {
      return;
    }

    await ref
        .read(authProvider.notifier)
        .completeProfile(
          fullName: _nameCtrl.text.trim(),
          gender: _selectedGender!,
          collegeName: _collegeCtrl.text.trim(),
          rollNumber: _rollCtrl.text.trim(),
          email: _emailCtrl.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final isDark = theme.brightness == Brightness.dark;

    final authState = ref.watch(authProvider);

    final isNoInternet =
        authState.errorMessage?.toLowerCase().contains('internet') ?? false;

    ref.listen(authProvider, (previous, next) {
      switch (next.status) {
        case AuthStatus.pendingApproval:
          context.go('/approval');
          break;

        case AuthStatus.authenticated:
          context.go('/home');
          break;

        case AuthStatus.blocked:
          context.go('/blocked');
          break;

        default:
          break;
      }
    });

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: AppConfig.backgroundGradient(isDark),
          ),
        ),

        child: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),

              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),

                child: Column(
                  children: [
                    const AppBrandWidget(size: 72, showTagline: true),

                    const SizedBox(height: 32),

                    Container(
                      padding: const EdgeInsets.all(24),

                      decoration: BoxDecoration(
                        color: theme.cardColor,
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: AppConfig.shadowColor(isDark),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),

                      child: Form(
                        key: _formKey,

                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,

                          children: [
                            Text(
                              'Complete Your Profile',
                              style: theme.textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: cs.onSurface,
                              ),
                            ),

                            const SizedBox(height: 8),

                            Text(
                              'Tell us a bit about yourself',

                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: cs.onSurfaceVariant,
                              ),
                            ),

                            if (authState.errorMessage != null) ...[
                              const SizedBox(height: 20),

                              if (isNoInternet)
                                const NoInternetBanner()
                              else
                                ErrorBanner(message: authState.errorMessage!),

                              const SizedBox(height: 20),
                            ],

                            const SizedBox(height: 28),

                            // Full Name
                            TextFormField(
                              controller: _nameCtrl,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(
                                labelText: 'Full Name',
                                prefixIcon: Icon(Icons.person_outline),
                                helperText: 'Enter your name as per your ID',
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Full name is required';
                                }
                                if (value.trim().length < 2) {
                                  return 'Name must be at least 2 characters';
                                }
                                if (!RegExp(
                                  r"^[a-zA-Z\s\-'\.]+$",
                                ).hasMatch(value.trim())) {
                                  return 'Name can only contain letters and spaces';
                                }
                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            // Gender
                            DropdownButtonFormField<String>(
                              initialValue: _selectedGender,

                              decoration: const InputDecoration(
                                labelText: 'Gender',
                                prefixIcon: Icon(Icons.wc_outlined),
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
                                // Clear provider error when user interacts
                                ref.read(authProvider.notifier).clearError();
                              },

                              validator: (value) {
                                if (value == null) {
                                  return 'Please select your gender';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            // College Name
                            TextFormField(
                              controller: _collegeCtrl,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(
                                labelText: 'College Name',
                                prefixIcon: Icon(Icons.school_outlined),
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'College name is required';
                                }
                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            // Roll Number
                            TextFormField(
                              controller: _rollCtrl,
                              textCapitalization: TextCapitalization.characters,
                              decoration: const InputDecoration(
                                labelText: 'Roll Number',
                                prefixIcon: Icon(Icons.badge_outlined),
                                hintText: 'e.g. 2022CSE042',
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Roll number is required';
                                }
                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            // Email
                            TextFormField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              autocorrect: false,
                              decoration: const InputDecoration(
                                labelText: 'Email Address',
                                hintText: 'you@example.com',
                                prefixIcon: Icon(Icons.mail_outline_rounded),
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Email address is required';
                                }

                                final email = value.trim();

                                if (!RegExp(
                                  r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                                ).hasMatch(email)) {
                                  return 'Please enter a valid email address';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 28),

                            PrimaryButton(
                              label: 'Complete Registration',

                              loading: authState.isLoading,

                              onPressed: _submit,
                            ),
                          ],
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
    );
  }
}
