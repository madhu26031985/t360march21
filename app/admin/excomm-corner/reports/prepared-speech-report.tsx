import { useState, useEffect } from 'react';
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
import { ArrowLeft, Calendar, Users, ChevronDown, Check, Building2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type TimeRange = '0-3' | '4-6';

type ReportRow = {
  meetingId: string;
  meeting_number: number;
  meeting_date: string;
  speaker_name: string;
  speech_title: string | null;
  pathway_name: string | null;
  pathway_level: number | null;
  project_number: string | null;
  project_name: string | null;
  evaluator_name: string | null;
};

type ClubMember = {
  id: string;
  full_name: string;
};

const cell = (value: string | null | undefined, fallback = '—') => {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
};

const getRoleSequenceNumber = (roleName: string) => {
  const match = (roleName || '').match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 999;
};

const isEvaluatorRole = (role: { role_name?: string; role_classification?: string }) => {
  const roleName = (role.role_name || '').trim();
  const classification = (role.role_classification || '').toLowerCase();
  const isPairedByName = /^evaluator\s*\d+$/i.test(roleName);
  const isSpeechEvaluatorClass =
    classification === 'speech evaluvator' ||
    classification === 'speech_evaluator' ||
    classification === 'speech evaluator';
  return isPairedByName || (isSpeechEvaluatorClass && /^evaluator/i.test(roleName));
};

const resolveEvaluatorName = (
  roles: any[],
  speakerRole: any,
  pathwayInfo: { assigned_evaluator_id?: string | null; evaluator?: { full_name?: string } | null } | null
): string | null => {
  if (pathwayInfo?.evaluator?.full_name?.trim()) {
    return pathwayInfo.evaluator.full_name.trim();
  }

  if (pathwayInfo?.assigned_evaluator_id) {
    const fromRole = roles.find((r) => r.assigned_user_id === pathwayInfo.assigned_evaluator_id);
    if (fromRole?.app_user_profiles?.full_name?.trim()) {
      return fromRole.app_user_profiles.full_name.trim();
    }
  }

  const slot = getRoleSequenceNumber(speakerRole.role_name || '');
  const pairedEvaluator = roles.find(
    (r) =>
      isEvaluatorRole(r) &&
      r.assigned_user_id &&
      getRoleSequenceNumber(r.role_name || '') === slot
  );
  if (pairedEvaluator?.app_user_profiles?.full_name?.trim()) {
    return pairedEvaluator.app_user_profiles.full_name.trim();
  }

  return null;
};

export default function PreparedSpeechReportScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [rows, setRows] = useState<ReportRow[]>([]);
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
      if (clubRes.data) {
        setClubName(clubRes.data.name);
        setClubNumber(clubRes.data.club_number);
      }
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
      setSelectedMembers(members.map((m) => m.id));
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
            assigned_evaluator_id,
            evaluator:app_user_profiles!fk_app_evaluation_pathway_assigned_evaluator_id (
              full_name
            )
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

      const reportRows: ReportRow[] = [];

      (data || []).forEach((meeting: any) => {
        if (!Array.isArray(meeting.app_meeting_roles_management)) return;

        const preparedSpeakers = meeting.app_meeting_roles_management.filter(
          (role: any) =>
            (role.role_classification === 'Prepared Speaker' || role.role_classification === 'Ice Breaker') &&
            role.assigned_user_id &&
            selectedMembers.includes(role.assigned_user_id)
        );

        const roles = meeting.app_meeting_roles_management;

        preparedSpeakers.forEach((speaker: any) => {
          const pathwayInfo = Array.isArray(meeting.app_evaluation_pathway)
            ? meeting.app_evaluation_pathway.find(
                (p: any) => p.user_id === speaker.assigned_user_id && p.role_name === speaker.role_name
              )
            : null;

          const evaluatorName = resolveEvaluatorName(roles, speaker, pathwayInfo);

          reportRows.push({
            meetingId: meeting.id,
            meeting_number: meeting.meeting_number,
            meeting_date: meeting.meeting_date,
            speaker_name: speaker.app_user_profiles?.full_name || 'Unknown',
            speech_title: pathwayInfo?.speech_title || null,
            pathway_name: pathwayInfo?.pathway_name || null,
            pathway_level: pathwayInfo?.level ?? null,
            project_number: pathwayInfo?.project_number || null,
            project_name: pathwayInfo?.project_name || null,
            evaluator_name: evaluatorName,
          });
        });
      });

      setRows(reportRows);
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
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllMembers = () => {
    setSelectedMembers(clubMembers.map((m) => m.id));
  };

  const deselectAllMembers = () => {
    setSelectedMembers([]);
  };

  const getMemberFilterText = () => {
    if (selectedMembers.length === 0) return 'No members selected';
    if (selectedMembers.length === clubMembers.length) return 'All Members';
    return `${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''} selected`;
  };

  const columns: { key: string; label: string; width: number; render: (row: ReportRow) => string }[] = [
    { key: 'meeting', label: 'Meeting No', width: 88, render: (r) => `#${r.meeting_number}` },
    { key: 'date', label: 'Date', width: 108, render: (r) => formatDate(r.meeting_date) },
    { key: 'speaker', label: 'Prepared Speaker', width: 140, render: (r) => r.speaker_name },
    { key: 'title', label: 'Speech Title', width: 160, render: (r) => cell(r.speech_title) },
    { key: 'pathway', label: 'Pathway', width: 140, render: (r) => cell(r.pathway_name) },
    {
      key: 'level',
      label: 'Level',
      width: 56,
      render: (r) => (r.pathway_level != null ? `L${r.pathway_level}` : '—'),
    },
    { key: 'projectNo', label: 'Project No', width: 72, render: (r) => cell(r.project_number) },
    { key: 'projectName', label: 'Project Name', width: 160, render: (r) => cell(r.project_name) },
    {
      key: 'evaluator',
      label: 'Evaluator',
      width: 120,
      render: (r) => (r.evaluator_name?.trim() ? r.evaluator_name : 'Not assigned'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Prepared Speech Report
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.clubBanner, { backgroundColor: bannerColor ?? 'transparent' }]}>
          <Text style={styles.clubBannerName} maxFontSizeMultiplier={1.3}>{clubName}</Text>
          {clubNumber ? (
            <Text style={styles.clubBannerNumber} maxFontSizeMultiplier={1.3}>Club #{clubNumber}</Text>
          ) : null}
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: selectedRange === '0-3' ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setSelectedRange('0-3')}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: selectedRange === '0-3' ? '#ffffff' : theme.colors.text },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              0-3 Months
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: selectedRange === '4-6' ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setSelectedRange('4-6')}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: selectedRange === '4-6' ? '#ffffff' : theme.colors.text },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              4-6 Months
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersSection}>
          <TouchableOpacity
            style={[styles.dropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => setShowMemberDropdown(true)}
          >
            <Users size={18} color={theme.colors.textSecondary} />
            <Text style={[styles.dropdownText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {getMemberFilterText()}
            </Text>
            <ChevronDown size={18} color={theme.colors.textSecondary} />
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
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Filter by Member
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={selectAllMembers} style={styles.modalActionButton}>
                    <Text style={[styles.modalActionText, { color: theme.colors.primary }]}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={deselectAllMembers} style={styles.modalActionButton}>
                    <Text style={[styles.modalActionText, { color: theme.colors.primary }]}>None</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView style={styles.modalList}>
                {clubMembers.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.modalItem, { borderBottomColor: theme.colors.border }]}
                    onPress={() => toggleMemberSelection(member.id)}
                  >
                    <Text style={[styles.modalItemText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                    {selectedMembers.includes(member.id) && (
                      <Check size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading...
            </Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Building2 size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              No prepared speeches found
            </Text>
          </View>
        ) : (
          <View style={styles.tableSection}>
            <Text style={[styles.countText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {rows.length} speech{rows.length !== 1 ? 'es' : ''} found
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={[styles.table, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.tableHeader, { borderBottomColor: theme.colors.border }]}>
                  {columns.map((col) => (
                    <Text
                      key={col.key}
                      style={[
                        styles.tableHeaderCell,
                        { width: col.width, color: theme.colors.text },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {col.label}
                    </Text>
                  ))}
                </View>
                {rows.map((row, index) => {
                  const isLast = index === rows.length - 1;
                  return (
                    <TouchableOpacity
                      key={`${row.meetingId}-${row.speaker_name}-${index}`}
                      style={[
                        styles.tableRow,
                        !isLast && {
                          borderBottomColor: theme.colors.border,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                      onPress={() =>
                        router.push({ pathname: '/evaluation-corner', params: { meetingId: row.meetingId } })
                      }
                      activeOpacity={0.6}
                    >
                      {columns.map((col) => (
                        <Text
                          key={col.key}
                          style={[
                            styles.tableCell,
                            { width: col.width, color: theme.colors.text },
                            col.key === 'evaluator' && !row.evaluator_name && styles.notAssignedCell,
                          ]}
                          numberOfLines={col.key === 'title' || col.key === 'projectName' || col.key === 'speaker' ? 2 : 1}
                          maxFontSizeMultiplier={1.2}
                        >
                          {col.render(row)}
                        </Text>
                      ))}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: { width: 40 },
  content: { flex: 1 },
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
    paddingVertical: 16,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterButtonText: { fontSize: 14, fontWeight: '600' },
  filtersSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalItemText: {
    fontSize: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: { fontSize: 15 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: 16 },
  tableSection: {
    paddingHorizontal: 16,
  },
  countText: {
    fontSize: 13,
    marginBottom: 12,
  },
  table: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    paddingRight: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  tableCell: {
    fontSize: 13,
    fontWeight: '400',
    paddingRight: 8,
  },
  notAssignedCell: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  bottomSpacing: { height: 40 },
});
