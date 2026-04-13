import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type AwardRow = {
  award_name?: string | null;
  category?: string | null;
  question_text?: string | null;
  poll_title?: string | null;
  meeting_date?: string | null;
  created_at?: string | null;
  won_at?: string | null;
};

type MonthCategoryRow = {
  shortTitle: string;
  emoji: string;
  count: number;
};

type MonthAwards = {
  key: string;
  label: string;
  totalWins: number;
  categories: MonthCategoryRow[];
};

const CACHE_TTL_MS = 2 * 60 * 1000;
let awardsCache: { key: string; at: number; awards: AwardRow[] } | null = null;

export async function prefetchMyAwardsPanel(
  userId?: string | null,
  clubId?: string | null,
  fullName?: string | null
) {
  if (!userId || !clubId) return;
  const cacheKey = `${clubId}:${userId}`;
  const isFresh = awardsCache && awardsCache.key === cacheKey && Date.now() - awardsCache.at < CACHE_TTL_MS;
  if (isFresh) return;
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_awards_snapshot', {
      p_club_id: clubId,
    });
    if (!rpcError && Array.isArray(rpcData)) {
      const rpcAwards = (rpcData as AwardRow[]).map((r) => ({
        award_name: r.award_name ?? null,
        question_text: r.question_text ?? null,
        poll_title: r.poll_title ?? null,
        meeting_date: r.meeting_date ?? null,
      }));
      awardsCache = { key: cacheKey, at: Date.now(), awards: rpcAwards };
      return;
    }

    const normalizedFull = (fullName || '').trim().toLowerCase();
    const normalizedFirst = normalizedFull.split(/\s+/).filter(Boolean)[0] || normalizedFull;
    const { data: polls, error: pollsError } = await supabase
      .from('polls')
      .select('id, title, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(120);
    if (pollsError || !polls?.length) return;

    const pollIds = polls.map((p) => p.id);
    const pollDateById = new Map<string, string | null>(polls.map((p) => [p.id, p.created_at || null]));
    const pollTitleById = new Map<string, string | null>(polls.map((p) => [p.id, p.title || null]));
    const { data: results, error: resultsError } = await supabase
      .from('poll_results_repository')
      .select('poll_id, question_order, question_text, option_text, votes')
      .in('poll_id', pollIds);
    if (resultsError || !results?.length) return;

    type ResultRow = {
      poll_id: string;
      question_order: number;
      question_text: string | null;
      option_text: string | null;
      votes: number | null;
    };
    const grouped = new Map<string, ResultRow[]>();
    (results as ResultRow[]).forEach((r) => {
      const key = `${r.poll_id}::${r.question_order}`;
      const arr = grouped.get(key) || [];
      arr.push(r);
      grouped.set(key, arr);
    });

    const fallbackAwards: AwardRow[] = [];
    grouped.forEach((rowsForQuestion) => {
      const maxVotes = Math.max(...rowsForQuestion.map((r) => r.votes || 0));
      if (maxVotes <= 0) return;
      const winners = rowsForQuestion.filter((r) => (r.votes || 0) === maxVotes);
      const matchedWinner = winners.find((w) => {
        const opt = (w.option_text || '').toLowerCase().trim();
        if (!opt) return false;
        return opt.includes(normalizedFull) || normalizedFull.includes(opt) || opt.includes(normalizedFirst);
      });
      if (!matchedWinner) return;
      fallbackAwards.push({
        award_name: matchedWinner.question_text || 'Award',
        question_text: matchedWinner.question_text,
        poll_title: pollTitleById.get(matchedWinner.poll_id) || null,
        meeting_date: pollDateById.get(matchedWinner.poll_id) || null,
      });
    });
    awardsCache = { key: cacheKey, at: Date.now(), awards: fallbackAwards };
  } catch {
    // best-effort warmup only
  }
}

/** Space-separated trophy emojis (one per win). */
function trophyRun(count: number): string {
  if (count <= 0) return '';
  return Array.from({ length: count }, () => '🏆').join('  ');
}

/** Strip poll question wording; pick a category emoji. */
function normalizeAwardTitle(raw: string): { shortTitle: string; emoji: string } {
  let t = raw.trim().replace(/\*\*/g, '');
  // question_text often starts with decorative emojis (e.g. "🎭 🎭 Who was the…") so ^who… never matches
  t = t.replace(/\bwho\s+was\s+the\s+/gi, '').replace(/\bwho\s+is\s+the\s+/gi, '');
  t = t.replace(/\?+$/g, '').trim();
  // Drop leading decorative emoji (poll UI often prefixes "🎭 🎭 …")
  t = t
    .replace(
      /^(\p{Extended_Pictographic}\uFE0F?(?:\s+\p{Extended_Pictographic}\uFE0F?)*)+/u,
      ''
    )
    .trim();
  t = t.replace(/^the\s+/i, '').trim();
  if (!t) t = 'Award';

  const lower = t.toLowerCase();
  let emoji = '🏆';
  if (lower.includes('ancillary')) emoji = '🎭';
  else if (lower.includes('prepared')) emoji = '🗣️';
  else if (lower.includes('table topic')) emoji = '💡';
  else if (lower.includes('role player')) emoji = '🎤';
  else if (lower.includes('evaluator') || lower.includes('evaluation')) emoji = '🧠';
  else if (lower.includes('toastmaster')) emoji = '🎙️';
  else if (lower.includes('educational')) emoji = '🎓';
  else if (lower.includes('keynote')) emoji = '⭐';

  return { shortTitle: t, emoji };
}

function extractAwardLabel(row: AwardRow): string {
  const label =
    row.award_name?.trim() ||
    row.category?.trim() ||
    row.question_text?.trim() ||
    row.poll_title?.trim() ||
    'Award';
  return label;
}

function extractAwardDate(row: AwardRow): string | null {
  return row.meeting_date || row.won_at || row.created_at || null;
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function MyAwardsPanel() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [awards, setAwards] = useState<AwardRow[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setAwards([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!user.currentClubId) {
      setAwards([]);
      setLoading(false);
      setError(null);
      return;
    }
    const cacheKey = `${user.currentClubId}:${user.id}`;
    const isFresh = awardsCache && awardsCache.key === cacheKey && Date.now() - awardsCache.at < CACHE_TTL_MS;
    if (isFresh && awardsCache) {
      setAwards(awardsCache.awards);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_awards_snapshot', {
        p_club_id: user.currentClubId,
      });
      if (!rpcError && Array.isArray(rpcData)) {
        const rpcAwards = (rpcData as AwardRow[]).map((r) => ({
          award_name: r.award_name ?? null,
          question_text: r.question_text ?? null,
          poll_title: r.poll_title ?? null,
          meeting_date: r.meeting_date ?? null,
        }));
        awardsCache = { key: cacheKey, at: Date.now(), awards: rpcAwards };
        setAwards(rpcAwards);
        return;
      }

      // Do not call get_user_awards RPC here: it is not shipped in all Supabase projects and
      // triggers noisy 404s in the browser network tab. Awards are derived from poll results.
      const fullName = (user.fullName || '').trim();
      const firstName = fullName.split(/\s+/).filter(Boolean)[0] || fullName;
      const normalizedFull = fullName.toLowerCase();
      const normalizedFirst = firstName.toLowerCase();

      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('id, title, created_at')
        .eq('club_id', user.currentClubId)
        .order('created_at', { ascending: false })
        .limit(120);
      if (pollsError || !polls?.length) {
        awardsCache = { key: cacheKey, at: Date.now(), awards: [] };
        setAwards([]);
        return;
      }

      const pollIds = polls.map((p) => p.id);
      const pollDateById = new Map<string, string | null>(
        polls.map((p) => [p.id, p.created_at || null])
      );
      const pollTitleById = new Map<string, string | null>(
        polls.map((p) => [p.id, p.title || null])
      );

      const { data: results, error: resultsError } = await supabase
        .from('poll_results_repository')
        .select('poll_id, question_order, question_text, option_text, votes')
        .in('poll_id', pollIds);
      if (resultsError || !results?.length) {
        awardsCache = { key: cacheKey, at: Date.now(), awards: [] };
        setAwards([]);
        return;
      }

      type ResultRow = {
        poll_id: string;
        question_order: number;
        question_text: string | null;
        option_text: string | null;
        votes: number | null;
      };
      const grouped = new Map<string, ResultRow[]>();
      (results as ResultRow[]).forEach((r) => {
        const key = `${r.poll_id}::${r.question_order}`;
        const arr = grouped.get(key) || [];
        arr.push(r);
        grouped.set(key, arr);
      });

      const fallbackAwards: AwardRow[] = [];
      grouped.forEach((rowsForQuestion) => {
        const maxVotes = Math.max(...rowsForQuestion.map((r) => r.votes || 0));
        if (maxVotes <= 0) return;

        const winners = rowsForQuestion.filter((r) => (r.votes || 0) === maxVotes);
        const matchedWinner = winners.find((w) => {
          const opt = (w.option_text || '').toLowerCase().trim();
          if (!opt) return false;
          return (
            opt.includes(normalizedFull) ||
            normalizedFull.includes(opt) ||
            opt.includes(normalizedFirst)
          );
        });
        if (!matchedWinner) return;

        fallbackAwards.push({
          award_name: matchedWinner.question_text || 'Award',
          question_text: matchedWinner.question_text,
          poll_title: pollTitleById.get(matchedWinner.poll_id) || null,
          meeting_date: pollDateById.get(matchedWinner.poll_id) || null,
        });
      });

      awardsCache = { key: cacheKey, at: Date.now(), awards: fallbackAwards };
      setAwards(fallbackAwards);
    } catch (e) {
      console.error('MyAwardsPanel load failed:', e);
      setAwards([]);
      setError('Could not load awards.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.fullName, user?.currentClubId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const monthlyAwards = useMemo<MonthAwards[]>(() => {
    const grouped = new Map<string, { labels: string[] }>();
    for (const row of awards) {
      const date = extractAwardDate(row);
      if (!date) continue;
      const key = monthKey(date);
      const current = grouped.get(key) ?? { labels: [] };
      current.labels.push(extractAwardLabel(row));
      grouped.set(key, current);
    }

    return [...grouped.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, value]) => {
        const byCanonical = new Map<string, { count: number; sample: string }>();
        value.labels.forEach((l) => {
          const { shortTitle } = normalizeAwardTitle(l);
          const canon = shortTitle.toLowerCase();
          const prev = byCanonical.get(canon);
          if (prev) prev.count += 1;
          else byCanonical.set(canon, { count: 1, sample: l });
        });

        const categories: MonthCategoryRow[] = [...byCanonical.values()]
          .map(({ count, sample }) => {
            const { shortTitle, emoji } = normalizeAwardTitle(sample);
            return { shortTitle, emoji, count };
          })
          .sort((a, b) => b.count - a.count || a.shortTitle.localeCompare(b.shortTitle));

        return {
          key,
          label: monthLabel(key),
          totalWins: value.labels.length,
          categories,
        };
      });
  }, [awards]);

  const totalWins = awards.length;
  const distinctAwardNames = useMemo(() => {
    const s = new Set<string>();
    awards.forEach((a) => s.add(extractAwardLabel(a)));
    return s.size;
  }, [awards]);
  const bestMonth = monthlyAwards[0]
    ? [...monthlyAwards].sort((a, b) => b.totalWins - a.totalWins || a.key.localeCompare(b.key))[0]
    : null;

  const winningStreak = useMemo(() => {
    if (monthlyAwards.length === 0) return 0;
    const sorted = [...monthlyAwards].sort((a, b) => b.key.localeCompare(a.key));
    let streak = 0;
    for (const m of sorted) {
      if (m.totalWins > 0) streak += 1;
      else break;
    }
    return streak;
  }, [monthlyAwards]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Loading awards...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.helperText, { color: theme.colors.text }]}>{error}</Text>
      </View>
    );
  }

  if (monthlyAwards.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
          No voting awards yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroBgTopRight} />
        <View style={styles.heroBgBottomLeft} />
        <Text style={styles.heroConfetti}>✨  🎉  ✨</Text>

        <View style={styles.heroTopSection}>
          <View style={styles.avatarRing}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {(user?.fullName || 'M').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroTopTextWrap}>
            <Text style={styles.heroTitle}>Congratulations!</Text>
            <Text style={styles.heroName}>✦ {(user?.fullName || 'Member').toUpperCase()} ✦</Text>
          </View>
        </View>

        <View style={styles.heroBadgeWrap}>
          <Text style={styles.heroBadgeText}>🏆 {totalWins} Awards Won</Text>
        </View>
        <Text style={styles.heroQuote}>Consistency creates champions.</Text>

        <View style={styles.heroStatsRow}>
          <Text style={styles.heroStat}>🏆 {totalWins} Wins</Text>
          <Text style={styles.heroStat}>🎯 {distinctAwardNames} Roles</Text>
          <Text style={styles.heroStat}>🔥 Streak {winningStreak}</Text>
        </View>
      </View>

      {bestMonth ? (
        <View style={styles.bestMonthCard}>
          <Text style={styles.bestMonthTitle}>🚀 Your Best Month</Text>
          <Text style={styles.bestMonthLabel}>{bestMonth.label}</Text>
          <Text style={styles.bestMonthSub}>
            {bestMonth.totalWins} {bestMonth.totalWins === 1 ? 'win' : 'wins'}
          </Text>
        </View>
      ) : null}

      {monthlyAwards.map((m) => (
        <View
          key={m.key}
          style={[styles.monthCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.monthTrophyLine, { color: theme.colors.text }]} selectable>
            {m.label} - {m.totalWins}
          </Text>

          <View style={styles.awardsList}>
            {m.categories.map((c) => (
              <Text
                key={`${m.key}-${c.shortTitle}`}
                style={[styles.categoryTrophyLine, { color: theme.colors.text }]}
                selectable
              >
                {c.emoji} {c.shortTitle}  {trophyRun(c.count)}
              </Text>
            ))}
          </View>
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  helperText: {
    marginTop: 10,
    fontSize: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#B9D2FF',
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBgTopRight: {
    position: 'absolute',
    width: 180,
    height: 180,
    right: -40,
    top: -40,
    borderRadius: 999,
    backgroundColor: '#8B5CF6',
    opacity: 0.42,
  },
  heroBgBottomLeft: {
    position: 'absolute',
    width: 180,
    height: 180,
    left: -60,
    bottom: -70,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
    opacity: 0.34,
  },
  heroConfetti: {
    position: 'absolute',
    top: 8,
    right: 12,
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '800',
  },
  heroTopSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTopTextWrap: {
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  avatarRing: {
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 3,
    borderColor: '#FCD34D',
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  heroName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#F8FAFC',
    textAlign: 'center',
    marginTop: 4,
  },
  heroBadgeWrap: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#7C2D12',
  },
  heroQuote: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    color: '#DBEAFE',
    fontWeight: '600',
  },
  heroStatsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  heroStat: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  bestMonthCard: {
    borderWidth: 1,
    borderColor: '#D6CCFF',
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderRadius: 12,
  },
  bestMonthTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },
  bestMonthLabel: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    color: '#312E81',
  },
  bestMonthSub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#4C1D95',
  },
  monthCard: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
  },
  monthTrophyLine: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    flexWrap: 'wrap',
    lineHeight: 22,
  },
  awardsList: {
    gap: 8,
  },
  categoryTrophyLine: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    flexWrap: 'wrap',
  },
});
