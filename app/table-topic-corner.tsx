import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Image,
  Linking,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchTableTopicCornerBundle, tableTopicCornerQueryKeys } from '@/lib/tableTopicCornerQuery';
import PremiumBookingSuccessModal from '@/components/PremiumBookingSuccessModal';
import {
  bookMeetingRoleForCurrentUser as bookMeetingRoleInline,
  bookOpenMeetingRole,
} from '@/lib/bookMeetingRoleInline';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  MessageSquare,
  Users,
  X,
  Plus,
  Trash2,
  StickyNote,
  FileText,
  NotebookPen,
  Calendar,
  ClipboardCheck,
  FileBarChart,
  Clock,
  Share2,
  RotateCcw,
  User,
  Vote
} from 'lucide-react-native';

const FOOTER_NAV_ICON_SIZE = 15;

const CORNER_QUESTION_SLOT_COUNT = 12;
/** Initial number of question rows shown; user can reveal up to CORNER_QUESTION_SLOT_COUNT via + Add Question. */
const CORNER_VISIBLE_SLOTS_MIN = 3;
const TABLE_TOPIC_QUESTION_MAX_CHARS = 100;

/** Notion-style palette (light) — aligned with General Evaluator Report */
const NOTION_TEXT = '#37352F';
const NOTION_TEXT_MUTED = '#787774';
const NOTION_ACCENT = '#2383E2';
const NOTION_PAGE_BG = '#FBFBFA';
const NOTION_SURFACE = '#FFFFFF';
const NOTION_DIVIDER = 'rgba(55, 53, 47, 0.09)';

const NOTION_FONT_FAMILY =
  Platform.OS === 'web'
    ? 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
    : undefined;

// Type definitions
interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_location: string | null;
  meeting_link: string | null;
  meeting_status: string;
}

function formatTimeForDisplay(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

function meetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** e.g. "April 4 | Sat | 19:30 - 20:30 | In Person" — same as General Evaluator Report */
function formatConsolidatedMeetingMetaSingleLine(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const parts: string[] = [monthDay, weekdayShort];
  if (m.meeting_start_time && m.meeting_end_time) {
    parts.push(
      `${formatTimeForDisplay(m.meeting_start_time)} - ${formatTimeForDisplay(m.meeting_end_time)}`
    );
  } else if (m.meeting_start_time) {
    parts.push(formatTimeForDisplay(m.meeting_start_time));
  }
  parts.push(meetingModeLabel(m));
  return parts.join(' | ');
}

interface UserProfile {
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface TableTopicMaster {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: UserProfile;
}

interface TableTopicParticipant {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string;
  order_index: number;
  app_user_profiles?: UserProfile;
}

interface QuestionForm {
  question: string;
  participantId: string;
  participantName: string;
}

interface ParticipantQuestion {
  [participantId: string]: string;
}

interface AssignedQuestion {
  id: string;
  meeting_id: string;
  participant_id: string;
  participant_name: string;
  question_text: string;
  asked_by: string;
  asked_by_name: string;
  created_at: string;
  updated_at: string;
  participant_avatar?: string | null;
}

interface TableTopicQuestion {
  id: string;
  question_text: string;
  is_used: boolean;
  question_order: number;
}

interface ClubMemberLite {
  id: string;
  full_name: string;
  email?: string;
}

/**
 * Table Topic Corner Component
 * Displays Table Topic Master and Participants for a meeting
 * Allows Table Topic Master to assign questions to participants
 */
export default function TableTopicCorner(): JSX.Element {
  const { theme } = useTheme();
  const notion =
    theme.mode === 'light'
      ? {
          text: NOTION_TEXT,
          muted: NOTION_TEXT_MUTED,
          accent: NOTION_ACCENT,
          divider: NOTION_DIVIDER,
          surface: NOTION_SURFACE,
          page: NOTION_PAGE_BG,
          blockFill: 'rgba(55, 53, 47, 0.04)',
          blockBorder: NOTION_DIVIDER,
          placeholder: 'rgba(55, 53, 47, 0.45)',
        }
      : {
          text: theme.colors.text,
          muted: theme.colors.textSecondary,
          accent: theme.colors.primary,
          divider: theme.colors.border,
          surface: theme.colors.surface,
          page: theme.colors.background,
          blockFill: theme.colors.surface,
          blockBorder: theme.colors.border,
          placeholder: theme.colors.textSecondary,
        };
  const notionType = NOTION_FONT_FAMILY ? ({ fontFamily: NOTION_FONT_FAMILY } as const) : {};
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  // State management
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [tableTopicMaster, setTableTopicMaster] = useState<TableTopicMaster | null>(null);
  const [participants, setParticipants] = useState<TableTopicParticipant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showQuestionModal, setShowQuestionModal] = useState<boolean>(false);
  const [selectedParticipant, setSelectedParticipant] = useState<TableTopicParticipant | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<TableTopicQuestion | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [participantQuestions, setParticipantQuestions] = useState<ParticipantQuestion>({});
  const [assignedQuestions, setAssignedQuestions] = useState<AssignedQuestion[]>([]);
  const [questions, setQuestions] = useState<TableTopicQuestion[]>([]);
  const [cornerSlotTexts, setCornerSlotTexts] = useState<string[]>(() =>
    Array.from({ length: CORNER_QUESTION_SLOT_COUNT }, () => '')
  );
  const [cornerSlotIds, setCornerSlotIds] = useState<(string | null)[]>(() =>
    Array.from({ length: CORNER_QUESTION_SLOT_COUNT }, () => null)
  );
  const [cornerVisibleSlotCount, setCornerVisibleSlotCount] = useState<number>(CORNER_VISIBLE_SLOTS_MIN);
  const [cornerAutoSaving, setCornerAutoSaving] = useState(false);
  const cornerAutoSaveOpsRef = useRef(0);
  const cornerSlotInputRefs = useRef<(TextInput | null)[]>([]);
  const cornerSlotTextsRef = useRef<string[]>(cornerSlotTexts);
  const cornerSlotIdsRef = useRef<(string | null)[]>(cornerSlotIds);
  const cornerSaveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({});
  const cornerPersistInFlightRef = useRef<Record<number, boolean>>({});
  const questionsRef = useRef<TableTopicQuestion[]>(questions);

  const beginCornerAutoSave = () => {
    cornerAutoSaveOpsRef.current += 1;
    setCornerAutoSaving(true);
  };
  const endCornerAutoSave = () => {
    cornerAutoSaveOpsRef.current = Math.max(0, cornerAutoSaveOpsRef.current - 1);
    if (cornerAutoSaveOpsRef.current === 0) {
      setCornerAutoSaving(false);
    }
  };

  useEffect(() => {
    cornerSlotTextsRef.current = cornerSlotTexts;
  }, [cornerSlotTexts]);
  useEffect(() => {
    cornerSlotIdsRef.current = cornerSlotIds;
  }, [cornerSlotIds]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  const [questionForm, setQuestionForm] = useState<QuestionForm>({
    question: '',
    participantId: '',
    participantName: '',
  });
  const [activeTab, setActiveTab] = useState<'participants' | 'table_topic_corner' | 'table_topic_summary'>('participants');
  const prevActiveTabRef = useRef<'participants' | 'table_topic_corner' | 'table_topic_summary'>('participants');
  const [publishedQuestions, setPublishedQuestions] = useState<AssignedQuestion[]>([]);
  const [clubInfo, setClubInfo] = useState<{ name: string; club_number: string | null; banner_color: string | null } | null>(null);
  const [isVPEClub, setIsVPEClub] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState<boolean>(false);
  const [newQuestionText, setNewQuestionText] = useState<string>('');
  const [savingQuestionBank, setSavingQuestionBank] = useState<boolean>(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionIdPendingDelete, setQuestionIdPendingDelete] = useState<string | null>(null);
  const [showAssignMemberModal, setShowAssignMemberModal] = useState<boolean>(false);
  const [selectedCornerQuestion, setSelectedCornerQuestion] = useState<TableTopicQuestion | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMemberLite[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);
  const [assignSearch, setAssignSearch] = useState<string>('');
  const [assignMode, setAssignMode] = useState<'member' | 'guest'>('member');
  const [guestName, setGuestName] = useState<string>('');
  /** Inline book-a-role: loading state per participant row */
  const [bookingRoleId, setBookingRoleId] = useState<string | null>(null);
  const [bookingTableTopicMaster, setBookingTableTopicMaster] = useState<boolean>(false);
  const [bookingSuccessRole, setBookingSuccessRole] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef<boolean>(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);

  // Ref for screenshot
  const summaryViewRef = useRef<ViewShot>(null);

  // Load data on component mount
  useEffect(() => {
    if (meetingId) {
      void loadTableTopicCornerData();
    }
  }, [meetingId, user?.currentClubId]);

  // Reload published questions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        return;
      }
      if (meetingId && user?.currentClubId) {
        void loadPublishedQuestions();
      }
    }, [meetingId, user?.currentClubId])
  );

  /**
   * Load all table topic corner data
   */
  const loadTableTopicCornerData = async (): Promise<void> => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    if (loadInFlightRef.current) {
      return loadInFlightRef.current;
    }

    const run = async () => {
      try {
        const effectiveUserId = user?.id ?? '';
        const bundle = await queryClient.fetchQuery({
          queryKey: tableTopicCornerQueryKeys.snapshot(
            meetingId,
            user.currentClubId,
            effectiveUserId || 'anon'
          ),
          queryFn: () => fetchTableTopicCornerBundle(meetingId, user.currentClubId!),
          staleTime: 60 * 1000,
        });
        setMeeting(bundle.meeting);
        setClubInfo(bundle.clubInfo);
        setTableTopicMaster(bundle.tableTopicMaster);
        setParticipants(bundle.participants);
        setAssignedQuestions(bundle.assignedQuestions);
        setPublishedQuestions(bundle.publishedQuestions);
        setIsVPEClub(bundle.isVpe);

        // Note: `participantQuestions` is not used elsewhere in this screen.
        // Keeping bundle fetch lightweight via the optimized snapshot payload.
      } catch (error) {
        console.error('Error loading table topic corner data:', error);
        Alert.alert('Error', 'Failed to load table topic data');
      } finally {
        setIsLoading(false);
        loadInFlightRef.current = null;
      }
    };

    loadInFlightRef.current = run();
    return loadInFlightRef.current;
  };

  const loadPublishedQuestions = async (): Promise<void> => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId)
        .eq('is_active', true)
        .eq('is_published', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading published questions:', error);
        return;
      }

      // On this screen we only need `publishedQuestions.length`.
      setPublishedQuestions((data || []) as any);
    } catch (error) {
      console.error('Error loading published questions:', error);
    }
  };

  /**
   * Load meeting details
   */
  const loadMeeting = async (): Promise<void> => {
    if (!meetingId) return;

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
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  /**
   * Load club information
   */
  const loadClubInfo = async (): Promise<void> => {
    if (!user?.currentClubId) return;

    try {
      // Fetch club basic info
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .select('name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (clubError) {
        console.error('Error loading club info:', clubError);
        return;
      }

      // Banner color is already included in the snapshot RPC; keep this as a no-op fallback.
      setClubInfo((prev) => prev ?? ({ ...clubData, banner_color: null } as any));
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  /**
   * Handle sharing summary to WhatsApp
   */
  const handleShareToWhatsApp = async (): Promise<void> => {
    setIsSharing(true);
    try {
      let uri: string;

      if (Platform.OS === 'web') {
        const html2canvas = (await import('html2canvas')).default;
        const element = document.getElementById('summary-view');

        if (!element) {
          Alert.alert('Error', 'Could not find summary view');
          return;
        }

        const savedScrollX = window.scrollX || window.pageXOffset || 0;
        const savedScrollY = window.scrollY || window.pageYOffset || 0;
        window.scrollTo(0, 0);

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );

        const rect = element.getBoundingClientRect();

        const canvas = await html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          foreignObjectRendering: false,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: element.scrollHeight,
          scrollX: 0,
          scrollY: 0,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
        });

        window.scrollTo(savedScrollX, savedScrollY);

        uri = canvas.toDataURL('image/png');

        // Download the image
        const link = document.createElement('a');
        link.href = uri;
        link.download = `table-topics-summary-${meeting?.meeting_number || 'export'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Alert.alert(
          'Download Complete',
          'The Table Topics summary has been downloaded. You can now upload it to WhatsApp Web manually.',
          [{ text: 'OK' }]
        );
        return;
      }

      // For mobile, use ViewShot
      if (!summaryViewRef.current) return;
      uri = await summaryViewRef.current.capture();

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Try to share directly to WhatsApp if possible, otherwise use general share
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent('Table Topics Summary')}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);

      if (canOpen) {
        // Share the image file
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Table Topics Summary',
        });
      } else {
        // WhatsApp not installed, use general share
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Table Topics Summary',
        });
      }
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
      Alert.alert('Error', 'Failed to share summary');
    } finally {
      setIsSharing(false);
    }
  };

  /**
   * Load Table Topic Master assignment
   */
  const loadTableTopicMaster = async (): Promise<void> => {
    if (!meetingId) return;

    try {
      console.log('Loading Table Topic Master for meeting:', meetingId);
      
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          booking_status,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .or('role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .single();

      console.log('Table Topic Master query result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading table topic master:', error);
        return;
      }

      if (data) {
        setTableTopicMaster(data);
        console.log('Table Topic Master loaded:', data.app_user_profiles?.full_name);
      } else {
        console.log('No Table Topic Master found');
        setTableTopicMaster(null);
      }
    } catch (error) {
      console.error('Error loading table topic master:', error);
    }
  };

  /**
   * Load Table Topic Participants
   */
  const loadTableTopicParticipants = async (): Promise<void> => {
    if (!meetingId) return;

    try {
      console.log('Loading Table Topic Participants for meeting:', meetingId);

      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          booking_status,
          order_index,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .or('role_name.ilike.%Table Topics Speaker%,role_name.ilike.%Table Topic Speaker%,role_name.ilike.%Table Topics Participant%,role_name.ilike.%Table Topic Participant%')
        .eq('role_status', 'Available')
        .order('order_index');

      console.log('Table Topic Participants query result:', {
        count: data?.length || 0,
        error: error?.message || 'none',
        participants: data?.map(p => ({
          name: p.app_user_profiles?.full_name,
          role: p.role_name,
          order: p.order_index,
          booking_status: p.booking_status
        })) || []
      });

      if (error) {
        console.error('Error loading table topic participants:', error);
        return;
      }

      // Sort participants by extracting numeric value from role name
      const sortedData = (data || []).sort((a, b) => {
        // Extract numbers from role names like "Table Topics Speaker 1", "Table Topics Speaker 10", etc.
        const numberA = parseInt(a.role_name.match(/\d+/)?.[0] || '0', 10);
        const numberB = parseInt(b.role_name.match(/\d+/)?.[0] || '0', 10);
        return numberA - numberB;
      });

      setParticipants(sortedData);
      console.log('Table Topic Participants loaded:', sortedData.length || 0);
    } catch (error) {
      console.error('Error loading table topic participants:', error);
    }
  };

  /**
   * Load assigned questions from database
   */
  const loadAssignedQuestions = async (): Promise<void> => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('booking_status', 'booked')
        .eq('is_active', true);

      if (error) {
        console.error('Error loading assigned questions:', error);
        return;
      }

      setAssignedQuestions(data || []);
      
      // Update participantQuestions state for display
      const questionsMap: ParticipantQuestion = {};
      (data || []).forEach(q => {
        questionsMap[q.participant_id] = q.question_text;
      });
      setParticipantQuestions(questionsMap);
    } catch (error) {
      console.error('Error loading assigned questions:', error);
    }
  };

  /**
   * Check if current user is the Table Topic Master
   */
  const isTableTopicMaster = (): boolean => {
    return tableTopicMaster?.assigned_user_id === user?.id;
  };
  const canManageTableTopicCorner = (): boolean => {
    return isTableTopicMaster() || isVPEClub;
  };
  const tableTopicQuestionOwnerId = tableTopicMaster?.assigned_user_id || user?.id || '';

  const hydrateCornerSlotsFromQuestions = useCallback((qs: TableTopicQuestion[]) => {
    const texts = Array.from({ length: CORNER_QUESTION_SLOT_COUNT }, () => '');
    const ids = Array.from({ length: CORNER_QUESTION_SLOT_COUNT }, () => null as string | null);
    const sorted = [...qs].sort((a, b) => a.question_order - b.question_order);
    sorted.slice(0, CORNER_QUESTION_SLOT_COUNT).forEach((q, i) => {
      texts[i] = q.question_text;
      ids[i] = q.id;
    });
    let maxOccupied = -1;
    for (let i = 0; i < CORNER_QUESTION_SLOT_COUNT; i++) {
      if ((texts[i] ?? '').trim().length > 0 || ids[i]) {
        maxOccupied = i;
      }
    }
    const neededVisible =
      maxOccupied < 0
        ? CORNER_VISIBLE_SLOTS_MIN
        : Math.min(
            CORNER_QUESTION_SLOT_COUNT,
            Math.max(CORNER_VISIBLE_SLOTS_MIN, maxOccupied + 1)
          );
    setCornerVisibleSlotCount(neededVisible);
    setCornerSlotTexts(texts);
    setCornerSlotIds(ids);
  }, []);

  const handleAddVisibleCornerSlot = useCallback(() => {
    setCornerVisibleSlotCount((c) => {
      if (c >= CORNER_QUESTION_SLOT_COUNT) {
        return c;
      }
      const next = c + 1;
      requestAnimationFrame(() => {
        cornerSlotInputRefs.current[next - 1]?.focus();
      });
      return next;
    });
  }, []);

  const persistCornerSlotAtIndex = useCallback(
    async (index: number) => {
      if (!canManageTableTopicCorner()) return;
      if (!meetingId || !user?.currentClubId || !tableTopicQuestionOwnerId) return;
      if (cornerPersistInFlightRef.current[index]) return;

      const text = (cornerSlotTextsRef.current[index] ?? '').trim();
      const id = cornerSlotIdsRef.current[index];

      if (text.length > TABLE_TOPIC_QUESTION_MAX_CHARS) {
        Alert.alert('Error', `Question ${index + 1} cannot exceed ${TABLE_TOPIC_QUESTION_MAX_CHARS} characters.`);
        return;
      }

      if (id) {
        const existing = questionsRef.current.find((q) => q.id === id);
        if (existing && existing.question_text === text && (existing.question_order ?? 0) === index + 1) {
          return;
        }
      }
      if (!id && !text) return;

      cornerPersistInFlightRef.current[index] = true;
      beginCornerAutoSave();
      try {
        if (id) {
          if (!text) {
            const { error } = await supabase
              .from('table_topic_master_questions')
              .delete()
              .eq('id', id)
              .eq('meeting_id', meetingId)
              .eq('table_topic_master_id', tableTopicQuestionOwnerId);
            if (error) {
              console.error('Error deleting corner question:', error);
              const snap = questionsRef.current.find((q) => q.id === id);
              if (snap) {
                setCornerSlotTexts((prev) => {
                  const next = [...prev];
                  next[index] = snap.question_text;
                  cornerSlotTextsRef.current = next;
                  return next;
                });
              }
              Alert.alert(
                'Could not clear',
                'The question could not be removed (permission or network). If this continues, ask your club admin to check database access for Table Topic Corner.'
              );
              return;
            }
            setCornerSlotIds((prev) => {
              const next = [...prev];
              next[index] = null;
              return next;
            });
            setQuestions((prev) => prev.filter((q) => q.id !== id));
          } else {
            const { error } = await supabase
              .from('table_topic_master_questions')
              .update({
                question_text: text,
                question_order: index + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', id)
              .eq('meeting_id', meetingId)
              .eq('table_topic_master_id', tableTopicQuestionOwnerId);
            if (error) {
              console.error('Error updating corner question:', error);
              const snap = questionsRef.current.find((q) => q.id === id);
              if (snap) {
                setCornerSlotTexts((prev) => {
                  const next = [...prev];
                  next[index] = snap.question_text;
                  cornerSlotTextsRef.current = next;
                  return next;
                });
              }
              Alert.alert('Error', 'Failed to update question');
              return;
            }
            setQuestions((prev) =>
              prev.map((q) => (q.id === id ? { ...q, question_text: text, question_order: index + 1 } : q))
            );
          }
        } else if (text) {
          const { data: row, error } = await supabase
            .from('table_topic_master_questions')
            .insert({
              meeting_id: meetingId,
              club_id: user.currentClubId,
              table_topic_master_id: tableTopicQuestionOwnerId,
              question_text: text,
              question_order: index + 1,
              is_used: false,
            })
            .select('*')
            .single();
          if (error) {
            console.error('Error inserting corner question:', error);
            Alert.alert('Error', 'Failed to add question');
            return;
          }
          if (row) {
            const r = row as TableTopicQuestion;
            setCornerSlotIds((prev) => {
              const next = [...prev];
              next[index] = r.id;
              return next;
            });
            setQuestions((prev) =>
              [...prev.filter((q) => q.id !== r.id), r].sort((a, b) => a.question_order - b.question_order)
            );
          }
        }
      } finally {
        cornerPersistInFlightRef.current[index] = false;
        endCornerAutoSave();
      }
    },
    [meetingId, tableTopicQuestionOwnerId, user?.currentClubId]
  );

  const scheduleCornerSlotAutoSave = useCallback(
    (index: number) => {
      const existing = cornerSaveTimersRef.current[index];
      if (existing) clearTimeout(existing);
      cornerSaveTimersRef.current[index] = setTimeout(() => {
        cornerSaveTimersRef.current[index] = undefined;
        void persistCornerSlotAtIndex(index);
      }, 850);
    },
    [persistCornerSlotAtIndex]
  );

  const flushCornerSlotAutoSave = useCallback(
    (index: number) => {
      const existing = cornerSaveTimersRef.current[index];
      if (existing) {
        clearTimeout(existing);
        cornerSaveTimersRef.current[index] = undefined;
      }
      void persistCornerSlotAtIndex(index);
    },
    [persistCornerSlotAtIndex]
  );

  const focusCornerSlot = useCallback((index: number) => {
    cornerSlotInputRefs.current[index]?.focus();
  }, []);

  const clearCornerSlotAtIndex = useCallback(
    (index: number) => {
      if (cornerAutoSaving) return;
      const raw = cornerSlotTextsRef.current[index] ?? '';
      const id = cornerSlotIdsRef.current[index];
      if (raw.length === 0 && !id) return;

      const runClear = () => {
        const t = cornerSaveTimersRef.current[index];
        if (t) {
          clearTimeout(t);
          cornerSaveTimersRef.current[index] = undefined;
        }
        setCornerSlotTexts((prev) => {
          const next = [...prev];
          next[index] = '';
          cornerSlotTextsRef.current = next;
          return next;
        });
        void persistCornerSlotAtIndex(index);
      };

      if (id || raw.trim()) {
        Alert.alert('Clear question?', 'This removes the question from your question bank.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: runClear },
        ]);
      } else {
        runClear();
      }
    },
    [cornerAutoSaving, persistCornerSlotAtIndex]
  );

  useEffect(() => {
    if (activeTab === 'table_topic_corner' && !canManageTableTopicCorner()) {
      setActiveTab('participants');
    }
  }, [activeTab, isVPEClub, tableTopicMaster?.assigned_user_id, user?.id]);

  useEffect(() => {
    const prev = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTab;
    if (prev === 'table_topic_corner' && activeTab !== 'table_topic_corner') {
      for (let i = 0; i < CORNER_QUESTION_SLOT_COUNT; i++) {
        const t = cornerSaveTimersRef.current[i];
        if (t) {
          clearTimeout(t);
          cornerSaveTimersRef.current[i] = undefined;
          void persistCornerSlotAtIndex(i);
        }
      }
    }
  }, [activeTab, persistCornerSlotAtIndex]);

  useEffect(() => {
    return () => {
      Object.keys(cornerSaveTimersRef.current).forEach((key) => {
        const t = cornerSaveTimersRef.current[Number(key)];
        if (t) clearTimeout(t);
      });
      cornerSaveTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const loadQuestionBank = async () => {
      if (!meetingId || !tableTopicQuestionOwnerId || !canManageTableTopicCorner()) return;
      const { data, error } = await supabase
        .from('table_topic_master_questions')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_id', tableTopicQuestionOwnerId)
        .order('question_order');
      if (error) {
        console.error('Error loading table topic question bank:', error);
        return;
      }
      const list = (data || []) as TableTopicQuestion[];
      setQuestions(list);
      hydrateCornerSlotsFromQuestions(list);
    };
    void loadQuestionBank();
  }, [meetingId, tableTopicQuestionOwnerId, isVPEClub, tableTopicMaster?.assigned_user_id, hydrateCornerSlotsFromQuestions]);

  /**
   * Handle adding/editing question for a participant from question bank
   */
  const handleAssignQuestionFromBank = async (participant: TableTopicParticipant): Promise<void> => {
    if (!canManageTableTopicCorner()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master or club VPE can assign questions.');
      return;
    }

    console.log('Loading questions from Table Topic Master question bank...');
    
    try {
      const { data: questions, error } = await supabase
        .from('table_topic_master_questions')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_id', tableTopicQuestionOwnerId)
        .order('question_order');

      console.log('Questions loaded:', {
        count: questions?.length || 0,
        questions: questions?.map(q => ({ id: q.id, text: q.question_text.substring(0, 50) + '...', used: q.is_used })) || []
      });
      
      if (error) {
        console.error('Error loading questions:', error);
        Alert.alert('Error', 'Failed to load questions from your question bank');
        return;
      }

      if (!questions || questions.length === 0) {
        Alert.alert('No Questions Available', 'Please add questions in Table Topic Corner first.');
        return;
      }

      // Set the questions and show the modal
      const list = questions as TableTopicQuestion[];
      setQuestions(list);
      hydrateCornerSlotsFromQuestions(list);
      setSelectedParticipant(participant);
      setSelectedQuestion(null); // Reset selection
      setShowQuestionModal(true);
    } catch (error) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading questions');
    }
  };

  /**
   * Handle assigning selected question from bank
   */
  const handleAssignSelectedQuestion = async (): Promise<void> => {
    if (!selectedQuestion || !selectedParticipant) {
      Alert.alert('Error', 'Please select a question to assign');
      return;
    }

    if (!meetingId || !user?.currentClubId || !user?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }
    setIsSaving(true);
    
    try {
      console.log('Assigning question:', {
        questionId: selectedQuestion.id,
        questionText: selectedQuestion.question_text,
        participantId: selectedParticipant.assigned_user_id,
        participantName: selectedParticipant.app_user_profiles?.full_name,
        meetingId: meetingId,
        clubId: user.currentClubId,
        ttMasterId: user.id
      });

      // Check if this participant already has a question assigned
      const { data: existingAssignment, error: checkError } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('participant_id', selectedParticipant.assigned_user_id)
        .eq('booking_status', 'booked')
        .eq('is_active', true)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing assignment:', checkError);
        Alert.alert('Error', 'Failed to check existing assignment');
        return;
      }

      if (existingAssignment) {
        // Update existing assignment
        console.log('Updating existing assignment:', existingAssignment.id);
        const { error } = await supabase
          .from('app_meeting_tabletopicscorner')
          .update({
            question_text: selectedQuestion.question_text,
            question_id: selectedQuestion.id,
            asked_by: user.id,
            asked_by_name: user.fullName || 'Unknown',
            table_topic_master_user_id: tableTopicQuestionOwnerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAssignment.id);

        if (error) {
          console.error('Error updating question assignment:', error);
          Alert.alert('Error', 'Failed to update question assignment');
          return;
        }
        
        console.log('Question assignment updated successfully');
      } else {
        // Create new assignment
        console.log('Creating new assignment');
        const { error } = await supabase
        .from('app_meeting_tabletopicscorner')
        .insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          participant_id: selectedParticipant.assigned_user_id,
          participant_name: selectedParticipant.app_user_profiles?.full_name || 'Unknown',
          question_text: selectedQuestion.question_text,
          question_id: selectedQuestion.id,
          asked_by: user?.id,
          asked_by_name: user?.fullName || 'Unknown',
          booking_status: 'booked',
          is_active: true,
          table_topic_master_user_id: tableTopicQuestionOwnerId,
        });

        if (error) {
          console.error('Error creating question assignment:', error);
          Alert.alert('Error', 'Failed to assign question');
          return;
        }

        console.log('Question assignment created successfully');
      }

      // Mark question as used
      const { error: updateError } = await supabase
        .from('table_topic_master_questions')
        .update({ 
          is_used: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedQuestion.id);

      if (updateError) {
        console.error('Error marking question as used:', updateError);
        // Don't fail the assignment for this, just log it
      }
      Alert.alert('Success', `Question assigned to ${selectedParticipant.app_user_profiles?.full_name}`);
      setShowQuestionModal(false);
      setSelectedQuestion(null);
      setSelectedParticipant(null);
      
      // Reload data
      await loadAssignedQuestions();
    } catch (error) {
      console.error('Error assigning question:', error);
      Alert.alert('Error', 'Failed to assign question');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle adding/editing question for a participant
   */
  const handleAssignQuestion = async (participant: TableTopicParticipant): Promise<void> => {
    if (!canManageTableTopicCorner()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master or club VPE can assign questions.');
      return;
    }

    console.log('Loading questions from Table Topic Master question bank...');
    
    try {
      const { data: questions, error } = await supabase
        .from('table_topic_master_questions')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_id', tableTopicQuestionOwnerId)
        .order('question_order');

      console.log('Questions loaded:', {
        count: questions?.length || 0,
        questions: questions?.map(q => ({ id: q.id, text: q.question_text.substring(0, 50) + '...', used: q.is_used })) || []
      });
      if (error) {
        console.error('Error loading questions:', error);
        Alert.alert('Error', 'Failed to load questions from your question bank');
        return;
      }

      if (!questions || questions.length === 0) {
        Alert.alert('No Questions Available', 'Please add questions in Table Topic Corner first.');
        return;
      }

      // Set the questions and show the modal
      const list = questions as TableTopicQuestion[];
      setQuestions(list);
      hydrateCornerSlotsFromQuestions(list);
      setSelectedParticipant(participant);
      setSelectedQuestion(null); // Reset selection
      setShowQuestionModal(true);
    } catch (error) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading questions');
    }
  };

  /**
   * Handle saving question
   */
  const handleSaveQuestion = async (): Promise<void> => {
    if (!questionForm.question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    if (questionForm.question.length > TABLE_TOPIC_QUESTION_MAX_CHARS) {
      Alert.alert('Error', `Question cannot exceed ${TABLE_TOPIC_QUESTION_MAX_CHARS} characters`);
      return;
    }

    setIsSaving(true);
    
    try {
      // Update local state immediately for better UX
      setParticipantQuestions(prev => ({
        ...prev,
        [questionForm.participantId]: questionForm.question.trim()
      }));

      Alert.alert('Success', `Question assigned to ${questionForm.participantName}`);
      setShowQuestionModal(false);
      
      // Reload data
      await loadAssignedQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      Alert.alert('Error', 'Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBookTableTopicParticipant = async (participant: TableTopicParticipant): Promise<void> => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingRoleId(participant.id);
    try {
      const result = await bookMeetingRoleInline(user.id, participant.id);
      if (result.ok) {
        await loadTableTopicParticipants();
        setBookingSuccessRole('Table Topics participant');
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingRoleId(null);
    }
  };

  const handleBookTableTopicMaster = async (): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }

    setBookingTableTopicMaster(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        {
          orRoleName:
            'role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%',
        },
        'Table Topic Master is already booked or this meeting has no master role set up.'
      );
      if (result.ok) {
        await loadTableTopicMaster();
        setBookingSuccessRole('Table Topics Master');
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingTableTopicMaster(false);
    }
  };

  /**
   * Handle clearing question for a participant
   */
  const handleClearQuestion = (participant: TableTopicParticipant): void => {
    if (!canManageTableTopicCorner()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master or club VPE can clear questions.');
      return;
    }

    Alert.alert(
      'Clear Question',
      `Are you sure you want to clear the question for ${participant.app_user_profiles?.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from database
              const { error } = await supabase
                .from('app_meeting_tabletopicscorner')
                .update({
                  is_active: false,
                  updated_at: new Date().toISOString(),
                })
                .eq('meeting_id', meetingId)
                .eq('participant_id', participant.assigned_user_id)
                .eq('booking_status', 'booked')
                .eq('table_topic_master_user_id', tableTopicQuestionOwnerId);

              if (error) {
                console.error('Error clearing question:', error);
                Alert.alert('Error', 'Failed to clear question');
                return;
              }

              // Update local state
              setParticipantQuestions(prev => {
                const updated = { ...prev };
                delete updated[participant.assigned_user_id || participant.id];
                return updated;
              });
              
              Alert.alert('Success', 'Question cleared');
              
              // Reload assigned questions
              await loadAssignedQuestions();
            } catch (error) {
              console.error('Error clearing question:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const handleAddQuestionToCorner = async (): Promise<void> => {
    if (!canManageTableTopicCorner()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master or club VPE can add questions.');
      return;
    }
    const text = newQuestionText.trim();
    if (!meetingId || !user?.currentClubId || !tableTopicQuestionOwnerId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }
    if (!text) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }
    if (text.length > TABLE_TOPIC_QUESTION_MAX_CHARS) {
      Alert.alert('Error', `Question cannot exceed ${TABLE_TOPIC_QUESTION_MAX_CHARS} characters`);
      return;
    }
    if (!editingQuestionId && questions.length >= 12) {
      Alert.alert('Limit reached', 'You can add up to 12 questions.');
      return;
    }
    setSavingQuestionBank(true);
    try {
      let error: any = null;
      if (editingQuestionId) {
        const result = await supabase
          .from('table_topic_master_questions')
          .update({
            question_text: text,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingQuestionId);
        error = result.error;
      } else {
        const nextOrder = (questions?.length || 0) + 1;
        const result = await supabase
          .from('table_topic_master_questions')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            table_topic_master_id: tableTopicQuestionOwnerId,
            question_text: text,
            question_order: nextOrder,
            is_used: false,
          });
        error = result.error;
      }
      if (error) {
        console.error('Error adding question to table topic corner:', error);
        Alert.alert('Error', 'Failed to add question');
        return;
      }
      const { data: refreshed, error: refreshError } = await supabase
        .from('table_topic_master_questions')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_id', tableTopicQuestionOwnerId)
        .order('question_order');
      if (!refreshError && refreshed) {
        const list = refreshed as TableTopicQuestion[];
        setQuestions(list);
        hydrateCornerSlotsFromQuestions(list);
      }
      setNewQuestionText('');
      setEditingQuestionId(null);
      setShowAddQuestionModal(false);
      Alert.alert('Success', editingQuestionId ? 'Question updated' : 'Question added');
    } finally {
      setSavingQuestionBank(false);
    }
  };

  const handleDeleteCornerQuestion = async (questionId: string): Promise<void> => {
    if (!canManageTableTopicCorner()) return;
    setQuestionIdPendingDelete(questionId);
  };

  const confirmDeleteCornerQuestion = async (): Promise<void> => {
    if (!questionIdPendingDelete || !meetingId || !tableTopicQuestionOwnerId) return;
    const { error } = await supabase
      .from('table_topic_master_questions')
      .delete()
      .eq('id', questionIdPendingDelete)
      .eq('meeting_id', meetingId)
      .eq('table_topic_master_id', tableTopicQuestionOwnerId);
    if (error) {
      console.error('Error deleting table topic question:', error);
      Alert.alert('Error', 'Failed to delete question');
      return;
    }
    const { data: refreshed, error: refreshError } = await supabase
      .from('table_topic_master_questions')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('table_topic_master_id', tableTopicQuestionOwnerId)
      .order('question_order');
    if (!refreshError && refreshed) {
      const list = refreshed as TableTopicQuestion[];
      setQuestions(list);
      hydrateCornerSlotsFromQuestions(list);
    } else {
      setQuestions((prev) => prev.filter((q) => q.id !== questionIdPendingDelete));
    }
    setQuestionIdPendingDelete(null);
  };

  const loadClubMembersForAssign = async (): Promise<void> => {
    if (!user?.currentClubId) return;
    setMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('user_id, app_user_profiles(full_name, email)')
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);
      if (error) {
        console.error('Error loading club members for assignment:', error);
        return;
      }
      const rows = (data || [])
        .map((r: any) => ({
          id: String(r.user_id || ''),
          full_name: String(r.app_user_profiles?.full_name || '').trim() || 'Member',
          email: r.app_user_profiles?.email || '',
        }))
        .filter((r: ClubMemberLite) => !!r.id)
        .sort((a: ClubMemberLite, b: ClubMemberLite) => a.full_name.localeCompare(b.full_name));
      setClubMembers(rows);
    } finally {
      setMembersLoading(false);
    }
  };

  const openAssignModalForQuestion = async (q: TableTopicQuestion): Promise<void> => {
    setSelectedCornerQuestion(q);
    setAssignSearch('');
    setGuestName('');
    setAssignMode('member');
    setShowAssignMemberModal(true);
    await loadClubMembersForAssign();
  };

  const assignQuestionToSpeaker = async (member?: ClubMemberLite): Promise<void> => {
    if (!selectedCornerQuestion || !meetingId || !user?.currentClubId) return;
    const isGuest = assignMode === 'guest';
    const participantName = isGuest ? guestName.trim() : (member?.full_name || '');
    if (!participantName) {
      Alert.alert('Error', isGuest ? 'Enter guest name' : 'Select a club member');
      return;
    }
    const participantId = isGuest ? null : member?.id || null;
    const { error } = await supabase.from('app_meeting_tabletopicscorner').insert({
      meeting_id: meetingId,
      club_id: user.currentClubId,
      participant_id: participantId,
      participant_name: participantName,
      question_text: selectedCornerQuestion.question_text,
      question_id: selectedCornerQuestion.id,
      asked_by: user.id,
      asked_by_name: user.fullName || 'Unknown',
      booking_status: 'booked',
      is_active: true,
      table_topic_master_user_id: tableTopicQuestionOwnerId,
    });
    if (error) {
      console.error('Error assigning corner question:', error);
      Alert.alert('Error', 'Failed to assign question');
      return;
    }
    setShowAssignMemberModal(false);
    setSelectedCornerQuestion(null);
    await loadAssignedQuestions();
    Alert.alert('Assigned', `Question assigned to ${participantName}`);
  };

  /**
   * Participant Card Component
   */
  const ParticipantCard = ({ participant }: { participant: TableTopicParticipant }): JSX.Element => {
    const isBooked = participant.booking_status === 'booked' && participant.assigned_user_id;

    return (
      <View style={[styles.participantCard, { backgroundColor: theme.colors.surface }]}>
        {isBooked ? (
          <View style={styles.bookedParticipant}>
            <View style={styles.participantAvatar}>
              {participant.app_user_profiles?.avatar_url ? (
                <Image
                  source={{ uri: participant.app_user_profiles.avatar_url }}
                  style={styles.participantAvatarImage}
                />
              ) : (
                <Text style={styles.participantInitials} maxFontSizeMultiplier={1.3}>
                  {participant.app_user_profiles?.full_name
                    ?.split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'TT'}
                </Text>
              )}
            </View>
            <View style={styles.participantDetails}>
              <Text style={[styles.participantName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {participant.app_user_profiles?.full_name || 'Unknown Member'}
              </Text>
              <View style={[styles.bookedTag, { backgroundColor: '#10b981' + '20' }]}>
                <Text style={[styles.bookedTagText, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                  Booked
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.openRoleRow}>
            <Text style={[styles.participantRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {participant.role_name}
            </Text>
            <TouchableOpacity
              style={[
                styles.bookRoleButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: bookingRoleId === participant.id ? 0.85 : 1,
                },
              ]}
              onPress={() => handleBookTableTopicParticipant(participant)}
              disabled={!!bookingRoleId}
            >
              {bookingRoleId === participant.id ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                  Book a Role
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Loading Table Topic Corner...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - meeting not found
  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Meeting not found
          </Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isTtmBooked = Boolean(tableTopicMaster?.assigned_user_id && tableTopicMaster.app_user_profiles);

  /** Bottom dock icons — same treatment as General Evaluator Report (no per-tile boxes). */
  const footerIconTileStyle = {
    borderWidth: 0,
    backgroundColor: 'transparent',
  } as const;

  // Main render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: notion.page }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.kavInner}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: notion.surface, borderBottomColor: notion.divider }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={notion.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.3}>
          Table Topic Corner
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mainBody}>
      <ScrollView
        style={styles.scrollMain}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded, { paddingBottom: 8 }]}
      >
        {isTtmBooked && tableTopicMaster?.app_user_profiles ? (
          <View
            style={[
              styles.consolidatedCornerCard,
              {
                backgroundColor: notion.page,
                borderBottomColor: notion.divider,
                marginTop: 12,
              },
            ]}
          >
            <View style={styles.consolidatedClubBadge}>
              <Text
                style={[
                  styles.consolidatedClubTitle,
                  notionType,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {clubInfo?.name || 'Club'}
              </Text>
            </View>

            <View style={styles.consolidatedProfileStack}>
              <View
                style={[
                  styles.consolidatedAvatarWrap,
                  {
                    borderColor: theme.mode === 'dark' ? theme.colors.border : '#E8E8E8',
                    backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#F4F4F5',
                  },
                ]}
              >
                {tableTopicMaster.app_user_profiles.avatar_url ? (
                  <Image
                    source={{ uri: tableTopicMaster.app_user_profiles.avatar_url }}
                    style={styles.consolidatedAvatarImage}
                  />
                ) : (
                  <User size={40} color={theme.mode === 'dark' ? '#737373' : '#9CA3AF'} />
                )}
              </View>
              <Text
                style={[
                  styles.consolidatedPersonName,
                  notionType,
                  { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                ]}
                maxFontSizeMultiplier={1.25}
              >
                {tableTopicMaster.app_user_profiles.full_name}
              </Text>
              <Text
                style={[
                  styles.consolidatedPersonRole,
                  notionType,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                Table topic master
              </Text>
            </View>

            <View style={[styles.consolidatedBottomDivider, { backgroundColor: notion.divider }]} />
            <View style={styles.consolidatedMeetingMetaBlock}>
              <Text
                style={[
                  styles.consolidatedMeetingMetaSingle,
                  notionType,
                  { color: theme.mode === 'dark' ? '#A3A3A3' : '#999999' },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                {formatConsolidatedMeetingMetaSingleLine(meeting)}
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.noAssignmentNotionCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.meetingCardContent}>
              <View style={[styles.dateBox, { backgroundColor: theme.colors.primary + '15' }]}>
                <Text style={[styles.dateDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {new Date(meeting.meeting_date).getDate()}
                </Text>
                <Text style={[styles.dateMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {new Date(meeting.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                </Text>
              </View>
              <View style={styles.meetingDetails}>
                <Text style={[styles.meetingCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {meeting.meeting_title}
                </Text>
                <Text
                  style={[styles.meetingCardMetaCompact, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.25}
                >
                  {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'short' })} •{' '}
                  {meeting.meeting_start_time || '--:--'}
                  {meeting.meeting_end_time ? ` - ${meeting.meeting_end_time}` : ''}
                </Text>
                <Text
                  style={[styles.meetingCardMetaCompact, styles.meetingCardMetaModeLine, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.25}
                >
                  {meetingModeLabel(meeting)}
                </Text>
              </View>
            </View>
            <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.noToastmasterCard}>
              <View style={[styles.noToastmasterIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                <MessageSquare size={32} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.noToastmasterText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Great meetings start with great questions 🤔✨
              </Text>
              <Text style={[styles.noToastmasterSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                It's time to become Table Topic Master now.
              </Text>
              <TouchableOpacity
                style={[
                  styles.heroBookTtmButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: bookingTableTopicMaster ? 0.85 : 1,
                    zIndex: 2,
                  },
                ]}
                onPress={() => handleBookTableTopicMaster()}
                disabled={bookingTableTopicMaster}
                delayPressIn={0}
                activeOpacity={0.88}
                hitSlop={{ top: 16, bottom: 16, left: 20, right: 20 }}
              >
                {bookingTableTopicMaster ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.heroBookTtmButtonText} maxFontSizeMultiplier={1.3}>
                    Book Table Topic Master
                  </Text>
                )}
              </TouchableOpacity>
              {isVPEClub ? (
                <TouchableOpacity
                  style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                  onPress={() => {
                    setAssignMode('member');
                    setShowAssignMemberModal(true);
                  }}
                  disabled={bookingTableTopicMaster}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }} maxFontSizeMultiplier={1.25}>
                    Assign to a member
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.meetingCardDecoration} pointerEvents="none" />
          </View>
        )}

        {/* Tab Switcher — General Evaluator Report pattern */}
        <View style={[styles.tabContainer, { backgroundColor: notion.page, borderBottomColor: notion.divider }]}>
          <TouchableOpacity
            style={[
              styles.ttTab,
              activeTab === 'participants' && styles.ttTabActive,
              { borderBottomColor: activeTab === 'participants' ? notion.accent : 'transparent' },
            ]}
            onPress={() => setActiveTab('participants')}
          >
            <Text
              style={[
                styles.ttTabText,
                notionType,
                { color: activeTab === 'participants' ? notion.accent : notion.muted },
              ]}
              maxFontSizeMultiplier={1.1}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              Participants
            </Text>
          </TouchableOpacity>

          {canManageTableTopicCorner() && (
            <TouchableOpacity
              style={[
                styles.ttTab,
                activeTab === 'table_topic_corner' && styles.ttTabActive,
                { borderBottomColor: activeTab === 'table_topic_corner' ? notion.accent : 'transparent' },
              ]}
              onPress={() => setActiveTab('table_topic_corner')}
            >
              <Text
                style={[
                  styles.ttTabText,
                  notionType,
                  { color: activeTab === 'table_topic_corner' ? notion.accent : notion.muted },
                ]}
                maxFontSizeMultiplier={1.1}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Table Topic Corner
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.ttTab,
              activeTab === 'table_topic_summary' && styles.ttTabActive,
              { borderBottomColor: activeTab === 'table_topic_summary' ? notion.accent : 'transparent' },
            ]}
            onPress={() => setActiveTab('table_topic_summary')}
          >
            <View style={styles.ttTabInnerRow}>
              <Text
                style={[
                  styles.ttTabText,
                  notionType,
                  { color: activeTab === 'table_topic_summary' ? notion.accent : notion.muted, flexShrink: 1 },
                ]}
                maxFontSizeMultiplier={1.1}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Table Topic Summary
              </Text>
              {publishedQuestions.length > 0 ? (
                <View style={[styles.tabBadge, { backgroundColor: notion.accent }]}>
                  <Text style={styles.tabBadgeText} maxFontSizeMultiplier={1.3}>
                    {publishedQuestions.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Participants Tab */}
        {activeTab === 'participants' && (
        <>
        {/* Table Topic Participants Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#f97316' + '20' }]}>
              <Users size={20} color="#f97316" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Table Topic Participants
            </Text>
          </View>

          {participants.length > 0 ? (
            <View style={styles.participantsGrid}>
              {participants.map((participant) => (
                <ParticipantCard key={participant.id} participant={participant} />
              ))}
            </View>
          ) : (
            <View style={styles.noParticipantsCard}>
              <View style={[styles.noParticipantsIcon, { backgroundColor: '#f97316' + '20' }]}>
                <Users size={32} color="#f97316" />
              </View>
              <Text style={[styles.noParticipantsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No Table Topic Participants Yet
              </Text>
              <Text style={[styles.noParticipantsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Table Topic participants will appear here once members book these roles for the meeting.
              </Text>
            </View>
          )}
        </View>
        </>
        )}

        {/* Table Topic Corner Tab */}
        {activeTab === 'table_topic_corner' && canManageTableTopicCorner() && (
        <View style={styles.summaryContainer}>
          <View style={styles.cornerNotionRoot}>
            <View style={styles.cornerNotionHeaderBlock}>
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionIcon,
                    {
                      backgroundColor:
                        theme.mode === 'light' ? NOTION_ACCENT + '18' : theme.colors.primary + '20',
                    },
                  ]}
                >
                  <MessageSquare
                    size={20}
                    color={theme.mode === 'light' ? NOTION_ACCENT : theme.colors.primary}
                  />
                </View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Table Topic Corner
                </Text>
              </View>
              <View style={styles.cornerNotionSaveRow}>
                {cornerAutoSaving ? (
                  <ActivityIndicator size="small" color={notion.accent} />
                ) : null}
                <Text
                  style={[styles.cornerNotionSaveHint, notionType, { color: notion.muted }]}
                  maxFontSizeMultiplier={1.15}
                >
                  {cornerAutoSaving ? 'Saving…' : 'Changes save automatically'}
                </Text>
              </View>
            </View>

            <View style={styles.cornerNotionSlotsWrap}>
              {Array.from({ length: cornerVisibleSlotCount }, (_, i) => (
                <View key={`corner-slot-${i}`} style={styles.cornerNotionSlotColumn}>
                  <View
                    style={[
                      styles.cornerNotionBlock,
                      { borderColor: notion.blockBorder, backgroundColor: notion.blockFill },
                    ]}
                  >
                    <View style={styles.cornerNotionBlockInner}>
                      <Text
                        style={[styles.cornerNotionIndex, notionType, { color: notion.muted }]}
                        maxFontSizeMultiplier={1.15}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <View style={styles.cornerNotionBlockMain}>
                        <TextInput
                          ref={(el) => {
                            cornerSlotInputRefs.current[i] = el;
                          }}
                          style={[
                            styles.cornerNotionInput,
                            notionType,
                            {
                              color: notion.text,
                              ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
                            },
                          ]}
                          value={cornerSlotTexts[i] ?? ''}
                          onChangeText={(v) => {
                            setCornerSlotTexts((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            });
                            scheduleCornerSlotAutoSave(i);
                          }}
                          onBlur={() => flushCornerSlotAutoSave(i)}
                          placeholder="Click to type your question..."
                          placeholderTextColor={notion.placeholder}
                          multiline
                          maxLength={TABLE_TOPIC_QUESTION_MAX_CHARS}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={styles.cornerNotionBelowBox}>
                    <View style={styles.cornerNotionBelowLeft}>
                      <TouchableOpacity
                        onPress={() => focusCornerSlot(i)}
                        disabled={cornerAutoSaving}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Text
                          style={[styles.cornerNotionActionLink, notionType, { color: notion.accent }]}
                          maxFontSizeMultiplier={1.1}
                        >
                          Edit
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => clearCornerSlotAtIndex(i)}
                        disabled={
                          cornerAutoSaving ||
                          ((cornerSlotTexts[i] ?? '').length === 0 && !cornerSlotIds[i])
                        }
                        style={{
                          opacity:
                            cornerAutoSaving ||
                            ((cornerSlotTexts[i] ?? '').length === 0 && !cornerSlotIds[i])
                              ? 0.4
                              : 1,
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Text
                          style={[
                            styles.cornerNotionActionLink,
                            notionType,
                            { color: theme.colors.error },
                          ]}
                          maxFontSizeMultiplier={1.1}
                        >
                          Clear
                        </Text>
                      </TouchableOpacity>
                      {cornerSlotIds[i] ? (
                        <TouchableOpacity
                          onPress={() => {
                            const q = questions.find((qq) => qq.id === cornerSlotIds[i]);
                            if (q) void openAssignModalForQuestion(q);
                          }}
                          disabled={cornerAutoSaving}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                          <Text
                            style={[styles.cornerNotionActionLink, notionType, { color: notion.accent }]}
                            maxFontSizeMultiplier={1.1}
                          >
                            Assign
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.cornerNotionCharCount, notionType, { color: notion.muted }]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {(cornerSlotTexts[i] ?? '').length}/{TABLE_TOPIC_QUESTION_MAX_CHARS}
                    </Text>
                  </View>
                </View>
              ))}
              {cornerVisibleSlotCount < CORNER_QUESTION_SLOT_COUNT ? (
                <TouchableOpacity
                  style={[styles.cornerNotionAddLink, { opacity: cornerAutoSaving ? 0.5 : 1 }]}
                  onPress={handleAddVisibleCornerSlot}
                  activeOpacity={0.65}
                  disabled={cornerAutoSaving}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                  <Plus size={17} color={notion.accent} strokeWidth={2.25} />
                  <Text
                    style={[styles.cornerNotionAddLinkText, notionType, { color: notion.accent }]}
                    maxFontSizeMultiplier={1.15}
                  >
                    Add Question
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
        )}

        {/* Table Topic Summary Tab */}
        {activeTab === 'table_topic_summary' && (
        <View style={styles.summaryContainer}>
          {publishedQuestions.length > 0 ? (
            <View style={styles.summaryReportEntryCard}>
              <View style={[styles.summaryReportIconWrap, { backgroundColor: '#FFF1F2' }]}>
                <MessageSquare size={28} color="#e11d48" />
              </View>
              <Text style={[styles.summaryReportTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Table Topics Report
              </Text>
              <Text style={[styles.summaryReportSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {publishedQuestions.length} question{publishedQuestions.length !== 1 ? 's' : ''} published
              </Text>
              <TouchableOpacity
                style={[styles.viewReportBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => router.push({
                  pathname: '/table-topics-published-report',
                  params: { meetingId: meeting?.id }
                })}
              >
                <FileBarChart size={18} color="#ffffff" />
                <Text style={styles.viewReportBtnText} maxFontSizeMultiplier={1.3}>View Table Topics Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.summarySection, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.noSummaryCard}>
                <View style={[styles.noSummaryIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                  <FileBarChart size={32} color={theme.colors.primary} />
                </View>
                <Text style={[styles.noSummaryText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Table Topic Summary yet
                </Text>
                <Text style={[styles.noSummarySubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Once questions are published, the Table Topic Summary will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>
        )}

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

        <View
          style={[
            styles.geBottomDock,
            {
              borderTopColor: notion.divider,
              backgroundColor: notion.surface,
              paddingBottom:
                Platform.OS === 'web'
                  ? Math.min(Math.max(insets.bottom, 8), 14)
                  : Math.max(insets.bottom, 10),
              width: windowWidth,
            },
          ]}
        >
          <View style={styles.tabBarRow}>
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id } })}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Book the role
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() =>
                router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id, initialTab: 'my_bookings' } })
              }
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Withdraw role
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Attendance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting.id } })}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Role completion
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() =>
                router.push({ pathname: '/table-topic-master-notes', params: { meetingId: meeting.id } })
              }
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                prep space
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                AGENDA
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                VOTING
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </View>

      {/* Question Assignment Modal */}
      <Modal
        visible={showQuestionModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowQuestionModal(false)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerQuestionModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Select Question to Assign
              </Text>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => {
                  setShowQuestionModal(false);
                  setSelectedQuestion(null);
                  setSelectedParticipant(null);
                }}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Participant Info */}
            {selectedParticipant && (
              <View style={[styles.participantInfoCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.participantInfoHeader}>
                  <View style={styles.participantInfoAvatar}>
                    {selectedParticipant.app_user_profiles?.avatar_url ? (
                      <Image 
                        source={{ uri: selectedParticipant.app_user_profiles.avatar_url }} 
                        style={styles.participantInfoAvatarImage}
                      />
                    ) : (
                      <MessageSquare size={20} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.participantInfoDetails}>
                    <Text style={[styles.participantInfoName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {selectedParticipant.app_user_profiles?.full_name || 'Unknown'}
                    </Text>
                    <Text style={[styles.participantInfoRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {selectedParticipant.role_name}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Questions List */}
            <ScrollView style={styles.questionsList} showsVerticalScrollIndicator={false}>
              <Text style={[styles.questionsListTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Select a question from your question bank:
              </Text>
              
              {questions.length > 0 ? (
                <View style={styles.questionsGrid}>
                  {questions.map((question, index) => (
                    <TouchableOpacity
                      key={question.id}
                      style={[
                        styles.questionBankItem,
                        {
                          backgroundColor: selectedQuestion?.id === question.id ? theme.colors.primary + '20' : theme.colors.surface,
                          borderColor: selectedQuestion?.id === question.id ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                      onPress={() => setSelectedQuestion(question)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.questionBankItemHeader}>
                        <View style={[styles.questionBankNumber, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.questionBankNumberText} maxFontSizeMultiplier={1.3}>
                            {index + 1}
                          </Text>
                        </View>
                        <View style={[
                          styles.questionBankStatus,
                          { backgroundColor: question.is_used ? '#f59e0b' + '20' : '#10b981' + '20' }
                        ]}>
                          <Text style={[
                            styles.questionBankStatusText,
                            { color: question.is_used ? '#f59e0b' : '#10b981' }
                          ]} maxFontSizeMultiplier={1.3}>
                            {question.is_used ? 'Used' : 'Available'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.questionBankText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {question.question_text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.noQuestionsInBank}>
                  <Text style={[styles.noQuestionsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    No Questions in Bank
                  </Text>
                  <Text style={[styles.noQuestionsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    You haven't added any questions to your question bank yet.
                  </Text>
                  <TouchableOpacity
                    style={[styles.addQuestionsButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      setShowQuestionModal(false);
                      setShowAddQuestionModal(true);
                    }}
                  >
                    <Plus size={16} color="#ffffff" />
                    <Text style={styles.addQuestionsButtonText} maxFontSizeMultiplier={1.3}>Add Questions</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Assign Button */}
            {questions.length > 0 && (
              <View style={[styles.questionModalFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.assignSelectedButton,
                    {
                      backgroundColor: selectedQuestion ? theme.colors.primary : theme.colors.surface,
                      borderColor: selectedQuestion ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={handleAssignSelectedQuestion}
                  disabled={!selectedQuestion || isSaving}
                >
                  <Text style={[
                    styles.assignSelectedButtonText,
                    { color: selectedQuestion ? '#ffffff' : theme.colors.textSecondary }
                  ]} maxFontSizeMultiplier={1.3}>
                    {isSaving ? 'Assigning...' : 'Assign Question'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddQuestionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingQuestionBank) setShowAddQuestionModal(false);
        }}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerQuestionModal, { backgroundColor: theme.colors.background, maxWidth: 560 }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {editingQuestionId ? 'Edit Question' : 'Add Question'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => !savingQuestionBank && setShowAddQuestionModal(false)}
                disabled={savingQuestionBank}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={[styles.noQuestionsSubtext, { color: theme.colors.textSecondary, textAlign: 'left', paddingHorizontal: 0 }]} maxFontSizeMultiplier={1.25}>
                Add up to 12 questions directly in Table Topic Corner.
              </Text>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    minHeight: 90,
                    textAlignVertical: 'top',
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    marginTop: 10,
                  },
                ]}
                value={newQuestionText}
                onChangeText={setNewQuestionText}
                placeholder="Type your table topic question..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                maxLength={TABLE_TOPIC_QUESTION_MAX_CHARS}
                editable={!savingQuestionBank}
              />
              <Text style={[styles.memberCountText, { marginTop: 8, alignSelf: 'flex-end' }]} maxFontSizeMultiplier={1.2}>
                {newQuestionText.length}/{TABLE_TOPIC_QUESTION_MAX_CHARS} • {questions.length}/12
              </Text>
            </View>
            <View style={[styles.questionModalFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.assignSelectedButton, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, opacity: savingQuestionBank ? 0.7 : 1 }]}
                onPress={handleAddQuestionToCorner}
                disabled={savingQuestionBank}
              >
                <Text style={styles.assignSelectedButtonText} maxFontSizeMultiplier={1.3}>
                  {savingQuestionBank ? 'Saving...' : 'Save Question'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAssignMemberModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssignMemberModal(false)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerQuestionModal, { backgroundColor: theme.colors.background, maxWidth: 560 }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Question
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowAssignMemberModal(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16, gap: 10 }}>
              <Text style={[styles.noQuestionsSubtext, { color: theme.colors.textSecondary, textAlign: 'left', paddingHorizontal: 0 }]} maxFontSizeMultiplier={1.25}>
                {selectedCornerQuestion?.question_text || ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.cornerActionBtn, { borderColor: assignMode === 'member' ? theme.colors.primary : theme.colors.border }]}
                  onPress={() => setAssignMode('member')}
                >
                  <Text style={[styles.cornerActionText, { color: assignMode === 'member' ? theme.colors.primary : theme.colors.text }]}>Club Members</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cornerActionBtn, { borderColor: assignMode === 'guest' ? theme.colors.primary : theme.colors.border }]}
                  onPress={() => setAssignMode('guest')}
                >
                  <Text style={[styles.cornerActionText, { color: assignMode === 'guest' ? theme.colors.primary : theme.colors.text }]}>Guest</Text>
                </TouchableOpacity>
              </View>
              {assignMode === 'guest' ? (
                <TextInput
                  style={[styles.searchInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, color: theme.colors.text }]}
                  placeholder="Enter guest name"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={guestName}
                  onChangeText={setGuestName}
                />
              ) : (
                <>
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, color: theme.colors.text }]}
                    placeholder="Search club members"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={assignSearch}
                    onChangeText={setAssignSearch}
                  />
                  <ScrollView style={{ maxHeight: 220 }}>
                    {membersLoading ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : (
                      clubMembers
                        .filter((m) => !assignSearch.trim() || m.full_name.toLowerCase().includes(assignSearch.toLowerCase()) || (m.email || '').toLowerCase().includes(assignSearch.toLowerCase()))
                        .map((m) => (
                          <TouchableOpacity key={m.id} style={[styles.memberOption, { backgroundColor: theme.colors.surface }]} onPress={() => assignQuestionToSpeaker(m)}>
                            <Text style={[styles.memberOptionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{m.full_name}</Text>
                          </TouchableOpacity>
                        ))
                    )}
                  </ScrollView>
                </>
              )}
            </View>
            {assignMode === 'guest' && (
              <View style={[styles.questionModalFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[styles.assignSelectedButton, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                  onPress={() => assignQuestionToSpeaker()}
                >
                  <Text style={styles.assignSelectedButtonText} maxFontSizeMultiplier={1.3}>
                    Assign Guest
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!questionIdPendingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setQuestionIdPendingDelete(null)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerQuestionModal, { backgroundColor: theme.colors.background, maxWidth: 480 }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Delete Question
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setQuestionIdPendingDelete(null)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={[styles.noQuestionsSubtext, { color: theme.colors.textSecondary, textAlign: 'left', paddingHorizontal: 0 }]} maxFontSizeMultiplier={1.25}>
                Are you sure you want to delete this question? This action cannot be undone.
              </Text>
            </View>
            <View style={[styles.questionModalFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, flexDirection: 'row', gap: 10 }]}>
              <TouchableOpacity
                style={[styles.assignSelectedButton, { flex: 1, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => setQuestionIdPendingDelete(null)}
              >
                <Text style={[styles.assignSelectedButtonText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.assignSelectedButton, { flex: 1, backgroundColor: '#dc2626', borderColor: '#dc2626' }]}
                onPress={confirmDeleteCornerQuestion}
              >
                <Text style={styles.assignSelectedButtonText} maxFontSizeMultiplier={1.3}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <PremiumBookingSuccessModal
        visible={!!bookingSuccessRole}
        roleLabel={bookingSuccessRole ?? ''}
        onClose={() => setBookingSuccessRole(null)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  kavInner: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
  },
  mainBody: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    alignItems: 'stretch',
  },
  /** Bottom shortcut dock — matches Educational Corner / Grammarian. */
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollMain: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  contentContainer: {
    flexGrow: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
  },
  contentContainerPadded: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  meetingCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    minHeight: 96,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    zIndex: 1,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  meetingCardMetaCompact: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  meetingCardMetaModeLine: {
    marginTop: 3,
  },
  meetingCardDateTime: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  meetingCardMode: {
    fontSize: 10,
    fontWeight: '500',
  },
  meetingCardDecoration: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  consolidatedCornerCard: {
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'visible',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  consolidatedClubBadge: {
    marginTop: 0,
    marginBottom: 16,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  consolidatedClubTitle: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 23,
  },
  consolidatedProfileStack: {
    alignItems: 'center',
    width: '100%',
  },
  consolidatedAvatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  consolidatedAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  consolidatedPersonName: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  consolidatedPersonRole: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
  },
  consolidatedBottomDivider: {
    width: '100%',
    maxWidth: 280,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  consolidatedMeetingMetaBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  consolidatedMeetingMetaSingle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  noAssignmentNotionCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  noAssignmentDivider: {
    height: 1,
    marginTop: 14,
  },
  noToastmasterCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noToastmasterIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noToastmasterText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noToastmasterSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  heroBookTtmButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 48,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  heroBookTtmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionIconSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  sectionTitleSmall: {
    fontSize: 9,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  notesButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  masterCard: {
    backgroundColor: '#fef7ed',
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  masterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterAvatar: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    overflow: 'hidden',
  },
  masterAvatarImage: {
    width: '100%',
    height: '100%',
  },
  masterDetails: {
    flex: 1,
  },
  masterName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1f2937',
  },
  masterRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  prepSpaceIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  masterEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  masterRole: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  masterRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  noMasterCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noMasterIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noMasterText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  noMasterSubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  bookRoleButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 7,
  },
  bookRoleButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  participantsGrid: {
    gap: 8,
  },
  participantCard: {
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantRole: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  openRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookedParticipant: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  participantAvatarImage: {
    width: '100%',
    height: '100%',
  },
  participantInitials: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  bookedTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  bookedTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  unbookedParticipant: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  availableTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  availableTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearQuestionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  assignQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignQuestionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  noParticipantsCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noParticipantsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noParticipantsText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noParticipantsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  bottomPadding: {
    height: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderBottomWidth: 1,
    borderRadius: 0,
    overflow: 'visible',
  },
  ttTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  ttTabActive: {},
  ttTabText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  ttTabInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  activeTabButton: {
    borderBottomWidth: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  summarySection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryTitleContainer: {
    flex: 1,
  },
  viewReportButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 13,
  },
  publishedQuestionsList: {
    gap: 10,
  },
  publishedQuestionCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  publishedQuestionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  publishedQuestionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishedQuestionNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  publishedQuestionContent: {
    flex: 1,
  },
  publishedQuestionText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 8,
  },
  publishedQuestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  participantTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  publishedQuestionFullText: {
    fontSize: 15,
    lineHeight: 24,
  },
  publishedQuestionNumber2: {
    fontWeight: '700',
  },
  publishedQuestionText2: {
    fontWeight: '500',
  },
  noSummaryCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noSummaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noSummaryText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noSummarySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  cornerNotionRoot: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
  },
  cornerNotionHeaderBlock: {
    width: '100%',
    marginBottom: 20,
  },
  cornerNotionSaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  cornerNotionSaveHint: {
    fontSize: 12,
    fontWeight: '400',
  },
  cornerNotionSlotsWrap: {
    width: '100%',
    gap: 10,
  },
  cornerNotionSlotColumn: {
    width: '100%',
  },
  cornerNotionBlock: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cornerNotionBlockInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 10,
    gap: 11,
  },
  cornerNotionIndex: {
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    minWidth: 26,
    paddingTop: 1,
  },
  cornerNotionBlockMain: {
    flex: 1,
    minWidth: 0,
  },
  cornerNotionInput: {
    minHeight: 45,
    borderWidth: 0,
    padding: 0,
    margin: 0,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  cornerNotionBelowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingHorizontal: 2,
    minHeight: 22,
    gap: 8,
  },
  cornerNotionBelowLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  cornerNotionActionLink: {
    fontSize: 13,
    fontWeight: '500',
  },
  cornerNotionCharCount: {
    fontSize: 11,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  cornerNotionAddLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  cornerNotionAddLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  addQuestionsCta: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addQuestionsCtaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cornerQuestionList: {
    marginTop: 14,
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  cornerQuestionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  cornerQuestionNumber: {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  cornerQuestionNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cornerQuestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  cornerQuestionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  cornerActionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cornerActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Center Modal styles
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  centerQuestionModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '100%',
    flexShrink: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  participantInfoCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  participantInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantInfoAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  participantInfoAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  participantInfoDetails: {
    flex: 1,
  },
  participantInfoName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  participantInfoRole: {
    fontSize: 14,
  },
  questionsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  questionsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  questionsGrid: {
    gap: 12,
  },
  questionBankItem: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionBankItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionBankNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionBankNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  questionBankStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  questionBankStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  questionBankText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  noQuestionsInBank: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noQuestionsText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noQuestionsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addQuestionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addQuestionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  questionModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  assignSelectedButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  assignSelectedButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  themeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  themeHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  themeAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryContainer: {
    flex: 1,
  },
  reportHeaderSection: {
    alignItems: 'center',
    paddingTop: 26,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 16,
  },
  reportMainTitle: {
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  reportSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  questionsReportList: {
    paddingHorizontal: 16,
    gap: 20,
    paddingBottom: 16,
  },
  questionReportCard: {
    borderRadius: 13,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  reportQuestionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  questionTextReport: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    marginBottom: 16,
  },
  participantInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  participantAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  participantAvatarImageSmall: {
    width: '100%',
    height: '100%',
  },
  participantAvatarInitials: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  participantNameContainer: {
    flex: 1,
  },
  participantNameReport: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  participantRoleLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  participantUnderline: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  },
  ttMasterFooter: {
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 16,
    borderRadius: 13,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  ttMasterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ttMasterAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ttMasterAvatarInitials: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  ttMasterName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  ttMasterRole: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 1,
  },
  ttMasterClub: {
    fontSize: 13,
    fontWeight: '400',
  },
  // New Summary Design Styles
  summaryMainCard: {
    marginHorizontal: 16,
    marginTop: 0,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  summaryCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryCardIcon: {
    fontSize: 18,
  },
  summaryQuestionsList: {
    gap: 16,
  },
  summaryQuestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryQuestionNumber: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 32,
  },
  summaryQuestionContent: {
    flex: 1,
  },
  summaryQuestionText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  summaryQuestionSpeaker: {
    fontSize: 16,
    fontWeight: '400',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 24,
  },
  summaryMasterLabel: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  summaryMasterName: {
    fontWeight: '600',
  },
  summaryMasterCard: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryMasterCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryMasterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  summaryMasterAvatarImage: {
    width: '100%',
    height: '100%',
  },
  summaryMasterAvatarInitials: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  summaryMasterDetails: {
    flex: 1,
  },
  summaryMasterCardLabel: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 4,
  },
  summaryMasterCardName: {
    fontSize: 18,
    fontWeight: '600',
  },
  summaryReportEntryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryReportIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryReportTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  summaryReportSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  viewReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  viewReportBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Screenshot Wrapper
  screenshotWrapper: {
    backgroundColor: '#ffffff',
    paddingBottom: 20,
  },
  // Club Info Header Styles
  clubInfoHeader: {
    marginHorizontal: 16,
    marginTop: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  clubName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
    color: '#ffffff',
  },
  meetingInfo: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    color: '#ffffff',
  },
});