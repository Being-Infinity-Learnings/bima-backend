import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/shared_widgets.dart';
import '../../../shared/enums/auth_status.dart';

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

  String? _selectedGender;

  @override
  void initState() {
    super.initState();

    _nameCtrl.addListener(_clearError);
    _collegeCtrl.addListener(_clearError);
    _rollCtrl.addListener(_clearError);
  }

  void _clearError() {
    ref.read(authProvider.notifier).clearError();
  }

  @override
  void dispose() {
    _nameCtrl.removeListener(_clearError);
    _collegeCtrl.removeListener(_clearError);
    _rollCtrl.removeListener(_clearError);

    _nameCtrl.dispose();
    _collegeCtrl.dispose();
    _rollCtrl.dispose();

    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    await ref
        .read(authProvider.notifier)
        .completeProfile(
          fullName: _nameCtrl.text.trim(),
          gender: _selectedGender!,
          collegeName: _collegeCtrl.text.trim(),
          rollNumber: _rollCtrl.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    final cs = Theme.of(context).colorScheme;

    ref.listen(authProvider, (previous, next) {
      switch (next.status) {
        case AuthStatus.pendingApproval:
          context.go('/approval');
          break;

        case AuthStatus.authenticated:
          context.go('/home');
          break;

        default:
          break;
      }
    });

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF8F9FC), Color(0xFFF2F4F9)],
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
                        color: Colors.white,

                        borderRadius: BorderRadius.circular(28),
                      ),

                      child: Form(
                        key: _formKey,

                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,

                          children: [
                            Text(
                              'Complete Profile',

                              style: Theme.of(context).textTheme.headlineMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),

                            const SizedBox(height: 8),

                            Text(
                              'Tell us a bit about yourself',

                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: cs.onSurfaceVariant),
                            ),

                            if (authState.errorMessage != null) ...[
                              const SizedBox(height: 20),

                              ErrorBanner(message: authState.errorMessage!),

                              const SizedBox(height: 20),
                            ],

                            const SizedBox(height: 28),

                            TextFormField(
                              controller: _nameCtrl,

                              decoration: const InputDecoration(
                                labelText: 'Full Name',
                                prefixIcon: Icon(Icons.person_outline),
                              ),

                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Required';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            DropdownButtonFormField<String>(
                              value: _selectedGender,

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
                              },

                              validator: (value) {
                                if (value == null) {
                                  return 'Select gender';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            TextFormField(
                              controller: _collegeCtrl,

                              decoration: const InputDecoration(
                                labelText: 'College Name',
                                prefixIcon: Icon(Icons.school_outlined),
                              ),

                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Required';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 18),

                            TextFormField(
                              controller: _rollCtrl,

                              decoration: const InputDecoration(
                                labelText: 'Roll Number',
                                prefixIcon: Icon(Icons.badge_outlined),
                              ),

                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Required';
                                }

                                return null;
                              },
                            ),

                            const SizedBox(height: 24),

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
