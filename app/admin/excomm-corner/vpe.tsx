import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Users, FileCheck, ShieldCheck, User } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function VPECorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [vpeName, setVpeName] = useState<string>('');
  const [vpeAvatarUrl, setVpeAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVPEName();
  }, [user?.currentClubId]);

  const fetchVPEName = async () => {
    if (!user?.currentClubId) {
      setVpeName('');
      setVpeAvatarUrl(null);
      setLoading(false);
      return;
    }

    try {
      const { data: clubProfile, error: clubError } = await supabase
        .from('club_profiles')
        .select('vpe_id')
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (clubError) throw clubError;

      if (!clubProfile?.vpe_id) {
        setVpeName('');
        setVpeAvatarUrl(null);
      } else {
        const { data: vpeProfile, error: profileError } = await supabase
          .from('app_user_profiles')
          .select('full_name, avatar_url')
          .eq('id', clubProfile.vpe_id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (vpeProfile) {
          setVpeName(vpeProfile.full_name);
          setVpeAvatarUrl(vpeProfile.avatar_url || null);
        }
      }
    } catch (error) {
      console.error('Error fetching VPE name:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>VPE Corner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <View style={styles.heroRow}>
              <View style={[styles.heroAvatarWrap, { borderColor: theme.colors.border }]}>
                {vpeAvatarUrl ? (
                  <Image source={{ uri: vpeAvatarUrl }} style={styles.heroAvatar} />
                ) : (
                  <View style={[styles.heroAvatarPlaceholder, { backgroundColor: theme.colors.primary + '18' }]}>
                    <User size={22} color={theme.colors.primary} />
                  </View>
                )}
              </View>
              <View style={styles.heroTextCol}>
                {vpeName ? (
                  <Text style={[styles.vpeName, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.25} numberOfLines={1}>
                    {vpeName}
                  </Text>
                ) : (
                  <Text style={[styles.vpeNameMuted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    VPE not assigned
                  </Text>
                )}
                <Text style={[styles.heroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                  VPE Corner
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.actionsSection}>
          <Text style={[styles.actionsSectionTitle, { color: theme.colors.textSecondary }]}>Start Here</Text>
          <View style={styles.iconGrid}>
            <TouchableOpacity
              style={[
                styles.iconTile,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push('/admin/excomm-corner/vpe/mentor-assignment')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconTileCircle, { backgroundColor: '#059669' }]}>
                <Users size={18} color="#ffffff" />
              </View>
              <Text style={[styles.iconTileLabel, { color: theme.colors.text }]} numberOfLines={3}>
                Mentor Assignment
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.iconTile,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push('/admin/excomm-corner/vpe/speech-approval')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconTileCircle, { backgroundColor: '#2563eb' }]}>
                <FileCheck size={18} color="#ffffff" />
              </View>
              <Text style={[styles.iconTileLabel, { color: theme.colors.text }]} numberOfLines={3}>
                Speech Approval
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.iconTile,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push('/admin/excomm-corner/vpe/placeholder-entry')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconTileCircle, { backgroundColor: '#7c3aed' }]}>
                <ShieldCheck size={18} color="#ffffff" />
              </View>
              <Text style={[styles.iconTileLabel, { color: theme.colors.text }]} numberOfLines={4}>
                Backdoor Placeholder Entry
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 64,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    marginRight: 12,
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
  },
  heroAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  vpeName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  vpeNameMuted: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  actionsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  iconTile: {
    width: '31%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
  },
  iconTileCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconTileLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
  bottomSpacing: {
    height: 40,
  },
});
