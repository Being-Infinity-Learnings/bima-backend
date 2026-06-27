import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../features/home/presentation/home_screen.dart';
import '../../features/history/presentation/history_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';

// Tracks how many unread notifications have come in since the user last
// visited the notifications tab. Exposed so the badge can read it.
final _unreadCountProvider = StateProvider<int>((_) => 0);

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  int _selectedIndex = 0;
  StreamSubscription<RemoteMessage>? _fgSub;
  StreamSubscription<RemoteMessage>? _tapSub;

  static const _notifTabIndex = 2;

  final _screens = const [
    HomeScreen(),
    HistoryScreen(),
    NotificationsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();

    // Increment badge whenever a foreground message arrives and the user is
    // NOT already on the notifications tab.
    _fgSub = FirebaseMessaging.onMessage.listen((msg) {
      if (_selectedIndex != _notifTabIndex) {
        ref.read(_unreadCountProvider.notifier).update((c) => c + 1);
      }
    });

    // When a notification is tapped from the system tray, jump straight to
    // the notifications tab and clear the badge.
    _tapSub = FirebaseMessaging.onMessageOpenedApp.listen((_) {
      _selectTab(_notifTabIndex);
    });

    // Handle the case where the app was terminated and launched via a notif.
    FirebaseMessaging.instance.getInitialMessage().then((msg) {
      if (msg != null && mounted) {
        _selectTab(_notifTabIndex);
      }
    });
  }

  @override
  void dispose() {
    _fgSub?.cancel();
    _tapSub?.cancel();
    super.dispose();
  }

  void _selectTab(int index) {
    setState(() => _selectedIndex = index);
    if (index == _notifTabIndex) {
      // Clear badge when user lands on the notifications tab.
      ref.read(_unreadCountProvider.notifier).state = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = ref.watch(_unreadCountProvider);

    return Scaffold(
      body: IndexedStack(index: _selectedIndex, children: _screens),

      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: _selectTab,
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: 'History',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications),
            ),
            label: 'Notifications',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
