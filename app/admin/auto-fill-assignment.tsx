import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Zap, Check, User, AlertCircle } from 'lucide-react-native';

interface RoleInfo {
  id: string | null;
  name: string | null;
}

interface AgendaSection {
  id: string;
  section_name: string;
  section_icon: string | null;
  section_order: number;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  is_visible: boolean;
  infoName: string | null;
  infoId: string | null;
  canAutoFill: boolean;
}

export default function AutoFillAssignment() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const meetingId = params.meetingId as string;

  const [sections, setSections] = useState<AgendaSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sergeantAtArms, setSergeantAtArms] = useState<RoleInfo>({ id: null, name: null });
  const [presidingOfficer, setPresidingOfficer] = useState<RoleInfo>({ id: null, name: null });
  const [toastmasterOfTheDay, setToastmasterOfTheDay] = useState<RoleInfo>({ id: null, name: null });
  const [tableTopicsMaster, setTableTopicsMaster] = useState<RoleInfo>({ id: null, name: null });
  const [quizMaster, setQuizMaster] = useState<RoleInfo>({ id: null, name: null });
  const [generalEvaluator, setGeneralEvaluator] = useState<RoleInfo>({ id: null, name: null });
  const [educationalSpeaker, setEducationalSpeaker] = useState<RoleInfo>({ id: null, name: null });
  const [grammarian, setGrammarian] = useState<RoleInfo>({ id: null, name: null });

  useEffect(() => {
    loadAllData();
  }, [meetingId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRoles(),
        loadAgendaSections(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    const { data: meeting } = await supabase
      .from('meetings')
      .select('club_id')
      .eq('id', meetingId)
      .maybeSingle();

    if (!meeting) return;
    const clubId = meeting.club_id;

    const [
      { data: saaData },
      { data: poData },
      { data: tmodData },
      { data: ttmData },
      { data: qmData },
      { data: geData },
      { data: esData },
      { data: gramData },
    ] = await Promise.all([
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%sergeant%').eq('status', 'confirmed').maybeSingle(),
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%presiding%').eq('status', 'confirmed').maybeSingle(),
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%toastmaster of the day%').eq('status', 'confirmed').maybeSingle(),
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%table topics master%').eq('status', 'confirmed').maybeSingle(),
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%quiz master%').eq('status', 'confirmed').maybeSingle(),
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%general evaluator%').eq('status', 'confirmed').maybeSingle(),
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%educational speaker%').eq('status', 'confirmed').maybeSingle(),
      supabase.from('meeting_roles').select('user_id, app_user_profiles(full_name)').eq('meeting_id', meetingId).ilike('role_name', '%grammarian%').eq('status', 'confirmed').maybeSingle(),
    ]);

    const extract = (data: any): RoleInfo => ({
      id: data?.user_id ?? null,
      name: (data?.app_user_profiles as any)?.full_name ?? null,
    });

    setSergeantAtArms(extract(saaData));
    setPresidingOfficer(extract(poData));
    setToastmasterOfTheDay(extract(tmodData));
    setTableTopicsMaster(extract(ttmData));
    setQuizMaster(extract(qmData));
    setGeneralEvaluator(extract(geData));
    setEducationalSpeaker(extract(esData));
    setGrammarian(extract(gramData));
  };

  const loadAgendaSections = async () => {
    const { data, error } = await supabase
      .from('meeting_agenda_items')
      .select('id, section_name, section_icon, section_order, assigned_user_id, assigned_user_name, is_visible')
      .eq('meeting_id', meetingId)
      .order('section_order');

    if (error || !data) return;
    setSections(data.map(item => ({ ...item, infoName: null, infoId: null, canAutoFill: false })));
  };

  const EXCLUDED_SECTIONS = [
    'meet and greet',
    'grammarian corner',
    'prepared speeches session',
    'ice breaker sessions',
    'ancillary speakers',
    'break',
  ];

  const isSectionExcluded = (sectionName: string): boolean => {
    const lower = sectionName.toLowerCase();
    return EXCLUDED_SECTIONS.some(ex => lower === ex || lower.includes(ex));
  };

  const getInfoForSection = (sectionName: string): RoleInfo => {
    const name = sectionName.toLowerCase();
    if (name.includes('call to order')) return sergeantAtArms;
    if (name.includes('presiding officer')) return presidingOfficer;
    if (name.includes('toastmaster of the day')) return toastmasterOfTheDay;
    if (name.includes('table topic')) return tableTopicsMaster;
    if (name.includes('quiz')) return quizMaster;
    if (name.includes('general evaluator')) return generalEvaluator;
    if (name.includes('educational speaker')) return educationalSpeaker;
    if (name.includes('grammarian') && !name.includes('corner')) return grammarian;
    if (name.includes('awards')) return presidingOfficer;
    if (name.includes('closing')) return presidingOfficer;
    return { id: null, name: null };
  };

  const enrichedSections = sections
    .filter(s => !isSectionExcluded(s.section_name))
    .map(s => {
      const info = getInfoForSection(s.section_name);
      return {
        ...s,
        infoName: info.name,
        infoId: info.id,
        canAutoFill: !!info.name,
      };
    });

  const [overrides, setOverrides] = useState<Record<string, { name: string | null; id: string | null }>>({});

  const getEffectiveAssignment = (section: typeof enrichedSections[0]) => {
    if (overrides[section.id] !== undefined) return overrides[section.id];
    if (section.canAutoFill) return { name: section.infoName, id: section.infoId };
    return { name: section.assigned_user_name, id: section.assigned_user_id };
  };

  const handleFillAll = () => {
    const newOverrides: Record<string, { name: string | null; id: string | null }> = {};
    enrichedSections.forEach(s => {
      if (s.canAutoFill) {
        newOverrides[s.id] = { name: s.infoName, id: s.infoId };
      }
    });
    setOverrides(newOverrides);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Promise<any>[] = [];

      enrichedSections.forEach(section => {
        const effective = getEffectiveAssignment(section);
        const changed =
          effective.name !== section.assigned_user_name ||
          effective.id !== section.assigned_user_id;

        if (changed && (effective.name !== null || overrides[section.id] !== undefined)) {
          updates.push(
            supabase
              .from('meeting_agenda_items')
              .update({
                assigned_user_id: effective.id,
                assigned_user_name: effective.name,
              })
              .eq('id', section.id)
          );
        }
      });

      await Promise.all(updates);
      Alert.alert('Success', 'Assignments saved successfully');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const autoFillCount = enrichedSections.filter(s => s.canAutoFill).length;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading assignments...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Auto Fill Assignment</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Check size={22} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBanner, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: `${theme.colors.primary}15` }]}>
            <Zap size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Auto Fill Assignment</Text>
            <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
              {autoFillCount} section{autoFillCount !== 1 ? 's' : ''} can be auto-filled from meeting role bookings
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.fillAllButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleFillAll}
          activeOpacity={0.8}
        >
          <Zap size={18} color="#ffffff" />
          <Text style={styles.fillAllButtonText}>Fill All Available Sections</Text>
        </TouchableOpacity>

        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionCardTitle, { color: theme.colors.text }]}>Agenda Sections</Text>
          <Text style={[styles.sectionCardSubtitle, { color: theme.colors.textSecondary }]}>
            Review info-assigned names and confirm assignment for each section
          </Text>
        </View>

        {enrichedSections.map((section, index) => {
          const effective = getEffectiveAssignment(section);
          const hasInfo = section.canAutoFill;
          const isAutoFilled = overrides[section.id] !== undefined || (hasInfo && effective.name === section.infoName);

          return (
            <View
              key={section.id}
              style={[
                styles.sectionRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: hasInfo ? `${theme.colors.primary}30` : theme.colors.border,
                }
              ]}
            >
              <View style={styles.sectionRowTop}>
                <View style={styles.sectionIconName}>
                  {section.section_icon ? (
                    <Text style={styles.sectionIcon}>{section.section_icon}</Text>
                  ) : (
                    <View style={[styles.sectionIconFallback, { backgroundColor: theme.colors.background }]}>
                      <Text style={[styles.sectionIndexText, { color: theme.colors.textSecondary }]}>{index + 1}</Text>
                    </View>
                  )}
                  <Text style={[styles.sectionName, { color: theme.colors.text }]}>{section.section_name}</Text>
                </View>
                {hasInfo && (
                  <View style={[styles.autoFillBadge, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <Zap size={10} color={theme.colors.primary} />
                    <Text style={[styles.autoFillBadgeText, { color: theme.colors.primary }]}>Auto</Text>
                  </View>
                )}
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.assignmentGrid}>
                <View style={[styles.assignmentCell, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.assignmentCellLabel, { color: theme.colors.textSecondary }]}>
                    Info Assigned
                  </Text>
                  <View style={styles.assignmentNameRow}>
                    {hasInfo ? (
                      <>
                        <View style={[styles.nameIndicator, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.assignmentName, { color: theme.colors.text }]} numberOfLines={1}>
                          {section.infoName}
                        </Text>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} color={theme.colors.textSecondary} />
                        <Text style={[styles.assignmentNameEmpty, { color: theme.colors.textSecondary }]}>
                          No info available
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <View style={styles.arrowContainer}>
                  <Text style={[styles.arrowText, { color: hasInfo ? theme.colors.primary : theme.colors.textSecondary }]}>→</Text>
                </View>

                <View style={[styles.assignmentCell, styles.assignedToCell, {
                  borderColor: hasInfo ? theme.colors.primary : theme.colors.border,
                  backgroundColor: hasInfo ? `${theme.colors.primary}08` : 'transparent',
                }]}>
                  <Text style={[styles.assignmentCellLabel, { color: hasInfo ? theme.colors.primary : theme.colors.textSecondary }]}>
                    Assigned To
                  </Text>
                  <View style={styles.assignmentNameRow}>
                    {effective.name ? (
                      <>
                        <User size={12} color={hasInfo ? theme.colors.primary : theme.colors.textSecondary} />
                        <Text style={[styles.assignmentName, { color: hasInfo ? theme.colors.primary : theme.colors.text }]} numberOfLines={1}>
                          {effective.name}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.assignmentNameEmpty, { color: theme.colors.textSecondary }]}>
                        TBA
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {hasInfo && (
                <TouchableOpacity
                  style={[styles.fillOneButton, {
                    backgroundColor: `${theme.colors.primary}12`,
                    borderColor: `${theme.colors.primary}30`,
                  }]}
                  onPress={() => setOverrides(prev => ({
                    ...prev,
                    [section.id]: { name: section.infoName, id: section.infoId },
                  }))}
                  activeOpacity={0.7}
                >
                  <Zap size={13} color={theme.colors.primary} />
                  <Text style={[styles.fillOneButtonText, { color: theme.colors.primary }]}>
                    Use Info Assigned Name
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.saveFooterButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Check size={18} color="#ffffff" />
              <Text style={styles.saveFooterButtonText}>Save All Assignments</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  fillAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  fillAllButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionCardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  sectionRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionIconName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionIconFallback: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIndexText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  autoFillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  autoFillBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginBottom: 10,
  },
  assignmentGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  assignmentCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  assignedToCell: {
    borderWidth: 1.5,
  },
  assignmentCellLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  assignmentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nameIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  assignmentName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  assignmentNameEmpty: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  arrowContainer: {
    width: 24,
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '300',
  },
  fillOneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
  },
  fillOneButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 15,
  },
  saveFooterButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomSpace: {
    height: 32,
  },
});
