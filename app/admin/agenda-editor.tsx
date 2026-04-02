import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useMemo } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import type { PublicAgendaSkinId } from '@/lib/publicAgendaSkin';
import { normalizeStoredPublicAgendaSkin } from '@/lib/publicAgendaSkin';
import { buildAgendaWebUrl, buildShortAgendaWebUrl } from '@/lib/agendaWebLink';
import { ChevronLeft, Save, Clock, Eye, EyeOff, Trash2, UserPlus, Search, X, ChevronUp, ChevronDown, RotateCcw, FileText, Zap, PencilLine, Users2, Filter, Check, Square, ListOrdered, ExternalLink, Copy } from 'lucide-react-native';
import { useCallback } from 'react';

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
  educational_topic: string | null;
  role_details: any;
  custom_notes: string | null;
  is_visible: boolean;
  is_auto_generated: boolean;
  is_role_based: boolean;
  timer_visible?: boolean;
  ah_counter_visible?: boolean;
  grammarian_visible?: boolean;
  grammarian_corner?: GrammarianCorner;
  timer_user_id?: string | null;
  ah_counter_user_id?: string | null;
  grammarian_user_id?: string | null;
  educational_topic?: string | null;
  prepared_speeches_agenda?: PreparedSpeechAgendaSlot[] | null;
}

export type PreparedSpeechAgendaSlot = {
  slot: number;
  role_name: string;
  booked: boolean;
  pathway_id: string | null;
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
  is_visible: boolean;
};

const PREPARED_SPEAKER_ROLE_NAMES = [
  'Prepared Speaker 1',
  'Prepared Speaker 2',
  'Prepared Speaker 3',
  'Prepared Speaker 4',
  'Prepared Speaker 5',
] as const;

function parsePreparedSpeechesAgenda(raw: unknown): PreparedSpeechAgendaSlot[] {
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
      role_name: String(s.role_name ?? ''),
      booked: !!s.booked,
      pathway_id: (s.pathway_id as string) || null,
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
      is_visible: !!s.is_visible,
    }))
    .filter(s => s.slot >= 1 && s.slot <= 5)
    .sort((a, b) => a.slot - b.slot);
}

interface GrammarianCorner {
  word_of_the_day?: {
    id: string;
    word: string;
    meaning: string;
    usage: string;
    part_of_speech: string | null;
  };
  idiom_of_the_day?: {
    id: string;
    idiom: string;
    meaning: string;
    usage: string;
  };
  quote_of_the_day?: {
    id: string;
    quote: string;
    meaning: string;
    usage: string;
  };
  word_visible: boolean;
  quote_visible: boolean;
  idiom_visible: boolean;
  selected_word_id: string | null;
  selected_quote_id: string | null;
  selected_idiom_id: string | null;
  available_words: Array<{id: string; word: string}>;
  available_quotes: Array<{id: string; quote: string}>;
  available_idioms: Array<{id: string; idiom: string}>;
}

interface ClubMember {
  id: string;
  full_name: string;
}

interface PreparedSpeaker {
  id: string;
  user_id: string;
  role_name: string;
  speech_title: string | null;
  pathway_name: string | null;
  project_name: string | null;
  level: number | null;
  project_number: number | null;
  assigned_evaluator_id: string | null;
  speaker_name: string;
  evaluator_name: string | null;
  evaluation_id: string | null;
  evaluation_pdf_url: string | null;
  evaluation_form: string | null;
}

interface GESubRole {
  id: string;
  agenda_item_id: string;
  sub_role_name: string;
  sub_role_type: string;
  sub_role_order: number;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  duration_minutes: number;
  linked_role_id: string | null;
}

export default function AgendaEditor() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = params.meetingId as string;

  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const agendaItemsRef = useRef<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isRecalculatingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** After Done/Enter on this item id, blur still fires — skip duplicate debounced save. */
  const skipDurationBlurForItemRef = useRef<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [meetingStartTime, setMeetingStartTime] = useState<string | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [customName, setCustomName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [clubInfoBannerColor, setClubInfoBannerColor] = useState('#3b82f6');
  const [datetimeBannerColor, setDatetimeBannerColor] = useState('#f97316');
  const [footerBanner1Color, setFooterBanner1Color] = useState('#16a34a');
  const [footerBanner2Color, setFooterBanner2Color] = useState('#ea580c');
  const [themeOfTheDay, setThemeOfTheDay] = useState('');
  const [themeFromCornerLoading, setThemeFromCornerLoading] = useState(false);
  const [educationTitleFromCornerLoading, setEducationTitleFromCornerLoading] = useState(false);
  const [keynoteTitleFromCornerLoading, setKeynoteTitleFromCornerLoading] = useState(false);
  const [grammarianCornerAutoFillLoading, setGrammarianCornerAutoFillLoading] = useState(false);
  const [wordOfTheDay, setWordOfTheDay] = useState('');
  const [phraseOfTheDay, setPhraseOfTheDay] = useState('');
  const [idiomOfTheDay, setIdiomOfTheDay] = useState('');
  const [quoteOfTheDay, setQuoteOfTheDay] = useState('');
  const [autoFillItemId, setAutoFillItemId] = useState<string | null>(null);
  const [masterAutoFillLoading, setMasterAutoFillLoading] = useState(false);
  const [presidingOfficer, setPresidingOfficer] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [toastmasterOfTheDay, setToastmasterOfTheDay] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [toastmasterCornerTheme, setToastmasterCornerTheme] = useState<string>('');
  const [quizMaster, setQuizMaster] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [generalEvaluator, setGeneralEvaluator] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [educationalSpeaker, setEducationalSpeaker] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [educationSpeechTitle, setEducationSpeechTitle] = useState<string>('');
  const [keynoteSpeechTitle, setKeynoteSpeechTitle] = useState<string>('');
  const [timer, setTimer] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [ahCounter, setAhCounter] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [grammarian, setGrammarian] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [saaModalVisible, setSaaModalVisible] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [ahCounterModalVisible, setAhCounterModalVisible] = useState(false);
  const [grammarianModalVisible, setGrammarianModalVisible] = useState(false);
  const [isAgendaVisible, setIsAgendaVisible] = useState(true);
  const [publicAgendaSkin, setPublicAgendaSkin] = useState<PublicAgendaSkinId>('default');
  const [meetingClubIdForWeb, setMeetingClubIdForWeb] = useState<string | null>(null);
  const [meetingClubDisplayNameForWeb, setMeetingClubDisplayNameForWeb] = useState<string | null>(null);
  const [meetingNumberForWeb, setMeetingNumberForWeb] = useState<string | null>(null);
  const [publicWebLinkCopied, setPublicWebLinkCopied] = useState(false);
  const publicWebLinkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preparedSpeakers, setPreparedSpeakers] = useState<PreparedSpeaker[]>([]);
  const [preparedSpeakerRoleDefs, setPreparedSpeakerRoleDefs] = useState<
    Array<{ slot: number; role_name: string }>
  >([]);
  const [iceBreakers, setIceBreakers] = useState<PreparedSpeaker[]>([]);
  const [geSubRoles, setGeSubRoles] = useState<GESubRole[]>([]);
  const [geSubRoleModalVisible, setGeSubRoleModalVisible] = useState(false);
  const [selectedGeSubRole, setSelectedGeSubRole] = useState<GESubRole | null>(null);
  const [sectionFilter, setSectionFilter] = useState<'all' | Set<string>>('all');
  const [sectionFilterModalVisible, setSectionFilterModalVisible] = useState(false);
  const [manageSequenceModalVisible, setManageSequenceModalVisible] = useState(false);
  const [agendaEditorTab, setAgendaEditorTab] = useState<'settings' | 'sections'>('settings');

  /** Active booking only, latest row — avoids stale/cancelled duplicates. */
  const fetchLatestBookedAssignee = async (
    spec:
      | { kind: 'eq_role'; roleName: string }
      | { kind: 'ilike_role'; pattern: string }
      | { kind: 'classification'; value: string }
  ): Promise<{ userId: string; userName: string } | null> => {
    let q = supabase
      .from('app_meeting_roles_management')
      .select(`
        assigned_user_id,
        app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
      `)
      .eq('meeting_id', meetingId)
      .eq('booking_status', 'booked')
      .not('assigned_user_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (spec.kind === 'eq_role') q = q.eq('role_name', spec.roleName);
    else if (spec.kind === 'ilike_role') q = q.ilike('role_name', spec.pattern);
    else q = q.eq('role_classification', spec.value);
    const { data, error } = await q;
    if (error) {
      console.error('fetchLatestBookedAssignee:', error);
      return null;
    }
    const row = data?.[0];
    const uid = row?.assigned_user_id;
    const nm = row?.app_user_profiles?.full_name;
    if (!uid || !nm) return null;
    return { userId: uid, userName: nm };
  };

  const fetchLatestBookedUserIdByRoleName = async (roleName: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('app_meeting_roles_management')
      .select('assigned_user_id')
      .eq('meeting_id', meetingId)
      .eq('role_name', roleName)
      .eq('booking_status', 'booked')
      .not('assigned_user_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) {
      console.error('fetchLatestBookedUserIdByRoleName:', error);
      return null;
    }
    return data?.[0]?.assigned_user_id ?? null;
  };

  const agendaAssigneeInSync = (item: AgendaItem, userId: string, userName: string) => {
    const nameMatch = (item.assigned_user_name || '').trim() === (userName || '').trim();
    const idMatch = !!item.assigned_user_id && item.assigned_user_id === userId;
    return idMatch && nameMatch;
  };

  // Keep ref in sync with state
  useEffect(() => {
    agendaItemsRef.current = agendaItems;
  }, [agendaItems]);

  useEffect(() => {
    return () => {
      if (publicWebLinkCopiedTimerRef.current) {
        clearTimeout(publicWebLinkCopiedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadMeetingData();
    loadAgendaItems();
    loadClubMembers();
    loadPresidingOfficer();
    loadToastmasterOfTheDay();
    loadToastmasterCornerTheme();
    loadQuizMaster();
    loadGeneralEvaluator();
    loadEducationalSpeaker();
    loadTimer();
    loadAhCounter();
    loadGrammarian();
    loadPreparedSpeakers();
    loadPreparedSpeakerRoleDefs();
    loadIceBreakers();
    loadGeSubRoles();
  }, [meetingId]);

  // Recalculate times when data is loaded
  useEffect(() => {
    if (meetingStartTime && agendaItems.length > 0 && !loading) {
      recalculateAllTimes(agendaItems);
    }
  }, [meetingStartTime, loading]);

  useFocusEffect(
    useCallback(() => {
      loadMeetingData();
      loadPresidingOfficer();
      loadToastmasterOfTheDay();
      loadToastmasterCornerTheme();
      loadQuizMaster();
      loadGeneralEvaluator();
      loadTimer();
      loadAhCounter();
      loadGrammarian();
      loadEducationalSpeaker();
      loadPreparedSpeakers();
      loadPreparedSpeakerRoleDefs();
      loadIceBreakers();
      loadGeSubRoles();
    }, [meetingId])
  );

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          user_id,
          app_user_profiles!inner(id, full_name)
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }

      const members = data?.map((item: any) => ({
        id: item.app_user_profiles.id,
        full_name: item.app_user_profiles.full_name,
      })) || [];

      members.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const loadTimer = async () => {
    try {
      // First try to load from agenda item
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select(`
          timer_user_id,
          timer:app_user_profiles!fk_meeting_agenda_items_timer_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .ilike('section_name', '%tag%team%')
        .maybeSingle();

      if (!agendaError && agendaData?.timer_user_id) {
        setTimer({
          id: agendaData.timer_user_id,
          name: agendaData.timer?.full_name || null,
        });
        return;
      }

      // Fallback to app_meeting_roles_management
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .eq('role_name', 'Timer')
        .maybeSingle();

      if (error) {
        console.error('Error loading timer:', error);
        return;
      }

      if (data) {
        setTimer({
          id: data.assigned_user_id,
          name: data.app_user_profiles?.full_name || null,
        });
      }
    } catch (error) {
      console.error('Error loading timer:', error);
    }
  };

  const loadAhCounter = async () => {
    try {
      // First try to load from agenda item
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select(`
          ah_counter_user_id,
          ah_counter:app_user_profiles!fk_meeting_agenda_items_ah_counter_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .ilike('section_name', '%tag%team%')
        .maybeSingle();

      if (!agendaError && agendaData?.ah_counter_user_id) {
        setAhCounter({
          id: agendaData.ah_counter_user_id,
          name: agendaData.ah_counter?.full_name || null,
        });
        return;
      }

      // Fallback to app_meeting_roles_management
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .eq('role_name', 'Ah Counter')
        .maybeSingle();

      if (error) {
        console.error('Error loading ah counter:', error);
        return;
      }

      if (data) {
        setAhCounter({
          id: data.assigned_user_id,
          name: data.app_user_profiles?.full_name || null,
        });
      }
    } catch (error) {
      console.error('Error loading ah counter:', error);
    }
  };

  const loadGrammarian = async () => {
    try {
      // First try to load from agenda item
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select(`
          grammarian_user_id,
          grammarian:app_user_profiles!fk_meeting_agenda_items_grammarian_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .ilike('section_name', '%tag%team%')
        .maybeSingle();

      if (!agendaError && agendaData?.grammarian_user_id) {
        setGrammarian({
          id: agendaData.grammarian_user_id,
          name: agendaData.grammarian?.full_name || null,
        });
        return;
      }

      // Fallback to app_meeting_roles_management
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .eq('role_name', 'Grammarian')
        .maybeSingle();

      if (error) {
        console.error('Error loading grammarian:', error);
        return;
      }

      if (data) {
        setGrammarian({
          id: data.assigned_user_id,
          name: data.app_user_profiles?.full_name || null,
        });
      }
    } catch (error) {
      console.error('Error loading grammarian:', error);
    }
  };

  const loadPresidingOfficer = async () => {
    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .eq('role_name', 'Presiding Officer')
        .maybeSingle();

      if (error) {
        console.error('Error loading presiding officer:', error);
        return;
      }

      if (data) {
        setPresidingOfficer({
          id: data.assigned_user_id,
          name: data.app_user_profiles?.full_name || null,
        });
      }
    } catch (error) {
      console.error('Error loading presiding officer:', error);
    }
  };

  const loadToastmasterOfTheDay = async () => {
    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%toastmaster%')
        .maybeSingle();

      if (error) {
        console.error('Error loading toastmaster of the day:', error);
        return;
      }

      if (data) {
        setToastmasterOfTheDay({
          id: data.assigned_user_id,
          name: data.app_user_profiles?.full_name || null,
        });
      }
    } catch (error) {
      console.error('Error loading toastmaster of the day:', error);
    }
  };

  /** Same resolution as Toastmaster corner: booked TMOD row in toastmaster_meeting_data, else latest. */
  const fetchToastmasterCornerThemeValue = async (): Promise<string | null> => {
    if (!meetingId) return null;
    try {
      const tmod = await fetchLatestBookedAssignee({ kind: 'ilike_role', pattern: '%toastmaster%' });
      const tmodId = tmod?.userId ?? null;

      let q = supabase
        .from('toastmaster_meeting_data')
        .select('theme_of_the_day, toastmaster_user_id')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });
      if (user?.currentClubId) {
        q = q.eq('club_id', user.currentClubId);
      }
      const { data: allEntries, error } = await q;

      if (error) {
        console.error('Error loading toastmaster meeting data for theme:', error);
        return null;
      }
      if (!allEntries?.length) return null;

      const bookedEntry = tmodId
        ? allEntries.find((e: { toastmaster_user_id: string | null }) => e.toastmaster_user_id === tmodId)
        : null;
      const row = bookedEntry || allEntries[0];
      const t = (row?.theme_of_the_day || '').trim();
      return t || null;
    } catch (e) {
      console.error('fetchToastmasterCornerThemeValue:', e);
      return null;
    }
  };

  const loadToastmasterCornerTheme = async () => {
    const t = await fetchToastmasterCornerThemeValue();
    setToastmasterCornerTheme(t || '');
  };

  const loadQuizMaster = async () => {
    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%quiz%master%')
        .maybeSingle();

      if (error) {
        console.error('Error loading quiz master:', error);
        return;
      }

      if (data) {
        setQuizMaster({
          id: data.assigned_user_id,
          name: data.app_user_profiles?.full_name || null,
        });
      }
    } catch (error) {
      console.error('Error loading quiz master:', error);
    }
  };

  const loadGeneralEvaluator = async () => {
    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%general%evaluator%')
        .maybeSingle();

      if (error) {
        console.error('Error loading general evaluator:', error);
        return;
      }

      if (data) {
        setGeneralEvaluator({
          id: data.assigned_user_id,
          name: data.app_user_profiles?.full_name || null,
        });
      }
    } catch (error) {
      console.error('Error loading general evaluator:', error);
    }
  };

  const loadEducationalSpeaker = async () => {
    try {
      const { data: speakerData, error: speakerError } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .eq('role_classification', 'Educational speaker')
        .maybeSingle();

      if (speakerError) {
        console.error('Error loading educational speaker:', speakerError);
      } else if (speakerData) {
        setEducationalSpeaker({
          id: speakerData.assigned_user_id,
          name: speakerData.app_user_profiles?.full_name || null,
        });
      }

      // Load the editable agenda educational topic
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select('educational_topic')
        .eq('meeting_id', meetingId)
        .eq('section_name', 'Educational Speaker')
        .maybeSingle();

      if (agendaError) {
        console.error('Error loading education speech title:', agendaError);
      } else if (agendaData?.educational_topic) {
        setEducationSpeechTitle(agendaData.educational_topic);
      }

    } catch (error) {
      console.error('Error loading educational speaker:', error);
    }
  };

  const loadPreparedSpeakers = async () => {
    try {
      const { data, error } = await supabase
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
          evaluation_form,
          app_user_profiles!fk_app_evaluation_pathway_user_id(full_name),
          evaluator:app_user_profiles!fk_app_evaluation_pathway_assigned_evaluator_id(full_name),
          evaluations:app_prepared_speech_evaluations(id, evaluation_pdf_url)
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%prepared%speaker%')
        .order('role_name');

      if (error) {
        console.error('Error loading prepared speakers:', error);
        return;
      }

      if (data) {
        const speakers: PreparedSpeaker[] = data.map((item: any) => {
          let projectNumber: number | null = null;
          if (item.project_number) {
            const parsed = typeof item.project_number === 'string' ? parseInt(item.project_number, 10) : item.project_number;
            projectNumber = !isNaN(parsed) ? parsed : null;
          }

          // Get the evaluation ID and PDF URL if it exists
          const evaluationId = item.evaluations && item.evaluations.length > 0
            ? item.evaluations[0].id
            : null;
          const evaluationPdfUrl = item.evaluations && item.evaluations.length > 0
            ? item.evaluations[0].evaluation_pdf_url
            : null;

          return {
            id: item.id,
            user_id: item.user_id,
            role_name: item.role_name,
            speech_title: item.speech_title,
            pathway_name: item.pathway_name,
            project_name: item.project_name,
            level: item.level,
            project_number: projectNumber,
            assigned_evaluator_id: item.assigned_evaluator_id,
            speaker_name: item.app_user_profiles?.full_name || 'Unknown',
            evaluator_name: item.evaluator?.full_name || null,
            evaluation_id: evaluationId,
            evaluation_pdf_url: evaluationPdfUrl,
            evaluation_form: item.evaluation_form || null,
          };
        });
        setPreparedSpeakers(speakers);
      }
    } catch (error) {
      console.error('Exception loading prepared speakers:', error);
    }
  };

  const loadIceBreakers = async () => {
    try {
      const { data, error } = await supabase
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
          evaluation_form,
          app_user_profiles!fk_app_evaluation_pathway_user_id(full_name),
          evaluator:app_user_profiles!fk_app_evaluation_pathway_assigned_evaluator_id(full_name),
          evaluations:app_prepared_speech_evaluations(id, evaluation_pdf_url)
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%ice%breaker%speech%')
        .order('role_name');

      if (error) {
        console.error('Error loading ice breakers:', error);
        return;
      }

      if (data) {
        const speakers: PreparedSpeaker[] = data.map((item: any) => {
          let projectNumber: number | null = null;
          if (item.project_number) {
            const parsed = typeof item.project_number === 'string' ? parseInt(item.project_number, 10) : item.project_number;
            projectNumber = !isNaN(parsed) ? parsed : null;
          }

          // Get the evaluation ID and PDF URL if it exists
          const evaluationId = item.evaluations && item.evaluations.length > 0
            ? item.evaluations[0].id
            : null;
          const evaluationPdfUrl = item.evaluations && item.evaluations.length > 0
            ? item.evaluations[0].evaluation_pdf_url
            : null;

          return {
            id: item.id,
            user_id: item.user_id,
            role_name: item.role_name,
            speech_title: item.speech_title,
            pathway_name: item.pathway_name,
            project_name: item.project_name,
            level: item.level,
            project_number: projectNumber,
            assigned_evaluator_id: item.assigned_evaluator_id,
            speaker_name: item.app_user_profiles?.full_name || 'Unknown',
            evaluator_name: item.evaluator?.full_name || null,
            evaluation_id: evaluationId,
            evaluation_pdf_url: evaluationPdfUrl,
            evaluation_form: item.evaluation_form || null,
          };
        });
        setIceBreakers(speakers);
      }
    } catch (error) {
      console.error('Exception loading ice breakers:', error);
    }
  };

  const loadGeSubRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('ge_report_sub_roles')
        .select(`
          *,
          assigned_user:app_user_profiles!ge_report_sub_roles_assigned_user_id_fkey(full_name)
        `)
        .eq('meeting_id', meetingId)
        .order('sub_role_order');

      if (error) {
        console.error('Error loading GE sub-roles:', error);
        return;
      }

      if (data) {
        const subRoles: GESubRole[] = data.map((item: any) => ({
          id: item.id,
          agenda_item_id: item.agenda_item_id,
          sub_role_name: item.sub_role_name,
          sub_role_type: item.sub_role_type,
          sub_role_order: item.sub_role_order,
          assigned_user_id: item.assigned_user_id,
          assigned_user_name: item.assigned_user?.full_name || null,
          duration_minutes: item.duration_minutes,
          linked_role_id: item.linked_role_id,
        }));
        setGeSubRoles(subRoles);
      }
    } catch (error) {
      console.error('Exception loading GE sub-roles:', error);
    }
  };

  const loadMeetingData = async () => {
    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('meeting_start_time, meeting_number, club_id, club_info_banner_color, datetime_banner_color, footer_banner_1_color, footer_banner_2_color, theme, word_of_the_day, phrase_of_the_day, idiom_of_the_day, quote_of_the_day, is_agenda_visible, public_agenda_skin')
        .eq('id', meetingId)
        .maybeSingle();

      if (error) {
        console.error('Error loading meeting data:', error);
        return;
      }

      if (data) {
        setMeetingStartTime(data.meeting_start_time);
        setClubInfoBannerColor(data.club_info_banner_color || '#3b82f6');
        setDatetimeBannerColor(data.datetime_banner_color || '#f97316');
        setFooterBanner1Color(data.footer_banner_1_color || '#16a34a');
        setFooterBanner2Color(data.footer_banner_2_color || '#ea580c');
        setThemeOfTheDay(data.theme || '');
        setWordOfTheDay(data.word_of_the_day || '');
        setPhraseOfTheDay(data.phrase_of_the_day || '');
        setIdiomOfTheDay(data.idiom_of_the_day || '');
        setQuoteOfTheDay(data.quote_of_the_day || '');
        setIsAgendaVisible(data.is_agenda_visible ?? true);
        setPublicAgendaSkin(normalizeStoredPublicAgendaSkin((data as { public_agenda_skin?: string | null }).public_agenda_skin));
        const cid = (data as { club_id?: string | null }).club_id ?? null;
        setMeetingClubIdForWeb(cid);
        setMeetingNumberForWeb((data as { meeting_number?: string | null }).meeting_number ?? null);
        if (cid) {
          const { data: clubRow, error: clubErr } = await supabase
            .from('clubs')
            .select('name, club_profiles(club_name)')
            .eq('id', cid)
            .maybeSingle();
          if (clubErr) {
            console.error('Error loading club name for public link:', clubErr);
            setMeetingClubDisplayNameForWeb(null);
          } else {
            const rawProfile = clubRow?.club_profiles as
              | { club_name?: string | null }
              | { club_name?: string | null }[]
              | null
              | undefined;
            const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
            const fromProfile = profile?.club_name?.trim();
            const fromTable =
              typeof clubRow?.name === 'string' && clubRow.name.trim() !== ''
                ? clubRow.name.trim()
                : null;
            const display =
              fromProfile && fromProfile.length > 0 ? fromProfile : fromTable;
            setMeetingClubDisplayNameForWeb(display);
          }
        } else {
          setMeetingClubDisplayNameForWeb(null);
        }
        console.log('✓ Loaded meeting start time:', data.meeting_start_time);
      } else {
        console.log('No meeting found with ID:', meetingId);
      }
    } catch (error) {
      console.error('Error loading meeting data:', error);
    }
  };

  const createAgendaSections = async () => {
    if (!user?.currentClubId) return;

    try {
      setLoading(true);

      const { data: templates, error: templatesError } = await supabase
        .from('agenda_item_templates')
        .select('*')
        .or(`club_id.eq.${user.currentClubId},club_id.is.null`)
        .eq('is_active', true)
        .order('section_order');

      if (templatesError) {
        console.error('Error loading templates:', templatesError);
        Alert.alert('Error', 'Failed to load agenda templates');
        setLoading(false);
        return;
      }

      if (!templates || templates.length === 0) {
        Alert.alert('Error', 'No agenda templates found');
        setLoading(false);
        return;
      }

      const sectionsToCreate = templates.map((template, index) => ({
        meeting_id: meetingId,
        club_id: user.currentClubId,
        template_id: template.id,
        section_name: template.section_name,
        section_description: template.section_description,
        section_icon: template.section_icon,
        section_order: index + 1,
        start_time: null,
        end_time: null,
        duration_minutes: template.default_duration_minutes || 5,
        is_auto_generated: true,
        is_visible: false,
      }));

      const { error: insertError } = await supabase
        .from('meeting_agenda_items')
        .insert(sectionsToCreate);

      if (insertError) {
        console.error('Error creating agenda sections:', insertError);
        Alert.alert('Error', 'Failed to create agenda sections');
        setLoading(false);
        return;
      }

      Alert.alert('Success', 'Agenda sections created successfully');
      await loadAgendaItems();
    } catch (error) {
      console.error('Error creating agenda sections:', error);
      Alert.alert('Error', 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const loadAgendaItems = async () => {
    try {
      setLoading(true);
      const [
        { data, error },
        { data: allWords },
        { data: allIdioms },
        { data: allQuotes },
        { data: visibilityData }
      ] = await Promise.all([
        supabase
          .from('meeting_agenda_items')
          .select(`
            *,
            agenda_item_templates!meeting_agenda_items_template_id_fkey(is_role_based, role_classification),
            timer:app_user_profiles!fk_meeting_agenda_items_timer_user_id(full_name),
            ah_counter:app_user_profiles!fk_meeting_agenda_items_ah_counter_user_id(full_name),
            grammarian:app_user_profiles!fk_meeting_agenda_items_grammarian_user_id(full_name)
          `)
          .eq('meeting_id', meetingId)
          .order('section_order'),
        supabase
          .from('grammarian_word_of_the_day')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('grammarian_idiom_of_the_day')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('grammarian_quote_of_the_day')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('grammarian_corner_visibility')
          .select('*')
          .eq('meeting_id', meetingId)
      ]);

      if (error) {
        console.error('Error loading agenda items:', error);
        Alert.alert('Error', 'Failed to load agenda items');
        return;
      }

      const items = (data?.map((item: any) => {
        const baseItem = {
          ...item,
          is_role_based: item.agenda_item_templates?.is_role_based ?? true,
          role_classification: item.agenda_item_templates?.role_classification,
        };

        // Add grammarian corner data to Grammarian Corner section
        if (item.section_name === 'Grammarian Corner') {
          // Find visibility settings for this agenda item
          const visibility = Array.isArray(visibilityData)
            ? visibilityData.find((v: any) => v.agenda_item_id === item.id)
            : null;

          const grammarianCorner: GrammarianCorner = {
            word_visible: visibility?.word_visible ?? true,
            quote_visible: visibility?.quote_visible ?? true,
            idiom_visible: visibility?.idiom_visible ?? true,
            selected_word_id: visibility?.selected_word_id ?? null,
            selected_quote_id: visibility?.selected_quote_id ?? null,
            selected_idiom_id: visibility?.selected_idiom_id ?? null,
            available_words: Array.isArray(allWords) ? allWords.map((w: any) => ({ id: w.id, word: w.word })) : [],
            available_quotes: Array.isArray(allQuotes) ? allQuotes.map((q: any) => ({ id: q.id, quote: q.quote })) : [],
            available_idioms: Array.isArray(allIdioms) ? allIdioms.map((i: any) => ({ id: i.id, idiom: i.idiom })) : [],
          };

          // Set the selected or first available word
          if (Array.isArray(allWords) && allWords.length > 0) {
            const selectedWord = visibility?.selected_word_id
              ? allWords.find((w: any) => w.id === visibility.selected_word_id)
              : allWords[0];

            if (selectedWord) {
              grammarianCorner.word_of_the_day = {
                id: selectedWord.id,
                word: selectedWord.word,
                meaning: selectedWord.meaning,
                usage: selectedWord.usage,
                part_of_speech: selectedWord.part_of_speech,
              };
            }
          }

          // Set the selected or first available quote
          if (Array.isArray(allQuotes) && allQuotes.length > 0) {
            const selectedQuote = visibility?.selected_quote_id
              ? allQuotes.find((q: any) => q.id === visibility.selected_quote_id)
              : allQuotes[0];

            if (selectedQuote) {
              grammarianCorner.quote_of_the_day = {
                id: selectedQuote.id,
                quote: selectedQuote.quote,
                meaning: selectedQuote.meaning,
                usage: selectedQuote.usage,
              };
            }
          }

          // Set the selected or first available idiom
          if (Array.isArray(allIdioms) && allIdioms.length > 0) {
            const selectedIdiom = visibility?.selected_idiom_id
              ? allIdioms.find((i: any) => i.id === visibility.selected_idiom_id)
              : allIdioms[0];

            if (selectedIdiom) {
              grammarianCorner.idiom_of_the_day = {
                id: selectedIdiom.id,
                idiom: selectedIdiom.idiom,
                meaning: selectedIdiom.meaning,
                usage: selectedIdiom.usage,
              };
            }
          }

          return {
            ...baseItem,
            grammarian_corner: grammarianCorner,
          };
        }

        return baseItem;
      }) || []).filter((item: any) => !item.section_name.toLowerCase().includes('ancillary'));

      setAgendaItems(items);
      const grammarianItem = items.find((i: any) => i.section_name === 'Grammarian Corner');
      const stored = grammarianItem?.role_details?.grammarian_corner;
      if (stored) {
        if (typeof stored.word_of_the_day === 'string') setWordOfTheDay(stored.word_of_the_day);
        if (typeof stored.quote_of_the_day === 'string') setQuoteOfTheDay(stored.quote_of_the_day);
        if (typeof stored.idiom_of_the_day === 'string') setIdiomOfTheDay(stored.idiom_of_the_day);
      }

      const keynoteItem = items.find((i: any) => (i.section_name || '').toLowerCase().includes('keynote'));
      const kt = (keynoteItem?.role_details?.speech_title || '').toString().trim();
      if (kt) setKeynoteSpeechTitle(kt);
    } catch (error) {
      console.error('Error loading agenda items:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateAgendaItem = async (itemId: string, updates: Partial<AgendaItem>) => {
    try {
      const { error } = await supabase
        .from('meeting_agenda_items')
        .update(updates)
        .eq('id', itemId);

      if (error) {
        console.error('Error updating agenda item:', error);
        Alert.alert('Error', 'Failed to update agenda item');
        return;
      }

      // Update local state
      setAgendaItems(items =>
        items.map(item => (item.id === itemId ? { ...item, ...updates } : item))
      );
    } catch (error) {
      console.error('Error updating agenda item:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const toggleVisibility = async (itemId: string, currentVisibility?: boolean) => {
    const liveVisibility =
      currentVisibility ?? agendaItems.find((item) => item.id === itemId)?.is_visible ?? true;
    const newVisibility = !liveVisibility;

    // Update local state immediately for instant feedback
    const updatedItems = agendaItems.map(item =>
      item.id === itemId ? { ...item, is_visible: newVisibility } : item
    );
    setAgendaItems(updatedItems);

    // Update database
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ is_visible: newVisibility })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating visibility:', error);
      // Revert local state if database update failed
      setAgendaItems(items =>
        items.map(item => (item.id === itemId ? { ...item, is_visible: liveVisibility } : item))
      );
      Alert.alert('Error', 'Failed to update visibility');
      return;
    }

    // Recalculate all times since visibility affects time flow
    await recalculateAllTimes(updatedItems);
  };

  const setAllSectionsVisibility = async (visible: boolean) => {
    if (agendaItems.length === 0) return;

    const updatedItems = agendaItems.map(item => ({ ...item, is_visible: visible }));
    setAgendaItems(updatedItems);

    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ is_visible: visible })
      .eq('meeting_id', meetingId);

    if (error) {
      console.error('Error updating section visibility:', error);
      setAgendaItems(agendaItems);
      Alert.alert('Error', 'Failed to update section visibility');
      return;
    }

    await recalculateAllTimes(updatedItems);
    Alert.alert('Done', visible ? 'All sections are now visible' : 'All sections are now hidden');
  };

  const toggleTagTeamRoleVisibility = async (itemId: string, roleType: 'timer' | 'ah_counter' | 'grammarian') => {
    const item = agendaItems.find(i => i.id === itemId);
    if (!item) return;

    const visibilityKey = `${roleType}_visible` as 'timer_visible' | 'ah_counter_visible' | 'grammarian_visible';
    const currentVisibility = item[visibilityKey] ?? true;
    const newVisibility = !currentVisibility;

    // Optimistically update local state
    setAgendaItems(items =>
      items.map(i => (i.id === itemId ? { ...i, [visibilityKey]: newVisibility } : i))
    );

    // Update database
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ [visibilityKey]: newVisibility })
      .eq('id', itemId);

    if (error) {
      console.error(`Error updating ${roleType} visibility:`, error);
      // Revert local state if database update failed
      setAgendaItems(items =>
        items.map(i => (i.id === itemId ? { ...i, [visibilityKey]: currentVisibility } : i))
      );
      Alert.alert('Error', `Failed to update ${roleType} visibility`);
    }
  };

  const openAssignmentModal = (itemId: string) => {
    const item = agendaItems.find(i => i.id === itemId);
    setSelectedItemId(itemId);
    setCustomName(item?.assigned_user_name || '');
    setSearchQuery('');
    setAssignmentModalVisible(true);
  };

  const closeAssignmentModal = () => {
    setAssignmentModalVisible(false);
    setSelectedItemId(null);
    setCustomName('');
    setSearchQuery('');
  };

  const assignMember = async (memberId: string, memberName: string) => {
    if (!selectedItemId) return;

    // Update local state
    setAgendaItems(items =>
      items.map(item =>
        item.id === selectedItemId
          ? { ...item, assigned_user_id: memberId, assigned_user_name: memberName }
          : item
      )
    );

    // Update database
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ assigned_user_id: memberId, assigned_user_name: memberName })
      .eq('id', selectedItemId);

    if (error) {
      console.error('Error assigning member:', error);
      Alert.alert('Error', 'Failed to assign member');
    } else {
      closeAssignmentModal();
    }
  };

  const unassignMember = async () => {
    if (!selectedItemId) return;

    // Update local state
    setAgendaItems(items =>
      items.map(item =>
        item.id === selectedItemId
          ? { ...item, assigned_user_id: null, assigned_user_name: null }
          : item
      )
    );

    // Update database
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ assigned_user_id: null, assigned_user_name: null })
      .eq('id', selectedItemId);

    if (error) {
      console.error('Error unassigning member:', error);
      Alert.alert('Error', 'Failed to unassign member');
    } else {
      closeAssignmentModal();
    }
  };

  const assignSergeantAtArms = async (memberId: string, memberName: string) => {
    if (!user?.currentClubId) {
      Alert.alert('Error', 'Club ID not found');
      return;
    }

    // First, check if a sergeant at arms role already exists
    const { data: existingRole, error: saaFetchError } = await supabase
      .from('app_meeting_roles_management')
      .select('id')
      .eq('meeting_id', meetingId)
      .ilike('role_name', '%sergeant%arms%')
      .maybeSingle();

    if (saaFetchError) {
      console.error('Error checking existing role:', saaFetchError);
      Alert.alert('Error', 'Failed to check existing role');
      return;
    }

    if (existingRole) {
      // Update existing role
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({ assigned_user_id: memberId })
        .eq('id', existingRole.id);

      if (error) {
        console.error('Error updating sergeant at arms:', error);
        Alert.alert('Error', 'Failed to assign Sergeant at Arms');
        return;
      }
    } else {
      // Create new role
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          role_classification: 'Club Speakers',
          role_name: 'Sergeant at Arms',
          assigned_user_id: memberId,
          booking_status: 'booked',
        });

      if (error) {
        console.error('Error creating sergeant at arms:', error);
        Alert.alert('Error', 'Failed to assign Sergeant at Arms');
        return;
      }
    }

    setSaaModalVisible(false);
    setSearchQuery('');
  };

  const autoFillAgendaAssignmentFromSergeantAtArmsBooking = async (agendaItem: AgendaItem) => {
    const applyBookedSaa = async (bookedUserId: string, bookedUserName: string) => {
      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
        .eq('id', agendaItem.id);
      if (updateError) {
        console.error('Error updating agenda assignment:', updateError);
        Alert.alert('Error', 'Failed to update agenda assignment');
        return;
      }
      setAgendaItems(items =>
        items.map(i =>
          i.id === agendaItem.id ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName } : i
        )
      );
    };

    try {
      setAutoFillItemId(agendaItem.id);
      const booked = await fetchLatestBookedAssignee({ kind: 'ilike_role', pattern: '%sergeant%arms%' });
      if (!booked) {
        Alert.alert('Not assigned', 'Sergeant-at-Arms is not booked for this meeting yet.');
        return;
      }
      const { userId: bookedUserId, userName: bookedUserName } = booked;
      if (agendaAssigneeInSync(agendaItem, bookedUserId, bookedUserName)) return;
      await applyBookedSaa(bookedUserId, bookedUserName);
    } catch (e) {
      console.error('Error auto-filling agenda assignment:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const autoFillAgendaAssignmentFromPresidingOfficerBooking = async (triggerItemId: string) => {
    const targetFilter = (item: AgendaItem) =>
      item.section_name.toLowerCase().includes('presiding officer') ||
      item.section_name.toLowerCase().includes('closing remarks') ||
      item.section_name.toLowerCase().includes('awards');

    try {
      setAutoFillItemId(triggerItemId);
      const booked = await fetchLatestBookedAssignee({ kind: 'eq_role', roleName: 'Presiding Officer' });
      if (!booked) {
        Alert.alert('Not assigned', 'Presiding Officer is not booked for this meeting yet.');
        return;
      }
      const { userId: bookedUserId, userName: bookedUserName } = booked;

      const targetItems = agendaItems.filter(targetFilter);
      if (targetItems.length === 0) {
        Alert.alert('Not found', 'No matching Presiding Officer sections found in this agenda.');
        return;
      }

      const targetIds = targetItems.map(i => i.id);
      const allInSync = targetItems.every(item =>
        agendaAssigneeInSync(item, bookedUserId, bookedUserName)
      );
      if (allInSync) return;

      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
        .in('id', targetIds);
      if (updateError) {
        console.error('Error updating Presiding Officer assignments:', updateError);
        Alert.alert('Error', 'Failed to update Presiding Officer assignments');
        return;
      }
      setAgendaItems(items =>
        items.map(i =>
          targetIds.includes(i.id)
            ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
            : i
        )
      );
    } catch (e) {
      console.error('Error auto-filling Presiding Officer assignments:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const autoFillAgendaAssignmentFromToastmasterBooking = async (agendaItem: AgendaItem) => {
    const applyBookedTmod = async (bookedUserId: string, bookedUserName: string) => {
      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
        .eq('id', agendaItem.id);
      if (updateError) {
        console.error('Error updating Toastmaster agenda assignment:', updateError);
        Alert.alert('Error', 'Failed to update Toastmaster of the Day assignment');
        return;
      }
      setAgendaItems(items =>
        items.map(i =>
          i.id === agendaItem.id ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName } : i
        )
      );
    };

    try {
      setAutoFillItemId(agendaItem.id);
      const booked = await fetchLatestBookedAssignee({ kind: 'ilike_role', pattern: '%toastmaster%' });
      if (!booked) {
        Alert.alert('Not assigned', 'Toastmaster of the Day is not booked for this meeting yet.');
        return;
      }
      const { userId: bookedUserId, userName: bookedUserName } = booked;
      if (agendaAssigneeInSync(agendaItem, bookedUserId, bookedUserName)) return;
      await applyBookedTmod(bookedUserId, bookedUserName);
    } catch (e) {
      console.error('Error auto-filling Toastmaster assignment:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  /** Sub-roles UI only on the GE Report section, not Opening/Feedback. */
  const isGeneralEvaluatorReportSection = (sectionName: string) => {
    const s = sectionName.toLowerCase();
    return s.includes('general evaluator') && s.includes('report');
  };

  const isGeneralEvaluatorOpeningOrFeedbackSection = (sectionName: string) => {
    const s = sectionName.trim().toLowerCase();
    if (s.includes('report')) return false;
    if (s === 'general evaluator feedback' || s === 'general evaluator opening') return true;
    if (s.includes('general evaluator') && s.includes('feedback')) return true;
    if (s.includes('general evaluator') && /\bopening\b/.test(s)) return true;
    if (s.includes('evaluator') && s.includes('feedback') && !s.includes('report')) return true;
    if (s.includes('evaluator') && /\bopening\b/.test(s) && !s.includes('report')) return true;
    return false;
  };

  const autoFillAgendaAssignmentFromGeneralEvaluatorBooking = async (triggerItemId: string) => {
    try {
      setAutoFillItemId(triggerItemId);
      const booked = await fetchLatestBookedAssignee({ kind: 'eq_role', roleName: 'General Evaluator' });
      if (!booked) {
        Alert.alert('Not assigned', 'General Evaluator is not booked for this meeting yet.');
        return;
      }
      const { userId: bookedUserId, userName: bookedUserName } = booked;

      const targetItems = agendaItems.filter(item =>
        isGeneralEvaluatorOpeningOrFeedbackSection(item.section_name)
      );

      if (targetItems.length === 0) {
        Alert.alert(
          'Not found',
          'No General Evaluator Opening or Feedback sections found. If names differ, use manual assign.'
        );
        return;
      }

      const targetIds = targetItems.map(i => i.id);
      const allInSync = targetItems.every(item =>
        agendaAssigneeInSync(item, bookedUserId, bookedUserName)
      );
      if (allInSync) return;

      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
        .in('id', targetIds);
      if (updateError) {
        console.error('Error updating General Evaluator assignments:', updateError);
        Alert.alert('Error', 'Failed to update General Evaluator assignments');
        return;
      }
      setAgendaItems(items =>
        items.map(i =>
          targetIds.includes(i.id)
            ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
            : i
        )
      );
    } catch (e) {
      console.error('Error auto-filling General Evaluator assignments:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const autoFillTagTeamFromBookedRoles = async (tagTeamAgendaItemId: string) => {
    const tagItem = agendaItems.find(i => i.id === tagTeamAgendaItemId);
    if (!tagItem || !tagItem.section_name.toLowerCase().includes('tag team')) return;

    try {
      setAutoFillItemId(tagTeamAgendaItemId);

      const [timerId, ahId, gramId] = await Promise.all([
        fetchLatestBookedUserIdByRoleName('Timer'),
        fetchLatestBookedUserIdByRoleName('Ah Counter'),
        fetchLatestBookedUserIdByRoleName('Grammarian'),
      ]);

      if (!timerId && !ahId && !gramId) {
        Alert.alert(
          'Not booked',
          'No Timer, Ah Counter, or Grammarian roles are booked for this meeting yet.'
        );
        return;
      }

      const curT = tagItem.timer_user_id ?? null;
      const curAh = tagItem.ah_counter_user_id ?? null;
      const curG = tagItem.grammarian_user_id ?? null;
      if (curT === timerId && curAh === ahId && curG === gramId) return;

      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({
          timer_user_id: timerId,
          ah_counter_user_id: ahId,
          grammarian_user_id: gramId,
        })
        .eq('id', tagTeamAgendaItemId);

      if (updateError) {
        console.error('Error updating Tag Team agenda item:', updateError);
        Alert.alert('Error', 'Failed to update Tag Team assignments');
        return;
      }

      await loadTimer();
      await loadAhCounter();
      await loadGrammarian();
      await loadAgendaItems();
    } catch (e) {
      console.error('Error auto-filling Tag Team:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  /** Maps Timer Report / Ah Counter Report / Grammarian Report sections to booked Tag Team role_name. */
  const getBookedRoleNameForTagReportSection = (
    sectionName: string
  ): 'Timer' | 'Ah Counter' | 'Grammarian' | null => {
    const s = sectionName.toLowerCase();
    if (s.includes('grammarian report')) return 'Grammarian';
    if (s.includes('ah counter report') || s.includes('ah-counter report')) return 'Ah Counter';
    if (s.includes('timer report')) return 'Timer';
    return null;
  };

  const autoFillTagTeamReportFromBooking = async (agendaItem: AgendaItem) => {
    const bookedRoleName = getBookedRoleNameForTagReportSection(agendaItem.section_name);
    if (!bookedRoleName) return;

    const roleLabel =
      bookedRoleName === 'Timer'
        ? 'Timer'
        : bookedRoleName === 'Ah Counter'
          ? 'Ah Counter'
          : 'Grammarian';

    const applyReportAssignee = async (bookedUserId: string, bookedUserName: string) => {
      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
        .eq('id', agendaItem.id);
      if (updateError) {
        console.error('Error updating report assignment:', updateError);
        Alert.alert('Error', `Failed to update ${roleLabel} Report assignment`);
        return;
      }
      setAgendaItems(items =>
        items.map(i =>
          i.id === agendaItem.id
            ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
            : i
        )
      );
    };

    try {
      setAutoFillItemId(agendaItem.id);
      const booked = await fetchLatestBookedAssignee({ kind: 'eq_role', roleName: bookedRoleName });
      if (!booked) {
        Alert.alert('Not assigned', `${roleLabel} is not booked for this meeting yet.`);
        return;
      }
      const { userId: bookedUserId, userName: bookedUserName } = booked;
      if (agendaAssigneeInSync(agendaItem, bookedUserId, bookedUserName)) return;
      await applyReportAssignee(bookedUserId, bookedUserName);
    } catch (e) {
      console.error('Error auto-filling Tag Team report:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const autoFillTableTopicsMasterFromBooking = async (agendaItem: AgendaItem) => {
    const applyTtm = async (bookedUserId: string, bookedUserName: string) => {
      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
        .eq('id', agendaItem.id);
      if (updateError) {
        console.error('Error updating Table Topics Session assignment:', updateError);
        Alert.alert('Error', 'Failed to update Table Topics Session assignment');
        return;
      }
      setAgendaItems(items =>
        items.map(i =>
          i.id === agendaItem.id
            ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
            : i
        )
      );
    };

    try {
      setAutoFillItemId(agendaItem.id);
      const booked = await fetchLatestBookedAssignee({
        kind: 'ilike_role',
        pattern: '%table%topics%master%',
      });
      if (!booked) {
        Alert.alert('Not assigned', 'Table Topics Master is not booked for this meeting yet.');
        return;
      }
      const { userId: bookedUserId, userName: bookedUserName } = booked;
      if (agendaAssigneeInSync(agendaItem, bookedUserId, bookedUserName)) return;
      await applyTtm(bookedUserId, bookedUserName);
    } catch (e) {
      console.error('Error auto-filling Table Topics Master:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const autoFillKeynoteSpeakerFromBooking = async (agendaItem: AgendaItem) => {
    const applyKeynote = async (bookedUserId: string, bookedUserName: string) => {
      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
        .eq('id', agendaItem.id);
      if (updateError) {
        console.error('Error updating Keynote Speaker assignment:', updateError);
        Alert.alert('Error', 'Failed to update Keynote Speaker assignment');
        return;
      }
      setAgendaItems(items =>
        items.map(i =>
          i.id === agendaItem.id
            ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
            : i
        )
      );
    };

    try {
      setAutoFillItemId(agendaItem.id);
      const booked = await fetchLatestBookedAssignee({ kind: 'ilike_role', pattern: '%keynote%' });
      if (!booked) {
        Alert.alert('Not assigned', 'Keynote Speaker is not booked for this meeting yet.');
        return;
      }
      const { userId: bookedUserId, userName: bookedUserName } = booked;
      if (agendaAssigneeInSync(agendaItem, bookedUserId, bookedUserName)) return;
      await applyKeynote(bookedUserId, bookedUserName);
    } catch (e) {
      console.error('Error auto-filling Keynote Speaker:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const autoFillEducationalSpeakerFromBooking = async (agendaItem: AgendaItem) => {
    const runFill = async (
      bookedUserId: string | null,
      bookedUserName: string | null,
      cornerSpeechTitle: string | null
    ) => {
      const patch: Record<string, string> = {};
      if (bookedUserId && bookedUserName) {
        patch.assigned_user_id = bookedUserId;
        patch.assigned_user_name = bookedUserName;
      }
      if (cornerSpeechTitle) {
        patch.educational_topic = cornerSpeechTitle;
      }
      if (Object.keys(patch).length === 0) return;

      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update(patch)
        .eq('id', agendaItem.id);

      if (updateError) {
        console.error('Error updating Educational Speaker agenda item:', updateError);
        Alert.alert('Error', 'Failed to update Educational Speaker section');
        return;
      }

      setAgendaItems(items =>
        items.map(i => {
          if (i.id !== agendaItem.id) return i;
          return {
            ...i,
            ...(bookedUserId && bookedUserName
              ? { assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
              : {}),
            ...(cornerSpeechTitle ? { educational_topic: cornerSpeechTitle } : {}),
          };
        })
      );
      if (cornerSpeechTitle) {
        setEducationSpeechTitle(cornerSpeechTitle);
      }
      if (bookedUserId && bookedUserName) {
        setEducationalSpeaker({ id: bookedUserId, name: bookedUserName });
      }
      await loadEducationalSpeaker();
    };

    try {
      setAutoFillItemId(agendaItem.id);

      let bookedUserId: string | null = null;
      let bookedUserName: string | null = null;
      const byClass = await fetchLatestBookedAssignee({
        kind: 'classification',
        value: 'Educational speaker',
      });
      if (byClass) {
        bookedUserId = byClass.userId;
        bookedUserName = byClass.userName;
      } else {
        const byName = await fetchLatestBookedAssignee({
          kind: 'ilike_role',
          pattern: '%educational%speaker%',
        });
        if (byName) {
          bookedUserId = byName.userId;
          bookedUserName = byName.userName;
        }
      }

      let cornerTitle = '';
      if (bookedUserId) {
        const { data: cornerRows, error: cornerErr } = await supabase
          .from('app_meeting_educational_speaker')
          .select('speech_title')
          .eq('meeting_id', meetingId)
          .eq('speaker_user_id', bookedUserId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (cornerErr) {
          console.error('Error loading Educational Corner title (booked speaker):', cornerErr);
        }

        cornerTitle = (cornerRows?.[0]?.speech_title || '').trim();
      } else {
        const { data: cornerRows, error: cornerErr } = await supabase
          .from('app_meeting_educational_speaker')
          .select('speech_title')
          .eq('meeting_id', meetingId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (cornerErr) {
          console.error('Error loading Educational Corner title (latest):', cornerErr);
        }

        cornerTitle = (cornerRows?.[0]?.speech_title || '').trim();
      }

      if (!bookedUserId && !cornerTitle) {
        Alert.alert(
          'Nothing to fill',
          'No Educational Speaker is booked and no speech title was found in Educational Corner.'
        );
        return;
      }

      const currentTopic = (
        (agendaItem.educational_topic ?? educationSpeechTitle) ||
        ''
      ).trim();

      const needsAssigneeUpdate =
        !!(bookedUserId && bookedUserName) &&
        !agendaAssigneeInSync(agendaItem, bookedUserId, bookedUserName);
      const needsTitleUpdate = !!cornerTitle && currentTopic !== cornerTitle;

      if (!needsAssigneeUpdate && !needsTitleUpdate) return;

      await runFill(
        needsAssigneeUpdate && bookedUserId && bookedUserName ? bookedUserId : null,
        needsAssigneeUpdate && bookedUserName ? bookedUserName : null,
        needsTitleUpdate ? cornerTitle : null
      );
    } catch (e) {
      console.error('Error auto-filling Educational Speaker:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const slotFromRoleName = (name: string): number | null => {
    const m = (name || '').match(/prepared\s*speaker\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };

  const loadPreparedSpeakerRoleDefs = async () => {
    // Prepared speaker slots should reflect how many roles are currently open for this meeting.
    // (e.g. only 2 roles -> render slots 1..2, even if the UI previously defaulted to 3.)
    const OPEN_BOOKING_STATUSES = ['available', 'pending', 'booked'];
    try {
      const { data: roleRows, error: roleErr } = await supabase
        .from('app_meeting_roles_management')
        .select('role_name, booking_status, updated_at')
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%prepared%speaker%')
        .order('updated_at', { ascending: false });

      if (roleErr) {
        console.error('Failed to load prepared speaker role definitions:', roleErr);
        setPreparedSpeakerRoleDefs([]);
        return;
      }

      const bySlot = new Map<number, string>();
      (roleRows || []).forEach((r: { role_name: string; booking_status?: string }) => {
        const sn = slotFromRoleName(r.role_name);
        if (sn == null || sn < 1 || sn > 5) return;
        const status = (r.booking_status ?? '').toLowerCase();
        if (!OPEN_BOOKING_STATUSES.includes(status)) return;
        if (!bySlot.has(sn)) bySlot.set(sn, r.role_name);
      });

      const sorted = Array.from(bySlot.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([slot, role_name]) => ({ slot, role_name }));

      setPreparedSpeakerRoleDefs(sorted);
    } catch (e) {
      console.error('Exception while loading prepared speaker role definitions:', e);
      setPreparedSpeakerRoleDefs([]);
    }
  };

  const autoFillPreparedSpeechesFromPathway = async (agendaItem: AgendaItem) => {
    const existing = parsePreparedSpeechesAgenda(agendaItem.prepared_speeches_agenda);
    const prevBySlot = (n: number) => existing.find(s => s.slot === n);

    try {
      setAutoFillItemId(agendaItem.id);
      const { data: roleRows, error: roleErr } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          role_name,
          booking_status,
          assigned_user_id,
          app_user_profiles!fk_meeting_roles_management_assigned_user_id(full_name)
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%prepared%speaker%');

      if (roleErr) {
        console.error(roleErr);
        Alert.alert('Error', 'Failed to load prepared speaker roles');
        return;
      }

      const roleBySlot = new Map<number, (typeof roleRows)[0]>();
      const OPEN_BOOKING_STATUSES = ['available', 'pending', 'booked'];
      (roleRows || []).forEach((r: { role_name: string; booking_status?: string }) => {
        const sn = slotFromRoleName(r.role_name);
        if (
          sn != null &&
          sn >= 1 &&
          sn <= 5 &&
          !roleBySlot.has(sn) &&
          OPEN_BOOKING_STATUSES.includes((r.booking_status ?? '').toLowerCase())
        ) {
          roleBySlot.set(sn, r as (typeof roleRows)[0]);
        }
      });

      const roleSlots = Array.from(roleBySlot.keys()).sort((a, b) => a - b);

      const slots: PreparedSpeechAgendaSlot[] = await Promise.all(
        roleSlots.map(async (slot) => {
          const role = roleBySlot.get(slot) as {
            role_name?: string;
            booking_status?: string;
            assigned_user_id?: string | null;
            app_user_profiles?: { full_name?: string | null };
          } | undefined;
          const roleName = (role?.role_name as string | undefined) ?? `Prepared Speaker ${slot}`;
          const booked =
            role?.booking_status === 'booked' && !!role?.assigned_user_id;

          let pathway: {
            id: string;
            speech_title: string | null;
            pathway_name: string | null;
            project_name: string | null;
            level: number | null;
            project_number: string | number | null;
            assigned_evaluator_id: string | null;
            evaluation_form: string | null;
            speaker?: { full_name?: string | null };
            evaluator?: { full_name?: string | null };
          } | null = null;

          if (booked && role?.assigned_user_id) {
            const rn = role.role_name as string;
            const { data: pw } = await supabase
              .from('app_evaluation_pathway')
              .select(`
                id,
                speech_title,
                pathway_name,
                project_name,
                level,
                project_number,
                assigned_evaluator_id,
                evaluation_form,
                speaker:app_user_profiles!fk_app_evaluation_pathway_user_id(full_name),
                evaluator:app_user_profiles!fk_app_evaluation_pathway_assigned_evaluator_id(full_name)
              `)
              .eq('meeting_id', meetingId)
              .eq('user_id', role.assigned_user_id)
              .ilike('role_name', rn)
              .maybeSingle();
            pathway = pw as typeof pathway;
          }

          const prev = prevBySlot(slot);
          const speakerName =
            pathway?.speaker?.full_name ??
            role?.app_user_profiles?.full_name ??
            (booked ? 'Member' : null);

          return {
            slot,
            role_name: (role as { role_name?: string } | undefined)?.role_name || roleName,
            booked,
            pathway_id: pathway?.id ?? null,
            speaker_user_id: role?.assigned_user_id ?? null,
            speaker_name: booked ? speakerName : null,
            speech_title: pathway?.speech_title ?? null,
            pathway_name: pathway?.pathway_name ?? null,
            level: pathway?.level != null ? Number(pathway.level) : null,
            project_number:
              pathway?.project_number != null
                ? String(pathway.project_number)
                : null,
            project_name: pathway?.project_name ?? null,
            evaluation_form: pathway?.evaluation_form ?? null,
            evaluator_user_id: pathway?.assigned_evaluator_id ?? null,
            evaluator_name: pathway?.evaluator?.full_name ?? null,
            is_visible: prev ? prev.is_visible : true,
          };
        })
      );

      const { error: upErr } = await supabase
        .from('meeting_agenda_items')
        .update({ prepared_speeches_agenda: slots })
        .eq('id', agendaItem.id);

      if (upErr) {
        console.error(upErr);
        Alert.alert('Error', 'Failed to save prepared speeches to agenda');
        return;
      }

      setAgendaItems(items =>
        items.map(i =>
          i.id === agendaItem.id ? { ...i, prepared_speeches_agenda: slots } : i
        )
      );
      await loadPreparedSpeakers();
      Alert.alert('Done', 'Prepared speech slots saved on the agenda from pathway data.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAutoFillItemId(null);
    }
  };

  const togglePreparedSpeechSlotVisibility = async (
    agendaItemId: string,
    slotNum: number
  ) => {
    const item = agendaItems.find(i => i.id === agendaItemId);
    if (!item) return;
    const parsed = parsePreparedSpeechesAgenda(item.prepared_speeches_agenda);
    const openSlotDefs =
      preparedSpeakerRoleDefs.length > 0
        ? preparedSpeakerRoleDefs
        : PREPARED_SPEAKER_ROLE_NAMES.map((roleName, i) => ({
            slot: i + 1,
            role_name: roleName,
          }));
    const parsedBySlot = new Map(parsed.map(s => [s.slot, s]));
    const slots = openSlotDefs
      .filter(def => def.slot >= 1 && def.slot <= 5)
      .sort((a, b) => a.slot - b.slot)
      .map(def => {
        const existing = parsedBySlot.get(def.slot);
        if (existing) return existing;
        return {
          slot: def.slot,
          role_name: def.role_name,
          booked: false,
          pathway_id: null,
          speaker_user_id: null,
          speaker_name: null,
          speech_title: null,
          pathway_name: null,
          level: null,
          project_number: null,
          project_name: null,
          evaluation_form: null,
          evaluator_user_id: null,
          evaluator_name: null,
          is_visible: true,
        } as PreparedSpeechAgendaSlot;
      });
    if (slots.length === 0) {
      Alert.alert(
        'Auto Fill first',
        'Use Auto Fill to create the prepared speaker slots from bookings and pathway data.'
      );
      return;
    }
    const idx = slots.findIndex(s => s.slot === slotNum);
    if (idx < 0) return;
    const next = slots.map((s, i) =>
      i === idx ? { ...s, is_visible: !s.is_visible } : s
    );
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ prepared_speeches_agenda: next })
      .eq('id', agendaItemId);
    if (error) {
      Alert.alert('Error', 'Could not update slot visibility');
      return;
    }
    setAgendaItems(items =>
      items.map(i =>
        i.id === agendaItemId ? { ...i, prepared_speeches_agenda: next } : i
      )
    );
  };

  const updatePreparedSpeechSlot = async (
    agendaItemId: string,
    slotNum: number,
    updates: Partial<PreparedSpeechAgendaSlot>
  ) => {
    const item = agendaItemsRef.current.find(i => i.id === agendaItemId);
    if (!item) return;

    const parsed = parsePreparedSpeechesAgenda(item.prepared_speeches_agenda);
    const openSlotDefs =
      preparedSpeakerRoleDefs.length > 0
        ? preparedSpeakerRoleDefs
        : PREPARED_SPEAKER_ROLE_NAMES.map((roleName, i) => ({
            slot: i + 1,
            role_name: roleName,
          }));
    const parsedBySlot = new Map(parsed.map(s => [s.slot, s]));
    const slots = openSlotDefs
      .filter(def => def.slot >= 1 && def.slot <= 5)
      .sort((a, b) => a.slot - b.slot)
      .map(def => {
        const existing = parsedBySlot.get(def.slot);
        if (existing) return existing;
        return {
          slot: def.slot,
          role_name: def.role_name,
          booked: false,
          pathway_id: null,
          speaker_user_id: null,
          speaker_name: null,
          speech_title: null,
          pathway_name: null,
          level: null,
          project_number: null,
          project_name: null,
          evaluation_form: null,
          evaluator_user_id: null,
          evaluator_name: null,
          is_visible: true,
        } as PreparedSpeechAgendaSlot;
      });

    const next = slots.map(s =>
      s.slot === slotNum ? { ...s, ...updates } : s
    );

    // Update local state immediately for snappy UI
    setAgendaItems(items =>
      items.map(i =>
        i.id === agendaItemId ? { ...i, prepared_speeches_agenda: next } : i
      )
    );
    agendaItemsRef.current = agendaItemsRef.current.map(i =>
      i.id === agendaItemId ? { ...i, prepared_speeches_agenda: next } : i
    );

    // Persist to Supabase in background
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ prepared_speeches_agenda: next })
      .eq('id', agendaItemId);

    if (error) {
      console.error('updatePreparedSpeechSlot error', error);
      Alert.alert('Error', 'Could not save prepared speech details. Please try again.');
    }
  };

  const assignTimer = async (memberId: string, memberName: string) => {
    // Update the agenda item only - do not modify role booking
    const { data: agendaItem, error: timerAgendaFetchError } = await supabase
      .from('meeting_agenda_items')
      .select('id')
      .eq('meeting_id', meetingId)
      .ilike('section_name', '%tag%team%')
      .maybeSingle();

    if (timerAgendaFetchError) {
      console.error('Error fetching Tag Team agenda item:', timerAgendaFetchError);
      Alert.alert('Error', 'Failed to find Tag Team section');
      return;
    }

    if (!agendaItem) {
      Alert.alert('Error', 'Tag Team section not found in agenda');
      return;
    }

    const { error: updateError } = await supabase
      .from('meeting_agenda_items')
      .update({ timer_user_id: memberId })
      .eq('id', agendaItem.id);

    if (updateError) {
      console.error('Error updating timer in agenda:', updateError);
      Alert.alert('Error', 'Failed to assign Timer in agenda');
    } else {
      setTimer({ id: memberId, name: memberName });
      setTimerModalVisible(false);
      setSearchQuery('');
      await loadAgendaItems();
    }
  };

  const assignAhCounter = async (memberId: string, memberName: string) => {
    // Update the agenda item only - do not modify role booking
    const { data: agendaItem, error: ahCounterAgendaFetchError } = await supabase
      .from('meeting_agenda_items')
      .select('id')
      .eq('meeting_id', meetingId)
      .ilike('section_name', '%tag%team%')
      .maybeSingle();

    if (ahCounterAgendaFetchError) {
      console.error('Error fetching Tag Team agenda item:', ahCounterAgendaFetchError);
      Alert.alert('Error', 'Failed to find Tag Team section');
      return;
    }

    if (!agendaItem) {
      Alert.alert('Error', 'Tag Team section not found in agenda');
      return;
    }

    const { error: updateError } = await supabase
      .from('meeting_agenda_items')
      .update({ ah_counter_user_id: memberId })
      .eq('id', agendaItem.id);

    if (updateError) {
      console.error('Error updating ah counter in agenda:', updateError);
      Alert.alert('Error', 'Failed to assign Ah Counter in agenda');
    } else {
      setAhCounter({ id: memberId, name: memberName });
      setAhCounterModalVisible(false);
      setSearchQuery('');
      await loadAgendaItems();
    }
  };

  const assignGrammarian = async (memberId: string, memberName: string) => {
    // Update the agenda item only - do not modify role booking
    const { data: agendaItem, error: grammarianAgendaFetchError } = await supabase
      .from('meeting_agenda_items')
      .select('id')
      .eq('meeting_id', meetingId)
      .ilike('section_name', '%tag%team%')
      .maybeSingle();

    if (grammarianAgendaFetchError) {
      console.error('Error fetching Tag Team agenda item:', grammarianAgendaFetchError);
      Alert.alert('Error', 'Failed to find Tag Team section');
      return;
    }

    if (!agendaItem) {
      Alert.alert('Error', 'Tag Team section not found in agenda');
      return;
    }

    const { error: updateError } = await supabase
      .from('meeting_agenda_items')
      .update({ grammarian_user_id: memberId })
      .eq('id', agendaItem.id);

    if (updateError) {
      console.error('Error updating grammarian in agenda:', updateError);
      Alert.alert('Error', 'Failed to assign Grammarian in agenda');
    } else {
      setGrammarian({ id: memberId, name: memberName });
      setGrammarianModalVisible(false);
      setSearchQuery('');
      await loadAgendaItems();
    }
  };

  const assignCustomName = async () => {
    if (!selectedItemId || !customName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    // Update local state
    setAgendaItems(items =>
      items.map(item =>
        item.id === selectedItemId
          ? { ...item, assigned_user_id: null, assigned_user_name: customName.trim() }
          : item
      )
    );

    // Update database
    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({ assigned_user_id: null, assigned_user_name: customName.trim() })
      .eq('id', selectedItemId);

    if (error) {
      console.error('Error assigning custom name:', error);
      Alert.alert('Error', 'Failed to assign name');
    } else {
      closeAssignmentModal();
    }
  };

  const updateCustomNotes = (itemId: string, notes: string) => {
    setAgendaItems(items =>
      items.map(item => (item.id === itemId ? { ...item, custom_notes: notes } : item))
    );
  };

  const saveCustomNotes = async (itemId: string, notes: string) => {
    await updateAgendaItem(itemId, { custom_notes: notes });
    setEditingItem(null);
  };

  const resetCustomNotes = async (itemId: string) => {
    setAgendaItems(items =>
      items.map(item => (item.id === itemId ? { ...item, custom_notes: null } : item))
    );
    // Exit any custom-notes editing UI for this item.
    setEditingItem(null);
    await updateAgendaItem(itemId, { custom_notes: null });
  };

  const toggleGrammarianCornerVisibility = async (itemId: string, field: 'word' | 'quote' | 'idiom', visible: boolean) => {
    try {
      const columnMap = {
        word: 'word_visible',
        quote: 'quote_visible',
        idiom: 'idiom_visible',
      };

      const { error } = await supabase
        .from('grammarian_corner_visibility')
        .update({ [columnMap[field]]: visible })
        .eq('agenda_item_id', itemId);

      if (error) {
        console.error('Error updating visibility:', error);
        Alert.alert('Error', 'Failed to update visibility');
        return;
      }

      // Update local state
      setAgendaItems(items =>
        items.map(item => {
          if (item.id === itemId && item.grammarian_corner) {
            return {
              ...item,
              grammarian_corner: {
                ...item.grammarian_corner,
                [columnMap[field]]: visible,
              },
            };
          }
          return item;
        })
      );
    } catch (error) {
      console.error('Error toggling visibility:', error);
      Alert.alert('Error', 'Failed to toggle visibility');
    }
  };

  const selectGrammarianItem = async (itemId: string, field: 'word' | 'quote' | 'idiom', selectedId: string) => {
    try {
      const columnMap = {
        word: 'selected_word_id',
        quote: 'selected_quote_id',
        idiom: 'selected_idiom_id',
      };

      const { error } = await supabase
        .from('grammarian_corner_visibility')
        .update({ [columnMap[field]]: selectedId })
        .eq('agenda_item_id', itemId);

      if (error) {
        console.error('Error updating selection:', error);
        Alert.alert('Error', 'Failed to update selection');
        return;
      }

      // Reload agenda items to get the new selection
      await loadAgendaItems();
    } catch (error) {
      console.error('Error selecting item:', error);
      Alert.alert('Error', 'Failed to select item');
    }
  };

  const updateDuration = (itemId: string, duration: string) => {
    const durationNum = parseInt(duration) || 0;
    setAgendaItems(items =>
      items.map(item => (item.id === itemId ? { ...item, duration_minutes: durationNum } : item))
    );
  };

  const addMinutesToTime = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}:00`;
  };

  const recalculateAllTimes = async (itemsToUpdate: AgendaItem[]) => {
    if (!meetingStartTime) {
      console.log('No meeting start time, skipping recalculation');
      return;
    }

    // Prevent concurrent recalculations
    if (isRecalculatingRef.current) {
      console.log('Already recalculating, skipping...');
      return;
    }

    isRecalculatingRef.current = true;
    console.log('=== RECALCULATING TIMES ===');
    console.log('Meeting start time:', meetingStartTime);

    const updatedItems = [...itemsToUpdate];
    let currentTime = meetingStartTime;

    // Contiguous times for every section in order (visibility only affects member-facing agenda, not clock math)
    for (let i = 0; i < updatedItems.length; i++) {
      updatedItems[i].start_time = currentTime;
      const duration = updatedItems[i].duration_minutes || 0;
      console.log(
        `Section ${i + 1} (${updatedItems[i].section_name}): visible=${updatedItems[i].is_visible}, duration=${duration}, start=${currentTime}`
      );

      updatedItems[i].end_time = addMinutesToTime(currentTime, duration);
      console.log(`  -> end=${updatedItems[i].end_time}`);

      currentTime = updatedItems[i].end_time!;
    }

    console.log('=== UPDATING STATE AND DB ===');
    // Update local state
    setAgendaItems(updatedItems);

    // Update all items in database with error handling
    for (let i = 0; i < updatedItems.length; i++) {
      const { error } = await supabase
        .from('meeting_agenda_items')
        .update({
          start_time: updatedItems[i].start_time,
          end_time: updatedItems[i].end_time,
          duration_minutes: updatedItems[i].duration_minutes,
        })
        .eq('id', updatedItems[i].id);

      if (error) {
        console.error(`Error updating item ${updatedItems[i].section_name}:`, error);
      } else {
        console.log(`✓ Updated ${updatedItems[i].section_name}`);
      }
    }

    isRecalculatingRef.current = false;
    console.log('=== DONE ===');
  };

  const performDurationSave = async (itemId: string) => {
    try {
      const currentItems = agendaItemsRef.current;
      const item = currentItems.find(i => i.id === itemId);
      if (!item) {
        console.log('Item not found:', itemId);
        return;
      }

      console.log('Saving duration for item:', item.section_name, 'Duration:', item.duration_minutes);

      const { error } = await supabase
        .from('meeting_agenda_items')
        .update({ duration_minutes: item.duration_minutes })
        .eq('id', itemId);

      if (error) {
        console.error('Error saving duration:', error);
        Alert.alert('Error', 'Failed to save duration');
        return;
      }

      console.log('✓ Duration saved successfully');
      console.log('Recalculating times with items:', currentItems.map(i => ({ name: i.section_name, dur: i.duration_minutes })));

      await recalculateAllTimes(currentItems);
    } finally {
      if (skipDurationBlurForItemRef.current === itemId) {
        skipDurationBlurForItemRef.current = null;
      }
    }
  };

  /** Debounced save while typing multi-digit minutes (blur still triggers this). */
  const saveDuration = (itemId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void performDurationSave(itemId);
    }, 500);
  };

  /** Save immediately when user presses Done/Enter (onBlur alone misses submit on some platforms). */
  const commitDurationNow = (itemId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Defer one tick so the last onChangeText has committed to state/ref
    setTimeout(() => {
      void performDurationSave(itemId);
    }, 0);
  };

  /** Web/Android IME "Done" / iOS accessory bar — number pads often omit Return. */
  const submitDurationFromKeyboard = (itemId: string) => {
    skipDurationBlurForItemRef.current = itemId;
    Keyboard.dismiss();
    commitDurationNow(itemId);
  };

  const persistPublicAgendaSkin = async (skin: PublicAgendaSkinId) => {
    if (skin === publicAgendaSkin) return;
    const prev = publicAgendaSkin;
    setPublicAgendaSkin(skin);
    const { error } = await supabase
      .from('app_club_meeting')
      .update({ public_agenda_skin: skin })
      .eq('id', meetingId);
    if (error) {
      setPublicAgendaSkin(prev);
      console.error('Error saving public web layout:', error);
      Alert.alert('Error', 'Could not save web layout');
    }
  };

  const publicWebAgendaUrl =
    meetingClubIdForWeb && meetingId
      ? buildAgendaWebUrl({
          clubId: meetingClubIdForWeb,
          clubDisplayName: meetingClubDisplayNameForWeb,
          meetingNumber: meetingNumberForWeb,
          meetingId,
          skin: publicAgendaSkin,
        })
      : null;

  const publicWebAgendaShortUrl =
    meetingClubIdForWeb && meetingId
      ? buildShortAgendaWebUrl({
          meetingId,
          skin: publicAgendaSkin,
          clubDisplayName: meetingClubDisplayNameForWeb,
        })
      : null;

  const handleOpenPublicWebAgenda = async () => {
    const url = publicWebAgendaShortUrl ?? publicWebAgendaUrl;
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Error', 'Unable to open this link');
    } catch (e) {
      console.error('Open public web agenda:', e);
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const flashPublicWebLinkCopied = (message: string) => {
    if (publicWebLinkCopiedTimerRef.current) {
      clearTimeout(publicWebLinkCopiedTimerRef.current);
    }
    setPublicWebLinkCopied(true);
    publicWebLinkCopiedTimerRef.current = setTimeout(() => {
      setPublicWebLinkCopied(false);
      publicWebLinkCopiedTimerRef.current = null;
    }, 2800);
    Alert.alert('Copied', message);
  };

  const handleCopyPublicWebAgendaLink = async () => {
    const url = publicWebAgendaShortUrl?.trim() ?? publicWebAgendaUrl?.trim();
    if (!url) {
      Alert.alert('Nothing to copy', 'The public link is not available yet.');
      return;
    }

    const flashCopied = () => {
      flashPublicWebLinkCopied(
        publicWebAgendaShortUrl
          ? 'Short agenda link copied to clipboard.'
          : 'Public agenda link copied to clipboard.'
      );
    };

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          flashCopied();
          return;
        }
        const ok = await Clipboard.setStringAsync(url);
        if (!ok) {
          throw new Error('Clipboard API returned false');
        }
        flashCopied();
        return;
      }

      const ok = await Clipboard.setStringAsync(url);
      if (!ok) {
        throw new Error('Clipboard unavailable');
      }
      flashCopied();
    } catch (e) {
      console.error('Copy public web agenda link:', e);
      setPublicWebLinkCopied(false);
      Alert.alert(
        'Could not copy',
        Platform.OS === 'web'
          ? 'Your browser may block clipboard access. Select the link text above and copy manually, or try again.'
          : 'Select the link text above to copy manually, or try again.'
      );
    }
  };

  const handleCopyFullPublicWebAgendaLink = async () => {
    const url = publicWebAgendaUrl?.trim();
    if (!url) {
      Alert.alert('Nothing to copy', 'The full link is not available yet.');
      return;
    }
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          flashPublicWebLinkCopied('Full agenda link copied to clipboard.');
          return;
        }
        const ok = await Clipboard.setStringAsync(url);
        if (!ok) throw new Error('Clipboard API returned false');
        flashPublicWebLinkCopied('Full agenda link copied to clipboard.');
        return;
      }
      const ok = await Clipboard.setStringAsync(url);
      if (!ok) throw new Error('Clipboard unavailable');
      flashPublicWebLinkCopied('Full agenda link copied to clipboard.');
    } catch (e) {
      console.error('Copy full public web agenda link:', e);
      setPublicWebLinkCopied(false);
      Alert.alert('Could not copy', 'Try selecting the full URL from another device or paste the short link.');
    }
  };

  const toggleAgendaVisibility = async () => {
    try {
      const newVisibility = !isAgendaVisible;

      const { error: meetingError } = await supabase
        .from('app_club_meeting')
        .update({ is_agenda_visible: newVisibility })
        .eq('id', meetingId);

      if (meetingError) {
        console.error('Error updating agenda visibility:', meetingError);
        Alert.alert('Error', 'Failed to update agenda visibility');
        return;
      }

      if (!newVisibility) {
        const { error: sectionsError } = await supabase
          .from('meeting_agenda_items')
          .update({ is_visible: false })
          .eq('meeting_id', meetingId);

        if (sectionsError) {
          console.error('Error hiding agenda sections:', sectionsError);
        } else {
          setAgendaItems(prev => prev.map(item => ({ ...item, is_visible: false })));
        }
      }

      setIsAgendaVisible(newVisibility);
      Alert.alert(
        'Success',
        newVisibility
          ? 'Agenda is now visible to all members'
          : 'Agenda and all sections are now hidden from members'
      );
    } catch (error) {
      console.error('Error toggling agenda visibility:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const openColorPicker = (type: 'club_info' | 'datetime' | 'footer1' | 'footer2') => {
    const colorMap = {
      club_info: clubInfoBannerColor,
      datetime: datetimeBannerColor,
      footer1: footerBanner1Color,
      footer2: footerBanner2Color,
    };

    router.push({
      pathname: '/admin/select-agenda-color',
      params: {
        meetingId: meetingId,
        colorType: type,
        currentColor: colorMap[type],
      },
    });
  };


  const updateGrammarianField = async (field: 'word_of_the_day' | 'phrase_of_the_day' | 'idiom_of_the_day' | 'quote_of_the_day', value: string) => {
    const { error } = await supabase
      .from('app_club_meeting')
      .update({ [field]: value })
      .eq('id', meetingId);

    if (error) {
      console.error(`Error updating ${field}:`, error);
      Alert.alert('Error', `Failed to update ${field.replace(/_/g, ' ')}`);
    }
  };

  const updateTheme = async () => {
    const { error } = await supabase
      .from('app_club_meeting')
      .update({ theme: themeOfTheDay })
      .eq('id', meetingId);

    if (error) {
      console.error('Error updating theme:', error);
      Alert.alert('Error', 'Failed to update theme');
    }
  };

  /** Pull theme from toastmaster_meeting_data (Toastmaster corner) into meeting agenda (app_club_meeting.theme). */
  const autoFillThemeFromToastmasterCorner = async () => {
    if (themeFromCornerLoading) return;
    setThemeFromCornerLoading(true);
    try {
      const themeText = await fetchToastmasterCornerThemeValue();
      if (!themeText) {
        Alert.alert(
          'No theme in Toastmaster corner',
          'Add and save the Theme of the Day in Toastmaster corner for this meeting, then tap Auto Fill again.'
        );
        return;
      }
      setThemeOfTheDay(themeText);
      const { error } = await supabase
        .from('app_club_meeting')
        .update({ theme: themeText })
        .eq('id', meetingId);
      if (error) {
        console.error('Error saving theme to meeting:', error);
        Alert.alert('Error', 'Could not save theme to the meeting agenda.');
        return;
      }
      setToastmasterCornerTheme(themeText);
    } finally {
      setThemeFromCornerLoading(false);
    }
  };

  const autoFillEducationSpeechTitleFromEducationalCorner = async (agendaItemId: string) => {
    if (educationTitleFromCornerLoading) return;
    setEducationTitleFromCornerLoading(true);
    try {
      let bookedUserId: string | null = null;
      const byClass = await fetchLatestBookedAssignee({
        kind: 'classification',
        value: 'Educational speaker',
      });
      if (byClass?.userId) {
        bookedUserId = byClass.userId;
      } else {
        const byName = await fetchLatestBookedAssignee({
          kind: 'ilike_role',
          pattern: '%educational%speaker%',
        });
        bookedUserId = byName?.userId ?? null;
      }

      const q = supabase
        .from('app_meeting_educational_speaker')
        .select('speech_title')
        .eq('meeting_id', meetingId)
        .order('updated_at', { ascending: false })
        .limit(1);

      const cornerQuery = bookedUserId ? q.eq('speaker_user_id', bookedUserId) : q;
      const { data: cornerRows, error: cornerErr } = await cornerQuery;

      if (cornerErr) {
        console.error('Error loading Educational corner speech title:', cornerErr);
      }

      const cornerTitle = (cornerRows?.[0]?.speech_title || '').trim();
      if (!cornerTitle) {
        Alert.alert(
          'No educational title found',
          'Add and save the Educational Speech Title in Educational Corner for this meeting, then tap Auto Fill again.'
        );
        return;
      }

      setEducationSpeechTitle(cornerTitle);

      const { error: updateError } = await supabase
        .from('meeting_agenda_items')
        .update({
          educational_topic: cornerTitle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agendaItemId);

      if (updateError) {
        console.error('Error saving educational_topic to agenda:', updateError);
        Alert.alert('Error', 'Could not save educational title to the agenda.');
        return;
      }
    } finally {
      setEducationTitleFromCornerLoading(false);
    }
  };

  const updateKeynoteSpeechTitle = async (agendaItemId: string, value: string) => {
    const existingRoleDetails =
      (agendaItemsRef.current.find(i => i.id === agendaItemId)?.role_details as any) || {};
    const nextRoleDetails = {
      ...existingRoleDetails,
      speech_title: value.trim() || null,
    };

    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({
        role_details: nextRoleDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agendaItemId);

    if (error) {
      console.error('Error updating keynote title in agenda:', error);
      Alert.alert('Error', 'Failed to update keynote title');
      return;
    }

    setAgendaItems(items =>
      items.map(i => (i.id === agendaItemId ? { ...i, role_details: nextRoleDetails } : i))
    );
  };

  const autoFillKeynoteSpeechTitleFromCorner = async (agendaItem: AgendaItem) => {
    if (keynoteTitleFromCornerLoading) return;
    setKeynoteTitleFromCornerLoading(true);
    try {
      // Clear existing content first (and persist clearing if no data exists)
      setKeynoteSpeechTitle('');

      const booked = await fetchLatestBookedAssignee({ kind: 'ilike_role', pattern: '%keynote%' });
      const bookedUserId = booked?.userId ?? null;

      let title = '';
      if (bookedUserId) {
        const { data: rows, error } = await supabase
          .from('app_meeting_keynote_speaker')
          .select('speech_title')
          .eq('meeting_id', meetingId)
          .eq('speaker_user_id', bookedUserId)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) console.error('Error loading keynote title (booked):', error);
        title = (rows?.[0]?.speech_title || '').trim();
      } else {
        const { data: rows, error } = await supabase
          .from('app_meeting_keynote_speaker')
          .select('speech_title')
          .eq('meeting_id', meetingId)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) console.error('Error loading keynote title (latest):', error);
        title = (rows?.[0]?.speech_title || '').trim();
      }

      setKeynoteSpeechTitle(title);
      await updateKeynoteSpeechTitle(agendaItem.id, title);
    } finally {
      setKeynoteTitleFromCornerLoading(false);
    }
  };

  const autoFillGrammarianCornerDailyHighlights = async (agendaItem: AgendaItem) => {
    if (grammarianCornerAutoFillLoading) return;
    setGrammarianCornerAutoFillLoading(true);
    try {
      const gc = agendaItem.grammarian_corner;
      const word = (gc?.word_of_the_day?.word || '').trim();
      const quote = (gc?.quote_of_the_day?.quote || '').trim();
      const idiom = (gc?.idiom_of_the_day?.idiom || '').trim();

      // Always clear existing content first, then overwrite from published data (if any).
      setWordOfTheDay(word);
      setQuoteOfTheDay(quote);
      setIdiomOfTheDay(idiom);

      const existingRoleDetails =
        (agendaItemsRef.current.find(i => i.id === agendaItem.id)?.role_details as any) || {};
      const nextRoleDetails = {
        ...existingRoleDetails,
        grammarian_corner: {
          ...(existingRoleDetails?.grammarian_corner || {}),
          word_of_the_day: word || null,
          quote_of_the_day: quote || null,
          idiom_of_the_day: idiom || null,
        },
      };

      const { error } = await supabase
        .from('meeting_agenda_items')
        .update({
          role_details: nextRoleDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agendaItem.id);

      if (error) {
        console.error('Error saving grammarian highlights to meeting_agenda_items:', error);
        Alert.alert('Error', 'Could not save grammarian highlights to the meeting agenda.');
        return;
      }

      setAgendaItems(items =>
        items.map(i => (i.id === agendaItem.id ? { ...i, role_details: nextRoleDetails } : i))
      );
    } finally {
      setGrammarianCornerAutoFillLoading(false);
    }
  };

  /** Auto-fill assignments + corner details across the entire agenda. */
  const autoFillEntireAgenda = async () => {
    if (masterAutoFillLoading) return;
    setMasterAutoFillLoading(true);
    const originalAlert = Alert.alert;
    (Alert as any).alert = () => {};
    try {
      const itemsToFill = [...(agendaItemsRef.current || [])];
      if (!itemsToFill.length) return;

      const hasToastmaster = itemsToFill.some(
        (i) => i.section_name.toLowerCase().includes('toastmaster')
      );
      if (hasToastmaster) {
        await autoFillThemeFromToastmasterCorner();
      }

      for (const item of itemsToFill) {
        const s = item.section_name.toLowerCase();

        if (s.includes('call to order')) {
          await autoFillAgendaAssignmentFromSergeantAtArmsBooking(item);
        } else if (s.includes('toastmaster')) {
          await autoFillAgendaAssignmentFromToastmasterBooking(item);
        } else if (
          s.includes('presiding officer') ||
          s.includes('closing remarks') ||
          s.includes('awards')
        ) {
          await autoFillAgendaAssignmentFromPresidingOfficerBooking(item.id);
        } else if (isGeneralEvaluatorOpeningOrFeedbackSection(item.section_name)) {
          await autoFillAgendaAssignmentFromGeneralEvaluatorBooking(item.id);
        } else if (s.includes('keynote')) {
          await autoFillKeynoteSpeakerFromBooking(item);
          await autoFillKeynoteSpeechTitleFromCorner(item);
        } else if (s.includes('listener')) {
          // Inline logic from the Listener auto-fill button.
          const booked = await fetchLatestBookedAssignee({
            kind: 'ilike_role',
            pattern: '%listener%',
          });
          if (!booked) {
            Alert.alert('Not assigned', 'Listener is not booked for this meeting yet.');
            continue;
          }
          const { userId: bookedUserId, userName: bookedUserName } = booked;
          if (agendaAssigneeInSync(item, bookedUserId, bookedUserName)) continue;

          const { error: updateError } = await supabase
            .from('meeting_agenda_items')
            .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
            .eq('id', item.id);

          if (updateError) {
            console.error('Error auto-filling Listener assignment:', updateError);
            Alert.alert('Error', 'Failed to update Listener assignment');
          } else {
            setAgendaItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
                  : i
              )
            );
          }
        } else if (s.includes('quiz')) {
          // Inline logic from the Quiz Session auto-fill button.
          const booked = await fetchLatestBookedAssignee({
            kind: 'ilike_role',
            pattern: '%quiz%master%',
          });
          if (!booked) {
            Alert.alert('Not assigned', 'Quiz Master is not booked for this meeting yet.');
            continue;
          }
          const { userId: bookedUserId, userName: bookedUserName } = booked;
          if (agendaAssigneeInSync(item, bookedUserId, bookedUserName)) continue;

          const { error: updateError } = await supabase
            .from('meeting_agenda_items')
            .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
            .eq('id', item.id);

          if (updateError) {
            console.error('Error auto-filling Quiz Session assignment:', updateError);
            Alert.alert('Error', 'Failed to update Quiz Session assignment');
          } else {
            setAgendaItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
                  : i
              )
            );
          }
        } else if (s.includes('educational speaker')) {
          await autoFillEducationalSpeakerFromBooking(item);
          await autoFillEducationSpeechTitleFromEducationalCorner(item.id);
        } else if (s.includes('tag team')) {
          await autoFillTagTeamFromBookedRoles(item.id);
        } else if (getBookedRoleNameForTagReportSection(item.section_name) != null) {
          await autoFillTagTeamReportFromBooking(item);
        } else if (s.includes('table topic')) {
          await autoFillTableTopicsMasterFromBooking(item);
        } else if (item.section_name === 'Grammarian Corner') {
          await autoFillGrammarianCornerDailyHighlights(item);
        } else if (s.includes('prepared speeches')) {
          await autoFillPreparedSpeechesFromPathway(item);
        }
      }

      // Refresh from DB to ensure everything is in sync after multiple patches.
      await loadAgendaItems();
    } catch (e) {
      console.error('autoFillEntireAgenda error:', e);
    } finally {
      (Alert as any).alert = originalAlert;
      setMasterAutoFillLoading(false);
      Alert.alert('Done', 'Auto fill entire agenda completed.');
    }
  };

  const updateGrammarianCornerAgendaField = async (
    agendaItemId: string,
    field: 'word_of_the_day' | 'quote_of_the_day' | 'idiom_of_the_day',
    value: string
  ) => {
    const existingRoleDetails =
      (agendaItemsRef.current.find(i => i.id === agendaItemId)?.role_details as any) || {};
    const nextRoleDetails = {
      ...existingRoleDetails,
      grammarian_corner: {
        ...(existingRoleDetails?.grammarian_corner || {}),
        [field]: value.trim() || null,
      },
    };

    const { error } = await supabase
      .from('meeting_agenda_items')
      .update({
        role_details: nextRoleDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agendaItemId);

    if (error) {
      console.error('Error saving grammarian field to meeting_agenda_items:', error);
      Alert.alert('Error', 'Failed to save grammarian field');
      return;
    }

    setAgendaItems(items =>
      items.map(i => (i.id === agendaItemId ? { ...i, role_details: nextRoleDetails } : i))
    );
  };

  const updateEducationSpeechTitle = async () => {
    try {
      const { error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .update({
          educational_topic: educationSpeechTitle,
          updated_at: new Date().toISOString()
        })
        .eq('meeting_id', meetingId)
        .eq('section_name', 'Educational Speaker');

      if (agendaError) {
        console.error('Error updating agenda educational topic:', agendaError);
        Alert.alert('Error', 'Failed to update educational topic');
        return;
      }

      await loadAgendaItems();
    } catch (error) {
      console.error('Error in updateEducationSpeechTitle:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving');
    }
  };

  const getSectionTypeTag = (item: AgendaItem) => {
    // Check both role_details and template role_classification
    const roleClass = (item.role_details?.role_classification || item.role_classification)?.toLowerCase();

    // Tag Team already shows a dedicated icon at the start of the header.
    // Avoid the extra orange "TAG TEAM" type pill to prevent duplication.
    if (roleClass === 'tag_team' || item.section_name.toLowerCase().includes('tag team')) {
      return null;
    }

    if (roleClass === 'education_speech' || roleClass === 'educational_speaker' ||
        item.section_name.toLowerCase().includes('education')) {
      return { label: 'Education Speech', color: '#8b5cf6', bgColor: '#8b5cf615' };
    }

    return null;
  };

  const allSectionNames = useMemo(
    () => [...new Set(agendaItems.map((i) => i.section_name))].sort((a, b) => {
      const aItem = agendaItems.find((i) => i.section_name === a);
      const bItem = agendaItems.find((i) => i.section_name === b);
      return (aItem?.section_order ?? 0) - (bItem?.section_order ?? 0);
    }),
    [agendaItems]
  );
  const filteredAgendaItems = useMemo(() => {
    if (sectionFilter === 'all') return agendaItems;
    return agendaItems.filter((i) => sectionFilter.has(i.section_name));
  }, [agendaItems, sectionFilter]);

  const sectionBulkVisibilityState = useMemo(() => {
    const visibleCount = agendaItems.filter((i) => i.is_visible).length;
    const total = agendaItems.length;
    return {
      visibleCount,
      hiddenCount: total - visibleCount,
      allVisible: total > 0 && visibleCount === total,
      allHidden: total > 0 && visibleCount === 0,
    };
  }, [agendaItems]);

  const toggleSectionInFilter = (name: string) => {
    if (sectionFilter === 'all') {
      const next = new Set(allSectionNames.filter((n) => n !== name));
      setSectionFilter(next);
    } else {
      const next = new Set(sectionFilter);
      if (next.has(name)) {
        next.delete(name);
        setSectionFilter(next);
      } else {
        next.add(name);
        setSectionFilter(next.size === allSectionNames.length ? 'all' : next);
      }
    }
  };
  const isSectionSelected = (name: string) =>
    sectionFilter === 'all' || sectionFilter.has(name);

  const moveItemUp = async (index: number) => {
    if (index === 0) return;

    const newItems = [...agendaItems];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;

    // Update section_order for both items
    const reorderedItems = newItems.map((item, idx) => ({
      ...item,
      section_order: idx + 1,
    }));

    // Update local state immediately
    setAgendaItems(reorderedItems);

    // Update database
    for (let i = 0; i < reorderedItems.length; i++) {
      await supabase
        .from('meeting_agenda_items')
        .update({ section_order: reorderedItems[i].section_order })
        .eq('id', reorderedItems[i].id);
    }

    // Always recalculate from the beginning when reordering
    recalculateAllTimes(reorderedItems);
  };

  const moveItemDown = async (index: number) => {
    if (index === agendaItems.length - 1) return;

    const newItems = [...agendaItems];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;

    // Update section_order for both items
    const reorderedItems = newItems.map((item, idx) => ({
      ...item,
      section_order: idx + 1,
    }));

    // Update local state immediately
    setAgendaItems(reorderedItems);

    // Update database
    for (let i = 0; i < reorderedItems.length; i++) {
      await supabase
        .from('meeting_agenda_items')
        .update({ section_order: reorderedItems[i].section_order })
        .eq('id', reorderedItems[i].id);
    }

    // Always recalculate from the beginning when reordering
    recalculateAllTimes(reorderedItems);
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // All updates are saved individually, so just show success
      Alert.alert('Success', 'All changes saved successfully');
      router.back();
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
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

  const moveSpeaker = async (speakers: PreparedSpeaker[], index: number, direction: 'up' | 'down', isIceBreaker: boolean = false) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === speakers.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentSpeaker = speakers[index];
    const targetSpeaker = speakers[targetIndex];

    try {
      // Swap role names in database
      const { error: error1 } = await supabase
        .from('app_evaluation_pathway')
        .update({ role_name: targetSpeaker.role_name })
        .eq('id', currentSpeaker.id);

      const { error: error2 } = await supabase
        .from('app_evaluation_pathway')
        .update({ role_name: currentSpeaker.role_name })
        .eq('id', targetSpeaker.id);

      if (error1 || error2) {
        console.error('Error swapping speakers:', error1 || error2);
        Alert.alert('Error', 'Failed to reorder speakers');
        return;
      }

      // Reload the speakers list
      if (isIceBreaker) {
        await loadIceBreakers();
      } else {
        await loadPreparedSpeakers();
      }
    } catch (error) {
      console.error('Error moving speaker:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading agenda items...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Edit Agenda</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleSaveAll}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Save size={20} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.editorTabRow,
          { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.editorTab,
            {
              backgroundColor: agendaEditorTab === 'settings' ? theme.colors.primary : 'transparent',
              borderColor: agendaEditorTab === 'settings' ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={() => setAgendaEditorTab('settings')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.editorTabText,
              { color: agendaEditorTab === 'settings' ? '#ffffff' : theme.colors.text },
            ]}
            maxFontSizeMultiplier={1.12}
          >
            Agenda Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.editorTab,
            {
              backgroundColor: agendaEditorTab === 'sections' ? theme.colors.primary : 'transparent',
              borderColor: agendaEditorTab === 'sections' ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={() => setAgendaEditorTab('sections')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.editorTabText,
              { color: agendaEditorTab === 'sections' ? '#ffffff' : theme.colors.text },
            ]}
            maxFontSizeMultiplier={1.12}
          >
            Agenda Section
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {agendaEditorTab === 'settings' ? (
        <>
        <View
          style={[
            styles.notionAgendaVisibilitySheet,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.notionVisibilitySheetHeader,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.notionVisibilitySheetTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Agenda Visibility
            </Text>
          </View>

          <View
            style={[
              styles.notionVisibilityMemberRow,
              agendaItems.length > 0 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.agendaMemberVisibilityLeft}>
              {isAgendaVisible ? (
                <Eye size={20} color={theme.colors.primary} />
              ) : (
                <EyeOff size={20} color={theme.colors.textSecondary} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.agendaMemberVisibilityTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Show meeting agenda to members
                </Text>
                <Text style={[styles.agendaMemberVisibilityHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                  {isAgendaVisible ? 'Visible to members' : 'Hidden from members'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.agendaMemberVisibilityToggle,
                {
                  backgroundColor: isAgendaVisible ? theme.colors.primary : theme.colors.background,
                  borderColor: isAgendaVisible ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={toggleAgendaVisibility}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={isAgendaVisible ? 'Hide agenda from members' : 'Show agenda to members'}
            >
              {isAgendaVisible ? (
                <Eye size={16} color="#ffffff" />
              ) : (
                <EyeOff size={16} color={theme.colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          {agendaItems.length > 0 && (
            <>
              <View
                style={[
                  styles.notionVisibilityMetaRow,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.notionVisibilityMetaText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
                  {sectionBulkVisibilityState.visibleCount} visible · {sectionBulkVisibilityState.hiddenCount} hidden
                </Text>
              </View>
              <View style={styles.notionVisibilitySegmentRow}>
                <TouchableOpacity
                  style={[
                    styles.notionVisibilitySegmentHalf,
                    sectionBulkVisibilityState.allVisible && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setAllSectionsVisibility(true)}
                  activeOpacity={0.75}
                >
                  <Eye
                    size={16}
                    color={
                      sectionBulkVisibilityState.allVisible
                        ? '#ffffff'
                        : sectionBulkVisibilityState.allHidden
                          ? theme.colors.textSecondary
                          : theme.colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.sectionVisibilityButtonText,
                      {
                        color: sectionBulkVisibilityState.allVisible
                          ? '#ffffff'
                          : sectionBulkVisibilityState.allHidden
                            ? theme.colors.textSecondary
                            : theme.colors.primary,
                      },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    Show all
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.notionVisibilitySegmentDivider,
                    { backgroundColor: theme.colors.border },
                  ]}
                />
                <TouchableOpacity
                  style={[
                    styles.notionVisibilitySegmentHalf,
                    sectionBulkVisibilityState.allHidden && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setAllSectionsVisibility(false)}
                  activeOpacity={0.75}
                >
                  <EyeOff
                    size={16}
                    color={sectionBulkVisibilityState.allHidden ? '#ffffff' : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sectionVisibilityButtonText,
                      {
                        color: sectionBulkVisibilityState.allHidden ? '#ffffff' : theme.colors.textSecondary,
                      },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    Hide all
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View
          style={[
            styles.notionAgendaVisibilitySheet,
            { marginTop: 0, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.notionVisibilitySheetHeader,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.notionVisibilitySheetTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Public web layout
            </Text>
          </View>
          {(
            [
              { id: 'default' as const, title: 'Default', subtitle: 'Banners and section cards' },
              { id: 'minimal' as const, title: 'Minimal', subtitle: 'Simple list' },
              { id: 'vibrant' as const, title: 'Vibrant', subtitle: 'Bold cards' },
            ] as const
          ).map((opt) => {
            const selected = publicAgendaSkin === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.notionPublicWebSkinRow,
                  {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.colors.border,
                    backgroundColor: selected ? theme.colors.primary + '14' : 'transparent',
                    borderLeftWidth: selected ? 3 : 0,
                    borderLeftColor: theme.colors.primary,
                  },
                ]}
                onPress={() => persistPublicAgendaSkin(opt.id)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.publicWebSkinOptionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                    {opt.title}
                  </Text>
                  <Text style={[styles.publicWebSkinOptionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                    {opt.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {publicWebAgendaUrl ? (
            <>
              <View
                style={[
                  styles.notionPublicWebMetaBlock,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[styles.publicWebLinkText, { color: theme.colors.textSecondary }]}
                  numberOfLines={4}
                  maxFontSizeMultiplier={1.15}
                  selectable
                >
                  {publicWebAgendaShortUrl ?? publicWebAgendaUrl}
                </Text>
                {isAgendaVisible === false ? (
                  <Text style={[styles.publicWebLinkHint, { color: theme.colors.warningDark }]} maxFontSizeMultiplier={1.1}>
                    Public web link will not open until Agenda Visibility is set to Visible to members.
                  </Text>
                ) : null}
              </View>
              <View style={styles.notionPublicWebActionsRow}>
                <TouchableOpacity
                  style={[styles.notionPublicWebActionPrimary, { backgroundColor: theme.colors.primary }]}
                  onPress={handleOpenPublicWebAgenda}
                  activeOpacity={0.85}
                >
                  <ExternalLink size={16} color="#ffffff" />
                  <Text style={styles.publicWebLinkPrimaryButtonLabel} maxFontSizeMultiplier={1.1}>
                    Open
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.notionPublicWebActionDivider,
                    { backgroundColor: theme.colors.border },
                  ]}
                />
                <TouchableOpacity
                  style={[
                    styles.notionPublicWebActionOutline,
                    { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => {
                    void handleCopyPublicWebAgendaLink();
                  }}
                  activeOpacity={0.85}
                >
                  <Copy size={16} color={theme.colors.primary} />
                  <Text style={[styles.publicWebLinkOutlineButtonLabel, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.1}>
                    {publicWebLinkCopied ? 'Copied!' : 'Copy short link'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.notionPublicWebCopyFullRow,
                  {
                    borderTopColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                onPress={() => {
                  void handleCopyFullPublicWebAgendaLink();
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.notionPublicWebCopyFullLabel, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.1}>
                  Copy full URL (club path)
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.notionPublicWebEmptyRow}>
              <Text style={[styles.publicWebLinkHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                Save meeting details first to generate a public web link.
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.notionAgendaVisibilitySheet,
            { marginTop: 0, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.notionVisibilitySheetHeader,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.notionVisibilitySheetTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Banner Colors
            </Text>
            <Text style={[styles.notionBannerColorsSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Used on the public web agenda banners.
            </Text>
          </View>
          {(
            [
              { id: 'club_info' as const, label: 'Club Info Banner', value: clubInfoBannerColor },
              { id: 'datetime' as const, label: 'Date/Time Banner', value: datetimeBannerColor },
              { id: 'footer1' as const, label: 'Footer Banner 1', value: footerBanner1Color },
              { id: 'footer2' as const, label: 'Footer Banner 2', value: footerBanner2Color },
            ] as const
          ).map((row, index, arr) => (
            <TouchableOpacity
              key={row.id}
              style={[
                styles.notionBannerColorRow,
                {
                  borderBottomWidth: index < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: theme.colors.border,
                },
              ]}
              onPress={() => openColorPicker(row.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.notionBannerColorRowLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {row.label}
              </Text>
              <View style={[styles.colorPreview, { backgroundColor: row.value, borderColor: theme.colors.border }]} />
              <View
                style={[
                  styles.colorInput,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.colorInputText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {row.value}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        </>
        ) : null}

        {agendaEditorTab === 'sections' ? (
        <View
          style={[
            styles.notionSectionsSheet,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
        <TouchableOpacity
          style={[
            styles.notionSectionsToolbarRow,
            {
              backgroundColor: theme.colors.primary + '18',
              borderBottomColor: theme.colors.border,
              opacity: masterAutoFillLoading ? 0.6 : 1,
              justifyContent: masterAutoFillLoading ? 'center' : 'flex-start',
            },
          ]}
          onPress={autoFillEntireAgenda}
          disabled={masterAutoFillLoading}
          activeOpacity={0.7}
        >
          {masterAutoFillLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Zap size={20} color={theme.colors.primary} />
              <Text style={[styles.manageSequenceButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                Auto Fill Entire Agenda
              </Text>
            </>
          )}
        </TouchableOpacity>

        {agendaItems.length > 0 && (
          <TouchableOpacity
            onPress={() => setManageSequenceModalVisible(true)}
            style={[
              styles.notionSectionsToolbarRow,
              {
                backgroundColor: theme.colors.primary + '18',
                borderBottomColor: theme.colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <ListOrdered size={20} color={theme.colors.primary} />
            <Text style={[styles.manageSequenceButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              Manage sequence ({agendaItems.length} sections)
            </Text>
          </TouchableOpacity>
        )}

        {agendaItems.length > 0 && (
          <TouchableOpacity
            onPress={() => setSectionFilterModalVisible(true)}
            style={[
              styles.notionSectionsToolbarRow,
              {
                backgroundColor: theme.colors.surface,
                borderBottomColor: theme.colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Filter size={18} color={theme.colors.primary} />
            <Text style={[styles.notionSectionsToolbarRowText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {sectionFilter === 'all'
                ? `Showing all ${agendaItems.length} sections`
                : `Showing ${filteredAgendaItems.length} of ${agendaItems.length} sections`}
            </Text>
            <ChevronDown size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}

        {agendaItems.length === 0 ? (
          <View style={styles.notionSectionsEmptyState}>
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Agenda Sections Found
            </Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Agenda sections should be created automatically when a meeting is created. Click the button below to create them now.
            </Text>
            <TouchableOpacity
              style={[styles.createSectionsButton, { backgroundColor: theme.colors.primary }]}
              onPress={createAgendaSections}
            >
              <Text style={styles.createSectionsButtonText} maxFontSizeMultiplier={1.3}>
                Create Agenda Sections
              </Text>
            </TouchableOpacity>
          </View>
        ) : filteredAgendaItems.length === 0 ? (
          <View style={styles.notionSectionsEmptyState}>
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No sections selected
            </Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Use the filter above to select which sections to display.
            </Text>
          </View>
        ) : (
          filteredAgendaItems.map((item, rowIndex) => {
          const index = agendaItems.findIndex((i) => i.id === item.id);
          const isLastRow = rowIndex === filteredAgendaItems.length - 1;
          return (
          <View
            key={item.id}
            style={[
              styles.agendaCard,
              { backgroundColor: theme.colors.surface },
              !isLastRow && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                {item.section_name.toLowerCase().includes('tag team') ? (
                  <View style={[styles.tagTeamIconWrap, { backgroundColor: '#f59e0b18' }]}>
                    <Users2 size={22} color="#f59e0b" />
                  </View>
                ) : item.section_icon ? (
                  <Text style={styles.sectionIcon} maxFontSizeMultiplier={1.3}>{item.section_icon}</Text>
                ) : null}
                <View style={styles.titleContainer}>
                  <View style={styles.titleWithTags}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {item.section_name}
                    </Text>
                    {getSectionTypeTag(item) && (
                      <View style={[styles.sectionTypeTag, {
                        backgroundColor: getSectionTypeTag(item)!.bgColor,
                        borderColor: getSectionTypeTag(item)!.color
                      }]}>
                        <Text style={[styles.sectionTypeTagText, {
                          color: getSectionTypeTag(item)!.color
                        }]} maxFontSizeMultiplier={1.3}>
                          {getSectionTypeTag(item)!.label}
                        </Text>
                      </View>
                    )}
                    {!item.is_visible && (
                      <View style={styles.hiddenBadge}>
                        <Text style={styles.hiddenBadgeText} maxFontSizeMultiplier={1.3}>HIDDEN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.sectionOrder, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Section {item.section_order}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <View style={styles.reorderButtons}>
                  <TouchableOpacity
                    onPress={() => moveItemUp(index)}
                    disabled={index === 0}
                    style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                  >
                    <ChevronUp
                      size={18}
                      color={index === 0 ? theme.colors.border : theme.colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveItemDown(index)}
                    disabled={index === agendaItems.length - 1}
                    style={[styles.reorderButton, index === agendaItems.length - 1 && styles.reorderButtonDisabled]}
                  >
                    <ChevronDown
                      size={18}
                      color={index === agendaItems.length - 1 ? theme.colors.border : theme.colors.primary}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    toggleVisibility(item.id, item.is_visible);
                  }}
                  style={[
                    styles.sectionHeaderEyeButton,
                    {
                      backgroundColor: item.is_visible ? '#16a34a' : '#ef4444',
                      borderColor: item.is_visible ? '#15803d' : '#dc2626',
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  {item.is_visible ? (
                    <Eye size={18} color="#ffffff" />
                  ) : (
                    <EyeOff size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardContent}>
              {item.section_name !== 'Grammarian Corner' && (
                <View style={styles.timeRow}>
                  <View style={[styles.timeChip, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Clock size={14} color={theme.colors.primary} />
                    <Text style={[styles.timeChipText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                      {formatTime(item.start_time)} - {formatTime(item.end_time)}
                    </Text>
                  </View>
                </View>
              )}

              {item.section_name !== 'Grammarian Corner' && (
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Duration (minutes):
                  </Text>
                  {Platform.OS === 'ios' ? (
                    <InputAccessoryView nativeID={`agenda-duration-${item.id}`}>
                      <View
                        style={[
                          styles.durationInputAccessoryBar,
                          {
                            backgroundColor: theme.colors.surface,
                            borderTopColor: theme.colors.border,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => submitDurationFromKeyboard(item.id)}
                          style={styles.durationInputAccessoryButton}
                          hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
                        >
                          <Text style={[styles.durationInputAccessoryButtonText, { color: theme.colors.primary }]}>
                            Done
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </InputAccessoryView>
                  ) : null}
                  <TextInput
                    style={[styles.durationInput, {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border
                    }]}
                    value={item.duration_minutes?.toString() || ''}
                    onChangeText={(text) => updateDuration(item.id, text)}
                    onBlur={() => {
                      if (skipDurationBlurForItemRef.current === item.id) {
                        skipDurationBlurForItemRef.current = null;
                        return;
                      }
                      saveDuration(item.id);
                    }}
                    onSubmitEditing={() => submitDurationFromKeyboard(item.id)}
                    blurOnSubmit
                    multiline={false}
                    returnKeyType="done"
                    keyboardType="numeric"
                    inputAccessoryViewID={Platform.OS === 'ios' ? `agenda-duration-${item.id}` : undefined}
                    {...(Platform.OS === 'android'
                      ? { submitBehavior: 'blurAndSubmit' as const }
                      : {})}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
              )}

              {item.is_role_based && (
                <>
                  {!item.section_name.toLowerCase().includes('voting') &&
                   !item.section_name.toLowerCase().includes('prepared speeches') &&
                   !item.section_name.toLowerCase().includes('ice breaker') && (
                   !item.section_name.toLowerCase().includes('speech evaluation') &&
                   !item.section_name.toLowerCase().includes('speech eval')) && (
                    <View style={styles.assignmentRow}>
                      <TouchableOpacity
                        onPress={() => openAssignmentModal(item.id)}
                        style={[styles.assignmentButton, {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          flex: 1,
                        }]}
                      >
                        <Text style={[styles.assignedLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Assigned to:
                        </Text>
                        <View style={styles.assignmentValueRow}>
                          <Text style={[styles.assignedName, {
                            color: item.assigned_user_name ? theme.colors.text : theme.colors.textSecondary
                          }]} maxFontSizeMultiplier={1.3}>
                            {item.assigned_user_name || 'TBA'}
                          </Text>
                          <UserPlus size={16} color={theme.colors.primary} />
                        </View>
                      </TouchableOpacity>

                      {item.section_name.toLowerCase().includes('call to order') && (
                        <TouchableOpacity
                          onPress={() => autoFillAgendaAssignmentFromSergeantAtArmsBooking(item)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {item.section_name.toLowerCase().includes('toastmaster') && (
                        <TouchableOpacity
                          onPress={() => autoFillAgendaAssignmentFromToastmasterBooking(item)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {(item.section_name.toLowerCase().includes('presiding officer') ||
                        item.section_name.toLowerCase().includes('closing remarks') ||
                        item.section_name.toLowerCase().includes('awards')) && (
                        <TouchableOpacity
                          onPress={() => autoFillAgendaAssignmentFromPresidingOfficerBooking(item.id)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {isGeneralEvaluatorOpeningOrFeedbackSection(item.section_name) && (
                        <TouchableOpacity
                          onPress={() => autoFillAgendaAssignmentFromGeneralEvaluatorBooking(item.id)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {item.section_name.toLowerCase().includes('keynote') && (
                        <TouchableOpacity
                          onPress={() => autoFillKeynoteSpeakerFromBooking(item)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {item.section_name.toLowerCase().includes('listener') && (
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              setAutoFillItemId(item.id);
                              const booked = await fetchLatestBookedAssignee({
                                kind: 'ilike_role',
                                pattern: '%listener%',
                              });
                              if (!booked) {
                                Alert.alert('Not assigned', 'Listener is not booked for this meeting yet.');
                                return;
                              }
                              const { userId: bookedUserId, userName: bookedUserName } = booked;
                              if (agendaAssigneeInSync(item, bookedUserId, bookedUserName)) return;
                              const { error: updateError } = await supabase
                                .from('meeting_agenda_items')
                                .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
                                .eq('id', item.id);
                              if (updateError) {
                                console.error('Error updating Listener Section assignment:', updateError);
                                Alert.alert('Error', 'Failed to update Listener assignment');
                                return;
                              }
                              setAgendaItems(items =>
                                items.map(i =>
                                  i.id === item.id
                                    ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
                                    : i
                                )
                              );
                            } catch (e) {
                              console.error('Error auto-filling Listener assignment:', e);
                              Alert.alert('Error', 'An unexpected error occurred');
                            } finally {
                              setAutoFillItemId(null);
                            }
                          }}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {item.section_name.toLowerCase().includes('quiz') && (
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              setAutoFillItemId(item.id);
                              const booked = await fetchLatestBookedAssignee({
                                kind: 'ilike_role',
                                pattern: '%quiz%master%',
                              });
                              if (!booked) {
                                Alert.alert('Not assigned', 'Quiz Master is not booked for this meeting yet.');
                                return;
                              }
                              const { userId: bookedUserId, userName: bookedUserName } = booked;
                              if (agendaAssigneeInSync(item, bookedUserId, bookedUserName)) return;
                              const { error: updateError } = await supabase
                                .from('meeting_agenda_items')
                                .update({ assigned_user_id: bookedUserId, assigned_user_name: bookedUserName })
                                .eq('id', item.id);
                              if (updateError) {
                                console.error('Error updating Quiz Session assignment:', updateError);
                                Alert.alert('Error', 'Failed to update Quiz Session assignment');
                                return;
                              }
                              setAgendaItems(items =>
                                items.map(i =>
                                  i.id === item.id
                                    ? { ...i, assigned_user_id: bookedUserId, assigned_user_name: bookedUserName }
                                    : i
                                )
                              );
                            } catch (e) {
                              console.error('Error auto-filling Quiz Session:', e);
                              Alert.alert('Error', 'An unexpected error occurred');
                            } finally {
                              setAutoFillItemId(null);
                            }
                          }}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {item.section_name.toLowerCase().includes('educational speaker') && (
                        <TouchableOpacity
                          onPress={() => autoFillEducationalSpeakerFromBooking(item)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {getBookedRoleNameForTagReportSection(item.section_name) != null && (
                        <TouchableOpacity
                          onPress={() => autoFillTagTeamReportFromBooking(item)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {item.section_name.toLowerCase().includes('table topic') && (
                        <TouchableOpacity
                          onPress={() => autoFillTableTopicsMasterFromBooking(item)}
                          disabled={autoFillItemId === item.id}
                          style={[styles.autoFillButton, {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: autoFillItemId === item.id ? 0.6 : 1,
                          }]}
                        >
                          {autoFillItemId === item.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Auto Fill
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {item.section_name.toLowerCase().includes('toastmaster') && (
                    <View style={styles.themeSection}>
                      <View style={[styles.themeFieldContainer, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}>
                        <View style={styles.themeFieldHeaderRow}>
                          <View style={styles.themeFieldHeader}>
                            <Text style={styles.themeFieldIcon} maxFontSizeMultiplier={1.3}>🎨</Text>
                            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              Theme of the Day
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={autoFillThemeFromToastmasterCorner}
                            disabled={themeFromCornerLoading}
                            style={[styles.autoFillButton, {
                              backgroundColor: theme.colors.background,
                              borderColor: theme.colors.border,
                              opacity: themeFromCornerLoading ? 0.6 : 1,
                            }]}
                          >
                            {themeFromCornerLoading ? (
                              <ActivityIndicator size="small" color={theme.colors.primary} />
                            ) : (
                              <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                                Auto Fill
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          style={[styles.themeFieldInput, {
                            color: theme.colors.text,
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border
                          }]}
                          value={themeOfTheDay}
                          onChangeText={setThemeOfTheDay}
                          onBlur={updateTheme}
                          placeholder="e.g., Leadership, Innovation, Growth"
                          placeholderTextColor={theme.colors.textSecondary}
                        />
                      </View>
                    </View>
                  )}
                </>
              )}

              {item.section_name.toLowerCase().includes('tag team') && (
                <View style={styles.tagTeamAssignmentsSection}>
                  <View style={styles.tagTeamAutoFillRow}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, flex: 1 }]} maxFontSizeMultiplier={1.3}>
                      Fill from booked roles
                    </Text>
                    <TouchableOpacity
                      onPress={() => autoFillTagTeamFromBookedRoles(item.id)}
                      disabled={autoFillItemId === item.id}
                      style={[styles.autoFillButton, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        opacity: autoFillItemId === item.id ? 0.6 : 1,
                      }]}
                    >
                      {autoFillItemId === item.id ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                          Auto Fill
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* Timer */}
                  <View style={styles.tagTeamRoleRow}>
                    <TouchableOpacity
                      style={[styles.tagTeamAssignmentCard, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        flex: 1
                      }]}
                      onPress={() => {
                        setSelectedItemId(item.id);
                        setTimerModalVisible(true);
                      }}
                    >
                      <View style={styles.tagTeamAssignmentHeader}>
                        <Text style={styles.tagTeamAssignmentIcon} maxFontSizeMultiplier={1.3}>⏱️</Text>
                        <View style={styles.tagTeamAssignmentInfo}>
                          <Text style={[styles.tagTeamAssignmentRole, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            Timer
                          </Text>
                          <Text style={[styles.tagTeamAssignmentLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Assigned to
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tagTeamAssignmentValueRow}>
                        <Text style={[styles.tagTeamAssignmentValue, {
                          color: timer.name ? theme.colors.text : theme.colors.textSecondary
                        }]} maxFontSizeMultiplier={1.3}>
                          {timer.name || 'Unassigned'}
                        </Text>
                        <UserPlus size={16} color={theme.colors.primary} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleTagTeamRoleVisibility(item.id, 'timer')}
                      style={[styles.tagTeamVisibilityButton, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}
                    >
                      {(item.timer_visible ?? true) ? (
                        <Eye size={20} color={theme.colors.primary} />
                      ) : (
                        <EyeOff size={20} color={theme.colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Ah Counter */}
                  <View style={styles.tagTeamRoleRow}>
                    <TouchableOpacity
                      style={[styles.tagTeamAssignmentCard, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        flex: 1
                      }]}
                      onPress={() => {
                        setSelectedItemId(item.id);
                        setAhCounterModalVisible(true);
                      }}
                    >
                      <View style={styles.tagTeamAssignmentHeader}>
                        <Text style={styles.tagTeamAssignmentIcon} maxFontSizeMultiplier={1.3}>📝</Text>
                        <View style={styles.tagTeamAssignmentInfo}>
                          <Text style={[styles.tagTeamAssignmentRole, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            Ah Counter
                          </Text>
                          <Text style={[styles.tagTeamAssignmentLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Assigned to
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tagTeamAssignmentValueRow}>
                        <Text style={[styles.tagTeamAssignmentValue, {
                          color: ahCounter.name ? theme.colors.text : theme.colors.textSecondary
                        }]} maxFontSizeMultiplier={1.3}>
                          {ahCounter.name || 'Unassigned'}
                        </Text>
                        <UserPlus size={16} color={theme.colors.primary} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleTagTeamRoleVisibility(item.id, 'ah_counter')}
                      style={[styles.tagTeamVisibilityButton, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}
                    >
                      {(item.ah_counter_visible ?? true) ? (
                        <Eye size={20} color={theme.colors.primary} />
                      ) : (
                        <EyeOff size={20} color={theme.colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Grammarian */}
                  <View style={styles.tagTeamRoleRow}>
                    <TouchableOpacity
                      style={[styles.tagTeamAssignmentCard, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        flex: 1
                      }]}
                      onPress={() => {
                        setSelectedItemId(item.id);
                        setGrammarianModalVisible(true);
                      }}
                    >
                      <View style={styles.tagTeamAssignmentHeader}>
                        <Text style={styles.tagTeamAssignmentIcon} maxFontSizeMultiplier={1.3}>📖</Text>
                        <View style={styles.tagTeamAssignmentInfo}>
                          <Text style={[styles.tagTeamAssignmentRole, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            Grammarian
                          </Text>
                          <Text style={[styles.tagTeamAssignmentLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Assigned to
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tagTeamAssignmentValueRow}>
                        <Text style={[styles.tagTeamAssignmentValue, {
                          color: grammarian.name ? theme.colors.text : theme.colors.textSecondary
                        }]} maxFontSizeMultiplier={1.3}>
                          {grammarian.name || 'Unassigned'}
                        </Text>
                        <UserPlus size={16} color={theme.colors.primary} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleTagTeamRoleVisibility(item.id, 'grammarian')}
                      style={[styles.tagTeamVisibilityButton, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}
                    >
                      {(item.grammarian_visible ?? true) ? (
                        <Eye size={20} color={theme.colors.primary} />
                      ) : (
                        <EyeOff size={20} color={theme.colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {item.section_name === 'Grammarian Corner' && item.grammarian_corner && (
                <View style={styles.grammarianCornerMainContainer}>
                  <View
                    style={[
                      styles.grammarianCornerHeaderBanner,
                      {
                        backgroundColor: theme.dark ? '#1e293b' : '#f1f5f9',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => autoFillGrammarianCornerDailyHighlights(item)}
                      disabled={grammarianCornerAutoFillLoading}
                      style={[styles.autoFillButton, {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        opacity: grammarianCornerAutoFillLoading ? 0.6 : 1,
                      }]}
                    >
                      {grammarianCornerAutoFillLoading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                          Auto Fill
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.grammarianCornerFields}>
                    {/* Word */}
                    <View style={[styles.grammarianCornerFieldRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                      <View style={styles.grammarianCornerFieldHeader}>
                        <View style={styles.grammarianCornerFieldHeaderLeft}>
                          <Text style={styles.grammarianCornerFieldIcon} maxFontSizeMultiplier={1.3}>📖</Text>
                          <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Word of the day
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => toggleGrammarianCornerVisibility(item.id, 'word', !item.grammarian_corner!.word_visible)}
                          style={[
                            styles.grammarianEyeButton,
                            {
                              backgroundColor: item.grammarian_corner.word_visible ? '#3b82f610' : theme.colors.surface
                            }
                          ]}
                        >
                          {item.grammarian_corner.word_visible ? (
                            <Eye size={18} color="#3b82f6" />
                          ) : (
                            <EyeOff size={18} color={theme.colors.textSecondary} />
                          )}
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[styles.grammarianCornerInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                        value={wordOfTheDay}
                        onChangeText={setWordOfTheDay}
                        onBlur={() => updateGrammarianCornerAgendaField(item.id, 'word_of_the_day', wordOfTheDay)}
                        placeholder="Auto fill from Grammarian report"
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>

                    {/* Quote */}
                    <View style={[styles.grammarianCornerFieldRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                      <View style={styles.grammarianCornerFieldHeader}>
                        <View style={styles.grammarianCornerFieldHeaderLeft}>
                          <Text style={styles.grammarianCornerFieldIcon} maxFontSizeMultiplier={1.3}>💭</Text>
                          <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Quote of the day
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => toggleGrammarianCornerVisibility(item.id, 'quote', !item.grammarian_corner!.quote_visible)}
                          style={[
                            styles.grammarianEyeButton,
                            {
                              backgroundColor: item.grammarian_corner.quote_visible ? '#22c55e10' : theme.colors.surface
                            }
                          ]}
                        >
                          {item.grammarian_corner.quote_visible ? (
                            <Eye size={18} color="#22c55e" />
                          ) : (
                            <EyeOff size={18} color={theme.colors.textSecondary} />
                          )}
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[styles.grammarianCornerInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                        value={quoteOfTheDay}
                        onChangeText={setQuoteOfTheDay}
                        onBlur={() => updateGrammarianCornerAgendaField(item.id, 'quote_of_the_day', quoteOfTheDay)}
                        placeholder="Auto fill from Grammarian report"
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>

                    {/* Idiom */}
                    <View style={[styles.grammarianCornerFieldRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                      <View style={styles.grammarianCornerFieldHeader}>
                        <View style={styles.grammarianCornerFieldHeaderLeft}>
                          <Text style={styles.grammarianCornerFieldIcon} maxFontSizeMultiplier={1.3}>🎯</Text>
                          <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Idiom of the day
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => toggleGrammarianCornerVisibility(item.id, 'idiom', !item.grammarian_corner!.idiom_visible)}
                          style={[
                            styles.grammarianEyeButton,
                            {
                              backgroundColor: item.grammarian_corner.idiom_visible ? '#f9731610' : theme.colors.surface
                            }
                          ]}
                        >
                          {item.grammarian_corner.idiom_visible ? (
                            <Eye size={18} color="#f97316" />
                          ) : (
                            <EyeOff size={18} color={theme.colors.textSecondary} />
                          )}
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[styles.grammarianCornerInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                        value={idiomOfTheDay}
                        onChangeText={setIdiomOfTheDay}
                        onBlur={() => updateGrammarianCornerAgendaField(item.id, 'idiom_of_the_day', idiomOfTheDay)}
                        placeholder="Auto fill from Grammarian report"
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              )}

              {item.section_name !== 'Grammarian Corner' && (
                <View style={styles.notesSection}>
                  {(item.section_name.toLowerCase().includes('meet and greet') ||
                    item.section_name.toLowerCase().includes('call to order') ||
                    item.section_name.toLowerCase().includes('presiding officer address') ||
                    item.section_name.toLowerCase().includes('toastmaster of the day') ||
                    item.section_name.toLowerCase().includes('general evaluator opening') ||
                    item.section_name.toLowerCase().includes('quiz session') ||
                    item.section_name.toLowerCase().includes('grammarian report') ||
                    item.section_name.toLowerCase().includes('general evaluator feedback') ||
                    item.section_name.toLowerCase().includes('table topics session') ||
                    item.section_name.toLowerCase().includes('ah counter report') ||
                    item.section_name.toLowerCase().includes('timer report') ||
                    item.section_name.toLowerCase().includes('voting') ||
                    item.section_name.toLowerCase().includes('awards') ||
                    item.section_name.toLowerCase().includes('closing remarks') ||
                    (item.section_name.toLowerCase().includes('tmod') &&
                      item.section_name.toLowerCase().includes('theme') &&
                      (item.section_name.toLowerCase().includes('continue') ||
                        item.section_name.toLowerCase().includes('continues'))) ||
                    item.section_name.toLowerCase().includes('tmod closing') ||
                    item.section_name.toLowerCase().includes('listener') ||
                    item.section_name.toLowerCase().includes('tag team') ||
                    item.section_name.toLowerCase().includes('prepared speeches') ||
                    (item.section_name.toLowerCase().includes('speech') &&
                      item.section_name.toLowerCase().includes('eval'))) ? (
                    <>
                      {item.custom_notes ? (
                        editingItem === item.id ? (
                          <>
                            <TextInput
                              style={[
                                styles.notesInput,
                                {
                                  color: theme.colors.text,
                                  backgroundColor: theme.colors.background,
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              value={item.custom_notes || ''}
                              onChangeText={(text) => updateCustomNotes(item.id, text)}
                              onBlur={() => saveCustomNotes(item.id, item.custom_notes || '')}
                              placeholder="Add notes or special instructions..."
                              placeholderTextColor={theme.colors.textSecondary}
                              multiline
                              numberOfLines={3}
                            />
                            <View style={styles.meetAndGreetActionsRow}>
                              <TouchableOpacity
                                onPress={() => saveCustomNotes(item.id, item.custom_notes || '')}
                                style={[
                                  styles.meetAndGreetEditButton,
                                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                                ]}
                                activeOpacity={0.8}
                              >
                                <Save size={18} color={theme.colors.primary} />
                                <Text style={[styles.meetAndGreetEditText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                                  Save
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => resetCustomNotes(item.id)}
                                style={[
                                  styles.meetAndGreetAutoButton,
                                  { borderColor: theme.colors.border },
                                ]}
                                activeOpacity={0.8}
                              >
                                <Zap size={18} color={theme.colors.primary} />
                                <Text style={[styles.meetAndGreetAutoText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                                  Auto
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={[styles.meetAndGreetDescriptionText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              {item.custom_notes || 'No description available'}
                            </Text>
                            <View style={styles.meetAndGreetActionsRow}>
                              <TouchableOpacity
                                onPress={() => setEditingItem(item.id)}
                                style={[
                                  styles.meetAndGreetEditButton,
                                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                                ]}
                                activeOpacity={0.8}
                              >
                                <PencilLine size={18} color={theme.colors.primary} />
                                <Text style={[styles.meetAndGreetEditText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                                  Edit
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => resetCustomNotes(item.id)}
                                style={[
                                  styles.meetAndGreetAutoButton,
                                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                                ]}
                                activeOpacity={0.8}
                              >
                                <Zap size={18} color={theme.colors.primary} />
                                <Text style={[styles.meetAndGreetAutoText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                                  Auto
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )
                      ) : (
                        <>
                          <Text style={[styles.meetAndGreetDescriptionText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {item.section_description || 'No description available'}
                          </Text>
                          <View style={styles.meetAndGreetActionsRow}>
                            <TouchableOpacity
                              onPress={() => {
                                updateCustomNotes(item.id, item.section_description || '');
                                setEditingItem(item.id);
                              }}
                              style={[
                                styles.meetAndGreetEditButton,
                                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                              ]}
                              activeOpacity={0.8}
                            >
                              <PencilLine size={18} color={theme.colors.primary} />
                              <Text style={[styles.meetAndGreetEditText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                                Edit
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => resetCustomNotes(item.id)}
                              style={[
                                styles.meetAndGreetAutoButton,
                                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                              ]}
                              activeOpacity={0.8}
                            >
                              <Zap size={18} color={theme.colors.primary} />
                              <Text style={[styles.meetAndGreetAutoText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                                Auto
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={styles.notesSectionHeader}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          {item.custom_notes ? 'Custom Notes:' : 'Description:'}
                        </Text>
                        {item.custom_notes && (
                          <TouchableOpacity
                            onPress={() => resetCustomNotes(item.id)}
                            style={styles.resetButton}
                          >
                            <RotateCcw size={14} color="#ef4444" />
                            <Text style={styles.resetButtonText} maxFontSizeMultiplier={1.3}>Reset to Auto</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {item.custom_notes ? (
                        <TextInput
                          style={[
                            styles.notesInput,
                            {
                              color: theme.colors.text,
                              backgroundColor: theme.colors.background,
                              borderColor: theme.colors.border,
                            },
                          ]}
                          value={item.custom_notes || ''}
                          onChangeText={(text) => updateCustomNotes(item.id, text)}
                          onBlur={() => saveCustomNotes(item.id, item.custom_notes || '')}
                          placeholder="Add notes or special instructions..."
                          placeholderTextColor={theme.colors.textSecondary}
                          multiline
                          numberOfLines={3}
                          maxLength={75}
                        />
                      ) : (
                        <View style={styles.autoDescriptionContainer}>
                          <Text style={[styles.autoDescriptionText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {item.section_description || 'No description available'}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              updateCustomNotes(item.id, item.section_description || '');
                            }}
                            style={[styles.editDescriptionButton, { borderColor: theme.colors.primary }]}
                          >
                            <Text style={[styles.editDescriptionButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Edit Description
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {item.section_name.toLowerCase().includes('general evaluator') && (
                <>
                  {!isGeneralEvaluatorOpeningOrFeedbackSection(item.section_name) && (
                    <View style={styles.saaInfoContainer}>
                      <Text style={[styles.saaInfoTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Info:
                      </Text>
                      <View style={[styles.saaInfoBox, {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}>
                        <Text style={[styles.saaInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          This is information box. Assigned General Evaluator for the meeting is{' '}
                          <Text style={[styles.saaInfoName, { color: generalEvaluator.name ? theme.colors.text : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {generalEvaluator.name || 'Unassigned'}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  )}

                  {isGeneralEvaluatorReportSection(item.section_name) && (
                    <View style={styles.preparedSpeakersSection}>
                      {geSubRoles.filter(subRole => subRole.agenda_item_id === item.id).length > 0 ? (
                        geSubRoles
                          .filter(subRole => subRole.agenda_item_id === item.id)
                          .map((subRole) => (
                            <View
                              key={subRole.id}
                              style={[styles.speakerCard, {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border
                              }]}
                            >
                              <View style={styles.speakerHeader}>
                                <View style={styles.speakerMainInfo}>
                                  <Text style={[styles.speakerRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                    {subRole.sub_role_name}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setSelectedGeSubRole(subRole);
                                      setSearchQuery('');
                                      setGeSubRoleModalVisible(true);
                                    }}
                                    style={[styles.assignmentButton, {
                                      backgroundColor: theme.colors.background,
                                      borderColor: theme.colors.border,
                                      marginTop: 8
                                    }]}
                                  >
                                    <Text style={[styles.assignedLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                      Assigned to:
                                    </Text>
                                    <View style={styles.assignmentValueRow}>
                                      <Text style={[styles.assignedName, {
                                        color: subRole.assigned_user_name ? theme.colors.text : theme.colors.textSecondary
                                      }]} maxFontSizeMultiplier={1.3}>
                                        {subRole.assigned_user_name || 'TBA'}
                                      </Text>
                                      <UserPlus size={16} color={theme.colors.primary} />
                                    </View>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {subRole.duration_minutes > 0 && (
                                <View style={styles.speakerDetailRow}>
                                  <Text style={styles.speakerDetailIcon} maxFontSizeMultiplier={1.3}>⏱️</Text>
                                  <View style={styles.speakerDetailContent}>
                                    <Text style={[styles.speakerDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                      Duration
                                    </Text>
                                    <Text style={[styles.speakerDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                      {subRole.duration_minutes} minute{subRole.duration_minutes !== 1 ? 's' : ''}
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          ))
                      ) : (
                        <View style={[styles.emptyStateCard, {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border
                        }]}>
                          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            No sub-roles found for General Evaluator Report
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              {item.section_name.toLowerCase().includes('prepared speeches') && (
                <>
                  <View style={styles.preparedSpeakersSection}>
                    {(() => {
                      const parsed = parsePreparedSpeechesAgenda(item.prepared_speeches_agenda);
                      const parsedBySlot = new Map(parsed.map(s => [s.slot, s]));
                      const openSlotDefs =
                        preparedSpeakerRoleDefs.length > 0
                          ? preparedSpeakerRoleDefs
                          : PREPARED_SPEAKER_ROLE_NAMES.map((roleName, i) => ({
                              slot: i + 1,
                              role_name: roleName,
                            }));

                      return openSlotDefs
                        .filter(def => def.slot >= 1 && def.slot <= 5)
                        .sort((a, b) => a.slot - b.slot)
                        .map((def) => {
                          const existing = parsedBySlot.get(def.slot);
                          if (existing) return existing;
                          return {
                            slot: def.slot,
                            role_name: def.role_name,
                            booked: false,
                            pathway_id: null,
                            speaker_user_id: null,
                            speaker_name: null,
                            speech_title: null,
                            pathway_name: null,
                            level: null,
                            project_number: null,
                            project_name: null,
                            evaluation_form: null,
                            evaluator_user_id: null,
                            evaluator_name: null,
                            is_visible: true,
                          } as PreparedSpeechAgendaSlot;
                        });
                    })().map((slot) => (
                      <View
                        key={slot.slot}
                        style={[
                          styles.preparedSlotCard,
                          {
                            backgroundColor: theme.colors.background,
                            borderColor: theme.colors.border,
                            opacity: slot.is_visible ? 1 : 0.75,
                          },
                        ]}
                      >
                        {/* HEADER - 56px */}
                        <View style={[styles.preparedSlotHeader, { borderBottomColor: theme.colors.border }]}>
                          <View style={styles.speakerNumberBadge}>
                            <Text style={styles.speakerNumberText} maxFontSizeMultiplier={1.3}>{slot.slot}</Text>
                          </View>
                          <View style={[styles.speakerMainInfo, { flex: 1 }]}>
                            <Text style={[styles.speakerRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              {slot.role_name}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => autoFillPreparedSpeechesFromPathway(item)}
                            disabled={autoFillItemId === item.id}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 7,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: theme.colors.border,
                              backgroundColor: theme.colors.background,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            activeOpacity={0.8}
                          >
                            {autoFillItemId === item.id ? (
                              <ActivityIndicator size="small" color={theme.colors.primary} />
                            ) : (
                              <Zap size={18} color={theme.colors.primary} />
                            )}
                            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>
                              Autofill
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => togglePreparedSpeechSlotVisibility(item.id, slot.slot)}
                            style={{ padding: 8 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {slot.is_visible ? (
                              <Eye size={22} color={theme.colors.primary} />
                            ) : (
                              <EyeOff size={22} color={theme.colors.textSecondary} />
                            )}
                          </TouchableOpacity>
                        </View>

                        {parsePreparedSpeechesAgenda(item.prepared_speeches_agenda).length === 0 && (
                          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary, marginTop: 20, marginBottom: 8 }]} maxFontSizeMultiplier={1.3}>
                            Tap Autofill to copy pathway details into the agenda for each slot.
                          </Text>
                        )}

                        {/* Content - gap 20px after header */}
                        <View style={styles.preparedSlotContent}>
                          {/* Speaker - Label 12px, Value 15px */}
                          <View style={styles.preparedSlotField}>
                            <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speaker</Text>
                            <TextInput
                              style={[
                                styles.preparedSlotInput,
                                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                              ]}
                              placeholder="Not assigned"
                              placeholderTextColor={theme.colors.textSecondary}
                              value={slot.speaker_name || ''}
                              onChangeText={(text) => updatePreparedSpeechSlot(item.id, slot.slot, { speaker_name: text || null })}
                            />
                          </View>

                          {/* Title - gap 16px */}
                          <View style={styles.preparedSlotField}>
                            <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Title</Text>
                            <TextInput
                              style={[
                                styles.preparedSlotInput,
                                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                              ]}
                              placeholder="Enter speech title"
                              placeholderTextColor={theme.colors.textSecondary}
                              value={slot.speech_title || ''}
                              onChangeText={(text) => updatePreparedSpeechSlot(item.id, slot.slot, { speech_title: text || null })}
                            />
                          </View>

                          {/* GRID - Pathway | Level, Project | Number */}
                          <View style={styles.preparedSlotGrid}>
                            <View style={styles.preparedSlotGridCol}>
                              <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pathway</Text>
                              <TextInput
                                style={[
                                  styles.preparedSlotInput,
                                  { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                                ]}
                                placeholder="Pathway name"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={slot.pathway_name || ''}
                                onChangeText={(text) => updatePreparedSpeechSlot(item.id, slot.slot, { pathway_name: text || null })}
                              />
                            </View>
                            <View style={styles.preparedSlotGridColNarrow}>
                              <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Level</Text>
                              <TextInput
                                style={[
                                  styles.preparedSlotInput,
                                  { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background, textAlign: 'center' },
                                ]}
                                keyboardType="number-pad"
                                placeholder="L1"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={slot.level != null ? `L${slot.level}` : ''}
                                onChangeText={(text) => {
                                  const digits = text.replace(/[^0-9]/g, '');
                                  updatePreparedSpeechSlot(item.id, slot.slot, { level: digits ? Number(digits) : null });
                                }}
                              />
                            </View>
                          </View>

                          <View style={styles.preparedSlotGrid}>
                            <View style={styles.preparedSlotGridCol}>
                              <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project</Text>
                              <TextInput
                                style={[
                                  styles.preparedSlotInput,
                                  { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                                ]}
                                placeholder="Project name"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={slot.project_name || ''}
                                onChangeText={(text) => updatePreparedSpeechSlot(item.id, slot.slot, { project_name: text || null })}
                              />
                            </View>
                            <View style={styles.preparedSlotGridColNarrow}>
                              <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Number</Text>
                              <TextInput
                                style={[
                                  styles.preparedSlotInput,
                                  { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background, textAlign: 'center' },
                                ]}
                                keyboardType="number-pad"
                                placeholder="P2"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={slot.project_number != null ? `P${String(slot.project_number).replace(/[^0-9]/g, '')}` : ''}
                                onChangeText={(text) => {
                                  const digits = text.replace(/[^0-9]/g, '');
                                  updatePreparedSpeechSlot(item.id, slot.slot, { project_number: digits || null });
                                }}
                              />
                            </View>
                          </View>

                          {/* Evaluator - gap 16px */}
                          <View style={styles.preparedSlotField}>
                            <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                            <TextInput
                              style={[
                                styles.preparedSlotInput,
                                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                              ]}
                              placeholder="Not assigned"
                              placeholderTextColor={theme.colors.textSecondary}
                              value={slot.evaluator_name || ''}
                              onChangeText={(text) => updatePreparedSpeechSlot(item.id, slot.slot, { evaluator_name: text || null })}
                            />
                          </View>

                          {/* Divider 1px - gap 16px */}
                          <View style={[styles.preparedSlotDivider, { backgroundColor: theme.colors.border }]} />

                          {/* Evaluation Form - 44px row */}
                          <View style={styles.preparedSlotField}>
                            <Text style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Evaluation Form</Text>
                            <View style={[styles.preparedSlotEvalFormRow, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                              <TextInput
                                style={[
                                  styles.preparedSlotInput,
                                  {
                                    flex: 1,
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.background,
                                    minHeight: 44,
                                    paddingVertical: 10,
                                  },
                                ]}
                                placeholder="Enter evaluation form link"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={slot.evaluation_form || ''}
                                onChangeText={(text) => updatePreparedSpeechSlot(item.id, slot.slot, { evaluation_form: text || null })}
                                numberOfLines={1}
                              />
                              {slot.evaluation_form ? (
                                <TouchableOpacity
                                  onPress={() => handleViewEvaluationForm(slot.evaluation_form!)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.preparedSlotValue, { color: theme.colors.primary }]}>→ Open</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {(item.section_name.toLowerCase().includes('speech') &&
                item.section_name.toLowerCase().includes('eval')) && (
                <>
                  {(() => {
                    const preparedItem = agendaItems.find(i =>
                      i.section_name.toLowerCase().includes('prepared speeches')
                    );
                    const preparedItemId = preparedItem?.id;
                    const preparedSlots = preparedItem
                      ? parsePreparedSpeechesAgenda(preparedItem.prepared_speeches_agenda)
                      : [];
                    const bySlot = new Map(preparedSlots.map(s => [s.slot, s]));
                    const openSlotSet = new Set(preparedSpeakerRoleDefs.map(d => d.slot));

                    const evaluatorRows: Array<{
                      evaluatorNo: number;
                      slotNum: number;
                      durationLabel: string;
                      isVisible: boolean;
                      evaluatorName: string | null;
                      speechTitle: string | null;
                      speakerName: string | null;
                    }> = [];

                    [1, 2, 3].forEach(slotNum => {
                      const slot = bySlot.get(slotNum);

                      const hasRoleDef = openSlotSet.size > 0;
                      const shouldShow = slot != null || (hasRoleDef ? openSlotSet.has(slotNum) : false);
                      if (!shouldShow) return;

                      const isVisible =
                        slot != null
                          ? slot.is_visible
                          : hasRoleDef
                            ? openSlotSet.has(slotNum)
                            : true; // fallback while role defs are loading

                      evaluatorRows.push({
                        evaluatorNo: slotNum,
                        slotNum,
                        durationLabel: '3 mins',
                        isVisible,
                        evaluatorName: slot?.evaluator_name ?? null,
                        speechTitle: slot?.speech_title ?? null,
                        speakerName: slot?.speaker_name ?? null,
                      });
                    });

                    if (evaluatorRows.length === 0) {
                      return (
                        <View
                          style={[
                            styles.emptyStateCard,
                            {
                              backgroundColor: theme.colors.background,
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.emptyStateText,
                              { color: theme.colors.textSecondary },
                            ]}
                            maxFontSizeMultiplier={1.3}
                          >
                            No prepared speakers are currently available for evaluation.
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <View style={styles.preparedSpeakersSection}>
                        <Text
                          style={[
                            styles.agendaVisibilitySubtitle,
                            { color: theme.colors.textSecondary, marginTop: 2 },
                          ]}
                          maxFontSizeMultiplier={1.3}
                        >
                          Speech evaluator provides evaluation for prepared speakers.
                          Duration is 3 mins each.
                        </Text>

                        {evaluatorRows.map(row => (
                          <View
                            key={row.evaluatorNo}
                            style={[
                              styles.preparedSlotCard,
                              {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border,
                                marginTop: 12,
                                opacity: row.isVisible ? 1 : 0.75,
                              },
                            ]}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <Text
                                style={[styles.preparedSlotValue, { color: theme.colors.text }]}
                                maxFontSizeMultiplier={1.3}
                              >
                                Evaluator {row.evaluatorNo}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text
                                  style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  {row.durationLabel}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => {
                                    if (!preparedItemId) return;
                                    togglePreparedSpeechSlotVisibility(preparedItemId, row.slotNum);
                                  }}
                                  style={{ padding: 6 }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  {row.isVisible ? (
                                    <Eye size={20} color={theme.colors.primary} />
                                  ) : (
                                    <EyeOff size={20} color={theme.colors.textSecondary} />
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>

                            <View style={{ marginTop: 12, gap: 8 }}>
                              <View style={styles.preparedSlotField}>
                                <Text
                                  style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  Evaluator name
                                </Text>
                                <Text
                                  style={[styles.preparedSlotValue, { color: theme.colors.text }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  {row.evaluatorName || 'TBA'}
                                </Text>
                              </View>

                              <View style={styles.preparedSlotField}>
                                <Text
                                  style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  Speech title
                                </Text>
                                <Text
                                  style={[styles.preparedSlotValue, { color: theme.colors.text }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  {row.speechTitle || 'TBA'}
                                </Text>
                              </View>

                              <View style={styles.preparedSlotField}>
                                <Text
                                  style={[styles.preparedSlotLabel, { color: theme.colors.textSecondary }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  Speaker name
                                </Text>
                                <Text
                                  style={[styles.preparedSlotValue, { color: theme.colors.text }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  {row.speakerName || 'TBA'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </>
              )}

              {item.section_name.toLowerCase().includes('ice breaker') && (
                <>
                  <View style={styles.preparedSpeakersSection}>
                    {iceBreakers.length > 0 ? (
                    iceBreakers.map((speaker, index) => (
                      <View
                        key={speaker.id}
                        style={[styles.speakerCard, {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border
                        }]}
                      >
                        <View style={styles.speakerHeader}>
                          <View style={[styles.speakerNumberBadge, { backgroundColor: '#10b981' }]}>
                            <Text style={styles.speakerNumberText} maxFontSizeMultiplier={1.3}>{index + 1}</Text>
                          </View>
                          <View style={styles.speakerMainInfo}>
                            <Text style={[styles.speakerRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              {speaker.role_name}
                            </Text>
                            <Text style={[styles.speakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {speaker.speaker_name}
                            </Text>
                          </View>
                          <View style={styles.speakerReorderButtons}>
                            <TouchableOpacity
                              style={[styles.reorderButton, {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.border,
                                opacity: index === 0 ? 0.3 : 1
                              }]}
                              onPress={() => moveSpeaker(iceBreakers, index, 'up', true)}
                              disabled={index === 0}
                              activeOpacity={0.7}
                            >
                              <ChevronUp size={18} color={theme.colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.reorderButton, {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.border,
                                opacity: index === iceBreakers.length - 1 ? 0.3 : 1
                              }]}
                              onPress={() => moveSpeaker(iceBreakers, index, 'down', true)}
                              disabled={index === iceBreakers.length - 1}
                              activeOpacity={0.7}
                            >
                              <ChevronDown size={18} color={theme.colors.text} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {speaker.speech_title && (
                          <View style={styles.speakerDetailRow}>
                            <Text style={styles.speakerDetailIcon} maxFontSizeMultiplier={1.3}>🎤</Text>
                            <View style={styles.speakerDetailContent}>
                              <Text style={[styles.speakerDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Speech Title
                              </Text>
                              <Text style={[styles.speakerDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                {speaker.speech_title}
                              </Text>
                            </View>
                          </View>
                        )}

                        {speaker.evaluator_name && (
                          <View style={styles.speakerDetailRow}>
                            <Text style={styles.speakerDetailIcon} maxFontSizeMultiplier={1.3}>👤</Text>
                            <View style={styles.speakerDetailContent}>
                              <Text style={[styles.speakerDetailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Evaluator
                              </Text>
                              <Text style={[styles.speakerDetailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                {speaker.evaluator_name}
                              </Text>
                            </View>
                          </View>
                        )}

                        {(speaker.pathway_name || speaker.project_name) && (
                          <View style={styles.pathwayInfoRow}>
                            {speaker.pathway_name && (
                              <View style={[styles.pathwayBadge, {
                                backgroundColor: '#10b98120',
                                borderColor: '#10b981'
                              }]}>
                                <Text style={[styles.pathwayBadgeLabel, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                                  Pathway
                                </Text>
                                <Text style={[styles.pathwayBadgeValue, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                                  {speaker.pathway_name}
                                </Text>
                                {speaker.level && (
                                  <View style={[styles.levelBadge, { backgroundColor: '#10b981' }]}>
                                    <Text style={styles.levelBadgeText} maxFontSizeMultiplier={1.3}>L{speaker.level}</Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {speaker.project_name && (
                              <View style={[styles.pathwayBadge, {
                                backgroundColor: '#f59e0b20',
                                borderColor: '#f59e0b'
                              }]}>
                                <Text style={[styles.pathwayBadgeLabel, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.3}>
                                  Project
                                </Text>
                                <Text style={[styles.pathwayBadgeValue, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.3}>
                                  {speaker.project_name}
                                </Text>
                                {speaker.project_number && (
                                  <View style={[styles.projectNumberBadge, { backgroundColor: '#f59e0b' }]}>
                                    <Text style={styles.projectNumberBadgeText} maxFontSizeMultiplier={1.3}>P{speaker.project_number}</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        )}

                        {(speaker.pathway_name || speaker.project_name) && speaker.evaluation_form && (
                          <TouchableOpacity
                            style={[styles.evaluationFormButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => {
                              handleViewEvaluationForm(speaker.evaluation_form!);
                            }}
                            activeOpacity={0.7}
                          >
                            <FileText size={18} color="#FFFFFF" />
                            <Text style={styles.evaluationFormButtonText} maxFontSizeMultiplier={1.3}>
                              Evaluation Form - Open
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  ) : (
                    <View style={[styles.emptyStateCard, {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border
                    }]}>
                      <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        No ice breaker speeches have been booked yet
                      </Text>
                    </View>
                  )}
                  </View>
                </>
              )}

              {item.section_name.toLowerCase().includes('educational speaker') && (
                <View style={styles.themeSection}>
                  <View style={[styles.themeFieldContainer, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border
                  }]}>
                    <View style={styles.themeFieldHeaderRow}>
                      <View style={styles.themeFieldHeader}>
                        <Text style={styles.themeFieldIcon} maxFontSizeMultiplier={1.3}>📚</Text>
                        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Education Speech Title
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => autoFillEducationSpeechTitleFromEducationalCorner(item.id)}
                        disabled={educationTitleFromCornerLoading}
                        style={[styles.autoFillButton, {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          opacity: educationTitleFromCornerLoading ? 0.6 : 1,
                        }]}
                      >
                        {educationTitleFromCornerLoading ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                            Auto Fill
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.themeFieldInput, {
                        color: theme.colors.text,
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}
                      value={educationSpeechTitle}
                      onChangeText={setEducationSpeechTitle}
                      onBlur={updateEducationSpeechTitle}
                      placeholder="e.g., Effective Communication Strategies"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>
                </View>
              )}

              {item.section_name.toLowerCase().includes('keynote') && (
                <View style={styles.themeSection}>
                  <View style={[styles.themeFieldContainer, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border
                  }]}>
                    <View style={styles.themeFieldHeaderRow}>
                      <View style={styles.themeFieldHeader}>
                        <Text style={styles.themeFieldIcon} maxFontSizeMultiplier={1.3}>🎤</Text>
                        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Keynote Title
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => autoFillKeynoteSpeechTitleFromCorner(item)}
                        disabled={keynoteTitleFromCornerLoading}
                        style={[styles.autoFillButton, {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          opacity: keynoteTitleFromCornerLoading ? 0.6 : 1,
                        }]}
                      >
                        {keynoteTitleFromCornerLoading ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <Text style={[styles.autoFillButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                            Auto Fill
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.themeFieldInput, {
                        color: theme.colors.text,
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}
                      value={keynoteSpeechTitle}
                      onChangeText={setKeynoteSpeechTitle}
                      onBlur={() => updateKeynoteSpeechTitle(item.id, keynoteSpeechTitle)}
                      placeholder="e.g., Building Confidence Through Communication"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>
                </View>
              )}

              {item.is_auto_generated && (
                <View style={styles.autoGenBadge}>
                  <Text style={styles.autoGenText} maxFontSizeMultiplier={1.3}>Auto-generated</Text>
                </View>
              )}
            </View>
          </View>
          );
        })
        )}
        </View>
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={assignmentModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeAssignmentModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Role
              </Text>
              <TouchableOpacity onPress={closeAssignmentModal} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
            }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {selectedItemId && agendaItems.find(item => item.id === selectedItemId)?.assigned_user_name && (
                <View style={styles.unassignSection}>
                  <TouchableOpacity
                    onPress={unassignMember}
                    style={[styles.unassignButton, {
                      backgroundColor: '#fee',
                      borderColor: '#dc2626',
                    }]}
                  >
                    <Text style={[styles.unassignButtonText, { color: '#dc2626' }]} maxFontSizeMultiplier={1.3}>
                      Remove Assignment
                    </Text>
                    <X size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.customNameSection, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.modalFormSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Or type custom name:
                </Text>
                <View style={styles.customNameRow}>
                  <TextInput
                    style={[styles.customNameInput, {
                      color: theme.colors.text,
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border
                    }]}
                    placeholder="Enter name (e.g., Guest Speaker)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={customName}
                    onChangeText={setCustomName}
                  />
                  <TouchableOpacity
                    onPress={assignCustomName}
                    style={[styles.saveCustomButton, { backgroundColor: theme.colors.primary }]}
                  >
                    <Text style={styles.saveCustomButtonText} maxFontSizeMultiplier={1.3}>Assign</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalMembersSectionTitle}>
                <Text style={[styles.modalFormSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club Members:
                </Text>
              </View>
              {clubMembers
                .filter(member =>
                  member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => assignMember(member.id, member.full_name)}
                    style={[styles.memberItem, { borderBottomColor: theme.colors.border }]}
                  >
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                    <UserPlus size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={sectionFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSectionFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Filter sections
              </Text>
              <TouchableOpacity onPress={() => setSectionFilterModalVisible(false)} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.sectionFilterModalActions, { borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity
                onPress={() => setSectionFilter('all')}
                style={[styles.sectionFilterActionButton, { borderRightColor: theme.colors.border }]}
              >
                <Text style={[styles.sectionFilterActionText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                  Select all
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSectionFilter(new Set())}
                style={[styles.sectionFilterActionButton, { borderRightWidth: 0 }]}
              >
                <Text style={[styles.sectionFilterActionText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Deselect all
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sectionFilterList} showsVerticalScrollIndicator={false}>
              {allSectionNames.map((name) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => toggleSectionInFilter(name)}
                  style={[styles.sectionFilterRow, { borderBottomColor: theme.colors.border }]}
                  activeOpacity={0.7}
                >
                  {isSectionSelected(name) ? (
                    <Check size={20} color={theme.colors.primary} />
                  ) : (
                    <Square size={20} color={theme.colors.textSecondary} />
                  )}
                  <Text style={[styles.sectionFilterRowText, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={manageSequenceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setManageSequenceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.manageSequenceModalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Manage sequence
              </Text>
              <TouchableOpacity onPress={() => setManageSequenceModalVisible(false)} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.manageSequenceSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Reorder the full list of {agendaItems.length} sections. Changes save automatically.
            </Text>
            <ScrollView
              style={styles.manageSequenceList}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 24 }}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {agendaItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.manageSequenceRow, { borderBottomColor: theme.colors.border }]}
                >
                  <Text style={[styles.manageSequenceOrder, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {index + 1}
                  </Text>
                  <Text
                    style={[
                      styles.manageSequenceName,
                      {
                        color: item.is_visible ? theme.colors.text : theme.colors.textSecondary,
                        textDecorationLine: item.is_visible ? 'none' : 'line-through',
                      },
                    ]}
                    numberOfLines={2}
                    maxFontSizeMultiplier={1.3}
                  >
                    {item.section_name}
                  </Text>
                  <View style={styles.manageSequenceActions}>
                    <TouchableOpacity
                      onPress={() => toggleVisibility(item.id)}
                      style={styles.manageSequenceEye}
                    >
                      {item.is_visible ? (
                        <Eye size={18} color={theme.colors.primary} />
                      ) : (
                        <EyeOff size={18} color={theme.colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveItemUp(index)}
                      disabled={index === 0}
                      style={[styles.manageSequenceArrow, index === 0 && styles.reorderButtonDisabled]}
                    >
                      <ChevronUp size={20} color={index === 0 ? theme.colors.border : theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveItemDown(index)}
                      disabled={index === agendaItems.length - 1}
                      style={[styles.manageSequenceArrow, index === agendaItems.length - 1 && styles.reorderButtonDisabled]}
                    >
                      <ChevronDown size={20} color={index === agendaItems.length - 1 ? theme.colors.border : theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setManageSequenceModalVisible(false)}
              style={[styles.manageSequenceDoneButton, { backgroundColor: theme.colors.primary, borderTopColor: theme.colors.border }]}
            >
              <Text style={styles.manageSequenceDoneButtonText} maxFontSizeMultiplier={1.3}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={saaModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setSaaModalVisible(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Sergeant at Arms
              </Text>
              <TouchableOpacity onPress={() => {
                setSaaModalVisible(false);
                setSearchQuery('');
              }} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
            }]}>
              <Search size={18} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              <View style={styles.modalMembersSectionTitle}>
                <Text style={[styles.modalFormSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club Members:
                </Text>
              </View>
              {clubMembers
                .filter(member =>
                  member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => assignSergeantAtArms(member.id, member.full_name)}
                    style={[styles.memberItem, { borderBottomColor: theme.colors.border }]}
                  >
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                    <UserPlus size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Timer Modal */}
      <Modal
        visible={timerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setTimerModalVisible(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Timer
              </Text>
              <TouchableOpacity onPress={() => {
                setTimerModalVisible(false);
                setSearchQuery('');
              }} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
            }]}>
              <Search size={18} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              <View style={styles.modalMembersSectionTitle}>
                <Text style={[styles.modalFormSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club Members:
                </Text>
              </View>
              {clubMembers
                .filter(member =>
                  member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => assignTimer(member.id, member.full_name)}
                    style={[styles.memberItem, { borderBottomColor: theme.colors.border }]}
                  >
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                    <UserPlus size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ah Counter Modal */}
      <Modal
        visible={ahCounterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setAhCounterModalVisible(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Ah Counter
              </Text>
              <TouchableOpacity onPress={() => {
                setAhCounterModalVisible(false);
                setSearchQuery('');
              }} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
            }]}>
              <Search size={18} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              <View style={styles.modalMembersSectionTitle}>
                <Text style={[styles.modalFormSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club Members:
                </Text>
              </View>
              {clubMembers
                .filter(member =>
                  member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => assignAhCounter(member.id, member.full_name)}
                    style={[styles.memberItem, { borderBottomColor: theme.colors.border }]}
                  >
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                    <UserPlus size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Grammarian Modal */}
      <Modal
        visible={grammarianModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setGrammarianModalVisible(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Grammarian
              </Text>
              <TouchableOpacity onPress={() => {
                setGrammarianModalVisible(false);
                setSearchQuery('');
              }} style={styles.closeButton}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
            }]}>
              <Search size={18} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              <View style={styles.modalMembersSectionTitle}>
                <Text style={[styles.modalFormSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club Members:
                </Text>
              </View>
              {clubMembers
                .filter(member =>
                  member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => assignGrammarian(member.id, member.full_name)}
                    style={[styles.memberItem, { borderBottomColor: theme.colors.border }]}
                  >
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                    <UserPlus size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* GE Sub-Role Assignment Modal */}
      <Modal
        visible={geSubRoleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setGeSubRoleModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign {selectedGeSubRole?.sub_role_name}
              </Text>
              <TouchableOpacity
                onPress={() => setGeSubRoleModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, {
              backgroundColor: theme.colors.background,
              borderBottomColor: theme.colors.border,
            }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              <View style={styles.modalMembersSectionTitle}>
                <Text style={[styles.modalFormSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club Members:
                </Text>
              </View>
              {clubMembers
                .filter(member =>
                  member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.memberItem, { borderBottomColor: theme.colors.border }]}
                    onPress={async () => {
                      if (selectedGeSubRole) {
                        const { error } = await supabase
                          .from('ge_report_sub_roles')
                          .update({
                            assigned_user_id: member.id,
                            assigned_user_name: member.full_name
                          })
                          .eq('id', selectedGeSubRole.id);

                        if (!error) {
                          setGeSubRoles(prev =>
                            prev.map(sr =>
                              sr.id === selectedGeSubRole.id
                                ? { ...sr, assigned_user_id: member.id, assigned_user_name: member.full_name }
                                : sr
                            )
                          );
                          setGeSubRoleModalVisible(false);
                          setSearchQuery('');
                        } else {
                          Alert.alert('Error', 'Failed to assign member');
                        }
                      }
                    }}
                  >
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
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
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  editorTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editorTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  editorTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  /** Single Notion-style surface for Agenda Section tab (matches book-a-role notionSheet) */
  notionSectionsSheet: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notionSectionsToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notionSectionsToolbarRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  notionSectionsEmptyState: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  /** Agenda Settings — single flat surface for visibility (matches notionSectionsSheet) */
  notionAgendaVisibilitySheet: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notionVisibilitySheetHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notionVisibilitySheetTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  notionVisibilityMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  notionVisibilityMetaRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notionVisibilityMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  notionVisibilitySegmentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  notionVisibilitySegmentHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  notionVisibilitySegmentDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  notionPublicWebSkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  notionPublicWebMetaBlock: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notionPublicWebActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  notionPublicWebActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  notionPublicWebActionOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  notionPublicWebActionDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  notionPublicWebEmptyRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  notionPublicWebCopyFullRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  notionPublicWebCopyFullLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  notionBannerColorsSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  notionBannerColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  notionBannerColorRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#3b82f620',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  hiddenCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#3b82f640',
  },
  hiddenCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  agendaCard: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    padding: 14,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionIcon: {
    fontSize: 24,
  },
  tagTeamIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  titleWithTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTypeTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: 1,
  },
  sectionTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hiddenBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 0,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  hiddenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#ef4444',
  },
  sectionOrder: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  visibilityButton: {
    padding: 8,
  },
  disabledButton: {
    opacity: 0.4,
  },
  cardContent: {
    gap: 12,
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 0,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  durationInput: {
    width: 80,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  durationInputAccessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  durationInputAccessoryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  durationInputAccessoryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  assignmentButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 0,
    borderWidth: 1,
  },
  assignmentValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoFillButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  autoFillButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  assignedLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  assignedName: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesSection: {
    gap: 8,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  resetButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  notesInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  autoDescriptionContainer: {
    gap: 8,
  },
  autoDescriptionText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  editDescriptionButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  editDescriptionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  autoGenBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 0,
    backgroundColor: '#8b5cf620',
  },
  autoGenText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  meetAndGreetDescriptionText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  meetAndGreetActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  meetAndGreetEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 0,
    borderWidth: 1,
  },
  meetAndGreetEditText: {
    fontSize: 14,
    fontWeight: '700',
  },
  meetAndGreetAutoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 0,
    borderWidth: 1,
  },
  meetAndGreetAutoText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSpace: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 0,
    paddingTop: 0,
    width: '100%',
    maxWidth: 600,
    maxHeight: '85%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    margin: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  membersList: {
    minHeight: 200,
    maxHeight: 400,
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  unassignSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    marginBottom: 0,
  },
  unassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    width: '100%',
  },
  unassignButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  customNameSection: {
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modalMembersSectionTitle: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  modalFormSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  customNameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customNameInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
  },
  saveCustomButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveCustomButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 0,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  regenerateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  visibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  visibilityButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  agendaMemberVisibilityLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  agendaMemberVisibilityTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  agendaMemberVisibilityHint: {
    fontSize: 11,
    marginTop: 3,
  },
  agendaMemberVisibilityToggle: {
    width: 34,
    height: 34,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  agendaVisibilitySubtitle: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  sectionVisibilityButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  publicWebSkinOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  publicWebSkinOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  publicWebLinkText: {
    fontSize: 12,
    marginTop: 0,
    lineHeight: 18,
  },
  publicWebLinkHint: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  publicWebLinkPrimaryButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  publicWebLinkOutlineButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  colorPreview: {
    width: 36,
    height: 36,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  colorInput: {
    minWidth: 112,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  colorInputText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  sectionFilterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionFilterDropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionFilterModalActions: {
    flexDirection: 'row',
    gap: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionFilterActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  sectionFilterActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionFilterList: {
    maxHeight: 360,
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  sectionFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 0,
  },
  sectionFilterRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  manageSequenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  manageSequenceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  manageSequenceModalContent: {
    width: '92%',
    maxWidth: 520,
    alignSelf: 'center',
    marginVertical: 40,
    borderRadius: 0,
    overflow: 'hidden',
    maxHeight: '88%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  manageSequenceSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  manageSequenceList: {
    flexGrow: 1,
    minHeight: 220,
    paddingHorizontal: 0,
  },
  manageSequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 0,
  },
  manageSequenceOrder: {
    width: 28,
    fontSize: 14,
    fontWeight: '700',
  },
  manageSequenceName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  manageSequenceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  manageSequenceEye: {
    padding: 6,
  },
  manageSequenceArrow: {
    padding: 6,
  },
  manageSequenceDoneButton: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 16,
    borderRadius: 0,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  manageSequenceDoneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  createSectionsButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 0,
  },
  createSectionsButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  grammarianFieldsSection: {
    gap: 12,
  },
  grammarianFieldItem: {
    gap: 8,
  },
  grammarianFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  grammarianFieldIcon: {
    fontSize: 16,
  },
  grammarianFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  grammarianFieldInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  grammarianCornerFields: {
    marginTop: 12,
    gap: 10,
  },
  grammarianCornerFieldRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  grammarianCornerFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  grammarianCornerFieldHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  grammarianCornerFieldIcon: {
    fontSize: 16,
  },
  grammarianCornerInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  themeSection: {
    marginTop: 12,
  },
  themeFieldContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  themeFieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  themeFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  themeFieldIcon: {
    fontSize: 16,
  },
  themeFieldInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  saaInfoContainer: {
    marginTop: 12,
    gap: 6,
  },
  saaInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  saaInfoBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  saaInfoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  saaInfoName: {
    fontWeight: '600',
    fontSize: 14,
  },
  tagTeamSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tagTeamIcon: {
    fontSize: 22,
  },
  tagTeamRoleCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  tagTeamRoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tagTeamRoleIcon: {
    fontSize: 24,
  },
  tagTeamRoleInfo: {
    flex: 1,
  },
  tagTeamRoleName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  tagTeamRoleAssignee: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagTeamAssignmentsSection: {
    marginTop: 12,
    gap: 12,
  },
  tagTeamAutoFillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  tagTeamRoleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  tagTeamAssignmentCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagTeamVisibilityButton: {
    width: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagTeamAssignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tagTeamAssignmentIcon: {
    fontSize: 24,
  },
  tagTeamAssignmentInfo: {
    flex: 1,
  },
  tagTeamAssignmentRole: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  tagTeamAssignmentLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tagTeamAssignmentValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 36,
  },
  tagTeamAssignmentValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  preparedSpeakersSection: {
    paddingTop: 12,
    gap: 12,
  },
  preparedSlotCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  preparedSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    gap: 12,
    borderBottomWidth: 1,
  },
  preparedSlotContent: {
    marginTop: 20,
    gap: 16,
  },
  preparedSlotField: {
    gap: 4,
  },
  preparedSlotLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  preparedSlotValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  preparedSlotGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  preparedSlotGridCol: {
    flex: 1,
    gap: 4,
  },
  preparedSlotGridColNarrow: {
    width: 92,
    gap: 4,
  },
  preparedSlotDivider: {
    height: 1,
    width: '100%',
  },
  preparedSlotEvalFormRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  preparedSlotInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  speakerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speakerNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  speakerMainInfo: {
    flex: 1,
  },
  speakerReorderButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  reorderButton: {
    width: 32,
    height: 32,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerRoleLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  speakerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  speakerDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingLeft: 4,
  },
  speakerDetailIcon: {
    fontSize: 18,
  },
  speakerDetailContent: {
    flex: 1,
  },
  speakerDetailLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  speakerDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  speakerSectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  speakerTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    marginTop: 4,
  },
  speakerLevelInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 40,
    textAlign: 'center',
    fontSize: 13,
    marginTop: 4,
  },
  pathwayInfoRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pathwayBadge: {
    flex: 1,
    minWidth: 140,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 4,
    position: 'relative',
  },
  pathwayBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pathwayBadgeValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  levelBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  projectNumberBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectNumberBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  emptyStateCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  evaluationFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 7,
    marginTop: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  evaluationFormButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  grammarianCornerContainer: {
    gap: 12,
    marginTop: 8,
  },
  grammarianCornerMainContainer: {
    marginTop: 12,
    gap: 16,
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
    gap: 12,
  },
  grammarianCornerNewCard: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  grammarianCornerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  grammarianCornerCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grammarianCornerCardIcon: {
    fontSize: 18,
  },
  grammarianCornerCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  grammarianEyeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grammarianCornerMainText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  grammarianCornerPhonetic: {
    fontSize: 14,
  },
  grammarianCornerQuoteText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  grammarianCornerCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  grammarianCornerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  grammarianCornerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grammarianCornerIcon: {
    fontSize: 20,
  },
  grammarianCornerTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grammarianCornerWord: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  grammarianCornerPartOfSpeech: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  grammarianCornerMeaning: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  grammarianCornerUsage: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  hiddenFieldContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  hiddenFieldText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Small eye button used on section header rows
  sectionHeaderEyeButton: {
    width: 34,
    height: 34,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  pickerInput: {
    flex: 1,
    fontSize: 14,
  },
  pickerButton: {
    padding: 4,
    marginLeft: 8,
  },
});
