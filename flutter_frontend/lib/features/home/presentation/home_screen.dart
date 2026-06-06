/// Home screen shown to authenticated users.
///
/// Displays basic profile details and logout actions.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../shared/enums/auth_status.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  /// Builds the authenticated home screen and handles logout routing.
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    final user = authState.user;

    ref.listen(authProvider, (previous, next) {
      if (next.status == AuthStatus.unauthenticated) {
        context.go('/login');
      }
    });

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Home')),

      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),

        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,

          children: [
            Text(
              'Welcome ${user.fullName}',
              style: Theme.of(context).textTheme.headlineMedium,
            ),

            const SizedBox(height: 24),

            _InfoTile(label: 'Email', value: user.email ?? 'N/A'),

            _InfoTile(label: 'Role', value: user.role),

            _InfoTile(label: 'College', value: user.collegeName),

            _InfoTile(label: 'Roll Number', value: user.rollNumber),

            _InfoTile(label: 'Approved', value: user.approved.toString()),

            _InfoTile(label: 'Blocked', value: user.blocked.toString()),

            const SizedBox(height: 32),

            ElevatedButton(
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
              },

              child: const Text('Logout'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Simple information tile used to display a label/value pair.
class _InfoTile extends StatelessWidget {
  final String label;
  final String value;

  const _InfoTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(title: Text(label), subtitle: Text(value)),
    );
  }
}
