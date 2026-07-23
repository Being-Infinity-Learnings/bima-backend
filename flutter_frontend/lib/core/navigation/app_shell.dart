import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../features/home/presentation/home_screen.dart';
import '../../features/history/presentation/history_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../shared/widgets/shared_widgets.dart';
import '../../config/app_config.dart';

// Tracks how many unread notifications have come in since the user last
// visited the notifications tab. Exposed so the badge can read it.
final _unreadCountProvider = StateProvider<int>((_) => 0);

/// The currently selected bottom-nav tab (0=Home, 1=History, 2=Notifications,
/// 3=Profile). Exposed so other screens (e.g. Home's "Recent Activity" card)
/// can switch tabs — e.g. `ref.read(selectedTabIndexProvider.notifier).state
/// = 1` to jump to the History tab — without needing a BuildContext route.
final selectedTabIndexProvider = StateProvider<int>((_) => 0);

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  StreamSubscription<RemoteMessage>? _fgSub;
  StreamSubscription<RemoteMessage>? _tapSub;

  static const _notifTabIndex = 2;

  final _screens = const [
    HomeScreen(),
    HistoryScreen(),
    NotificationsScreen(),
    ProfileScreen(),
  ];

  int get _selectedIndex => ref.read(selectedTabIndexProvider);

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
    ref.read(selectedTabIndexProvider.notifier).state = index;
    if (index == _notifTabIndex) {
      // Clear badge when user lands on the notifications tab.
      ref.read(_unreadCountProvider.notifier).state = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = ref.watch(_unreadCountProvider);
    final selectedIndex = ref.watch(selectedTabIndexProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),

      // The persistent branding strip lives here, above the tab content, so
      // every tab (Home, History, Notifications, Profile) shows it without
      // each screen needing its own copy. Each tab screen still draws its
      // own SafeArea, so the top inset is consumed here and removed below
      // to avoid double padding.
      body: Column(
        children: [
          SafeArea(bottom: false, child: const AppBrandBar()),

          Expanded(
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: IndexedStack(index: selectedIndex, children: _screens),
            ),
          ),
        ],
      ),

      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
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
