import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Mail, Phone, CheckCircle2, UserX, Copy, UsersRound, Info, X, Home, Calendar, Users, Settings } from 'lucide-react-native';
import { useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';

interface ContactPerson {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
}

export default function MyGrowthGuidance() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<ContactPerson | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    if (user?.currentClubId && user?.id) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user?.currentClubId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.currentClubId && user?.id) {
        loadData();
      }
    }, [user?.currentClubId, user?.id])
  );

  const loadData = async () => {
    if (!user?.currentClubId || !user?.id) {
      return;
    }

    try {
      setLoading(true);

      // Fetch mentor assignment with profile data in a single query
      const { data, error } = await supabase
        .from('mentor_assignments')
        .select(`
          mentor_id,
          mentor:app_user_profiles!mentor_id (
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        `)
        .eq('club_id', user.currentClubId)
        .eq('mentee_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error loading mentor:', error);
        setMentor(null);
      } else if (data?.mentor) {
        setMentor(data.mentor as ContactPerson);
      } else {
        setMentor(null);
      }
    } catch (err) {
      console.error('Error loading mentor data:', err);
      setMentor(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', `${type} copied to clipboard`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const mentorBenefits = [
    'Speech preparation',
    'Evaluations & feedback',
    'Pathways guidance',
    'Confidence building',
    'Personal growth planning',
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>My Mentor</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => setShowInfoModal(true)}>
          <Info size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading your mentor...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

          {mentor ? (
            <>
              <View style={styles.introSection}>
                <Text style={[styles.introTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Meet your mentor 🤝 🚀
                </Text>
              </View>

              <View style={[styles.mentorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.mentorHeader}>
                  {mentor.avatar_url ? (
                    <Image
                      source={{ uri: mentor.avatar_url }}
                      style={styles.avatarLarge}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.avatarLarge}>
                      <Text style={styles.avatarLargeText} maxFontSizeMultiplier={1.3}>
                        {getInitials(mentor.full_name)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.mentorInfo}>
                    <Text style={[styles.mentorName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {mentor.full_name}
                    </Text>
                    <Text style={[styles.mentorRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Mentor | Toastmasters
                    </Text>

                    <View style={styles.contactDetailsSection}>
                      {mentor.phone_number && (
                        <TouchableOpacity
                          style={styles.contactDetail}
                          onPress={() => handleCopy(mentor.phone_number!, 'Phone number')}
                        >
                          <Phone size={18} color="#10b981" />
                          <Text style={[styles.contactDetailText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {mentor.phone_number}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.viewProfileButton}
                        onPress={() => router.push({
                          pathname: '/member-profile',
                          params: { memberId: mentor.id }
                        })}
                      >
                        <Text style={styles.viewProfileButtonText} maxFontSizeMultiplier={1.3}>
                          View Profile
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.benefitsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.benefitsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  What Your Mentor Helps With
                </Text>
                {mentorBenefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <CheckCircle2 size={16} color="#3b82f6" />
                    <Text style={[styles.benefitText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {benefit}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <UsersRound size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Your Toastmasters buddy awaits! 👋
              </Text>
              <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                A mentor helps you learn faster, speak better, and feel at home. Ping your VPE to get your mentor today! 🤝🌱
              </Text>
            </View>
          )}

          <View style={styles.navSpacer} />

          {/* Navigation Icons */}
          <View style={[styles.navigationSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.navigationBar}>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)')}
              >
                <View style={[styles.navIcon, { backgroundColor: '#E8F4FD' }]}>
                  <Home size={16} color="#3b82f6" />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/club')}
              >
                <View style={[styles.navIcon, { backgroundColor: '#FEF3E7' }]}>
                  <Users size={16} color="#f59e0b" />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/meetings')}
              >
                <View style={[styles.navIcon, { backgroundColor: '#E0F2FE' }]}>
                  <Calendar size={16} color="#0ea5e9" />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/settings')}
              >
                <View style={[styles.navIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Settings size={16} color="#8b5cf6" />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
              </TouchableOpacity>

              {user?.clubRole === 'excomm' && (
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => router.push('/(tabs)/admin')}
                >
                  <View style={[styles.navIcon, { backgroundColor: '#FFE5E5' }]}>
                    <Settings size={16} color="#dc2626" />
                  </View>
                  <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.infoModalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                About Mentorship
              </Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.infoModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                🌟 Every great Toastmaster grows faster with the right guide. A mentor is that guiding light — helping you prepare, improve, and gain confidence.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                🙋‍♂️ No mentor yet?
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Reach out to your VPE and get connected.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                🛠️ For VPEs:
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign mentors in just a few steps:{'\n'}
                ➡️ Admin Panel{'\n'}
                ➡️ ExComm Corner{'\n'}
                ➡️ VPE Corner{'\n'}
                ➡️ Mentor Assignment
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, marginBottom: 0 }]} maxFontSizeMultiplier={1.3}>
                💡 Your journey deserves the right support — and it starts here.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
  },
  introSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  mentorCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  mentorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarLargeText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#fff',
  },
  mentorInfo: {
    flex: 1,
  },
  mentorName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  mentorRole: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  contactDetailsSection: {
    gap: 12,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactDetailText: {
    fontSize: 15,
    fontWeight: '500',
  },
  viewProfileButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  viewProfileButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  benefitsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  navigationSection: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoModalContent: {
    padding: 20,
    maxHeight: 500,
  },
  infoModalText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoModalButton: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
