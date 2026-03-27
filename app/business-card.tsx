import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function BusinessCardScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [about, setAbout] = useState<string>('');
  const [clubName, setClubName] = useState<string>('');

  const firstName = (user?.fullName || 'Member').trim().split(/\s+/).filter(Boolean)[0] || 'Member';
  const fullName = user?.fullName || 'T-360 Member';
  const roleLabel = useMemo(() => {
    const raw = (user?.currentClubRole || user?.clubRole || user?.role || '').toString().trim();
    if (!raw) return 'Member';
    const normalized = raw.toLowerCase();
    if (normalized === 'excomm') return 'ExComm';
    if (normalized === 'vpe') return 'VPE';
    if (normalized === 'vpm') return 'VPM';
    if (normalized === 'vppr') return 'VPPR';
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }, [user?.currentClubRole, user?.clubRole, user?.role]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const loadCardData = async () => {
      try {
        const [profileRes, clubRes] = await Promise.all([
          supabase
            .from('app_user_profiles')
            .select('avatar_url, About')
            .eq('id', user.id)
            .maybeSingle(),
          user.currentClubId
            ? supabase
                .from('clubs')
                .select('name')
                .eq('id', user.currentClubId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null } as any),
        ]);

        if (cancelled) return;

        const profile = profileRes.data as {
          avatar_url?: string | null;
          About?: string | null;
        } | null;
        const club = clubRes.data as { name?: string | null } | null;

        setAvatarUrl((profile?.avatar_url || '').trim() || null);
        setAbout((profile?.About || '').trim());
        setClubName((club?.name || '').trim());
      } catch (error) {
        console.error('Error loading business card data:', error);
      }
    };

    loadCardData();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.currentClubId]);

  const cardWidth = Math.min(width - 32, 420);
  const cardStyle = useMemo(
    () => ({
      width: cardWidth,
      aspectRatio: 3.5 / 2, // standard business card ratio
    }),
    [cardWidth]
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Business Card
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, cardStyle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardTopRow}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <User size={28} color="#ffffff" />
                </View>
              )}
            </View>
            <View style={styles.nameCol}>
              <Text style={[styles.nameText, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {fullName}
              </Text>
              <Text style={[styles.clubText, { color: theme.colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {roleLabel}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.aboutLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            About
          </Text>
          <Text style={[styles.aboutText, { color: theme.colors.text }]} numberOfLines={4} maxFontSizeMultiplier={1.2}>
            {about || `${firstName} has not updated the profile intro yet.`}
          </Text>

          <View style={[styles.divider, styles.bottomDivider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.bottomClubName, { color: theme.colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {clubName || 'Toastmasters Club'}
          </Text>
        </View>
          </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCol: {
    flex: 1,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
  },
  clubText: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginTop: 14,
    marginBottom: 10,
  },
  bottomDivider: {
    marginTop: 10,
    marginBottom: 6,
  },
  aboutLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  bottomClubName: {
    fontSize: 12,
    fontWeight: '700',
  },
});
