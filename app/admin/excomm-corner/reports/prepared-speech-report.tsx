import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Calendar, User, BookOpen, Users, ChevronDown, Check, Building2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface SpeechData {
  speaker_name: string;
  role_name: string;
  speech_title: string | null;
  pathway_name: string | null;
  pathway_level: number | null;
  project_number: string | null;
  project_name: string | null;
  evaluator_name: string | null;
}

interface MeetingData {
  id: string;
  meeting_number: string;
  meeting_date: string;
  speeches: SpeechData[];
}

interface ClubMember {
  id: string;
  full_name: string;
}

type TimeRange = '0-3' | '4-6';

export default function PreparedSpeechReportScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<TimeRange>('0-3');
  const [clubName, setClubName] = useState<string>('');
  const [clubNumber, setClubNumber] = useState<string | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [bannerColor, setBannerColor] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentClubId) {
      loadClubData();
      loadClubMembers();
    }
  }, [user?.currentClubId]);

  useEffect(() => {
    if (user?.currentClubId) {
      loadMeetings();
    }
  }, [user?.currentClubId, selectedRange, selectedMembers]);

  const loadClubData = async () => {
    if (!user?.currentClubId) return;

    try {
      const [clubRes, profileRes] = await Promise.all([
        supabase.from('clubs').select('name, club_number').eq('id', user.currentClubId).maybeSingle(),
        supabase.from('club_profiles').select('banner_color').eq('club_id', user.currentClubId).maybeSingle(),
      ]);
      if (clubRes.data) { setClubName(clubRes.data.name); setClubNumber(clubRes.data.club_number); }
      setBannerColor(profileRes.data?.banner_color || '#1e3a5f');
    } catch {}
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          user_id,
          app_user_profiles (
            id,
            full_name
          )
        `)
        .eq('club_id', user.currentClubId)
        .order('app_user_profiles(full_name)');

      if (error) throw error;

      const members: ClubMember[] = (data || [])
        .filter((rel: any) => rel.app_user_profiles)
        .map((rel: any) => ({
          id: rel.app_user_profiles.id,
          full_name: rel.app_user_profiles.full_name,
        }));

      setClubMembers(members);
      setSelectedMembers(members.map(m => m.id));
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const loadMeetings = async () => {
    if (!user?.currentClubId) return;

    try {
      setLoading(true);

      const today = new Date();
      const startDate = new Date();
      const endDate = new Date();

      if (selectedRange === '0-3') {
        startDate.setMonth(today.getMonth() - 3);
      } else {
        startDate.setMonth(today.getMonth() - 6);
        endDate.setMonth(today.getMonth() - 3);
        endDate.setDate(endDate.getDate() - 1);
      }

      const { data, error } = await supabase
        .from('app_club_meeting')
        .select(`
          id,
          meeting_number,
          meeting_date,
          app_meeting_roles_management (
            role_name,
            role_classification,
            assigned_user_id,
            app_user_profiles (
              full_name
            )
          ),
          app_evaluation_pathway (
            user_id,
            role_name,
            speech_title,
            pathway_name,
            level,
            project_number,
            project_name,
            assigned_evaluator_id
          )
        `)
        .eq('club_id', user.currentClubId)
        .gte('meeting_date', toLocalDateStr(startDate))
        .lte('meeting_date', toLocalDateStr(endDate))
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading meetings:', error);
        Alert.alert('Error', 'Failed to load meeting data');
        return;
      }

      const formattedMeetings: MeetingData[] = (data || [])
        .map((meeting: any) => {
          const speeches: SpeechData[] = [];

          if (Array.isArray(meeting.app_meeting_roles_management)) {
            const preparedSpeakers = meeting.app_meeting_roles_management.filter(
              (role: any) =>
                role.role_classification === 'Prepared Speaker' ||
                role.role_classification === 'Ice Breaker'
            );

            const evaluators = meeting.app_meeting_roles_management.filter(
              (role: any) => role.role_classification === 'Speech evaluvator'
            );

            preparedSpeakers.forEach((speaker: any) => {
              if (speaker.assigned_user_id && selectedMembers.includes(speaker.assigned_user_id)) {
                const pathwayInfo = Array.isArray(meeting.app_evaluation_pathway)
                  ? meeting.app_evaluation_pathway.find(
                      (p: any) =>
                        p.user_id === speaker.assigned_user_id &&
                        p.role_name === speaker.role_name
                    )
                  : null;

                console.log('Speaker:', speaker.role_name, speaker.app_user_profiles?.full_name);
                console.log('Pathway Info:', pathwayInfo);

                let evaluatorName = null;
                if (pathwayInfo?.assigned_evaluator_id) {
                  const evaluatorRole = meeting.app_meeting_roles_management.find(
                    (r: any) => r.assigned_user_id === pathwayInfo.assigned_evaluator_id
                  );
                  evaluatorName = evaluatorRole?.app_user_profiles?.full_name || null;
                }

                speeches.push({
                  speaker_name: speaker.app_user_profiles?.full_name || 'Unknown',
                  role_name: speaker.role_name,
                  speech_title: pathwayInfo?.speech_title || null,
                  pathway_name: pathwayInfo?.pathway_name || null,
                  pathway_level: pathwayInfo?.level || null,
                  project_number: pathwayInfo?.project_number || null,
                  project_name: pathwayInfo?.project_name || null,
                  evaluator_name: evaluatorName,
                });
              }
            });
          }

          return {
            id: meeting.id,
            meeting_number: meeting.meeting_number,
            meeting_date: meeting.meeting_date,
            speeches,
          };
        })
        .filter((meeting) => meeting.speeches.length > 0);

      setMeetings(formattedMeetings);
    } catch (error) {
      console.error('Error loading meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAllMembers = () => {
    setSelectedMembers(clubMembers.map(m => m.id));
  };

  const deselectAllMembers = () => {
    setSelectedMembers([]);
  };

  const getMemberFilterText = () => {
    if (selectedMembers.length === 0) return 'No members selected';
    if (selectedMembers.length === clubMembers.length) return 'All Members';
    return `${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''} selected`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Prepared Speech Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.clubBanner, { backgroundColor: bannerColor ?? 'transparent' }]}>
          <Text style={styles.clubBannerName}>{clubName}</Text>
          {clubNumber ? (
            <Text style={styles.clubBannerNumber}>Club #{clubNumber}</Text>
          ) : null}
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, selectedRange === '0-3' && styles.filterButtonActive]}
            onPress={() => setSelectedRange('0-3')}
          >
            <Text
              style={[styles.filterButtonText, selectedRange === '0-3' && styles.filterButtonTextActive]}
            >
              0-3 Months
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedRange === '4-6' && styles.filterButtonActive]}
            onPress={() => setSelectedRange('4-6')}
          >
            <Text
              style={[styles.filterButtonText, selectedRange === '4-6' && styles.filterButtonTextActive]}
            >
              4-6 Months
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersSection}>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowMemberDropdown(true)}
          >
            <Users size={18} color="#6b7280" />
            <Text style={styles.dropdownText}>{getMemberFilterText()}</Text>
            <ChevronDown size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

      <Modal
        visible={showMemberDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMemberDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberDropdown(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Member</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={selectAllMembers} style={styles.modalActionButton}>
                  <Text style={styles.modalActionText}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={deselectAllMembers} style={styles.modalActionButton}>
                  <Text style={styles.modalActionText}>None</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.modalList}>
              {clubMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.modalItem}
                  onPress={() => toggleMemberSelection(member.id)}
                >
                  <Text style={styles.modalItemText}>{member.full_name}</Text>
                  {selectedMembers.includes(member.id) && (
                    <Check size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : meetings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Building2 size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No prepared speeches found</Text>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>{meetings.length} meetings found</Text>
            {meetings.map((meeting) => (
              <View key={meeting.id} style={styles.meetingCard}>
                <View style={styles.meetingHeader}>
                  <TouchableOpacity
                    style={styles.meetingNumberBadge}
                    onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting.id } })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.meetingNumberText}>#{meeting.meeting_number}</Text>
                  </TouchableOpacity>
                  <View style={styles.meetingDate}>
                    <Calendar size={16} color="#6b7280" />
                    <Text style={styles.meetingDateText}>{formatDate(meeting.meeting_date)}</Text>
                  </View>
                </View>

                {meeting.speeches.map((speech, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.speechCard}
                    onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting.id } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.speechRow}>
                      <User size={16} color="#2563eb" />
                      <View style={styles.speechInfo}>
                        <Text style={styles.speechLabel}>{speech.role_name}</Text>
                        <Text style={styles.speechValue}>{speech.speaker_name}</Text>
                      </View>
                    </View>

                    {speech.speech_title && (
                      <View style={styles.detailRow}>
                        <BookOpen size={16} color="#8b5cf6" />
                        <View style={styles.speechInfo}>
                          <Text style={styles.speechLabel}>Speech Title</Text>
                          <Text style={styles.speechValue}>{speech.speech_title}</Text>
                        </View>
                      </View>
                    )}

                    {speech.pathway_name && (
                      <View style={styles.detailRow}>
                        <BookOpen size={16} color="#f59e0b" />
                        <View style={styles.speechInfo}>
                          <Text style={styles.speechLabel}>Pathway</Text>
                          <Text style={styles.speechValue}>{speech.pathway_name}</Text>
                        </View>
                      </View>
                    )}

                    {speech.pathway_level && (
                      <View style={styles.detailRow}>
                        <BookOpen size={16} color="#06b6d4" />
                        <View style={styles.speechInfo}>
                          <Text style={styles.speechLabel}>Level</Text>
                          <Text style={styles.speechValue}>L{speech.pathway_level}</Text>
                        </View>
                      </View>
                    )}

                    {speech.project_number && (
                      <View style={styles.detailRow}>
                        <BookOpen size={16} color="#ec4899" />
                        <View style={styles.speechInfo}>
                          <Text style={styles.speechLabel}>Project Number</Text>
                          <Text style={styles.speechValue}>{speech.project_number}</Text>
                        </View>
                      </View>
                    )}

                    {speech.project_name && (
                      <View style={styles.detailRow}>
                        <BookOpen size={16} color="#14b8a6" />
                        <View style={styles.speechInfo}>
                          <Text style={styles.speechLabel}>Project Name</Text>
                          <Text style={styles.speechValue}>{speech.project_name}</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.speechRow}>
                      <Users size={16} color="#10b981" />
                      <View style={styles.speechInfo}>
                        <Text style={styles.speechLabel}>Evaluator</Text>
                        <Text
                          style={[
                            styles.speechValue,
                            !speech.evaluator_name && styles.notAssignedText,
                          ]}
                        >
                          {speech.evaluator_name || 'Not assigned'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}
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
  clubBanner: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  clubBannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  clubBannerNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filtersSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  modalActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  countText: {
    fontSize: 14,
    color: '#6b7280',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  meetingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  meetingNumberBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  meetingNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  meetingDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meetingDateText: {
    fontSize: 14,
    color: '#6b7280',
  },
  speechCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  speechRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  speechInfo: {
    flex: 1,
  },
  speechLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  speechValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  notAssignedText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
