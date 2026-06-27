// notifications_screen.dart
//
// The user-facing notifications feed.
//
// Features:
//  • Correct targeting — only notifications meant for the current user are
//    shown (ALL, APPROVED_ONLY, or GROUP they belong to). Enforced on the
//    backend; the screen just displays what the API returns.
//  • Pagination — loads AppConfig.notificationPageSize items at a time with
//    a "Load more" button at the bottom (no infinite-scroll jank).
//  • Type filter chips — tap to see only a specific category.
//  • Date-range filter — pick a start and/or end date via a bottom sheet.
//  • Real-time updates — foreground FCM messages prepend instantly then
//    trigger a soft refresh.
//  • App-resume refresh — fetches fresh data when the user brings the app
//    to the foreground.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:dio/dio.dart';
import '../../../config/app_config.dart';
import '../../../core/network/api_client.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Enums & data models
// ─────────────────────────────────────────────────────────────────────────────

/// Maps the backend NotificationType enum values to a Dart enum.
enum NotifType { quizReminder, announcement, result, contest }

extension NotifTypeExt on NotifType {
  /// The backend string representation sent in the API response.
  String get apiValue {
    switch (this) {
      case NotifType.quizReminder:
        return 'QUIZ_REMINDER';
      case NotifType.result:
        return 'RESULT';
      case NotifType.contest:
        return 'CONTEST';
      case NotifType.announcement:
        return 'ANNOUNCEMENT';
    }
  }

  /// Human-readable label shown in the filter chip and card badge.
  String get label {
    switch (this) {
      case NotifType.quizReminder:
        return 'Quiz';
      case NotifType.result:
        return 'Result';
      case NotifType.contest:
        return 'Contest';
      case NotifType.announcement:
        return 'Update';
    }
  }

  IconData get icon {
    switch (this) {
      case NotifType.quizReminder:
        return Icons.timer_outlined;
      case NotifType.result:
        return Icons.emoji_events_outlined;
      case NotifType.contest:
        return Icons.code_rounded;
      case NotifType.announcement:
        return Icons.campaign_outlined;
    }
  }

  Color get color {
    switch (this) {
      case NotifType.quizReminder:
        return AppConfig.notifColorQuiz;
      case NotifType.result:
        return AppConfig.notifColorResult;
      case NotifType.contest:
        return AppConfig.notifColorContest;
      case NotifType.announcement:
        return AppConfig.notifColorAnnouncement;
    }
  }
}

/// A single notification item as returned from the API.
class AppNotif {
  final String id;
  final String title;
  final String body;
  final String timeLabel;
  final NotifType type;
  final DateTime? sentAt;

  const AppNotif({
    required this.id,
    required this.title,
    required this.body,
    required this.timeLabel,
    required this.type,
    this.sentAt,
  });

  factory AppNotif.fromJson(Map<String, dynamic> json) {
    final typeStr = (json['type'] as String? ?? 'ANNOUNCEMENT').toUpperCase();
    NotifType type;
    switch (typeStr) {
      case 'QUIZ_REMINDER':
        type = NotifType.quizReminder;
        break;
      case 'RESULT':
        type = NotifType.result;
        break;
      case 'CONTEST':
        type = NotifType.contest;
        break;
      default:
        type = NotifType.announcement;
    }

    final sentAt = json['sentAt'] != null
        ? DateTime.tryParse(json['sentAt'])
        : null;
    final timeLabel = sentAt != null ? _formatRelativeTime(sentAt) : 'Just now';

    return AppNotif(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      timeLabel: timeLabel,
      type: type,
      sentAt: sentAt,
    );
  }

  static String _formatRelativeTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter state
// ─────────────────────────────────────────────────────────────────────────────

/// Holds the current filter selections for the notification feed.
class NotifFilter {
  final NotifType? type; // null = all types
  final DateTime? dateFrom;
  final DateTime? dateTo;

  const NotifFilter({this.type, this.dateFrom, this.dateTo});

  bool get isActive => type != null || dateFrom != null || dateTo != null;

  NotifFilter copyWith({
    Object? type = _sentinel,
    Object? dateFrom = _sentinel,
    Object? dateTo = _sentinel,
  }) {
    return NotifFilter(
      type: type == _sentinel ? this.type : type as NotifType?,
      dateFrom: dateFrom == _sentinel ? this.dateFrom : dateFrom as DateTime?,
      dateTo: dateTo == _sentinel ? this.dateTo : dateTo as DateTime?,
    );
  }

  static const _sentinel = Object();

  NotifFilter cleared() => const NotifFilter();
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider state
// ─────────────────────────────────────────────────────────────────────────────

class NotifFeedState {
  final List<AppNotif> items;
  final bool isLoading; // loading first page
  final bool isLoadingMore; // loading next page
  final bool hasMore; // whether a next page exists
  final String? nextCursor; // cursor for the next page request
  final String? error;
  final NotifFilter filter;

  const NotifFeedState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.nextCursor,
    this.error,
    this.filter = const NotifFilter(),
  });

  NotifFeedState copyWith({
    List<AppNotif>? items,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    Object? nextCursor = _sentinel,
    Object? error = _sentinel,
    NotifFilter? filter,
  }) {
    return NotifFeedState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      nextCursor: nextCursor == _sentinel
          ? this.nextCursor
          : nextCursor as String?,
      error: error == _sentinel ? this.error : error as String?,
      filter: filter ?? this.filter,
    );
  }

  static const _sentinel = Object();
}

// ─────────────────────────────────────────────────────────────────────────────
// StateNotifier
// ─────────────────────────────────────────────────────────────────────────────

class NotifNotifier extends StateNotifier<NotifFeedState> {
  NotifNotifier() : super(const NotifFeedState(isLoading: true)) {
    _loadFirstPage();
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /// Builds query parameters from the current filter state and an optional cursor.
  Map<String, dynamic> _buildParams({String? cursor}) {
    final params = <String, dynamic>{'limit': AppConfig.notificationPageSize};
    final f = state.filter;
    if (f.type != null) params['type'] = f.type!.apiValue;
    if (f.dateFrom != null) {
      params['dateFrom'] = f.dateFrom!.toIso8601String();
    }
    if (f.dateTo != null) {
      params['dateTo'] = f.dateTo!.toIso8601String();
    }
    if (cursor != null) params['cursor'] = cursor;
    return params;
  }

  /// Fetches a page and parses the result envelope from the API.
  Future<({List<AppNotif> items, String? nextCursor})> _fetchPage(
    Map<String, dynamic> params,
  ) async {
    final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
    if (idToken == null) return (items: <AppNotif>[], nextCursor: null);

    final response = await ApiClient.dio.get(
      '/notifications/my',
      queryParameters: params,
      options: Options(headers: {'Authorization': 'Bearer $idToken'}),
    );

    final envelope = response.data['data'] as Map<String, dynamic>;
    final rawItems = envelope['items'] as List? ?? [];
    final nextCursor = envelope['nextCursor'] as String?;

    final items = rawItems
        .map((e) => AppNotif.fromJson(e as Map<String, dynamic>))
        .toList();

    return (items: items, nextCursor: nextCursor);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /// Loads the first page (or first page after a filter change).
  Future<void> _loadFirstPage() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _fetchPage(_buildParams());
      state = state.copyWith(
        isLoading: false,
        items: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor != null,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Appends the next page of results to the existing list.
  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore || state.nextCursor == null) {
      return;
    }
    state = state.copyWith(isLoadingMore: true);
    try {
      final result = await _fetchPage(_buildParams(cursor: state.nextCursor));
      state = state.copyWith(
        isLoadingMore: false,
        items: [...state.items, ...result.items],
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor != null,
      );
    } catch (e) {
      // Don't wipe existing items on a "load more" failure
      state = state.copyWith(isLoadingMore: false, error: e.toString());
    }
  }

  /// Full refresh — resets to page 1 while keeping the current filter.
  Future<void> refresh() => _loadFirstPage();

  /// Apply new filter settings and reload from page 1.
  Future<void> applyFilter(NotifFilter newFilter) async {
    state = state.copyWith(filter: newFilter);
    await _loadFirstPage();
  }

  /// Prepend a notification from an incoming FCM message immediately so the
  /// UI updates in <1 frame, then do a real fetch to sync server data.
  void prependFromMessage(RemoteMessage message) {
    final title =
        message.notification?.title ?? message.data['title'] as String?;
    final body = message.notification?.body ?? message.data['body'] as String?;
    if (title == null && body == null) return;

    final notif = AppNotif(
      id:
          message.data['notificationId'] as String? ??
          message.messageId ??
          DateTime.now().millisecondsSinceEpoch.toString(),
      title: title ?? '',
      body: body ?? '',
      timeLabel: 'Just now',
      type: NotifType.announcement,
    );

    // Avoid duplicate if the id is already in the list
    if (!state.items.any((n) => n.id == notif.id)) {
      state = state.copyWith(items: [notif, ...state.items]);
    }

    // Then sync from the server to get correct type, sentAt, etc.
    _loadFirstPage();
  }
}

final notificationsProvider =
    StateNotifierProvider<NotifNotifier, NotifFeedState>(
      (_) => NotifNotifier(),
    );

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
    with WidgetsBindingObserver {
  StreamSubscription<RemoteMessage>? _fgSub;
  StreamSubscription<RemoteMessage>? _tapSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Prepend new items instantly when a foreground FCM message arrives.
    _fgSub = FirebaseMessaging.onMessage.listen((msg) {
      ref.read(notificationsProvider.notifier).prependFromMessage(msg);
    });

    // Refresh when the user taps a notification and the app opens.
    _tapSub = FirebaseMessaging.onMessageOpenedApp.listen((_) {
      ref.read(notificationsProvider.notifier).refresh();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState appState) {
    // Catch background/killed notifications that were received while the
    // app was away and the user opens it without tapping the notification.
    if (appState == AppLifecycleState.resumed) {
      ref.read(notificationsProvider.notifier).refresh();
    }
  }

  @override
  void dispose() {
    _fgSub?.cancel();
    _tapSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // ── Date filter bottom sheet ───────────────────────────────────────────────

  Future<void> _showDateFilterSheet(
    BuildContext context,
    bool isDark,
    NotifFeedState notifState,
  ) async {
    DateTime? from = notifState.filter.dateFrom;
    DateTime? to = notifState.filter.dateTo;

    await showModalBottomSheet(
      context: context,
      backgroundColor: AppConfig.cardColor(isDark),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Sheet handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppConfig.mutedTextColor(
                          isDark,
                        ).withOpacity(0.3),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Filter by Date',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppConfig.bodyTextColor(isDark),
                    ),
                  ),
                  const SizedBox(height: 20),
                  // From
                  _DatePickerRow(
                    isDark: isDark,
                    label: 'From',
                    value: from,
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate: from ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now(),
                      );
                      if (picked != null) setSheetState(() => from = picked);
                    },
                    onClear: () => setSheetState(() => from = null),
                  ),
                  const SizedBox(height: 12),
                  // To
                  _DatePickerRow(
                    isDark: isDark,
                    label: 'To',
                    value: to,
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate: to ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now(),
                      );
                      if (picked != null) setSheetState(() => to = picked);
                    },
                    onClear: () => setSheetState(() => to = null),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      // Clear
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            ref
                                .read(notificationsProvider.notifier)
                                .applyFilter(
                                  notifState.filter.copyWith(
                                    dateFrom: null,
                                    dateTo: null,
                                  ),
                                );
                          },
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: AppConfig.mutedTextColor(isDark),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            'Clear',
                            style: TextStyle(
                              color: AppConfig.mutedTextColor(isDark),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Apply
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            ref
                                .read(notificationsProvider.notifier)
                                .applyFilter(
                                  notifState.filter.copyWith(
                                    dateFrom: from,
                                    dateTo: to,
                                  ),
                                );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppConfig.primaryColor,
                            foregroundColor: Colors.black,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text(
                            'Apply',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final notifState = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppConfig.backgroundGradient(isDark),
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header ────────────────────────────────────────────────────
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
                              color: AppConfig.bodyTextColor(isDark),
                            ),
                          ),
                          const SizedBox(height: 4),
                          if (!notifState.isLoading)
                            Text(
                              '${notifState.items.length} notification'
                              '${notifState.items.length == 1 ? '' : 's'}'
                              '${notifState.hasMore ? '+' : ''}',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: AppConfig.mutedTextColor(isDark),
                              ),
                            ),
                        ],
                      ),
                    ),
                    // Date filter button — shows a dot when active
                    _FilterIconButton(
                      isDark: isDark,
                      icon: Icons.calendar_month_outlined,
                      isActive:
                          notifState.filter.dateFrom != null ||
                          notifState.filter.dateTo != null,
                      onTap: () =>
                          _showDateFilterSheet(context, isDark, notifState),
                    ),
                    const SizedBox(width: 8),
                    // Refresh button / spinner
                    _RefreshButton(
                      isDark: isDark,
                      isLoading: notifState.isLoading,
                      onTap: () =>
                          ref.read(notificationsProvider.notifier).refresh(),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // ── Type filter chips ─────────────────────────────────────────
              _TypeFilterRow(
                isDark: isDark,
                selectedType: notifState.filter.type,
                onSelect: (type) {
                  final newFilter = notifState.filter.copyWith(type: type);
                  ref
                      .read(notificationsProvider.notifier)
                      .applyFilter(newFilter);
                },
              ),

              const SizedBox(height: 16),

              // ── Active date range label ───────────────────────────────────
              if (notifState.filter.dateFrom != null ||
                  notifState.filter.dateTo != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                  child: _ActiveDateLabel(
                    isDark: isDark,
                    from: notifState.filter.dateFrom,
                    to: notifState.filter.dateTo,
                    onClear: () {
                      ref
                          .read(notificationsProvider.notifier)
                          .applyFilter(
                            notifState.filter.copyWith(
                              dateFrom: null,
                              dateTo: null,
                            ),
                          );
                    },
                  ),
                ),

              // ── Body ──────────────────────────────────────────────────────
              Expanded(child: _buildBody(isDark, notifState)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(bool isDark, NotifFeedState state) {
    // First-time loading spinner
    if (state.isLoading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    // Error with no existing items
    if (state.error != null && state.items.isEmpty) {
      return _ErrorView(
        isDark: isDark,
        onRetry: () => ref.read(notificationsProvider.notifier).refresh(),
      );
    }

    // Empty state
    if (state.items.isEmpty) {
      return _EmptyView(isDark: isDark, hasFilter: state.filter.isActive);
    }

    // List + load-more button
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      // +1 for the load-more row at the bottom
      itemCount: state.items.length + 1,
      itemBuilder: (context, index) {
        if (index < state.items.length) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _NotifCard(isDark: isDark, notif: state.items[index]),
          );
        }
        // Last item: load-more button or end-of-list indicator
        return _LoadMoreRow(
          isDark: isDark,
          hasMore: state.hasMore,
          isLoadingMore: state.isLoadingMore,
          onLoadMore: () => ref.read(notificationsProvider.notifier).loadMore(),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-widgets
// ─────────────────────────────────────────────────────────────────────────────

/// A small icon button used in the header (date filter, refresh, etc.).
class _FilterIconButton extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;

  const _FilterIconButton({
    required this.isDark,
    required this.icon,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF161B26) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark
                    ? Colors.white.withOpacity(0.06)
                    : Colors.black.withOpacity(0.06),
              ),
            ),
            child: Icon(
              icon,
              size: 18,
              color: isActive
                  ? AppConfig.primaryColor
                  : AppConfig.mutedTextColor(isDark),
            ),
          ),
          // Active indicator dot
          if (isActive)
            Positioned(
              top: -3,
              right: -3,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppConfig.primaryColor,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Refresh button — shows a spinner while loading.
class _RefreshButton extends StatelessWidget {
  final bool isDark;
  final bool isLoading;
  final VoidCallback onTap;

  const _RefreshButton({
    required this.isDark,
    required this.isLoading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF161B26) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark
                ? Colors.white.withOpacity(0.06)
                : Colors.black.withOpacity(0.06),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppConfig.primaryColor,
                ),
              )
            : const Text(
                'Refresh',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppConfig.primaryColor,
                ),
              ),
      ),
    );
  }
}

/// Horizontal scrollable row of type-filter chips.
class _TypeFilterRow extends StatelessWidget {
  final bool isDark;
  final NotifType? selectedType;
  final ValueChanged<NotifType?> onSelect;

  const _TypeFilterRow({
    required this.isDark,
    required this.selectedType,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final chips = [
      (label: 'All', type: null as NotifType?),
      (label: NotifType.announcement.label, type: NotifType.announcement),
      (label: NotifType.quizReminder.label, type: NotifType.quizReminder),
      (label: NotifType.result.label, type: NotifType.result),
      (label: NotifType.contest.label, type: NotifType.contest),
    ];

    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final chip = chips[i];
          final isSelected = chip.type == selectedType;
          // Pick accent color from config when a specific type is selected
          final accent = chip.type?.color ?? AppConfig.primaryColor;

          return GestureDetector(
            onTap: () => onSelect(chip.type),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? accent.withOpacity(0.15)
                    : (isDark ? const Color(0xFF161B26) : Colors.white),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected
                      ? accent.withOpacity(0.6)
                      : (isDark
                            ? Colors.white.withOpacity(0.08)
                            : Colors.black.withOpacity(0.08)),
                ),
              ),
              child: Text(
                chip.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? accent : AppConfig.mutedTextColor(isDark),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Small row showing the active date range with a clear button.
class _ActiveDateLabel extends StatelessWidget {
  final bool isDark;
  final DateTime? from;
  final DateTime? to;
  final VoidCallback onClear;

  const _ActiveDateLabel({
    required this.isDark,
    required this.from,
    required this.to,
    required this.onClear,
  });

  String _fmt(DateTime dt) => '${dt.day}/${dt.month}/${dt.year}';

  @override
  Widget build(BuildContext context) {
    String label;
    if (from != null && to != null) {
      label = '${_fmt(from!)} – ${_fmt(to!)}';
    } else if (from != null) {
      label = 'From ${_fmt(from!)}';
    } else {
      label = 'Until ${_fmt(to!)}';
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppConfig.primaryColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppConfig.primaryColor,
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: onClear,
                child: const Icon(
                  Icons.close,
                  size: 14,
                  color: AppConfig.primaryColor,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// A single row in the date-filter bottom sheet.
class _DatePickerRow extends StatelessWidget {
  final bool isDark;
  final String label;
  final DateTime? value;
  final VoidCallback onTap;
  final VoidCallback onClear;

  const _DatePickerRow({
    required this.isDark,
    required this.label,
    required this.value,
    required this.onTap,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF232733) : const Color(0xFFF7F8FC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark
                ? Colors.white.withOpacity(0.06)
                : Colors.black.withOpacity(0.06),
          ),
        ),
        child: Row(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppConfig.mutedTextColor(isDark),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value != null
                    ? '${value!.day}/${value!.month}/${value!.year}'
                    : 'Tap to select',
                style: TextStyle(
                  fontSize: 14,
                  color: value != null
                      ? AppConfig.bodyTextColor(isDark)
                      : AppConfig.mutedTextColor(isDark),
                ),
              ),
            ),
            if (value != null)
              GestureDetector(
                onTap: onClear,
                child: Icon(
                  Icons.close,
                  size: 16,
                  color: AppConfig.mutedTextColor(isDark),
                ),
              )
            else
              Icon(
                Icons.calendar_today_outlined,
                size: 16,
                color: AppConfig.mutedTextColor(isDark),
              ),
          ],
        ),
      ),
    );
  }
}

/// "Load more" / end-of-list row at the bottom of the list.
class _LoadMoreRow extends StatelessWidget {
  final bool isDark;
  final bool hasMore;
  final bool isLoadingMore;
  final VoidCallback onLoadMore;

  const _LoadMoreRow({
    required this.isDark,
    required this.hasMore,
    required this.isLoadingMore,
    required this.onLoadMore,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppConfig.primaryColor,
            ),
          ),
        ),
      );
    }

    if (hasMore) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: GestureDetector(
            onTap: onLoadMore,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF161B26) : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppConfig.primaryColor.withOpacity(0.4),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Load more',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppConfig.primaryColor,
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(
                    Icons.expand_more,
                    size: 16,
                    color: AppConfig.primaryColor,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // All items loaded
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Text(
          'You\'re all caught up',
          style: TextStyle(
            fontSize: 13,
            color: AppConfig.mutedTextColor(isDark),
          ),
        ),
      ),
    );
  }
}

/// Error view shown when the first page fails to load.
class _ErrorView extends StatelessWidget {
  final bool isDark;
  final VoidCallback onRetry;

  const _ErrorView({required this.isDark, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.wifi_off_outlined,
              size: 48,
              color: AppConfig.mutedTextColor(isDark),
            ),
            const SizedBox(height: 16),
            Text(
              'Could not load notifications',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppConfig.bodyTextColor(isDark),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Check your connection and try again.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppConfig.mutedTextColor(isDark),
              ),
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: onRetry,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppConfig.primaryColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppConfig.primaryColor,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Empty state for when no notifications match (initial or filtered).
class _EmptyView extends StatelessWidget {
  final bool isDark;
  final bool hasFilter;

  const _EmptyView({required this.isDark, required this.hasFilter});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            hasFilter
                ? Icons.filter_list_off
                : Icons.notifications_none_outlined,
            size: 48,
            color: AppConfig.mutedTextColor(isDark),
          ),
          const SizedBox(height: 16),
          Text(
            hasFilter ? 'No matching notifications' : 'No notifications yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppConfig.bodyTextColor(isDark),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            hasFilter
                ? 'Try adjusting your filters.'
                : 'Quiz reminders and announcements will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: AppConfig.mutedTextColor(isDark),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Card
// ─────────────────────────────────────────────────────────────────────────────

class _NotifCard extends StatelessWidget {
  final bool isDark;
  final AppNotif notif;

  const _NotifCard({required this.isDark, required this.notif});

  @override
  Widget build(BuildContext context) {
    final meta = notif.type;
    final cardBg = AppConfig.cardColor(isDark);
    final borderColor = isDark
        ? Colors.white.withOpacity(0.06)
        : Colors.black.withOpacity(0.06);

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
            // Type icon badge
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

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notif.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.1,
                      color: AppConfig.bodyTextColor(isDark),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notif.body,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: AppConfig.mutedTextColor(isDark),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      // Type badge
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
                        notif.timeLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: AppConfig.mutedTextColor(isDark),
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
