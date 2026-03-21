import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Megaphone, GraduationCap, BookOpen, Grid, MessageSquare, Building2 } from 'lucide-react-native';

interface PlaceholderCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

const placeholders: PlaceholderCategory[] = [
  {
    id: 'toastmaster',
    title: 'Backdoor - Toastmaster Corner',
    description: 'Toastmaster of the day placeholder entries and notes',
    icon: Megaphone,
    color: '#3b82f6',
  },
  {
    id: 'keynote-speaker',
    title: 'Backdoor - Keynote Speaker',
    description: 'Keynote speaker placeholder entries and details',
    icon: GraduationCap,
    color: '#8b5cf6',
  },
  {
    id: 'educational-speaker',
    title: 'Backdoor - Educational Speaker',
    description: 'Educational speaker placeholder entries and topics',
    icon: BookOpen,
    color: '#10b981',
  },
  {
    id: 'grammarian',
    title: 'Backdoor - Grammarian',
    description: 'Grammarian placeholder entries and word tracking',
    icon: Grid,
    color: '#f59e0b',
  },
  {
    id: 'table-topic-master',
    title: 'Backdoor - Table Topic Master',
    description: 'Table topic master placeholder entries and questions',
    icon: MessageSquare,
    color: '#ec4899',
  },
];

export default function PlaceholderEntry() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const currentClub = user?.clubs?.find(club => club.id === user?.currentClubId);
  const clubName = currentClub?.name || 'Unknown Club';

  const handlePlaceholderPress = (placeholderId: string) => {
    switch (placeholderId) {
      case 'toastmaster':
        router.push('/admin/excomm-corner/vpe/toastmaster-placeholder');
        break;
      case 'keynote-speaker':
        router.push('/admin/excomm-corner/vpe/keynote-speaker-placeholder');
        break;
      case 'educational-speaker':
        router.push('/admin/excomm-corner/vpe/educational-speaker-placeholder');
        break;
      case 'grammarian':
        router.push('/admin/excomm-corner/vpe/grammarian-placeholder');
        break;
      case 'table-topic-master':
        console.log('Table Topic Master placeholder - Coming soon');
        break;
      default:
        console.log('Unknown placeholder:', placeholderId);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Backdoor Placeholder Entry
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Quick Access System
          </Text>
          <Text style={[styles.infoDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Access placeholder entries for key meeting roles. This backdoor allows VPE to manage system entries and placeholders efficiently.
          </Text>
        </View>

        {user?.currentClubId && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}>
            <View style={[styles.clubIconContainer, { backgroundColor: theme.colors.primary }]}>
              <Building2 size={24} color="#FFFFFF" />
            </View>
            <View style={styles.clubInfo}>
              <Text style={[styles.clubLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Current Club
              </Text>
              <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {clubName}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.placeholderContainer}>
          {placeholders.map((placeholder) => {
            const IconComponent = placeholder.icon;
            const isComingSoon = placeholder.id === 'table-topic-master';
            return (
              <TouchableOpacity
                key={placeholder.id}
                style={[
                  styles.placeholderCard,
                  { backgroundColor: theme.colors.surface },
                  isComingSoon && { opacity: 0.65 },
                ]}
                onPress={() => !isComingSoon && handlePlaceholderPress(placeholder.id)}
                activeOpacity={isComingSoon ? 1 : 0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: placeholder.color + '15' }]}>
                  <IconComponent size={32} color={placeholder.color} />
                </View>
                <View style={styles.placeholderContent}>
                  <View style={styles.placeholderTitleRow}>
                    <Text style={[styles.placeholderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {placeholder.title}
                    </Text>
                    {isComingSoon && (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>Coming Soon</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.placeholderDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {placeholder.description}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
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
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clubIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  placeholderContainer: {
    padding: 16,
    gap: 12,
  },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  placeholderContent: {
    flex: 1,
  },
  placeholderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  comingSoonBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  placeholderDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 40,
  },
});
