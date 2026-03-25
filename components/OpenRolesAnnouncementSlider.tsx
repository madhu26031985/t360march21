import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Megaphone, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type OpenRoleRow = { role_name: string | null; role_classification: string | null };

const SLIDER_HORIZONTAL_INSET = 72; // matches Club Meetings master box: 16*2 margin + 20*2 padding

/** Pale blue tile + dark blue icon (matches design mockup) */
const MEGAPHONE_TILE_BG = '#E8F4FC';
const MEGAPHONE_ICON_COLOR = '#1565C0';
const AVAILABLE_DOT = '#22c55e';

const ANNOUNCEMENT_SLOTS: {
  id: string;
  title: string;
  subtitle: string;
  match: (rows: OpenRoleRow[]) => boolean;
}[] = [
  {
    id: 'toastmaster',
    title: 'Toastmaster of the Day',
    subtitle: 'Lead the meeting',
    match: (rows) =>
      rows.some((r) => {
        const n = (r.role_name || '').toLowerCase();
        return n.includes('toastmaster') && !n.includes('table');
      }),
  },
  {
    id: 'general_evaluator',
    title: 'General Evaluator',
    subtitle: 'Evaluate the meeting',
    match: (rows) =>
      rows.some((r) => {
        const n = (r.role_name || '').toLowerCase();
        return n.includes('general') && n.includes('evaluat');
      }),
  },
  {
    id: 'table_topics_master',
    title: 'Table Topics Master',
    subtitle: 'Lead Table Topics',
    match: (rows) =>
      rows.some((r) => {
        const n = (r.role_name || '').toLowerCase();
        return (
          n.includes('table topics master') ||
          n.includes('table topic master') ||
          (n.includes('topics master') && n.includes('table'))
        );
      }),
  },
  {
    id: 'prepared_speeches',
    title: 'Prepared speeches',
    subtitle: 'Deliver a speech',
    match: (rows) =>
      rows.some((r) => {
        const n = (r.role_name || '').toLowerCase();
        const c = r.role_classification || '';
        return (
          c === 'Prepared Speaker' ||
          c === 'Ice Breaker' ||
          n.includes('prepared speaker') ||
          n.includes('ice breaker')
        );
      }),
  },
  {
    id: 'evaluators',
    title: 'Evaluator roles',
    subtitle: 'Support fellow speakers',
    match: (rows) =>
      rows.some((r) => {
        const n = (r.role_name || '').toLowerCase();
        const c = r.role_classification || '';
        if (c === 'Speech evaluvator' || c === 'speech_evaluator') return true;
        return /^evaluator\s*\d/i.test((r.role_name || '').trim());
      }),
  },
  {
    id: 'table_topic_speaker',
    title: 'Table Topics speaker',
    subtitle: 'Take the stage',
    match: (rows) =>
      rows.some((r) => {
        const n = (r.role_name || '').toLowerCase();
        const c = r.role_classification || '';
        if (c === 'On-the-Spot Speaking' && !n.includes('master')) return true;
        return n.includes('table topics participant') || n.includes('table topic participant');
      }),
  },
];

type Props = {
  meetingId: string | null | undefined;
  /** Hide when meeting is a placeholder card */
  disabled?: boolean;
};

export default function OpenRolesAnnouncementSlider({ meetingId, disabled }: Props) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const sliderWidth = Math.max(280, windowWidth - SLIDER_HORIZONTAL_INSET);
  const scrollRef = useRef<ScrollView>(null);
  const [slides, setSlides] = useState<typeof ANNOUNCEMENT_SLOTS>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  const cardBorderColor = theme.mode === 'dark' ? theme.colors.border : '#E8EAED';

  const load = useCallback(async () => {
    if (!meetingId || disabled) {
      setSlides([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select('role_name, role_classification')
        .eq('meeting_id', meetingId)
        .eq('role_status', 'Available')
        .is('assigned_user_id', null);

      if (error) {
        console.error('OpenRolesAnnouncementSlider:', error);
        setSlides([]);
        return;
      }
      const rows = (data || []) as OpenRoleRow[];
      const next = ANNOUNCEMENT_SLOTS.filter((slot) => slot.match(rows));
      setSlides(next);
      setActiveIndex(0);
      activeIndexRef.current = 0;
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    } finally {
      setLoading(false);
    }
  }, [meetingId, disabled]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const slideCount = slides.length;

  useEffect(() => {
    if (slideCount <= 1) return;
    const id = setInterval(() => {
      const next = (activeIndexRef.current + 1) % slideCount;
      activeIndexRef.current = next;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ x: next * sliderWidth, animated: true });
    }, 6000);
    return () => clearInterval(id);
  }, [slideCount, sliderWidth]);

  const onBookPress = useCallback(() => {
    if (!meetingId) return;
    router.push({ pathname: '/book-a-role', params: { meetingId } });
  }, [meetingId]);

  const dots = useMemo(
    () =>
      slides.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === activeIndex ? theme.colors.primary : theme.colors.border,
              width: i === activeIndex ? 18 : 6,
            },
          ]}
        />
      )),
    [slides, activeIndex, theme.colors.primary, theme.colors.border]
  );

  if (!meetingId || disabled) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (slides.length === 0) {
    return null;
  }

  const iconTileBg = theme.mode === 'dark' ? theme.colors.primary + '22' : MEGAPHONE_TILE_BG;

  return (
    <View style={styles.outer}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
        Roles you can book
      </Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={sliderWidth}
        snapToAlignment="center"
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const i = Math.round(x / sliderWidth);
          const clamped = Math.max(0, Math.min(i, slides.length - 1));
          activeIndexRef.current = clamped;
          setActiveIndex(clamped);
        }}
      >
        {slides.map((slot) => (
          <TouchableOpacity
            key={slot.id}
            style={[styles.slide, { width: sliderWidth }]}
            onPress={onBookPress}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`${slot.title}. ${slot.subtitle}. Available now. Tap to book a role.`}
          >
            <View
              style={[
                styles.card,
                {
                  borderColor: cardBorderColor,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <View style={[styles.iconTile, { backgroundColor: iconTileBg }]}>
                <Megaphone size={22} color={MEGAPHONE_ICON_COLOR} strokeWidth={2} />
              </View>

              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {slot.title}
                </Text>
                <Text
                  style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.15}
                >
                  {slot.subtitle}
                </Text>
                <View style={styles.availableRow}>
                  <Text
                    style={[styles.availableLabel, { color: theme.colors.textSecondary }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    Available now
                  </Text>
                  <View style={[styles.availableDot, { backgroundColor: AVAILABLE_DOT }]} />
                </View>
              </View>

              <ChevronRight size={22} color={theme.colors.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {slides.length > 1 ? <View style={styles.dotsRow}>{dots}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  scrollContent: {
    alignItems: 'stretch',
  },
  slide: {
    paddingRight: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 96,
    gap: 14,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 20,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  availableLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  availableDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
