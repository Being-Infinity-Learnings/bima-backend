import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../data/quiz_dummy_data.dart';
import '../../../config/app_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class QuizResultsScreen extends StatefulWidget {
  final String quizId;
  const QuizResultsScreen({super.key, required this.quizId});

  @override
  State<QuizResultsScreen> createState() => _QuizResultsScreenState();
}

class _QuizResultsScreenState extends State<QuizResultsScreen>
    with TickerProviderStateMixin {
  late AnimationController _headerCtrl;
  late AnimationController _thirdCtrl;
  late AnimationController _secondCtrl;
  late AnimationController _firstCtrl;
  late AnimationController _firstGlowCtrl;
  late final Ticker _confettiTicker;
  final ValueNotifier<double> _confettiProgress = ValueNotifier<double>(0);
  bool _confettiActive = false;
  late AnimationController _bottomCtrl;
  late AnimationController _cardCtrl;

  late Animation<double> _headerFade;
  late Animation<Offset> _headerSlide;

  late Animation<double> _thirdRise;
  late Animation<double> _secondRise;
  late Animation<double> _firstScale;
  late Animation<double> _firstFade;

  late Animation<double> _bottomSlide;
  late Animation<double> _bottomFade;

  late Animation<double> _cardScale;
  late Animation<double> _cardFade;

  final List<_Particle> _particles = [];

  @override
  void initState() {
    super.initState();

    for (int i = 0; i < 110; i++) {
      _particles.add(_Particle.random(i));
    }

    _headerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _headerFade = CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOut);
    _headerSlide = Tween<Offset>(
      begin: const Offset(0, -0.4),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOutCubic));

    _thirdCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _thirdRise = CurvedAnimation(parent: _thirdCtrl, curve: Curves.elasticOut);

    _secondCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _secondRise = CurvedAnimation(
      parent: _secondCtrl,
      curve: Curves.elasticOut,
    );

    _firstCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    );
    _firstScale = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _firstCtrl, curve: Curves.elasticOut));
    _firstFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _firstCtrl,
        curve: const Interval(0.0, 0.35, curve: Curves.easeIn),
      ),
    );

    _firstGlowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _confettiTicker = createTicker((elapsed) {
      _confettiProgress.value = elapsed.inMilliseconds / 1000.0;
    });

    _bottomCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _bottomSlide = Tween<double>(
      begin: 60,
      end: 0,
    ).animate(CurvedAnimation(parent: _bottomCtrl, curve: Curves.easeOutCubic));
    _bottomFade = CurvedAnimation(parent: _bottomCtrl, curve: Curves.easeOut);

    _cardCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _cardScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(
          begin: 0.8,
          end: 1.05,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 60,
      ),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.05,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.easeIn)),
        weight: 40,
      ),
    ]).animate(_cardCtrl);
    _cardFade = CurvedAnimation(
      parent: _cardCtrl,
      curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
    );

    _runSequence();
  }

  Future<void> _runSequence() async {
    _headerCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 400));

    _thirdCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 850));

    _secondCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 850));

    if (!mounted) return;
    _firstCtrl.forward();
    setState(() => _confettiActive = true);
    _confettiTicker.start();
    HapticFeedback.heavyImpact();
    await Future.delayed(const Duration(milliseconds: 700));

    if (!mounted) return;

    _bottomCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 200));

    if (!mounted) return;
    _cardCtrl.forward();
  }

  @override
  void dispose() {
    _headerCtrl.dispose();
    _thirdCtrl.dispose();
    _secondCtrl.dispose();
    _firstCtrl.dispose();
    _firstGlowCtrl.dispose();
    _confettiTicker.dispose();
    _confettiProgress.dispose();
    _bottomCtrl.dispose();
    _cardCtrl.dispose();
    super.dispose();
  }

  DemoLeaderboardEntry get _top1 => demoLeaderboardEntries[0];
  DemoLeaderboardEntry get _top2 => demoLeaderboardEntries[1];
  DemoLeaderboardEntry get _top3 => demoLeaderboardEntries[2];
  DemoLeaderboardEntry get _yourEntry =>
      demoLeaderboardEntries[demoUserRank - 1];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: AppConfig.scaffoldColor(isDark),
      body: Stack(
        children: [
          if (_confettiActive)
            ValueListenableBuilder<double>(
              valueListenable: _confettiProgress,
              builder: (_, progress, __) => CustomPaint(
                painter: _ConfettiPainter(
                  progress: progress,
                  particles: _particles,
                ),
                size: MediaQuery.of(context).size,
              ),
            ),

          AnimatedBuilder(
            animation: Listenable.merge([_firstFade, _firstGlowCtrl]),
            builder: (_, __) {
              final base = _firstFade.value;
              final pulse = _firstGlowCtrl.value;
              return Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: MediaQuery.of(context).size.height * 0.55,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.topCenter,
                      radius: 0.85,
                      colors: [
                        AppConfig.rankGold.withOpacity(
                          (0.07 + pulse * 0.07) * base,
                        ),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              );
            },
          ),

          SafeArea(
            child: Column(
              children: [
                FadeTransition(
                  opacity: _headerFade,
                  child: SlideTransition(
                    position: _headerSlide,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                      child: Column(
                        children: [
                          Text(
                            '🏆  Quiz Complete!',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: AppConfig.bodyTextColor(isDark),
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$demoTotalParticipants players competed',
                            style: TextStyle(
                              fontSize: 13,
                              color: AppConfig.mutedTextColor(isDark),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 8),

                Expanded(
                  flex: 5,
                  child: ClipRect(
                    child: _AnimatedPodium(
                      top1: _top1,
                      top2: _top2,
                      top3: _top3,
                      thirdRise: _thirdRise,
                      secondRise: _secondRise,
                      firstScale: _firstScale,
                      firstFade: _firstFade,
                      firstGlowCtrl: _firstGlowCtrl,
                    ),
                  ),
                ),

                Expanded(
                  flex: 6,
                  child: AnimatedBuilder(
                    animation: _bottomCtrl,
                    builder: (_, child) => Opacity(
                      opacity: _bottomFade.value,
                      child: Transform.translate(
                        offset: Offset(0, _bottomSlide.value),
                        child: child,
                      ),
                    ),
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                      child: Column(
                        children: [
                          AnimatedBuilder(
                            animation: _cardCtrl,
                            builder: (_, child) => Opacity(
                              opacity: _cardFade.value,
                              child: Transform.scale(
                                scale: _cardScale.value,
                                child: child,
                              ),
                            ),
                            child: _YourResultCard(
                              entry: _yourEntry,
                              isDark: isDark,
                            ),
                          ),
                          const SizedBox(height: 20),
                          _FullLeaderboardSection(
                            yourEntry: _yourEntry,
                            isDark: isDark,
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ),

                AnimatedBuilder(
                  animation: _bottomFade,
                  builder: (_, child) =>
                      Opacity(opacity: _bottomFade.value, child: child),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => context.go('/home'),
                        icon: const Icon(Icons.home_rounded, size: 20),
                        label: const Text(
                          'Back to Home',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppConfig.primaryColor,
                          foregroundColor: AppConfig.bodyTextLight,
                          minimumSize: const Size.fromHeight(56),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AnimatedPodium extends StatelessWidget {
  final DemoLeaderboardEntry top1, top2, top3;
  final Animation<double> thirdRise;
  final Animation<double> secondRise;
  final Animation<double> firstScale;
  final Animation<double> firstFade;
  final AnimationController firstGlowCtrl;

  const _AnimatedPodium({
    required this.top1,
    required this.top2,
    required this.top3,
    required this.thirdRise,
    required this.secondRise,
    required this.firstScale,
    required this.firstFade,
    required this.firstGlowCtrl,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        AnimatedBuilder(
          animation: secondRise,
          builder: (_, child) => FractionalTranslation(
            translation: Offset(0, 1.0 - secondRise.value.clamp(0.0, 1.0)),
            child: Opacity(
              opacity: secondRise.value.clamp(0.0, 1.0),
              child: child,
            ),
          ),
          child: _PodiumColumn(
            entry: top2,
            podiumHeight: 90,
            avatarSize: 52,
            medal: '🥈',
            color: AppConfig.rankSilver,
            rank: 2,
            isWinner: false,
            glowCtrl: null,
          ),
        ),

        const SizedBox(width: 6),

        AnimatedBuilder(
          animation: Listenable.merge([firstScale, firstFade]),
          builder: (_, child) => Transform.scale(
            scale: firstScale.value.clamp(0.0, 1.1),
            alignment: Alignment.bottomCenter,
            child: Opacity(
              opacity: firstFade.value.clamp(0.0, 1.0),
              child: child,
            ),
          ),
          child: _PodiumColumn(
            entry: top1,
            podiumHeight: 120,
            avatarSize: 66,
            medal: '👑',
            color: AppConfig.rankGold,
            rank: 1,
            isWinner: true,
            glowCtrl: firstGlowCtrl,
          ),
        ),

        const SizedBox(width: 6),

        AnimatedBuilder(
          animation: thirdRise,
          builder: (_, child) => FractionalTranslation(
            translation: Offset(0, 1.0 - thirdRise.value.clamp(0.0, 1.0)),
            child: Opacity(
              opacity: thirdRise.value.clamp(0.0, 1.0),
              child: child,
            ),
          ),
          child: _PodiumColumn(
            entry: top3,
            podiumHeight: 70,
            avatarSize: 48,
            medal: '🥉',
            color: AppConfig.rankBronze,
            rank: 3,
            isWinner: false,
            glowCtrl: null,
          ),
        ),
      ],
    );
  }
}

class _PodiumColumn extends StatelessWidget {
  final DemoLeaderboardEntry entry;
  final double podiumHeight;
  final double avatarSize;
  final String medal;
  final Color color;
  final int rank;
  final bool isWinner;
  final AnimationController? glowCtrl;

  const _PodiumColumn({
    required this.entry,
    required this.podiumHeight,
    required this.avatarSize,
    required this.medal,
    required this.color,
    required this.rank,
    required this.isWinner,
    required this.glowCtrl,
  });

  @override
  Widget build(BuildContext context) {
    final double colWidth = isWinner ? 102.0 : 88.0;

    Widget avatar = Container(
      width: avatarSize,
      height: avatarSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withOpacity(0.15),
        border: Border.all(
          color: color.withOpacity(isWinner ? 0.75 : 0.45),
          width: isWinner ? 2.5 : 2.0,
        ),
      ),
      child: Center(
        child: Text(
          entry.name[0],
          style: TextStyle(
            fontSize: isWinner ? 26 : 20,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
      ),
    );

    if (isWinner && glowCtrl != null) {
      avatar = AnimatedBuilder(
        animation: glowCtrl!,
        builder: (_, child) => Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: color.withOpacity(0.15 + glowCtrl!.value * 0.35),
                blurRadius: 18 + glowCtrl!.value * 18,
                spreadRadius: glowCtrl!.value * 5,
              ),
            ],
          ),
          child: child,
        ),
        child: avatar,
      );
    }

    return SizedBox(
      width: colWidth,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text(medal, style: TextStyle(fontSize: isWinner ? 30 : 22)),
          const SizedBox(height: 5),
          avatar,
          const SizedBox(height: 6),
          Text(
            entry.name,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: isWinner ? 13 : 11,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${entry.score} pts',
            style: TextStyle(
              fontSize: isWinner ? 12 : 10,
              fontWeight: FontWeight.w600,
              color: color.withOpacity(0.65),
            ),
          ),
          const SizedBox(height: 6),
          Container(
            width: colWidth,
            height: podiumHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  color.withOpacity(isWinner ? 0.22 : 0.12),
                  color.withOpacity(0.05),
                ],
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12),
              ),
              border: Border.all(
                color: color.withOpacity(isWinner ? 0.38 : 0.20),
                width: isWinner ? 1.5 : 1.0,
              ),
            ),
            child: Center(
              child: Text(
                '$rank',
                style: TextStyle(
                  fontSize: isWinner ? 44 : 32,
                  fontWeight: FontWeight.w900,
                  color: color.withOpacity(0.16),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _YourResultCard extends StatelessWidget {
  final DemoLeaderboardEntry entry;
  final bool isDark;
  const _YourResultCard({required this.entry, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final rankColor = entry.rank == 1
        ? AppConfig.rankGold
        : entry.rank == 2
        ? AppConfig.rankSilver
        : entry.rank == 3
        ? AppConfig.rankBronze
        : AppConfig.quizAnswerColors[0];

    final String tagline = entry.rank == 1
        ? '🎉 You won! Incredible!'
        : entry.rank == 2
        ? '🎊 Runner-up — amazing!'
        : entry.rank == 3
        ? '⭐ Top 3 — well played!'
        : '💪 Keep pushing!';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            rankColor.withOpacity(isDark ? 0.16 : 0.25),
            AppConfig.cardColor(isDark),
          ],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: rankColor.withOpacity(isDark ? 0.30 : 0.45)),
        boxShadow: [
          BoxShadow(
            color: rankColor.withOpacity(isDark ? 0.08 : 0.15),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                'YOUR RESULT',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: rankColor.withOpacity(0.8),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: rankColor.withOpacity(isDark ? 0.12 : 0.18),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  tagline,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isDark ? rankColor : rankColor.withOpacity(0.9),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _ResultStat(
                value: '#${entry.rank}',
                label: 'Final Rank',
                color: rankColor,
                big: true,
                isDark: isDark,
              ),
              _divider(isDark),
              _ResultStat(
                value: '${entry.score}',
                label: 'Total Score',
                color: AppConfig.primaryColor,
                big: false,
                isDark: isDark,
              ),
              _divider(isDark),
              _ResultStat(
                value: '$demoTotalParticipants',
                label: 'Players',
                color: AppConfig.mutedTextColor(isDark),
                big: false,
                isDark: isDark,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _divider(bool isDark) =>
      Container(width: 1, height: 48, color: AppConfig.subtleOverlay(isDark));
}

class _ResultStat extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  final bool big;
  final bool isDark;

  const _ResultStat({
    required this.value,
    required this.label,
    required this.color,
    required this.big,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: big ? 36 : 22,
            fontWeight: FontWeight.w900,
            letterSpacing: -1,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: AppConfig.mutedTextColor(isDark),
          ),
        ),
      ],
    );
  }
}

class _FullLeaderboardSection extends StatefulWidget {
  final DemoLeaderboardEntry yourEntry;
  final bool isDark;
  const _FullLeaderboardSection({
    required this.yourEntry,
    required this.isDark,
  });

  @override
  State<_FullLeaderboardSection> createState() =>
      _FullLeaderboardSectionState();
}

class _FullLeaderboardSectionState extends State<_FullLeaderboardSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final entries = _expanded
        ? demoLeaderboardEntries
        : demoLeaderboardEntries.take(5).toList();

    final isYourEntryVisible = entries.any(
      (e) => e.name == widget.yourEntry.name,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'LEADERBOARD',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: AppConfig.mutedTextColor(widget.isDark),
              ),
            ),
            const Spacer(),
            GestureDetector(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Row(
                children: [
                  Text(
                    _expanded ? 'Show less' : 'Show all',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppConfig.primaryColor,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: AppConfig.primaryColor,
                    size: 18,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...entries.asMap().entries.map((kv) {
          final entry = kv.value;
          final isYou = entry.name == widget.yourEntry.name;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _LeaderRow(
              entry: entry,
              isYou: isYou,
              isDark: widget.isDark,
            ),
          );
        }),
        if (!isYourEntryVisible) ...[
          const SizedBox(height: 4),
          _YourRankDivider(entry: widget.yourEntry, isDark: widget.isDark),
        ],
        const SizedBox(height: 8),
      ],
    );
  }
}

class _LeaderRow extends StatelessWidget {
  final DemoLeaderboardEntry entry;
  final bool isYou;
  final bool isDark;

  const _LeaderRow({
    required this.entry,
    required this.isYou,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final medal = entry.rank == 1
        ? '🥇'
        : entry.rank == 2
        ? '🥈'
        : entry.rank == 3
        ? '🥉'
        : null;

    final rowColor = isYou
        ? AppConfig.rankGold
        : entry.rank <= 3
        ? [
            AppConfig.rankGold,
            AppConfig.rankSilver,
            AppConfig.rankBronze,
          ][entry.rank - 1]
        : AppConfig.mutedTextColor(isDark);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: isYou
            ? AppConfig.rankGold.withOpacity(isDark ? 0.07 : 0.12)
            : entry.rank <= 3
            ? rowColor.withOpacity(isDark ? 0.05 : 0.08)
            : AppConfig.cardColor(isDark),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isYou
              ? AppConfig.rankGold.withOpacity(0.25)
              : entry.rank <= 3
              ? rowColor.withOpacity(0.15)
              : AppConfig.subtleOverlay(isDark),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: medal != null
                ? Text(
                    medal,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16),
                  )
                : Text(
                    '${entry.rank}',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isYou
                          ? AppConfig.rankGold
                          : AppConfig.mutedTextColor(isDark),
                    ),
                  ),
          ),
          const SizedBox(width: 4),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: rowColor.withOpacity(isYou ? 0.15 : 0.08),
              border: Border.all(
                color: rowColor.withOpacity(isYou ? 0.4 : 0.2),
              ),
            ),
            child: Center(
              child: Text(
                entry.name[0],
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: rowColor,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isYou ? '${entry.name} (You)' : entry.name,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isYou ? FontWeight.w800 : FontWeight.w500,
                color: isYou
                    ? AppConfig.rankGold
                    : AppConfig.bodyTextColor(isDark),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${entry.score}',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: isYou
                      ? AppConfig.rankGold
                      : AppConfig.bodyTextColor(isDark),
                ),
              ),
              Text(
                'pts',
                style: TextStyle(
                  fontSize: 10,
                  color: AppConfig.mutedTextColor(isDark),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _YourRankDivider extends StatelessWidget {
  final DemoLeaderboardEntry entry;
  final bool isDark;
  const _YourRankDivider({required this.entry, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: Divider(color: AppConfig.subtleOverlay(isDark))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(
                '· · ·',
                style: TextStyle(
                  fontSize: 14,
                  color: AppConfig.mutedTextColor(isDark).withOpacity(0.5),
                  letterSpacing: 4,
                ),
              ),
            ),
            Expanded(child: Divider(color: AppConfig.subtleOverlay(isDark))),
          ],
        ),
        const SizedBox(height: 8),
        _LeaderRow(entry: entry, isYou: true, isDark: isDark),
      ],
    );
  }
}

class _Particle {
  final double x;
  final double speed;
  final double size;
  final Color color;
  final double swayAmount;
  final double swayFreq;
  final double swayPhase;
  final double phase;
  final double rotation;
  final double spin;
  final double fadeStart;
  final bool isCircle;

  _Particle({
    required this.x,
    required this.speed,
    required this.size,
    required this.color,
    required this.swayAmount,
    required this.swayFreq,
    required this.swayPhase,
    required this.phase,
    required this.rotation,
    required this.spin,
    required this.fadeStart,
    required this.isCircle,
  });

  factory _Particle.random(int seed) {
    final colors = AppConfig.quizConfettiColors;
    final rnd = math.Random(seed * 7919 + 104729);
    return _Particle(
      x: rnd.nextDouble(),
      speed: 0.035 + rnd.nextDouble() * 0.28,
      size: 3.5 + rnd.nextDouble() * 8.5,
      color: colors[rnd.nextInt(colors.length)],
      swayAmount: 0.01 + rnd.nextDouble() * 0.06,
      swayFreq: 0.6 + rnd.nextDouble() * 3.2,
      swayPhase: rnd.nextDouble() * math.pi * 2,
      phase: rnd.nextDouble(),
      rotation: rnd.nextDouble() * math.pi * 2,
      spin: (rnd.nextBool() ? 1 : -1) * (0.4 + rnd.nextDouble() * 3.0),
      fadeStart: 0.68 + rnd.nextDouble() * 0.22,
      isCircle: rnd.nextDouble() < 0.25,
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  final double progress;
  final List<_Particle> particles;

  _ConfettiPainter({required this.progress, required this.particles});

  @override
  void paint(Canvas canvas, Size size) {
    for (final p in particles) {
      final t = (progress * p.speed + p.phase) % 1.0;
      final x =
          (p.x +
              p.swayAmount *
                  math.sin(t * math.pi * 2 * p.swayFreq + p.swayPhase)) *
          size.width;
      final y = -20 + t * (size.height + 30);
      final opacity = t < 0.08
          ? t / 0.08
          : t > p.fadeStart
          ? (1 - (t - p.fadeStart) / (1.0 - p.fadeStart)).clamp(0.0, 1.0)
          : 1.0;

      final paint = Paint()
        ..color = p.color.withOpacity((opacity * 0.92).clamp(0.0, 1.0))
        ..style = PaintingStyle.fill;

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(p.rotation + t * math.pi * 2 * p.spin);

      if (p.isCircle) {
        canvas.drawCircle(Offset.zero, p.size * 0.5, paint);
      } else {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset.zero,
              width: p.size,
              height: p.size * 0.42,
            ),
            const Radius.circular(1.5),
          ),
          paint,
        );
      }

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.progress != progress;
}
