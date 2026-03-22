import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Image, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Calendar, Clock, MapPin, Sparkles, Edit3, Compass, FileText, CheckCircle2, Download, Users, Timer, PenLine, BookOpen } from 'lucide-react-native';
import { exportAgendaToPDF, generatePDFFilename } from '@/lib/pdfExportUtils';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string;
  meeting_start_time: string;
  meeting_end_time: string;
  meeting_mode: string;
  theme: string | null;
  word_of_the_day: string | null;
  phrase_of_the_day?: string | null;
  idiom_of_the_day?: string | null;
  quote_of_the_day?: string | null;
  club_id: string;
  club_info_banner_color?: string;
  datetime_banner_color?: string;
  footer_banner_1_color?: string;
  footer_banner_2_color?: string;
  is_agenda_visible?: boolean;
}

interface ClubInfo {
  id: string;
  club_name: string;
  club_number: string | null;
  district: string | null;
  division: string | null;
  area: string | null;
  country: string | null;
  time_zone: string | null;
}

interface VPMInfo {
  full_name: string;
  phone_number: string | null;
}

interface VPEInfo {
  full_name: string;
  phone_number: string | null;
}

interface PreparedSpeaker {
  id: string;
  speaker_name: string;
  speaker_id: string | null;
  speaker_avatar: string | null;
  speech_title: string | null;
  pathway_name: string | null;
  pathway_level: number | null;
  project_title: string | null;
  project_number: number | null;
  evaluator_name: string | null;
  evaluator_id: string | null;
  evaluator_avatar: string | null;
  evaluation_id: string | null;
  evaluation_pdf_url: string | null;
  evaluation_form: string | null;
  role_name?: string;
}

function parseMemberPreparedAgenda(raw: unknown): Array<{
  slot: number;
  booked: boolean;
  is_visible: boolean;
  speaker_user_id: string | null;
  speaker_name: string | null;
  speech_title: string | null;
  pathway_name: string | null;
  level: number | null;
  project_number: string | null;
  project_name: string | null;
  evaluation_form: string | null;
  evaluator_user_id: string | null;
  evaluator_name: string | null;
}> {
  if (raw == null) return [];
  let arr: unknown[] = [];
  try {
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'string') arr = JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }
  return arr
    .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
    .map(s => ({
      slot: Number(s.slot) || 0,
      booked: !!s.booked,
      is_visible: s.is_visible !== false,
      speaker_user_id: (s.speaker_user_id as string) || null,
      speaker_name: (s.speaker_name as string) || null,
      speech_title: (s.speech_title as string) || null,
      pathway_name: (s.pathway_name as string) || null,
      level: s.level != null ? Number(s.level) : null,
      project_number: s.project_number != null ? String(s.project_number) : null,
      project_name: (s.project_name as string) || null,
      evaluation_form: (s.evaluation_form as string) || null,
      evaluator_user_id: (s.evaluator_user_id as string) || null,
      evaluator_name: (s.evaluator_name as string) || null,
    }))
    .filter(s => s.slot >= 1 && s.slot <= 5)
    .sort((a, b) => a.slot - b.slot);
}

function slotFromRoleName(roleName: string): number | null {
  const m = roleName?.match(/(?:Prepared Speaker|prepared speaker)\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function preparedSpeakersListForDisplay(item: {
  prepared_speeches_agenda?: unknown;
  prepared_speakers?: PreparedSpeaker[];
}): PreparedSpeaker[] {
  const parsed = parseMemberPreparedAgenda(item.prepared_speeches_agenda);
  const fallback = item.prepared_speakers || [];

  // Build slot->speaker map from fallback (meeting roles) using role_name if available
  const fallbackBySlot = new Map<number, PreparedSpeaker & { slot?: number }>();
  fallback.forEach((p, idx) => {
    const slot = slotFromRoleName(p.role_name || '') ?? idx + 1;
    if (slot >= 1 && slot <= 5) fallbackBySlot.set(slot, { ...p, slot });
  });

  // Show slots that have any content from Edit Agenda (booked, manually added speaker, title, pathway, etc.)
  const hasContent = (s: {
    booked: boolean;
    speaker_name: string | null;
    speech_title?: string | null;
    pathway_name?: string | null;
    project_name?: string | null;
    evaluator_name?: string | null;
    evaluation_form?: string | null;
    level?: number | null;
    project_number?: string | null;
  }) => {
    if (s.booked) return true;
    const str = (v: unknown) => (v != null && String(v).trim() !== '' ? 1 : 0);
    return str(s.speaker_name) + str(s.speech_title) + str(s.pathway_name) + str(s.project_name) +
      str(s.evaluator_name) + str(s.evaluation_form) + (s.level != null ? 1 : 0) + str(s.project_number) > 0;
  };
  const parsedBySlot = new Map(
    parsed.filter(s => s.is_visible && hasContent(s)).map(s => [s.slot, s])
  );
  const result: PreparedSpeaker[] = [];

  for (let slot = 1; slot <= 5; slot++) {
    const fromAgenda = parsedBySlot.get(slot);
    const fromFallback = fallbackBySlot.get(slot);

    if (fromAgenda) {
      const pn = fromAgenda.project_number ? parseInt(fromAgenda.project_number, 10) : NaN;
      result.push({
        id: `agenda-ps-${slot}`,
        speaker_name: fromAgenda.speaker_name || 'TBA',
        speaker_id: fromAgenda.speaker_user_id,
        speaker_avatar: null,
        speech_title: fromAgenda.speech_title,
        pathway_name: fromAgenda.pathway_name,
        pathway_level: fromAgenda.level,
        project_title: fromAgenda.project_name,
        project_number: !isNaN(pn) ? pn : null,
        evaluator_name: fromAgenda.evaluator_name,
        evaluator_id: fromAgenda.evaluator_user_id,
        evaluator_avatar: null,
        evaluation_id: null,
        evaluation_pdf_url: null,
        evaluation_form: fromAgenda.evaluation_form,
      });
    } else if (fromFallback) {
      result.push(fromFallback);
    }
    // Skip unbooked slots – don't show "Open for booking" in Meeting Agenda
  }

  return result.length > 0 ? result : fallback;
}

function usesPreparedSpeechesAgendaSnapshot(item: { prepared_speeches_agenda?: unknown }): boolean {
  return parseMemberPreparedAgenda(item.prepared_speeches_agenda).length > 0;
}

interface DailyHighlights {
  word_of_the_day?: {
    word: string;
    meaning: string;
    usage: string;
    part_of_speech: string | null;
  };
  idiom_of_the_day?: {
    idiom: string;
    meaning: string;
    usage: string;
  };
  quote_of_the_day?: {
    quote: string;
    meaning: string;
    usage: string;
  };
}

interface AgendaItem {
  id: string;
  section_name: string;
  section_description: string | null;
  section_icon: string | null;
  section_order: number;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  assigned_user_name: string | null;
  assigned_user_id: string | null;
  assigned_user_avatar: string | null;
  is_role_based: boolean;
  role_details: {
    role_name?: string;
    role_classification?: string;
    speech_title?: string;
    pathway_name?: string;
    pathway_level?: number;
    project_title?: string;
    table_topic_question?: string;
    educational_topic?: string;
    summary?: string;
    grammarian_corner?: {
      word_of_the_day?: string | null;
      quote_of_the_day?: string | null;
      idiom_of_the_day?: string | null;
    };
  } | null;
  custom_notes: string | null;
  is_visible: boolean;
  theme_of_the_day?: string | null;
  theme_summary?: string | null;
  prepared_speakers?: PreparedSpeaker[];
  daily_highlights?: DailyHighlights;
  educational_topic?: string | null;
  timer_visible?: boolean;
  ah_counter_visible?: boolean;
  grammarian_visible?: boolean;
}

interface TagTeamRole {
  role_name: string;
  assigned_user_name: string | null;
  assigned_user_avatar: string | null;
  assigned_user_id: string | null;
  is_visible: boolean;
}

export default function MeetingAgendaView() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = params.meetingId as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [vpmInfo, setVpmInfo] = useState<VPMInfo | null>(null);
  const [vpeInfo, setVpeInfo] = useState<VPEInfo | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [tagTeamRoles, setTagTeamRoles] = useState<TagTeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExcomm, setIsExcomm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    loadData();
    checkExcommStatus();
  }, [meetingId]);

  // Refresh all data when screen comes into focus (e.g., after editing)
  // Skip on initial mount since useEffect already loads everything
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      if (meetingId) {
        // Use the same loadData flow as refresh to ensure proper sequencing
        loadData();
      }
    }, [meetingId])
  );

  const checkExcommStatus = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('role')
        .eq('user_id', user.id)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true)
        .single();

      if (!error && data) {
        setIsExcomm(data.role === 'excomm' || data.role === 'club_leader');
      }
    } catch (error) {
      console.error('Error checking excomm status:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Load meeting first to get club_id
      await loadMeeting();
      // Load agenda items and tag team roles in parallel
      await Promise.all([
        loadAgendaItems(),
        loadTagTeamRoles()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMeeting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        return;
      }

      setMeeting(data);

      // Load club info after meeting is loaded
      if (data?.club_id) {
        const { data: clubData } = await supabase
          .from('club_profiles')
          .select('id, club_name, club_number, district, division, area, country, time_zone, vpm_id, vpe_id')
          .eq('club_id', data.club_id)
          .single();

        if (clubData) {
          setClubInfo(clubData);

          // Load VPM and VPE info in parallel
          const promises = [];
          if (clubData.vpm_id) {
            promises.push(
              supabase
                .from('app_user_profiles')
                .select('full_name, phone_number')
                .eq('id', clubData.vpm_id)
                .single()
                .then(({ data: vpmData }) => {
                  if (vpmData) setVpmInfo(vpmData);
                })
            );
          }

          if (clubData.vpe_id) {
            promises.push(
              supabase
                .from('app_user_profiles')
                .select('full_name, phone_number')
                .eq('id', clubData.vpe_id)
                .single()
                .then(({ data: vpeData }) => {
                  if (vpeData) setVpeInfo(vpeData);
                })
            );
          }

          await Promise.all(promises);
        }
      }
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  const loadAgendaItems = async () => {
    try {
      // Load meeting theme along with other data for better performance
      const [
        { data, error },
        { data: speakersData, error: speakersError },
        { data: meetingData },
        { data: wordData },
        { data: idiomData },
        { data: quoteData },
        { data: bookedRolesData }
      ] = await Promise.all([
        supabase
          .from('meeting_agenda_items')
          .select(`
            *,
            agenda_item_templates!meeting_agenda_items_template_id_fkey(is_role_based)
          `)
          .eq('meeting_id', meetingId)
          .eq('is_visible', true)
          .order('section_order'),
        supabase
          .from('app_evaluation_pathway')
          .select(`
            id,
            user_id,
            role_name,
            speech_title,
            pathway_name,
            project_name,
            level,
            project_number,
            assigned_evaluator_id,
            evaluation_form
          `)
          .eq('meeting_id', meetingId)
          .order('role_name'),
        supabase
          .from('app_club_meeting')
          .select('theme')
          .eq('id', meetingId)
          .single(),
        supabase
          .from('grammarian_word_of_the_day')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .maybeSingle(),
        supabase
          .from('grammarian_idiom_of_the_day')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .maybeSingle(),
        supabase
          .from('grammarian_quote_of_the_day')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .maybeSingle(),
        supabase
          .from('app_meeting_roles_management')
          .select('assigned_user_id, booking_status')
          .eq('meeting_id', meetingId)
          .ilike('role_name', '%prepared%speaker%')
          .eq('booking_status', 'booked')
      ]);

      if (error) {
        console.error('Error loading agenda items:', error);
        return;
      }

      if (speakersError) {
        console.error('Error loading speakers:', speakersError);
      }

      // Build set of user IDs that have a booked prepared speaker role
      const bookedPreparedUserIds = new Set(
        (bookedRolesData || []).map((r: any) => r.assigned_user_id).filter(Boolean)
      );

      // Filter speakers in JavaScript (much faster than ILIKE)
      // Only include speakers whose booking_status is 'booked' in app_meeting_roles_management
      const preparedSpeakersData = speakersData?.filter((s: any) =>
        s.role_name?.toLowerCase().includes('prepared') &&
        s.role_name?.toLowerCase().includes('speaker') &&
        bookedPreparedUserIds.has(s.user_id)
      ) || [];

      const iceBreakersData = speakersData?.filter((s: any) =>
        s.role_name?.toLowerCase().includes('ice') &&
        s.role_name?.toLowerCase().includes('breaker')
      ) || [];

      // Collect all user IDs to fetch profiles
      const userIds = new Set<string>();

      // From agenda items
      data?.forEach((item: any) => {
        if (item.assigned_user_id) userIds.add(item.assigned_user_id);
        if (item.timer_user_id) userIds.add(item.timer_user_id);
        if (item.ah_counter_user_id) userIds.add(item.ah_counter_user_id);
        if (item.grammarian_user_id) userIds.add(item.grammarian_user_id);
      });

      // From speakers and evaluators
      preparedSpeakersData?.forEach((speaker: any) => {
        if (speaker.user_id) userIds.add(speaker.user_id);
        if (speaker.assigned_evaluator_id) userIds.add(speaker.assigned_evaluator_id);
      });

      iceBreakersData?.forEach((speaker: any) => {
        if (speaker.user_id) userIds.add(speaker.user_id);
        if (speaker.assigned_evaluator_id) userIds.add(speaker.assigned_evaluator_id);
      });

      // Fetch all user profiles in one query
      let userProfiles: Record<string, any> = {};
      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('app_user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(userIds));

        if (profilesData) {
          profilesData.forEach(profile => {
            userProfiles[profile.id] = profile;
          });
        }
      }

      // Fetch evaluation PDFs
      const evaluationPathwayIds = [
        ...(preparedSpeakersData?.map((s: any) => s.id) || []),
        ...(iceBreakersData?.map((s: any) => s.id) || [])
      ];

      let evaluations: Record<string, any> = {};
      if (evaluationPathwayIds.length > 0) {
        const { data: evaluationsData } = await supabase
          .from('app_prepared_speech_evaluations')
          .select('id, evaluation_pathway_id, evaluation_pdf_url')
          .in('evaluation_pathway_id', evaluationPathwayIds);

        if (evaluationsData) {
          evaluationsData.forEach(evaluation => {
            evaluations[evaluation.evaluation_pathway_id] = evaluation;
          });
        }
      }

      // Map prepared speakers with pathway information
      const preparedSpeakers: PreparedSpeaker[] = preparedSpeakersData?.map((speaker: any) => {
        let projectNumber: number | null = null;
        if (speaker.project_number) {
          const parsed = typeof speaker.project_number === 'string' ? parseInt(speaker.project_number, 10) : speaker.project_number;
          projectNumber = !isNaN(parsed) ? parsed : null;
        }

        const speakerProfile = speaker.user_id ? userProfiles[speaker.user_id] : null;
        const evaluatorProfile = speaker.assigned_evaluator_id ? userProfiles[speaker.assigned_evaluator_id] : null;
        const evaluation = evaluations[speaker.id];

        return {
          id: speaker.id,
          speaker_name: speakerProfile?.full_name || 'TBA',
          speaker_id: speaker.user_id || null,
          speaker_avatar: speakerProfile?.avatar_url || null,
          speech_title: speaker.speech_title,
          pathway_name: speaker.pathway_name,
          pathway_level: speaker.level,
          project_title: speaker.project_name,
          project_number: projectNumber,
          evaluator_name: evaluatorProfile?.full_name || null,
          evaluator_id: speaker.assigned_evaluator_id || null,
          evaluator_avatar: evaluatorProfile?.avatar_url || null,
          evaluation_id: evaluation?.id || null,
          evaluation_pdf_url: evaluation?.evaluation_pdf_url || null,
          evaluation_form: speaker.evaluation_form || null,
          role_name: speaker.role_name || undefined,
        };
      }) || [];

      // Map ice breakers with pathway information
      const iceBreakers: PreparedSpeaker[] = iceBreakersData?.map((speaker: any) => {
        let projectNumber: number | null = null;
        if (speaker.project_number) {
          const parsed = typeof speaker.project_number === 'string' ? parseInt(speaker.project_number, 10) : speaker.project_number;
          projectNumber = !isNaN(parsed) ? parsed : null;
        }

        const speakerProfile = speaker.user_id ? userProfiles[speaker.user_id] : null;
        const evaluatorProfile = speaker.assigned_evaluator_id ? userProfiles[speaker.assigned_evaluator_id] : null;
        const evaluation = evaluations[speaker.id];

        return {
          id: speaker.id,
          speaker_name: speakerProfile?.full_name || 'TBA',
          speaker_id: speaker.user_id || null,
          speaker_avatar: speakerProfile?.avatar_url || null,
          speech_title: speaker.speech_title,
          pathway_name: speaker.pathway_name,
          pathway_level: speaker.level,
          project_title: speaker.project_name,
          project_number: projectNumber,
          evaluator_name: evaluatorProfile?.full_name || null,
          evaluator_id: speaker.assigned_evaluator_id || null,
          evaluator_avatar: evaluatorProfile?.avatar_url || null,
          evaluation_id: evaluation?.id || null,
          evaluation_pdf_url: evaluation?.evaluation_pdf_url || null,
          evaluation_form: speaker.evaluation_form || null,
        };
      }) || [];

      const items = data?.map((item: any) => {
        // Normalize role_details (can arrive as object or JSON string depending on DB/client config)
        let normalizedRoleDetails: any = item.role_details;
        if (typeof normalizedRoleDetails === 'string') {
          try {
            normalizedRoleDetails = JSON.parse(normalizedRoleDetails);
          } catch {
            normalizedRoleDetails = null;
          }
        }

        const assignedUserProfile = item.assigned_user_id ? userProfiles[item.assigned_user_id] : null;
        const timerProfile = item.timer_user_id ? userProfiles[item.timer_user_id] : null;
        const ahCounterProfile = item.ah_counter_user_id ? userProfiles[item.ah_counter_user_id] : null;
        const grammarianProfile = item.grammarian_user_id ? userProfiles[item.grammarian_user_id] : null;

        const baseItem = {
          ...item,
          role_details: normalizedRoleDetails,
          is_role_based: item.agenda_item_templates?.is_role_based ?? true,
          assigned_user_avatar: assignedUserProfile?.avatar_url || null,
          assigned_user_name: assignedUserProfile?.full_name || item.assigned_user_name || null,
        };

        // Add theme data to Toastmaster of the Day items (always add fields, even if null)
        if (item.section_name.toLowerCase().includes('toastmaster of the day')) {
          return {
            ...baseItem,
            theme_of_the_day: meetingData?.theme || null,
          };
        }

        // Add prepared speakers to Prepared Speeches Session
        if (item.section_name.toLowerCase().includes('prepared speech')) {
          return {
            ...baseItem,
            prepared_speakers: preparedSpeakers,
          };
        }

        // Add prepared speakers to Speech Evaluation (same data: Evaluator, Speaker, Speech Title)
        if (item.section_name.toLowerCase().includes('speech evaluation')) {
          return {
            ...baseItem,
            prepared_speakers: preparedSpeakers,
          };
        }

        // Add ice breakers to Ice Breaker Sessions
        if (item.section_name.toLowerCase().includes('ice breaker')) {
          return {
            ...baseItem,
            ice_breakers: iceBreakers,
          };
        }

        // Add educational topic to Educational Speaker items
        if (item.section_name.toLowerCase().includes('educational speaker')) {
          return {
            ...baseItem,
            educational_topic: item.educational_topic || null,
          };
        }

        // Add daily highlights data to Daily Highlights or Grammarian Corner section
        if (item.section_name === 'Daily Highlights' || item.section_name === 'Grammarian Corner') {
          const dailyHighlights: DailyHighlights = {};

          const stored = normalizedRoleDetails?.grammarian_corner;
          const readStoredText = (v: any, key: 'word' | 'quote' | 'idiom'): string => {
            if (!v) return '';
            if (typeof v === 'string') return v.trim();
            if (typeof v === 'object' && typeof v[key] === 'string') return (v[key] as string).trim();
            return '';
          };

          const storedWord = readStoredText(stored?.word_of_the_day, 'word');
          const storedQuote = readStoredText(stored?.quote_of_the_day, 'quote');
          const storedIdiom = readStoredText(stored?.idiom_of_the_day, 'idiom');

          // Prefer agenda-saved values (Edit Agenda) over published tables.
          if (storedWord) {
            dailyHighlights.word_of_the_day = {
              word: storedWord,
              meaning: '',
              usage: '',
              part_of_speech: null,
            };
          } else if (wordData) {
            dailyHighlights.word_of_the_day = {
              word: wordData.word,
              meaning: wordData.meaning,
              usage: wordData.usage,
              part_of_speech: wordData.part_of_speech,
            };
          }

          if (storedIdiom) {
            dailyHighlights.idiom_of_the_day = {
              idiom: storedIdiom,
              meaning: '',
              usage: '',
            };
          } else if (idiomData) {
            dailyHighlights.idiom_of_the_day = {
              idiom: idiomData.idiom,
              meaning: idiomData.meaning,
              usage: idiomData.usage,
            };
          }

          if (storedQuote) {
            dailyHighlights.quote_of_the_day = {
              quote: storedQuote,
              meaning: '',
              usage: '',
            };
          } else if (quoteData) {
            dailyHighlights.quote_of_the_day = {
              quote: quoteData.quote,
              meaning: quoteData.meaning,
              usage: quoteData.usage,
            };
          }

          return {
            ...baseItem,
            daily_highlights: Object.keys(dailyHighlights).length > 0 ? dailyHighlights : undefined,
          };
        }

        // Add Tag Team user data
        if (item.section_name.toLowerCase().includes('tag team')) {
          return {
            ...baseItem,
            timer_name: timerProfile?.full_name || null,
            timer_id: item.timer_user_id || null,
            timer_avatar: timerProfile?.avatar_url || null,
            timer_visible: item.timer_visible ?? true,
            ah_counter_name: ahCounterProfile?.full_name || null,
            ah_counter_id: item.ah_counter_user_id || null,
            ah_counter_avatar: ahCounterProfile?.avatar_url || null,
            ah_counter_visible: item.ah_counter_visible ?? true,
            grammarian_name: grammarianProfile?.full_name || null,
            grammarian_id: item.grammarian_user_id || null,
            grammarian_avatar: grammarianProfile?.avatar_url || null,
            grammarian_visible: item.grammarian_visible ?? true,
          };
        }

        return baseItem;
      }).filter((item: any) => !item.section_name.toLowerCase().includes('ancillary')) || [];

      setAgendaItems(items);
    } catch (error) {
      console.error('Error loading agenda items:', error);
    }
  };

  const loadTagTeamRoles = async () => {
    try {
      // Try to load from agenda item first (just IDs)
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select('timer_user_id, ah_counter_user_id, grammarian_user_id, timer_visible, ah_counter_visible, grammarian_visible')
        .eq('meeting_id', meetingId)
        .ilike('section_name', '%tag%team%')
        .maybeSingle();

      if (!agendaError && agendaData) {
        // Collect user IDs
        const userIds = [
          agendaData.timer_user_id,
          agendaData.ah_counter_user_id,
          agendaData.grammarian_user_id
        ].filter(Boolean);

        // Fetch profiles if there are user IDs
        let userProfiles: Record<string, any> = {};
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('app_user_profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);

          if (profilesData) {
            profilesData.forEach(profile => {
              userProfiles[profile.id] = profile;
            });
          }
        }

        const timerProfile = agendaData.timer_user_id ? userProfiles[agendaData.timer_user_id] : null;
        const ahCounterProfile = agendaData.ah_counter_user_id ? userProfiles[agendaData.ah_counter_user_id] : null;
        const grammarianProfile = agendaData.grammarian_user_id ? userProfiles[agendaData.grammarian_user_id] : null;

        const roles: TagTeamRole[] = [
          {
            role_name: 'Timer',
            assigned_user_name: timerProfile?.full_name || null,
            assigned_user_avatar: timerProfile?.avatar_url || null,
            assigned_user_id: agendaData.timer_user_id,
            is_visible: agendaData.timer_visible ?? true,
          },
          {
            role_name: 'Ah Counter',
            assigned_user_name: ahCounterProfile?.full_name || null,
            assigned_user_avatar: ahCounterProfile?.avatar_url || null,
            assigned_user_id: agendaData.ah_counter_user_id,
            is_visible: agendaData.ah_counter_visible ?? true,
          },
          {
            role_name: 'Grammarian',
            assigned_user_name: grammarianProfile?.full_name || null,
            assigned_user_avatar: grammarianProfile?.avatar_url || null,
            assigned_user_id: agendaData.grammarian_user_id,
            is_visible: agendaData.grammarian_visible ?? true,
          },
        ];
        setTagTeamRoles(roles);
        return;
      }

      // Fallback to app_meeting_roles_management
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select('role_name, assigned_user_id')
        .eq('meeting_id', meetingId)
        .eq('role_classification', 'Tag roles')
        .in('role_name', ['Timer', 'Ah Counter', 'Grammarian'])
        .order('role_name');

      if (error) {
        console.error('Error loading tag team roles:', error);
        return;
      }

      // Fetch profiles for assigned users
      const userIds = data?.map((role: any) => role.assigned_user_id).filter(Boolean) || [];
      let userProfiles: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('app_user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (profilesData) {
          profilesData.forEach(profile => {
            userProfiles[profile.id] = profile;
          });
        }
      }

      const roles: TagTeamRole[] = data?.map((role: any) => {
        const profile = role.assigned_user_id ? userProfiles[role.assigned_user_id] : null;
        return {
          role_name: role.role_name,
          assigned_user_name: profile?.full_name || null,
          assigned_user_avatar: profile?.avatar_url || null,
          assigned_user_id: role.assigned_user_id,
          is_visible: true,
        };
      }) || [];

      // Ensure all three roles are present
      const roleNames = ['Timer', 'Ah Counter', 'Grammarian'];
      const allRoles = roleNames.map(roleName => {
        const existingRole = roles.find(r => r.role_name === roleName);
        return existingRole || {
          role_name: roleName,
          assigned_user_name: null,
          assigned_user_avatar: null,
          assigned_user_id: null,
          is_visible: true,
        };
      });

      setTagTeamRoles(allRoles);
    } catch (error) {
      console.error('Error loading tag team roles:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleExportPDF = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Not Available',
        'PDF export is currently only available on the web version of the app.'
      );
      return;
    }

    if (!meeting || !clubInfo) {
      Alert.alert('Error', 'Meeting information not loaded');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);

      const filename = generatePDFFilename(
        clubInfo.club_name,
        meeting.meeting_number,
        meeting.meeting_date
      );

      await exportAgendaToPDF('agenda-content', filename, (progress) => {
        setExportProgress(progress);
      });

      Alert.alert('Success', 'Agenda exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Failed to export agenda to PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatTimeRange = (start: string | null, end: string | null) => {
    if (!start || !end) return '';
    return `${formatTime(start)} -\n${formatTime(end)}`;
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTimeShort = (timeString: string | null) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };

  const formatRoleClassification = (classification: string) => {
    return classification
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');
  };

  const getRoleName = (item: AgendaItem) => {
    if (item.role_details?.role_name) {
      return item.role_details.role_name;
    }
    if (item.role_details?.role_classification) {
      return formatRoleClassification(item.role_details.role_classification);
    }
    return '';
  };

  const getSectionTypeTag = (item: AgendaItem) => {
    if (!item.role_details || !item.role_details.role_classification) {
      return null;
    }

    const roleClass = item.role_details.role_classification?.toLowerCase();

    if (roleClass === 'tag_team' || item.section_name.toLowerCase().includes('tag team')) {
      return { label: 'Tag Team', color: '#f59e0b', bgColor: '#f59e0b15' };
    }

    if (roleClass === 'education_speech' || roleClass === 'educational_speaker' ||
        item.section_name.toLowerCase().includes('education')) {
      return { label: 'Education Speech', color: '#8b5cf6', bgColor: '#8b5cf615' };
    }

    return null;
  };

  const handleViewEvaluationForm = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open evaluation form');
      }
    } catch (error) {
      console.error('Error opening evaluation form:', error);
      Alert.alert('Error', 'Failed to open evaluation form');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading agenda...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isExcomm && meeting.is_agenda_visible === false) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Meeting Agenda
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.hiddenAgendaContainer}>
          <Text style={styles.chefEmoji} maxFontSizeMultiplier={1.3}>👨‍🍳</Text>
          <Text style={[styles.hiddenAgendaTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Our VPE is busy cooking up the perfect meeting agenda
          </Text>
          <Text style={[styles.hiddenAgendaMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Check back soon—this page will be freshly served before the meeting!
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Agenda</Text>
        <View style={styles.headerActions}>
          {meeting?.is_agenda_visible && (
            <TouchableOpacity
              onPress={handleExportPDF}
              style={styles.headerButton}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Download size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          )}
          {isExcomm && (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/admin/agenda-editor',
                params: { meetingId }
              })}
              style={styles.headerButton}
            >
              <Edit3 size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View nativeID="agenda-content" style={styles.agendaContentWrapper}>
        {/* Banners and agenda sections as separate boxes */}
        <View style={styles.agendaSectionsContainer}>
        {/* Banner 1: Club Name and District Info */}
        <View style={[styles.agendaSectionCard, styles.clubInfoBanner, { backgroundColor: meeting.club_info_banner_color || '#0ea5e9', borderWidth: 0, marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
          <View style={styles.bannerContent}>
            <Text style={styles.clubName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.2}>{clubInfo?.club_name || 'Club Name'}</Text>

            <View style={styles.clubMetaRow}>
              {clubInfo?.district && (
                <Text style={styles.clubMetaText} maxFontSizeMultiplier={1.2}>District {clubInfo.district}</Text>
              )}
              {clubInfo?.division && (
                <>
                  <Text style={styles.clubMetaSeparator} maxFontSizeMultiplier={1.2}>|</Text>
                  <Text style={styles.clubMetaText} maxFontSizeMultiplier={1.2}>Division {clubInfo.division}</Text>
                </>
              )}
              {clubInfo?.area && (
                <>
                  <Text style={styles.clubMetaSeparator} maxFontSizeMultiplier={1.2}>|</Text>
                  <Text style={styles.clubMetaText} maxFontSizeMultiplier={1.2}>Area {clubInfo.area}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Banner 2: Date and Time */}
        <View style={[styles.agendaSectionCard, styles.dateTimeBanner, { backgroundColor: meeting.datetime_banner_color || '#f97316', borderWidth: 0, marginBottom: 12, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          <View style={styles.bannerChips}>
            <Calendar size={11} color="#ffffff" />
            <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>{formatDateShort(meeting.meeting_date)}</Text>
            <Text style={styles.bannerSeparator} maxFontSizeMultiplier={1.2}>|</Text>
            <Clock size={11} color="#ffffff" />
            <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>
              {formatTimeShort(meeting.meeting_start_time)} - {formatTimeShort(meeting.meeting_end_time)}
            </Text>
            <Text style={styles.bannerSeparator} maxFontSizeMultiplier={1.2}>|</Text>
            <Users size={11} color="#ffffff" />
            <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>
              Meeting {meeting.meeting_number}
            </Text>
          </View>
        </View>

        {/* Agenda Items or Empty State */}
        {agendaItems.length === 0 ? (
          <View style={[styles.agendaSectionCard, styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Sparkles size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              🎭 Your VPE is busy crafting the agenda magic!
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Watch this space — greatness loading… ⏳✨
            </Text>
          </View>
        ) : (
          <>
            {/* Agenda Items - each as separate card */}
            {agendaItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.agendaSectionCard,
                  styles.agendaItemRow,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                ]}
              >
                <View style={styles.agendaItemHeader}>
                  <View style={styles.agendaItemTitleRow}>
                    {item.section_name.toLowerCase().includes('tag team') ? (
                      <View style={[styles.tagTeamHeaderIconWrap, { backgroundColor: '#f59e0b20' }]}>
                        <Users size={16} color="#f59e0b" />
                      </View>
                    ) : (item.section_icon || (item.section_name || '').toLowerCase().includes('speech evaluation') || (item.section_name || '').toLowerCase().includes('general evaluator feedback') ? (
                      <Text style={styles.sectionIcon} maxFontSizeMultiplier={1.3}>{item.section_icon || ((item.section_name || '').toLowerCase().includes('general evaluator feedback') ? '💬' : '📋')}</Text>
                    ) : (
                      <View style={styles.sectionIconPlaceholder} />
                    ))}
                    <View style={styles.titleWithTagsContainer}>
                      <Text style={[styles.agendaItemTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {(item.section_name || '').toLowerCase().includes('prepared speech')
                          ? (item.section_name || '').replace(/\s+Session$/i, '')
                          : (item.section_name || '').replace(/^Speech Evaluation Session$/i, 'Speech Evaluation')}
                      </Text>
                      {getSectionTypeTag(item) && !item.section_name.toLowerCase().includes('educational speaker') && (
                        <View style={[styles.sectionTypeTagSmall, {
                          backgroundColor: getSectionTypeTag(item)!.bgColor,
                          borderColor: getSectionTypeTag(item)!.color
                        }]}>
                          <Text style={[styles.sectionTypeTagSmallText, {
                            color: getSectionTypeTag(item)!.color
                          }]} maxFontSizeMultiplier={1.3}>
                            {getSectionTypeTag(item)!.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {item.start_time && item.end_time && item.section_name !== 'Grammarian Corner' && item.section_name !== 'Daily Highlights' && (
                    <Text style={[styles.agendaItemTimeRight, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatTime(item.start_time)} – {formatTime(item.end_time)}
                    </Text>
                  )}
                </View>

                {(item.custom_notes || item.section_description) && item.section_name !== 'Grammarian Corner' && item.section_name !== 'Daily Highlights' && (
                  <Text style={[styles.agendaItemDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {(() => {
                      const desc = (item.custom_notes || item.section_description) || '';
                      const s = (item.section_name || '').toLowerCase();
                      const isReport = s.includes('timer report') || s.includes('ah counter report') || s.includes('grammarian report');
                      const isGeFeedback = s.includes('general evaluator feedback');
                      if (!isReport && !isGeFeedback) return desc;
                      const tagTeam = agendaItems.find((i: AgendaItem) => (i.section_name || '').toLowerCase().includes('tag team'));
                      const name = isGeFeedback
                        ? item.assigned_user_name
                        : (item.assigned_user_name
                          || (s.includes('timer report') ? (tagTeam as any)?.timer_name : null)
                          || (s.includes('ah counter report') ? (tagTeam as any)?.ah_counter_name : null)
                          || (s.includes('grammarian report') ? (tagTeam as any)?.grammarian_name : null));
                      if (!name) return desc;
                      return desc
                        .replace(/^Timer\s+will/, `Timer ${name} will`)
                        .replace(/^Ah Counter\s+will/, `Ah Counter ${name} will`)
                        .replace(/^Grammarian\s+will/, `Grammarian ${name} will`)
                        .replace(/^General Evaluator\s+provides/, `General Evaluator ${name} provides`);
                    })()}
                  </Text>
                )}

                {(() => {
                  const s = (item.section_name || '').toLowerCase();
                  const isTimer = s.includes('timer report');
                  const isAhCounter = s.includes('ah counter report');
                  const isGrammarian = s.includes('grammarian report');
                  const isGeFeedback = s.includes('general evaluator feedback');
                  if (!isTimer && !isAhCounter && !isGrammarian && !isGeFeedback) return null;
                  const tagTeam = agendaItems.find((i: AgendaItem) => (i.section_name || '').toLowerCase().includes('tag team')) as any;
                  const profile = isGeFeedback
                    ? { name: item.assigned_user_name, id: item.assigned_user_id, avatar: item.assigned_user_avatar }
                    : isTimer ? { name: tagTeam?.timer_name, id: tagTeam?.timer_id, avatar: tagTeam?.timer_avatar }
                    : isAhCounter ? { name: tagTeam?.ah_counter_name, id: tagTeam?.ah_counter_id, avatar: tagTeam?.ah_counter_avatar }
                    : { name: tagTeam?.grammarian_name, id: tagTeam?.grammarian_id, avatar: tagTeam?.grammarian_avatar };
                  return (
                    <View style={styles.profileCardContainer}>
                      <TouchableOpacity
                        style={styles.profileCard}
                        onPress={() => profile?.id && router.push(`/member-profile?memberId=${profile.id}`)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.profileAvatarBox}>
                          {profile?.avatar ? (
                            <Image source={{ uri: profile.avatar }} style={styles.profileAvatar} />
                          ) : (
                            <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                              <Text style={[styles.profileAvatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                                {(profile?.name || 'T').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.profileInfo}>
                          <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {profile?.name || 'TBA'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {item.section_name.toLowerCase().includes('toastmaster of the day') && (
                  <>
                  <View style={[styles.agendaItemDivider, { backgroundColor: theme.colors.border }]} />
                  <TouchableOpacity
                    style={styles.themeSection}
                    onPress={() => router.push(`/toastmaster-corner?meetingId=${meetingId}`)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.themeSectionHeader}>
                      <Text style={styles.themeIcon} maxFontSizeMultiplier={1.3}>🎯</Text>
                      <Text style={[styles.themeSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Theme of the Day
                      </Text>
                    </View>
                    <View style={[styles.themeBox, {
                      backgroundColor: theme.dark ? 'rgba(147, 197, 253, 0.15)' : 'rgba(224, 242, 254, 1)'
                    }]}>
                      <Text style={[styles.themeText, {
                        color: theme.dark ? '#93c5fd' : '#1e40af'
                      }]} maxFontSizeMultiplier={1.3}>
                        {item.theme_of_the_day || 'TBA'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  </>
                )}

                {item.section_name.toLowerCase().includes('educational speaker') && (
                  <>
                  <View style={[styles.agendaItemDivider, { backgroundColor: theme.colors.border }]} />
                  <View style={styles.themeSection}>
                    <View style={styles.themeSectionHeader}>
                      <Text style={styles.themeIcon} maxFontSizeMultiplier={1.3}>🎓</Text>
                      <Text style={[styles.themeSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Title
                      </Text>
                    </View>
                    <View style={[styles.themeBox, {
                      backgroundColor: theme.dark ? 'rgba(147, 197, 253, 0.15)' : 'rgba(224, 242, 254, 1)'
                    }]}>
                      <Text style={[styles.themeText, {
                        color: theme.dark ? '#93c5fd' : '#1e40af'
                      }]} maxFontSizeMultiplier={1.3}>
                        {item.educational_topic || 'TBA'}
                      </Text>
                    </View>

                    {item.assigned_user_name && (
                      <View style={styles.profileCardContainer}>
                        <TouchableOpacity
                          style={styles.profileCard}
                          onPress={() => item.assigned_user_id && router.push(`/member-profile?memberId=${item.assigned_user_id}`)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.profileAvatarBox}>
                            {item.assigned_user_avatar ? (
                              <Image
                                source={{ uri: item.assigned_user_avatar }}
                                style={styles.profileAvatar}
                              />
                            ) : (
                              <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Text style={[styles.profileAvatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                                  {item.assigned_user_name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {item.assigned_user_name}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  </>
                )}

                {item.section_name.toLowerCase().includes('keynote speaker') && (
                  <>
                  <View style={[styles.agendaItemDivider, { backgroundColor: theme.colors.border }]} />
                  <TouchableOpacity
                    style={styles.themeSection}
                    onPress={() => router.push(`/keynote-speaker-corner?meetingId=${meetingId}`)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.themeSectionHeader}>
                      <Text style={styles.themeIcon} maxFontSizeMultiplier={1.3}>🎤</Text>
                      <Text style={[styles.themeSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Keynote Title
                      </Text>
                    </View>
                    <View style={[styles.themeBox, {
                      backgroundColor: theme.dark ? 'rgba(147, 197, 253, 0.15)' : 'rgba(224, 242, 254, 1)'
                    }]}>
                      <Text style={[styles.themeText, {
                        color: theme.dark ? '#93c5fd' : '#1e40af'
                      }]} maxFontSizeMultiplier={1.3}>
                        {(item.role_details?.speech_title || '').toString().trim() || 'TBA'}
                      </Text>
                    </View>

                    {item.assigned_user_name && (
                      <View style={styles.profileCardContainer}>
                        <TouchableOpacity
                          style={styles.profileCard}
                          onPress={() => item.assigned_user_id && router.push(`/member-profile?memberId=${item.assigned_user_id}`)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.profileAvatarBox}>
                            {item.assigned_user_avatar ? (
                              <Image
                                source={{ uri: item.assigned_user_avatar }}
                                style={styles.profileAvatar}
                              />
                            ) : (
                              <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Text style={[styles.profileAvatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                                  {item.assigned_user_name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {item.assigned_user_name}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                  </>
                )}

                {item.section_name.toLowerCase().includes('speech evaluation') && (() => {
                  const preparedItem = agendaItems.find((i: AgendaItem) => (i.section_name || '').toLowerCase().includes('prepared speech'));
                  const speechEvalSpeakers = preparedItem ? preparedSpeakersListForDisplay(preparedItem) : [];
                  return speechEvalSpeakers.length > 0 && (
                  <>
                  <View style={[styles.agendaItemDivider, { backgroundColor: theme.colors.border }]} />
                  {speechEvalSpeakers.map((speaker, idx) => (
                    <View key={speaker.id}>
                    {idx > 0 && <View style={[styles.agendaItemDivider, { backgroundColor: theme.colors.border, marginVertical: 6 }]} />}
                    <View style={styles.themeSection}>
                      <View style={styles.themeSectionHeader}>
                        <Text style={styles.themeIcon} maxFontSizeMultiplier={1.3}>📋</Text>
                        <Text style={[styles.themeSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Speech Title
                        </Text>
                      </View>
                      <View style={[styles.themeBox, {
                        backgroundColor: theme.dark ? 'rgba(147, 197, 253, 0.15)' : 'rgba(224, 242, 254, 1)'
                      }]}>
                        <Text style={[styles.themeText, {
                          color: theme.dark ? '#93c5fd' : '#1e40af'
                        }]} maxFontSizeMultiplier={1.3}>
                          {(speaker.speech_title || '').trim() || 'TBA'}
                        </Text>
                      </View>
                      <View style={styles.speechEvalMetaRow}>
                        <TouchableOpacity
                          style={styles.speechEvalMetaItem}
                          onPress={() => speaker.speaker_id && router.push(`/member-profile?memberId=${speaker.speaker_id}`)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.speechEvalMetaLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speaker</Text>
                          <Text style={[styles.speechEvalMetaValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{speaker.speaker_name}</Text>
                        </TouchableOpacity>
                        <View style={[styles.speechEvalMetaDivider, { backgroundColor: theme.colors.border }]} />
                        <TouchableOpacity
                          style={styles.speechEvalMetaItem}
                          onPress={() => speaker.evaluator_id && router.push(`/member-profile?memberId=${speaker.evaluator_id}`)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.speechEvalMetaLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                          <Text style={[styles.speechEvalMetaValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{speaker.evaluator_name || 'TBA'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    </View>
                  ))}
                  </>
                  );
                })()}

                {item.section_name.toLowerCase().includes('prepared speech') && preparedSpeakersListForDisplay(item).length > 0 ? (
                  <View style={styles.preparedSpeakersContainer}>
                    {preparedSpeakersListForDisplay(item).map((speaker, index) => (
                      <View
                        key={speaker.id}
                        style={[styles.newSpeakerCard, {
                          backgroundColor: '#ffffff',
                          shadowColor: theme.dark ? 'transparent' : '#000',
                        }]}
                      >
                        {/* Speaker & Evaluator - same row with center divider */}
                        <View style={styles.newSpeakerEvaluatorRow}>
                          <TouchableOpacity
                            style={[styles.newSpeakerSection, styles.newSpeakerEvaluatorHalf]}
                            onPress={() => speaker.speaker_id && router.push(`/member-profile?memberId=${speaker.speaker_id}`)}
                            activeOpacity={0.7}
                          >
                            {speaker.speaker_avatar ? (
                              <Image source={{ uri: speaker.speaker_avatar }} style={styles.newSpeakerAvatar} />
                            ) : (
                              <View style={[styles.newSpeakerAvatarPlaceholder, { backgroundColor: '#C7D2FE' }]}>
                                <Text style={[styles.newSpeakerAvatarText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>
                                  {speaker.speaker_name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={styles.newSpeakerTextContainer}>
                              <Text style={styles.newSpeakerName} maxFontSizeMultiplier={1.3}>{speaker.speaker_name}</Text>
                              <Text style={styles.newSpeakerLabel} maxFontSizeMultiplier={1.3}>Speaker</Text>
                            </View>
                          </TouchableOpacity>
                          <View style={[styles.newSpeakerEvaluatorDivider, { backgroundColor: theme.colors.border }]} />
                          <TouchableOpacity
                            style={[styles.newEvaluatorContent, styles.newSpeakerEvaluatorHalf]}
                            onPress={() => speaker.evaluator_id && router.push(`/member-profile?memberId=${speaker.evaluator_id}`)}
                            activeOpacity={0.7}
                          >
                            {speaker.evaluator_name ? (
                              <>
                                {speaker.evaluator_avatar ? (
                                  <Image source={{ uri: speaker.evaluator_avatar }} style={styles.newEvaluatorAvatar} />
                                ) : (
                                  <View style={[styles.newEvaluatorAvatarPlaceholder, { backgroundColor: '#C7D2FE' }]}>
                                    <Text style={[styles.newEvaluatorAvatarText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>
                                      {speaker.evaluator_name.charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                <View style={styles.newEvaluatorTextContainer}>
                                  <Text style={styles.newEvaluatorName} maxFontSizeMultiplier={1.3}>{speaker.evaluator_name}</Text>
                                  <Text style={styles.newEvaluatorLabel} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                                </View>
                              </>
                            ) : (
                              <View style={styles.newEvaluatorTextContainer}>
                                <Text style={[styles.newEvaluatorName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>TBA</Text>
                                <Text style={styles.newEvaluatorLabel} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* Speech Details Section (includes Speech title above Pathway) */}
                        <View style={[styles.newDivider, { marginVertical: 4 }]} />
                        <View style={styles.newSpeechDetailsSection}>
                          {speaker.speech_title && (
                            <View style={styles.newDetailRow}>
                              <FileText size={14} color="#6366F1" />
                              <Text style={styles.newDetailText} maxFontSizeMultiplier={1.3}>
                                <Text style={styles.newSpeechTitleLabel}>Speech title: </Text>
                                <Text style={styles.newSpeechTitleInline}>{speaker.speech_title}</Text>
                              </Text>
                            </View>
                          )}
                          {speaker.pathway_name && (
                            <View style={styles.newDetailRow}>
                              <Compass size={14} color="#6366F1" />
                              <Text style={styles.newDetailText} maxFontSizeMultiplier={1.3}>Pathway: {speaker.pathway_name}</Text>
                            </View>
                          )}
                          {speaker.project_title && (
                            <View style={styles.newDetailRow}>
                              <FileText size={14} color="#6366F1" />
                              <Text style={styles.newDetailText} maxFontSizeMultiplier={1.3}>Project: {speaker.project_title}</Text>
                            </View>
                          )}
                        </View>

                        {/* Level & Project Status */}
                        {speaker.pathway_level && (
                          <View style={styles.newStatusContainer}>
                            <View style={styles.newStatusItem}>
                              <CheckCircle2 size={14} color="#6366F1" fill="#6366F1" />
                              <Text style={styles.newStatusText} maxFontSizeMultiplier={1.3}>Level {speaker.pathway_level}</Text>
                            </View>
                            {speaker.project_number && (
                              <View style={styles.newStatusItem}>
                                <CheckCircle2 size={14} color="#6366F1" fill="#6366F1" />
                                <Text style={styles.newStatusText} maxFontSizeMultiplier={1.3}>Project {speaker.project_number}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Evaluation Form Button */}
                        {(speaker.pathway_name || speaker.project_title) && speaker.evaluation_form && (
                          <TouchableOpacity
                            style={[styles.evaluationFormButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => {
                              handleViewEvaluationForm(speaker.evaluation_form!);
                            }}
                            activeOpacity={0.7}
                          >
                            <FileText size={14} color="#FFFFFF" />
                            <Text style={styles.evaluationFormButtonText} maxFontSizeMultiplier={1.3}>
                              Evaluation Form - Open
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                ) : item.section_name.toLowerCase().includes('prepared speech') &&
                  usesPreparedSpeechesAgendaSnapshot(item) ? (
                  <View style={[styles.profileCard, { paddingVertical: 12 }]}>
                    <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', flex: 1 }} maxFontSizeMultiplier={1.3}>
                      Prepared speech slots are on the agenda, but none are set visible yet. Check back later.
                    </Text>
                  </View>
                ) : item.section_name.toLowerCase().includes('prepared speech') ? (
                  <View style={styles.profileCardContainer}>
                    <View style={styles.profileCard}>
                      <View style={styles.profileAvatarBox}>
                        <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                          <Text style={[styles.profileAvatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                            T
                          </Text>
                        </View>
                      </View>
                      <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {getRoleName(item) ? (
                            <>
                              <Text style={{ color: theme.colors.textSecondary }} maxFontSizeMultiplier={1.3}>Assigned {getRoleName(item)} : </Text>
                              TBA
                            </>
                          ) : (
                            'TBA'
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : item.ice_breakers && item.ice_breakers.length > 0 ? (
                  <View style={styles.preparedSpeakersContainer}>
                    {item.ice_breakers.map((speaker: any, index: number) => (
                      <View
                        key={speaker.id}
                        style={[styles.newSpeakerCard, {
                          backgroundColor: '#ffffff',
                          shadowColor: theme.dark ? 'transparent' : '#000',
                        }]}
                      >
                        <View style={styles.newSpeakerEvaluatorRow}>
                          <TouchableOpacity
                            style={[styles.newSpeakerSection, styles.newSpeakerEvaluatorHalf]}
                            onPress={() => speaker.speaker_id && router.push(`/member-profile?memberId=${speaker.speaker_id}`)}
                            activeOpacity={0.7}
                          >
                            {speaker.speaker_avatar ? (
                              <Image source={{ uri: speaker.speaker_avatar }} style={styles.newSpeakerAvatar} />
                            ) : (
                              <View style={[styles.newSpeakerAvatarPlaceholder, { backgroundColor: '#D1FAE5' }]}>
                                <Text style={[styles.newSpeakerAvatarText, { color: '#059669' }]} maxFontSizeMultiplier={1.3}>
                                  {speaker.speaker_name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={styles.newSpeakerTextContainer}>
                              <Text style={styles.newSpeakerName} maxFontSizeMultiplier={1.3}>{speaker.speaker_name}</Text>
                              <Text style={styles.newSpeakerLabel} maxFontSizeMultiplier={1.3}>Speaker</Text>
                            </View>
                          </TouchableOpacity>
                          <View style={[styles.newSpeakerEvaluatorDivider, { backgroundColor: theme.colors.border }]} />
                          <TouchableOpacity
                            style={[styles.newEvaluatorContent, styles.newSpeakerEvaluatorHalf]}
                            onPress={() => speaker.evaluator_id && router.push(`/member-profile?memberId=${speaker.evaluator_id}`)}
                            activeOpacity={0.7}
                          >
                            {speaker.evaluator_name ? (
                              <>
                                {speaker.evaluator_avatar ? (
                                  <Image source={{ uri: speaker.evaluator_avatar }} style={styles.newEvaluatorAvatar} />
                                ) : (
                                  <View style={[styles.newEvaluatorAvatarPlaceholder, { backgroundColor: '#D1FAE5' }]}>
                                    <Text style={[styles.newEvaluatorAvatarText, { color: '#059669' }]} maxFontSizeMultiplier={1.3}>
                                      {speaker.evaluator_name.charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                <View style={styles.newEvaluatorTextContainer}>
                                  <Text style={styles.newEvaluatorName} maxFontSizeMultiplier={1.3}>{speaker.evaluator_name}</Text>
                                  <Text style={styles.newEvaluatorLabel} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                                </View>
                              </>
                            ) : (
                              <View style={styles.newEvaluatorTextContainer}>
                                <Text style={[styles.newEvaluatorName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>TBA</Text>
                                <Text style={styles.newEvaluatorLabel} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>

                        <View style={[styles.newDivider, { marginVertical: 4 }]} />
                        <View style={styles.newSpeechDetailsSection}>
                          {speaker.speech_title && (
                            <View style={styles.newDetailRow}>
                              <FileText size={14} color="#6366F1" />
                              <Text style={styles.newDetailText} maxFontSizeMultiplier={1.3}>
                                <Text style={styles.newSpeechTitleLabel}>Speech title: </Text>
                                <Text style={styles.newSpeechTitleInline}>{speaker.speech_title}</Text>
                              </Text>
                            </View>
                          )}
                          {speaker.pathway_name && (
                            <View style={styles.newDetailRow}>
                              <Compass size={14} color="#6366F1" />
                              <Text style={styles.newDetailText} maxFontSizeMultiplier={1.3}>Pathway: {speaker.pathway_name}</Text>
                            </View>
                          )}
                          {speaker.project_title && (
                            <View style={styles.newDetailRow}>
                              <FileText size={14} color="#6366F1" />
                              <Text style={styles.newDetailText} maxFontSizeMultiplier={1.3}>Project: {speaker.project_title}</Text>
                            </View>
                          )}
                        </View>

                        {speaker.pathway_level && (
                          <View style={styles.newStatusContainer}>
                            <View style={styles.newStatusItem}>
                              <CheckCircle2 size={14} color="#6366F1" fill="#6366F1" />
                              <Text style={styles.newStatusText} maxFontSizeMultiplier={1.3}>Level {speaker.pathway_level}</Text>
                            </View>
                            {speaker.project_number && (
                              <View style={styles.newStatusItem}>
                                <CheckCircle2 size={14} color="#6366F1" fill="#6366F1" />
                                <Text style={styles.newStatusText} maxFontSizeMultiplier={1.3}>Project {speaker.project_number}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {(speaker.pathway_name || speaker.project_title) && speaker.evaluation_form && (
                          <TouchableOpacity
                            style={[styles.evaluationFormButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => {
                              handleViewEvaluationForm(speaker.evaluation_form!);
                            }}
                            activeOpacity={0.7}
                          >
                            <FileText size={14} color="#FFFFFF" />
                            <Text style={styles.evaluationFormButtonText} maxFontSizeMultiplier={1.3}>
                              Evaluation Form - Open
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                ) : item.section_name.toLowerCase().includes('ice breaker') ? (
                  <View style={styles.profileCardContainer}>
                    <View style={styles.profileCard}>
                      <View style={styles.profileAvatarBox}>
                        <View style={[styles.profileAvatarPlaceholder, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.profileAvatarText, { color: '#059669' }]} maxFontSizeMultiplier={1.3}>
                            T
                          </Text>
                        </View>
                      </View>
                      <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          TBA
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : item.section_name.toLowerCase().includes('tag team') ? (
                  <View style={styles.tagTeamRolesContainer}>
                    <View style={[styles.tagTeamHeaderDivider, { backgroundColor: theme.colors.border }]} />
                    {[
                      { name: 'Timer', Icon: Timer, color: '#0ea5e9', userName: item.timer_name, userId: item.timer_id, userAvatar: item.timer_avatar, isVisible: item.timer_visible ?? true },
                      { name: 'Ah Counter', Icon: PenLine, color: '#10b981', userName: item.ah_counter_name, userId: item.ah_counter_id, userAvatar: item.ah_counter_avatar, isVisible: item.ah_counter_visible ?? true },
                      { name: 'Grammarian', Icon: BookOpen, color: '#8b5cf6', userName: item.grammarian_name, userId: item.grammarian_id, userAvatar: item.grammarian_avatar, isVisible: item.grammarian_visible ?? true }
                    ].filter(role => role.isVisible).map((role, index, visibleRoles) => (
                      <View key={role.name}>
                        <View style={styles.tagTeamRoleRow}>
                          <View style={styles.tagTeamRoleLeft}>
                            <View style={[styles.tagTeamRoleIconWrap, { backgroundColor: role.color + '20' }]}>
                              <role.Icon size={18} color={role.color} />
                            </View>
                            <Text style={[styles.tagTeamRoleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                              {role.name}
                            </Text>
                          </View>
                          {role.userName ? (
                            <TouchableOpacity
                              style={styles.tagTeamAssignedUser}
                              onPress={() => role.userId && router.push(`/member-profile?memberId=${role.userId}`)}
                              activeOpacity={0.7}
                            >
                              {role.userAvatar ? (
                                <Image source={{ uri: role.userAvatar }} style={styles.tagTeamUserAvatar} />
                              ) : (
                                <View style={[styles.tagTeamUserAvatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                                  <Text style={[styles.tagTeamUserAvatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                                    {role.userName.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <Text style={[styles.tagTeamUserName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                                {role.userName}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.tagTeamAssignedUser}>
                              <View style={[styles.tagTeamUserAvatarPlaceholder, { backgroundColor: theme.colors.border }]}>
                                <Text style={[styles.tagTeamUserAvatarText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  ?
                                </Text>
                              </View>
                              <Text style={[styles.tagTeamUserName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                                Yet to be assigned
                              </Text>
                            </View>
                          )}
                        </View>
                        {index < visibleRoles.length - 1 && (
                          <View style={[styles.tagTeamRowDivider, { backgroundColor: theme.colors.border }]} />
                        )}
                      </View>
                    ))}
                  </View>
                ) : (item.section_name === 'Daily Highlights' || item.section_name === 'Grammarian Corner') ? (
                  <View style={styles.grammarianCornerMainContainer}>
                    {item.daily_highlights ? (
                      <View style={styles.grammarianCardsGrid}>
                        {item.daily_highlights.word_of_the_day && (
                          <TouchableOpacity
                            style={[styles.grammarianCornerNewCard, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.border }]}
                            onPress={() => router.push(`/grammarian?meetingId=${meetingId}`)}
                            activeOpacity={0.75}
                          >
                            <View style={styles.grammarianCornerCardHeader}>
                              <View style={styles.grammarianCornerCardTitleRow}>
                                <Text style={styles.grammarianCornerCardIcon} maxFontSizeMultiplier={1.3}>📖</Text>
                                <Text style={[styles.grammarianCornerCardTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  WORD OF THE DAY
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.grammarianCornerContentText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {item.daily_highlights.word_of_the_day.word}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {item.daily_highlights.quote_of_the_day && (
                          <TouchableOpacity
                            style={[styles.grammarianCornerNewCard, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.border }]}
                            onPress={() => router.push(`/grammarian?meetingId=${meetingId}`)}
                            activeOpacity={0.75}
                          >
                            <View style={styles.grammarianCornerCardHeader}>
                              <View style={styles.grammarianCornerCardTitleRow}>
                                <Text style={styles.grammarianCornerCardIcon} maxFontSizeMultiplier={1.3}>💭</Text>
                                <Text style={[styles.grammarianCornerCardTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  QUOTE OF THE DAY
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.grammarianCornerContentText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              "{item.daily_highlights.quote_of_the_day.quote}"
                            </Text>
                          </TouchableOpacity>
                        )}

                        {item.daily_highlights.idiom_of_the_day && (
                          <TouchableOpacity
                            style={[styles.grammarianCornerNewCard, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.border }]}
                            onPress={() => router.push(`/grammarian?meetingId=${meetingId}`)}
                            activeOpacity={0.75}
                          >
                            <View style={styles.grammarianCornerCardHeader}>
                              <View style={styles.grammarianCornerCardTitleRow}>
                                <Text style={styles.grammarianCornerCardIcon} maxFontSizeMultiplier={1.3}>🎯</Text>
                                <Text style={[styles.grammarianCornerCardTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  IDIOM OF THE DAY
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.grammarianCornerContentText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              "{item.daily_highlights.idiom_of_the_day.idiom}"
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <Text style={[styles.grammarianCornerBannerSubtitle, { color: theme.colors.textSecondary, paddingHorizontal: 4 }]} maxFontSizeMultiplier={1.3}>
                        Word, Quote, and Idiom of the Day will appear here once published by the Grammarian.
                      </Text>
                    )}
                  </View>
                ) : item.is_role_based && !item.section_name.toLowerCase().includes('educational speaker') && !item.section_name.toLowerCase().includes('keynote speaker') && !item.section_name.toLowerCase().includes('timer report') && !item.section_name.toLowerCase().includes('ah counter report') && !item.section_name.toLowerCase().includes('grammarian report') && !item.section_name.toLowerCase().includes('general evaluator feedback') && !item.section_name.toLowerCase().includes('voting') && !item.section_name.toLowerCase().includes('awards') && !item.section_name.toLowerCase().includes('tag team') && !item.section_name.toLowerCase().includes('speech evaluation') && !item.section_name.toLowerCase().includes('daily highlights') && !item.section_name.toLowerCase().includes('grammarian corner') && (
                  <View style={styles.profileCardContainer}>
                    <TouchableOpacity
                      style={styles.profileCard}
                      onPress={() => item.assigned_user_id && router.push(`/member-profile?memberId=${item.assigned_user_id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.profileAvatarBox}>
                        {item.assigned_user_avatar ? (
                          <Image
                            source={{ uri: item.assigned_user_avatar }}
                            style={styles.profileAvatar}
                          />
                        ) : (
                          <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                            <Text style={[styles.profileAvatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              {item.assigned_user_name ? item.assigned_user_name.charAt(0).toUpperCase() : 'T'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {getRoleName(item) ? (
                            <>
                              <Text style={{ color: theme.colors.textSecondary }} maxFontSizeMultiplier={1.3}>Assigned {getRoleName(item)} : </Text>
                              {item.assigned_user_name || 'TBA'}
                            </>
                          ) : (
                            item.assigned_user_name || 'TBA'
                          )}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {item.role_details && !item.section_name.toLowerCase().includes('educational speaker') && !item.section_name.toLowerCase().includes('keynote speaker') && (
                  <View style={styles.roleDetailsContainer}>
                    {item.role_details.speech_title && (
                      <View style={styles.roleDetail}>
                        <Text style={[styles.roleDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Speech Title:
                        </Text>
                        <Text style={[styles.roleDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          "{item.role_details.speech_title}"
                        </Text>
                      </View>
                    )}
                    {item.role_details.pathway_name && (
                      <View style={styles.roleDetail}>
                        <Text style={[styles.roleDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Pathway:
                        </Text>
                        <Text style={[styles.roleDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {item.role_details.pathway_name}
                        </Text>
                      </View>
                    )}
                    {item.role_details.pathway_level && (
                      <View style={styles.roleDetail}>
                        <Text style={[styles.roleDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Level/Project:
                        </Text>
                        <Text style={[styles.roleDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Level {item.role_details.pathway_level}
                        </Text>
                      </View>
                    )}
                    {item.role_details.project_title && (
                      <View style={styles.roleDetail}>
                        <Text style={[styles.roleDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Project:
                        </Text>
                        <Text style={[styles.roleDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {item.role_details.project_title}
                        </Text>
                      </View>
                    )}
                    {item.role_details.table_topic_question && (
                      <View style={styles.roleDetail}>
                        <Text style={[styles.roleDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Question:
                        </Text>
                        <Text style={[styles.roleDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {item.role_details.table_topic_question}
                        </Text>
                      </View>
                    )}
                    {(item.duration_minutes != null && item.duration_minutes > 0) && item.section_name !== 'Grammarian Corner' && item.section_name !== 'Daily Highlights' && (
                      <View style={styles.roleDetail}>
                        <Text style={[styles.roleDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Duration:
                        </Text>
                        <Text style={[styles.roleDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {item.duration_minutes} minutes
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}

            {/* Footer Banners */}
            <View style={styles.footerBannersContainer}>
              {/* First Banner: Meeting Venue */}
              <View style={[styles.footerBanner1, { backgroundColor: meeting.footer_banner_1_color || '#004165' }]}>
                <View style={styles.footerBannerContent}>
                  <View style={styles.footerSection}>
                    <View style={styles.footerSectionHeader}>
                      <MapPin size={18} color="#ffffff" />
                      <Text style={styles.footerSectionTitle} maxFontSizeMultiplier={1.3}>Meeting Venue</Text>
                    </View>
                    {meeting.meeting_mode === 'online' ? (
                      <>
                        <Text style={styles.footerText} maxFontSizeMultiplier={1.3}>Online</Text>
                        {meeting.meeting_link && (
                          <Text style={styles.footerTextSmall} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                            {meeting.meeting_link}
                          </Text>
                        )}
                      </>
                    ) : meeting.meeting_mode === 'hybrid' ? (
                      <>
                        <Text style={styles.footerText} maxFontSizeMultiplier={1.3}>
                          {meeting.meeting_location || 'Location TBA'}
                        </Text>
                        {meeting.meeting_link && (
                          <Text style={styles.footerTextSmall} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                            {meeting.meeting_link}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.footerText} maxFontSizeMultiplier={1.3}>
                        {meeting.meeting_location || 'Location TBA'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Copyright Banner */}
              <View style={[styles.copyrightBanner, { backgroundColor: meeting.footer_banner_2_color || '#772432' }]}>
                <Text style={styles.copyrightText} maxFontSizeMultiplier={1.3}>
                  © 2026 {clubInfo?.club_name || 'Your Club'}
                </Text>
              </View>
            </View>
          </>
        )}
        </View>
        </View>
      </ScrollView>

      {/* Export Progress Overlay */}
      {isExporting && (
        <View style={styles.exportOverlay}>
          <View style={[styles.exportModal, { backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.exportText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Exporting agenda to PDF...
            </Text>
            <Text style={[styles.exportProgress, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {Math.round(exportProgress)}%
            </Text>
          </View>
        </View>
      )}
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
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  hiddenAgendaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  chefEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  hiddenAgendaTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  hiddenAgendaMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  clubInfoBanner: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
    paddingVertical: 20,
  },
  dateTimeBanner: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
    paddingVertical: 16,
  },
  bannerContent: {
    gap: 6,
    alignItems: 'center',
  },
  clubName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
    flexShrink: 1,
  },
  clubMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  clubMetaText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  clubMetaSeparator: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 8,
  },
  bannerChips: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerChipText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  bannerSeparator: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  agendaSectionsContainer: {
    marginHorizontal: Platform.OS === 'web' ? 16 : 20,
    marginTop: 16,
    marginBottom: 16,
  },
  agendaSectionCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  agendaItemRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  agendaItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  agendaItemTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIcon: {
    fontSize: 19,
    lineHeight: 22,
  },
  sectionIconPlaceholder: {
    width: 24,
    height: 22,
  },
  titleWithTagsContainer: {
    flex: 1,
    gap: 6,
  },
  agendaItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionTypeTagSmall: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sectionTypeTagSmallText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  agendaItemTimeRight: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0,
  },
  timeRangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  agendaItemDescription: {
    fontSize: 13,
    lineHeight: 19.5,
    marginBottom: 6,
    opacity: 0.75,
  },
  agendaItemDivider: {
    height: 1,
    marginVertical: 8,
  },
  themeSection: {
    marginBottom: 6,
    gap: 6,
  },
  themeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeIcon: {
    fontSize: 15,
  },
  themeSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeBox: {
    padding: 10,
    borderRadius: 8,
  },
  themeText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  speechEvalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  speechEvalMetaItem: {
    flex: 1,
  },
  speechEvalMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  speechEvalMetaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  speechEvalMetaDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  profileCardContainer: {
    marginTop: 10,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
    marginTop: 0,
  },
  profileAvatarBox: {
    padding: 4,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.65,
  },
  roleDetailsContainer: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  roleDetail: {
    flexDirection: 'row',
    gap: 8,
  },
  roleDetailLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  roleDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  regenerateButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  vpmFooter: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  vpmFooterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  footerBannersContainer: {
    gap: 0,
    marginTop: 0,
  },
  footerBanner1: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
    paddingVertical: 20,
  },
  footerBanner2: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
    paddingVertical: 20,
  },
  copyrightBanner: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBannerContent: {
    gap: 16,
  },
  footerSection: {
    gap: 6,
  },
  footerSeparatorLine: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 8,
    marginHorizontal: -24,
  },
  footerContactsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  footerContactSection: {
    flex: 1,
    minWidth: 140,
    gap: 6,
  },
  footerDivider: {
    fontSize: 20,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 8,
  },
  footerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  footerIcon: {
    fontSize: 16,
  },
  footerSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 18,
  },
  footerTextSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 16,
  },
  copyrightText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  preparedSpeakersContainer: {
    gap: 8,
  },
  speakerCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speakerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  speakerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  speakerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  speakerName: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  speechTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  pathwayInfoContainer: {
    gap: 6,
  },
  pathwayText: {
    fontSize: 13,
    lineHeight: 18,
  },
  levelBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  evaluatorSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  evaluatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  evaluatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  evaluatorAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  evaluatorAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  evaluatorLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  evaluatorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  grammarianExtras: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  grammarianExtraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  grammarianExtraIcon: {
    fontSize: 16,
  },
  grammarianExtraLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  grammarianExtraValue: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  educationalTopicBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  educationalTopicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  educationalTopicIcon: {
    fontSize: 20,
  },
  educationalTopicLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  educationalTopicText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  tagTeamHeaderIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagTeamRolesContainer: {
    marginTop: 4,
  },
  tagTeamHeaderDivider: {
    height: 1,
    marginBottom: 14,
  },
  tagTeamRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  tagTeamRoleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '50%',
    minWidth: 0,
  },
  tagTeamRoleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagTeamRoleName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  tagTeamAssignedUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
  },
  tagTeamUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tagTeamUserAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagTeamUserAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tagTeamUserName: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagTeamRowDivider: {
    height: 1,
  },
  // New Prepared Speech Card Styles (compact, ~50% reduced)
  newSpeakerCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  newSpeakerEvaluatorRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
  },
  newSpeakerEvaluatorHalf: {
    flex: 1,
  },
  newSpeakerEvaluatorDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
  newSpeakerSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  newSpeakerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  newSpeakerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newSpeakerAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  newSpeakerTextContainer: {
    flex: 1,
    gap: 1,
  },
  newSpeakerLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 14,
  },
  newSpeakerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  newSpeechTitleSection: {
    marginBottom: 8,
  },
  newSpeechTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 4,
  },
  newSpeechTitleLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B7280',
  },
  newSpeechTitleInline: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  newSpeechTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
    marginBottom: 6,
  },
  newDivider: {
    height: 1,
    backgroundColor: '#DDD6FE',
  },
  newSpeechDetailsSection: {
    gap: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  newDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newDetailText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#111827',
    lineHeight: 16,
  },
  newStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  newStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  newEvaluatorSection: {
    marginTop: 4,
  },
  newEvaluatorDivider: {
    height: 1,
    backgroundColor: '#DDD6FE',
    marginBottom: 8,
    marginTop: 4,
  },
  newEvaluatorContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  newEvaluatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  newEvaluatorAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newEvaluatorAvatarText: {
    fontSize: 12,
    fontWeight: '600',
  },
  newEvaluatorTextContainer: {
    flex: 1,
    gap: 1,
  },
  newEvaluatorLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 14,
  },
  newEvaluatorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  evaluationFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  evaluationFormButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  agendaContentWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        maxWidth: 800,
        marginHorizontal: 'auto',
        width: '100%',
      },
      default: {},
    }),
  },
  exportOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  exportModal: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  exportText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  exportProgress: {
    fontSize: 14,
    fontWeight: '500',
  },
  speechCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  speechCategoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dailyHighlightsContainer: {
    gap: 16,
    marginTop: 12,
  },
  dailyHighlightCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  dailyHighlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dailyHighlightIcon: {
    fontSize: 24,
  },
  dailyHighlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dailyHighlightWord: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 32,
  },
  dailyHighlightPartOfSpeech: {
    fontSize: 16,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  dailyHighlightMeaning: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  dailyHighlightUsage: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  grammarianCornerMainContainer: {
    marginTop: 6,
    gap: 8,
  },
  grammarianCornerHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  grammarianCornerBannerIcon: {
    fontSize: 32,
  },
  grammarianCornerBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  grammarianCornerBannerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  grammarianCardsGrid: {
    gap: 6,
  },
  grammarianCornerNewCard: {
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  grammarianCornerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  grammarianCornerCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  grammarianCornerCardIcon: {
    fontSize: 18,
  },
  grammarianCornerCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  grammarianCornerContentText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
