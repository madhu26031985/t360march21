import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Mail, Phone, CheckCircle2, UserX, Copy, UsersRound, Info, X, Home, Calendar, Users, Settings } from 'lucide-react-native';
import { useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import { fetchMyMentorSnapshot, getCachedMyMentorSnapshot, type MyMentorSnapshot } from '@/lib/myMentorSnapshot';

const FOOTER_NAV_ICON_SIZE = 15;

interface ContactPerson {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
}

interface VpeContactInfo {
  firstName: string;
  phoneNumber: string | null;
  clubName: string;
}

export default function MyGrowthGuidance() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<ContactPerson | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [vpeContact, setVpeContact] = useState<VpeContactInfo | null>(null);
  const latestLoadId = useRef(0);

  const applySnapshot = useCallback((snap: MyMentorSnapshot | null) => {
    if (!snap) {
      setMentor(null);
      setVpeContact({ firstName: 'VPE', phoneNumber: null, clubName: 'Your Club' });
      return;
    }
    setMentor((snap.mentor as ContactPerson | null) ?? null);
    const fullName = (snap.vpe?.full_name || 'VPE').trim();
    const firstName = fullName.split(/\s+/).filter(Boolean)[0] || 'VPE';
    const phoneNumber = (snap.vpe?.phone_number || '').trim() || null;
    const clubName = (snap.club_name || 'Your Club').trim() || 'Your Club';
    setVpeContact({ firstName, phoneNumber, clubName });
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.currentClubId || !user?.id) return;

    const loadId = ++latestLoadId.current;
    const clubId = user.currentClubId;
    const cached = getCachedMyMentorSnapshot(clubId);
    if (cached) {
      applySnapshot(cached);
      setLoading(false);
      const fresh = await fetchMyMentorSnapshot(clubId);
      if (loadId !== latestLoadId.current) return;
      if (fresh) applySnapshot(fresh);
      return;
    }

    try {
      setLoading(true);
      const fresh = await fetchMyMentorSnapshot(clubId);
      if (loadId !== latestLoadId.current) return;
      applySnapshot(fresh);
    } catch (err) {
      if (loadId !== latestLoadId.current) return;
      console.error('Error loading mentor data:', err);
      setMentor(null);
      setVpeContact({ firstName: 'VPE', phoneNumber: null, clubName: 'Your Club' });
    } finally {
      if (loadId === latestLoadId.current) {
        setLoading(false);
      }
    }
  }, [applySnapshot, user?.currentClubId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.currentClubId && user?.id) {
        void loadData();
      } else {
        setLoading(false);
      }
    }, [user?.currentClubId, user?.id, loadData])
  );

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

  const handleContactVpe = useCallback(async () => {
    const vpeFirstName = vpeContact?.firstName || 'VPE';
    const yourFirstName = (user?.fullName || '').trim().split(/\s+/).filter(Boolean)[0] || 'Member';
    const clubName = vpeContact?.clubName || 'Your Club';
    const phoneDigits = (vpeContact?.phoneNumber || '').replace(/[^0-9]/g, '') || '';

    router.push({
      pathname: '/contact-vpe',
      params: {
        vpeFirstName,
        vpePhone: phoneDigits,
        yourFirstName,
        clubName,
      },
    });
  }, [vpeContact, user?.fullName]);

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
        <TouchableOpacity
          style={[styles.infoButton, { backgroundColor: '#E8EEF5', borderColor: '#D4DEE9' }]}
          onPress={() => setShowInfoModal(true)}
          activeOpacity={0.8}
        >
          <Info size={18} color="#6E839F" />
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
              <TouchableOpacity
                style={[styles.emptyCtaButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleContactVpe}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyCtaButtonText} maxFontSizeMultiplier={1.3}>
                  Contact VPE
                </Text>
              </TouchableOpacity>
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
                <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                  <Home size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/club')}
              >
                <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                  <Users size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/meetings')}
              >
                <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                  <Calendar size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/settings')}
              >
                <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                  <Settings size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
              </TouchableOpacity>

              {user?.clubRole === 'excomm' && (
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => router.push('/(tabs)/admin')}
                >
                  <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                    <Settings size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
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
                Reach out to your VPE and get connected. Your journey deserves the right support and it starts here.
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
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#93A7BF',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
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
    marginTop: 20,
    borderRadius: 14,
    padding: 34,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyCtaButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyCtaButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
