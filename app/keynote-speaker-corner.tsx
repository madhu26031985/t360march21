import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import {
  ArrowLeft,
  Calendar,
  ClipboardCheck,
  Edit3,
  FileText,
  Mic,
  NotebookPen,
  RotateCcw,
  Save,
  Search,
  User,
  Users,
  Vote,
  X,
} from 'lucide-react-native';

/** Match Toastmaster Corner bottom dock icon size */
const FOOTER_NAV_ICON_SIZE = 15;

const CORNER_KEYNOTE_TITLE_MAX_LEN = 50;

/** Match TM Corner — flat Notion chrome */
const NOTION_FLAT_BORDER_LIGHT = 'rgba(55, 53, 47, 0.09)';
const NOTION_FLAT_RADIUS = 4;

function isReactNativeWebPlatform(): boolean {
  try {
    return Platform.OS === 'web';
  } catch {
    return false;
  }
}

/** Expo Router / web may use `meetingId` or `meeting_id` in the query string. */
function pickMeetingIdFromParams(
  params: Record<string, string | string[] | undefined>
): string | undefined {
  const pick = (v: string | string[] | undefined): string | undefined => {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v[0] != null && String(v[0]).trim()) return String(v[0]).trim();
    return undefined;
  };
  return pick(params.meetingId) ?? pick(params.meeting_id);
}

function isKeynoteCornerRpcUnavailable(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false;
  const text = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function/i.test(error.message || '') ||
    /function .* does not exist/i.test(text) ||
    /404/.test(error.message || '')
  );
}

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
  club_name?: string;
}

function formatTimeForDisplay(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

function meetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** e.g. "March 31 | Tue | 16:00 - 17:00 | In Person" — matches Toastmaster Corner meta line */
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

interface KeynoteSpeaker {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string; // Added booking_status to KeynoteSpeaker interface
  speech_title: string | null;
  summary: string | null; // Changed from educational_details
  notes: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

/** RPC `get_keynote_speaker_corner_snapshot` payload (slim JSON). */
interface KeynoteCornerSnapshot {
  meeting_id: string;
  club_id: string;
  meeting: {
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
    club_name: string | null;
  } | null;
  keynote_assignment: {
    id: string;
    role_name: string;
    assigned_user_id: string;
    booking_status: string;
    role_status: string | null;
    app_user_profiles: {
      full_name: string;
      email: string;
      avatar_url: string | null;
    } | null;
  } | null;
  keynote_content: {
    speech_title: string | null;
    notes: string | null;
  } | null;
  is_vpe_for_club: boolean;
}

/**
 * Keynote Speaker Corner — consolidated card, title-only (summary stored as null), Prep → private notes.
 */
export default function KeynoteSpeakerCorner(): JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = pickMeetingIdFromParams(params as Record<string, string | string[] | undefined>);

  // State management
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [keynoteSpeaker, setKeynoteSpeaker] = useState<KeynoteSpeaker | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [bookingKeynoteRole, setBookingKeynoteRole] = useState(false);
  const [showAssignKeynoteModal, setShowAssignKeynoteModal] = useState(false);
  const [assignKeynoteSearch, setAssignKeynoteSearch] = useState('');
  const [assigningKeynoteRole, setAssigningKeynoteRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [cornerKeynoteTitle, setCornerKeynoteTitle] = useState('');
  const [savingCornerKeynote, setSavingCornerKeynote] = useState(false);
  const [editingSavedCornerKeynote, setEditingSavedCornerKeynote] = useState(false);

  const applyKeynoteCornerSnapshot = useCallback((snap: KeynoteCornerSnapshot) => {
    const m = snap.meeting;
    if (m && typeof m === 'object' && m.id) {
      setMeeting({
        id: String(m.id),
        meeting_title: String(m.meeting_title ?? ''),
        meeting_date: String(m.meeting_date ?? ''),
        meeting_number: m.meeting_number != null ? String(m.meeting_number) : null,
        meeting_start_time: m.meeting_start_time != null ? String(m.meeting_start_time) : null,
        meeting_end_time: m.meeting_end_time != null ? String(m.meeting_end_time) : null,
        meeting_mode: String(m.meeting_mode ?? ''),
        meeting_location: m.meeting_location != null ? String(m.meeting_location) : null,
        meeting_link: m.meeting_link != null ? String(m.meeting_link) : null,
        meeting_status: String(m.meeting_status ?? ''),
        club_name: m.club_name != null ? String(m.club_name) : undefined,
      });
    } else {
      setMeeting(null);
    }

    const ka = snap.keynote_assignment;
    if (ka && ka.assigned_user_id) {
      const kc = snap.keynote_content;
      const prof = ka.app_user_profiles;
      setKeynoteSpeaker({
        id: String(ka.id),
        role_name: String(ka.role_name ?? ''),
        assigned_user_id: String(ka.assigned_user_id),
        booking_status: String(ka.booking_status ?? ''),
        app_user_profiles: prof
          ? {
              full_name: String(prof.full_name ?? ''),
              email: String(prof.email ?? ''),
              avatar_url: prof.avatar_url != null ? String(prof.avatar_url) : null,
            }
          : undefined,
        speech_title: kc?.speech_title != null ? String(kc.speech_title) : null,
        summary: null,
        notes: kc?.notes != null ? String(kc.notes) : null,
      });
    } else {
      setKeynoteSpeaker(null);
    }

    setIsVPEClub(Boolean(snap.is_vpe_for_club));
  }, []);

  /** When the snapshot RPC is not deployed (404 / PGRST202), use targeted REST reads. */
  const fetchKeynoteCornerLegacy = useCallback(async (): Promise<boolean> => {
    if (!meetingId || !user?.currentClubId || !user?.id) return false;
    try {
      const [{ data: meetingRow, error: meetingErr }, { data: vpeData }] = await Promise.all([
        supabase
          .from('app_club_meeting')
          .select('id, meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, meeting_location, meeting_link, meeting_status, clubs!inner(name)')
          .eq('id', meetingId)
          .single(),
        supabase.from('club_profiles').select('vpe_id').eq('club_id', user.currentClubId).maybeSingle(),
      ]);

      setIsVPEClub(vpeData?.vpe_id === user.id);

      if (meetingErr || !meetingRow) {
        console.error('Error loading meeting (legacy):', meetingErr);
        setMeeting(null);
        setKeynoteSpeaker(null);
        return false;
      }

      const row = meetingRow as Record<string, unknown> & { clubs?: { name?: string } };
      setMeeting({
        id: String(row.id),
        meeting_title: String(row.meeting_title ?? ''),
        meeting_date: String(row.meeting_date ?? ''),
        meeting_number: row.meeting_number != null ? String(row.meeting_number) : null,
        meeting_start_time: row.meeting_start_time != null ? String(row.meeting_start_time) : null,
        meeting_end_time: row.meeting_end_time != null ? String(row.meeting_end_time) : null,
        meeting_mode: String(row.meeting_mode ?? ''),
        meeting_location: row.meeting_location != null ? String(row.meeting_location) : null,
        meeting_link: row.meeting_link != null ? String(row.meeting_link) : null,
        meeting_status: String(row.meeting_status ?? ''),
        club_name: row.clubs?.name != null ? String(row.clubs.name) : undefined,
      });

      const { data: roleAssignment, error: roleError } = await supabase
        .from('app_meeting_roles_management')
        .select(
          `
          id,
          role_name,
          assigned_user_id,
          booking_status,
          role_status,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `
        )
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%keynote%')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error loading keynote role (legacy):', roleError);
        setKeynoteSpeaker(null);
        return true;
      }

      if (!roleAssignment || !roleAssignment.assigned_user_id) {
        setKeynoteSpeaker(null);
        return true;
      }

      const speakerData: KeynoteSpeaker = {
        id: roleAssignment.id,
        role_name: roleAssignment.role_name,
        assigned_user_id: roleAssignment.assigned_user_id,
        booking_status: roleAssignment.booking_status ?? 'booked',
        app_user_profiles: roleAssignment.app_user_profiles as KeynoteSpeaker['app_user_profiles'],
        speech_title: null,
        summary: null,
        notes: null,
      };

      const { data: keynoteContent, error: contentError } = await supabase
        .from('app_meeting_keynote_speaker')
        .select('speech_title, notes')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', roleAssignment.assigned_user_id)
        .maybeSingle();

      if (contentError && contentError.code !== 'PGRST116') {
        console.error('Error loading keynote content (legacy):', contentError);
      }
      if (keynoteContent) {
        speakerData.speech_title = keynoteContent.speech_title;
        speakerData.notes = keynoteContent.notes;
      }
      setKeynoteSpeaker(speakerData);
      return true;
    } catch (e) {
      console.error('fetchKeynoteCornerLegacy:', e);
      setMeeting(null);
      setKeynoteSpeaker(null);
      return false;
    }
  }, [meetingId, user?.currentClubId, user?.id]);

  const fetchKeynoteCornerSnapshot = useCallback(async (): Promise<boolean> => {
    if (!meetingId || !user?.currentClubId || !user?.id) return false;
    const { data, error } = await supabase.rpc('get_keynote_speaker_corner_snapshot', {
      p_meeting_id: meetingId,
    });
    if (error) {
      if (isKeynoteCornerRpcUnavailable(error)) {
        if (__DEV__) {
          console.warn(
            '[Keynote corner] RPC get_keynote_speaker_corner_snapshot not available; using REST fallback. Apply migration 20260409150000_keynote_speaker_corner_snapshot_rpc.sql on Supabase for faster loads.'
          );
        }
        return fetchKeynoteCornerLegacy();
      }
      console.error('get_keynote_speaker_corner_snapshot:', error);
      return false;
    }
    if (data == null) {
      setMeeting(null);
      setKeynoteSpeaker(null);
      setIsVPEClub(false);
      return false;
    }
    applyKeynoteCornerSnapshot(data as KeynoteCornerSnapshot);
    return true;
  }, [meetingId, user?.currentClubId, user?.id, applyKeynoteCornerSnapshot, fetchKeynoteCornerLegacy]);

  useFocusEffect(
    useCallback(() => {
      if (!meetingId) {
        setIsLoading(false);
        return () => {};
      }
      if (!user?.currentClubId || !user?.id) {
        return () => {};
      }

      let cancelled = false;
      setIsLoading(true);
      void (async () => {
        try {
          await fetchKeynoteCornerSnapshot();
        } catch (e) {
          console.error('Keynote corner snapshot load:', e);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [meetingId, user?.currentClubId, user?.id, fetchKeynoteCornerSnapshot])
  );

  /**
   * Book Keynote Speaker role inline (open row matching keynote role name)
   */
  const handleBookKeynoteSpeakerInline = async (): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingKeynoteRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { ilikeRoleName: '%keynote%' },
        'Keynote Speaker is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        await loadKeynoteSpeaker();
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingKeynoteRole(false);
    }
  };

  const loadClubMembers = async (): Promise<void> => {
    if (!user?.currentClubId) return;
    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);
      if (error) {
        console.error('Error loading club members:', error);
        return;
      }
      const members: ClubMember[] = (data || [])
        .map((item: any) => {
          const p = item.app_user_profiles;
          if (!p?.id) return null;
          return {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url,
          };
        })
        .filter((m): m is ClubMember => m !== null);
      members.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setClubMembers(members);
    } catch (e) {
      console.error('Error loading club members:', e);
    }
  };

  const handleAssignKeynoteToMember = async (member: ClubMember): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    setAssigningKeynoteRole(true);
    try {
      const roleId = await fetchOpenMeetingRoleId(meetingId, { ilikeRoleName: '%keynote%' });
      if (!roleId) {
        Alert.alert('Error', 'No open Keynote Speaker role was found for this meeting.');
        return;
      }
      const result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      if (result.ok) {
        setShowAssignKeynoteModal(false);
        setAssignKeynoteSearch('');
        await loadKeynoteSpeaker();
        Alert.alert('Assigned', `${member.full_name} is now the Keynote Speaker for this meeting.`);
      } else {
        Alert.alert('Could not assign', result.message);
      }
    } finally {
      setAssigningKeynoteRole(false);
    }
  };

  const filteredMembersForAssignKeynote = clubMembers.filter((member) => {
    const q = assignKeynoteSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      member.full_name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    );
  });

  /** Refresh meeting + keynote state (after book/assign/save); single RPC round-trip. */
  const loadKeynoteSpeaker = useCallback(async (): Promise<void> => {
    await fetchKeynoteCornerSnapshot();
  }, [fetchKeynoteCornerSnapshot]);

  /**
   * Booked Keynote Speaker (same idea as Toastmaster Corner: assigned + booked status)
   */
  const isKeynoteSpeaker = (): boolean => {
    const status = keynoteSpeaker?.booking_status?.toLowerCase();
    return (
      !!user?.id &&
      keynoteSpeaker?.assigned_user_id === user.id &&
      status === 'booked'
    );
  };

  const hasKeynoteTitle = (): boolean => {
    return !!(keynoteSpeaker?.speech_title?.trim());
  };

  const KEYNOTE_CONGRATS_SEEN_KEY = meetingId ? `keynoteCongratsSeen_${meetingId}` : null;

  const alertCorner = (title: string, message?: string) => {
    if (isReactNativeWebPlatform() && typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    Alert.alert(title, message || '');
  };

  /** Restore draft from last saved title and exit edit mode */
  const cancelCornerKeynoteEdit = () => {
    setCornerKeynoteTitle(
      (keynoteSpeaker?.speech_title || '').slice(0, CORNER_KEYNOTE_TITLE_MAX_LEN)
    );
    setEditingSavedCornerKeynote(false);
  };

  const clearCornerKeynoteTitle = () => {
    setCornerKeynoteTitle('');
  };

  const saveCornerKeynoteTitle = async () => {
    if (!isKeynoteSpeaker() || !meetingId || !user?.currentClubId || savingCornerKeynote) return;
    const name = cornerKeynoteTitle.trim().slice(0, CORNER_KEYNOTE_TITLE_MAX_LEN);
    setSavingCornerKeynote(true);
    try {
      const { data: existing, error: findErr } = await supabase
        .from('app_meeting_keynote_speaker')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', user.id)
        .maybeSingle();

      if (findErr && findErr.code !== 'PGRST116') {
        console.error('Error finding keynote row:', findErr);
        alertCorner('Error', 'Failed to save. Please try again.');
        return;
      }

      const updatedAt = new Date().toISOString();

      if (!name) {
        if (!existing?.id) {
          alertCorner('Validation', 'Please enter a keynote title.');
          return;
        }
        const { error } = await supabase
          .from('app_meeting_keynote_speaker')
          .update({
            speech_title: null,
            summary: null,
            updated_at: updatedAt,
          })
          .eq('id', existing.id);
        if (error) {
          console.error('Error clearing keynote title:', error);
          alertCorner('Error', 'Failed to save. Please try again.');
          return;
        }
        setKeynoteSpeaker((prev) => (prev ? { ...prev, speech_title: null, summary: null } : prev));
        alertCorner('Success', 'Keynote title cleared.');
        setEditingSavedCornerKeynote(false);
        await loadKeynoteSpeaker();
        return;
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('app_meeting_keynote_speaker')
          .update({
            speech_title: name,
            summary: null,
            updated_at: updatedAt,
          })
          .eq('id', existing.id);
        if (error) {
          console.error('Error updating keynote title:', error);
          alertCorner('Error', 'Failed to save. Please try again.');
          return;
        }
      } else {
        const { error } = await supabase.from('app_meeting_keynote_speaker').insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          speaker_user_id: user.id,
          speech_title: name,
          summary: null,
        });
        if (error) {
          console.error('Error inserting keynote title:', error);
          alertCorner('Error', 'Failed to save. Please try again.');
          return;
        }
      }

      setKeynoteSpeaker((prev) =>
        prev
          ? { ...prev, speech_title: name, summary: null }
          : prev
      );
      alertCorner('Success', 'Keynote title saved!');
      setEditingSavedCornerKeynote(false);
      await loadKeynoteSpeaker();
    } catch (e) {
      console.error('saveCornerKeynoteTitle:', e);
      alertCorner('Error', 'Failed to save. Please try again.');
    } finally {
      setSavingCornerKeynote(false);
    }
  };

  useEffect(() => {
    if (isLoading || !meeting || !isKeynoteSpeaker() || hasKeynoteTitle() || !KEYNOTE_CONGRATS_SEEN_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(KEYNOTE_CONGRATS_SEEN_KEY);
        if (!cancelled && !seen) setShowCongratsModal(true);
      } catch {
        if (!cancelled) setShowCongratsModal(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, meeting, keynoteSpeaker?.assigned_user_id, keynoteSpeaker?.speech_title, keynoteSpeaker?.booking_status, KEYNOTE_CONGRATS_SEEN_KEY]);

  useEffect(() => {
    if (!user?.id || keynoteSpeaker?.assigned_user_id !== user.id) return;
    const titleSaved = !!(keynoteSpeaker?.speech_title?.trim());
    if (titleSaved && !editingSavedCornerKeynote) return;
    setCornerKeynoteTitle(
      (keynoteSpeaker?.speech_title || '').slice(0, CORNER_KEYNOTE_TITLE_MAX_LEN)
    );
  }, [
    user?.id,
    keynoteSpeaker?.assigned_user_id,
    keynoteSpeaker?.speech_title,
    editingSavedCornerKeynote,
  ]);

  const dismissCongratsModal = useCallback(() => {
    if (KEYNOTE_CONGRATS_SEEN_KEY) {
      AsyncStorage.setItem(KEYNOTE_CONGRATS_SEEN_KEY, '1').catch(() => {});
    }
    setShowCongratsModal(false);
  }, [KEYNOTE_CONGRATS_SEEN_KEY]);

  const showConsolidatedKeynoteCard = Boolean(
    keynoteSpeaker?.assigned_user_id && keynoteSpeaker.app_user_profiles
  );

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  const tabBarBottomPadding = isReactNativeWebPlatform()
    ? Math.min(Math.max(insets.bottom, 8), 14)
    : Math.max(insets.bottom + 10, 22);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Loading Keynote Speaker Corner...
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

  // Main render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Keynote Speaker Corner
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mainBody}>
      <ScrollView
        style={styles.scrollMain}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded, { paddingBottom: 16 }]}
      >
        <View style={styles.contentTop} pointerEvents="box-none">
        {showConsolidatedKeynoteCard ? (
            <View
              style={[
                styles.consolidatedCornerCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  marginHorizontal: 13,
                  marginTop: 13,
                },
              ]}
            >
              <View style={styles.consolidatedClubBadge}>
                <Text
                  style={[
                    styles.consolidatedClubTitle,
                    { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {meeting.club_name || meeting.meeting_title}
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
                  {keynoteSpeaker!.app_user_profiles!.avatar_url ? (
                    <Image
                      source={{ uri: keynoteSpeaker!.app_user_profiles!.avatar_url }}
                      style={styles.consolidatedAvatarImage}
                    />
                  ) : (
                    <User size={40} color={theme.mode === 'dark' ? '#737373' : '#9CA3AF'} />
                  )}
                </View>
                <Text
                  style={[
                    styles.consolidatedPersonName,
                    { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                  ]}
                  maxFontSizeMultiplier={1.25}
                >
                  {keynoteSpeaker!.app_user_profiles!.full_name}
                </Text>
                <Text
                  style={[
                    styles.consolidatedPersonRole,
                    { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  Keynote Speaker
                </Text>
              </View>

              <View
                style={[
                  styles.consolidatedDivider,
                  {
                    backgroundColor: theme.mode === 'light' ? NOTION_FLAT_BORDER_LIGHT : theme.colors.border,
                  },
                ]}
              />

              {isKeynoteSpeaker() && (!hasKeynoteTitle() || editingSavedCornerKeynote) ? (
                <View style={styles.consolidatedThemeFormStretch}>
                  <View style={styles.cornerEdTitleFormHeader}>
                    <Text
                      style={[
                        styles.themeDaySectionHeading,
                        styles.cornerEdTitleFormHeadingText,
                        { color: theme.colors.text },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      ✨ Keynote Title
                    </Text>
                    <TouchableOpacity
                      style={styles.cornerEdTitleCloseHit}
                      onPress={cancelCornerKeynoteEdit}
                      accessibilityLabel="Cancel editing keynote title"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={22} color={theme.mode === 'dark' ? '#A3A3A3' : '#6B7280'} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cornerThemeFormInputSection}>
                    <TextInput
                      style={[
                        styles.cornerThemeNameInput,
                        styles.cornerThemeNameInputClean,
                        {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          color: theme.colors.text,
                        },
                      ]}
                      placeholder="Enter title"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={cornerKeynoteTitle}
                      onChangeText={(t) =>
                        setCornerKeynoteTitle(t.slice(0, CORNER_KEYNOTE_TITLE_MAX_LEN))
                      }
                      maxLength={CORNER_KEYNOTE_TITLE_MAX_LEN}
                    />
                    <View style={styles.cornerThemeInputFooterRow}>
                      <Text
                        style={[styles.cornerThemeHelperCaption, { color: theme.colors.textSecondary }]}
                        maxFontSizeMultiplier={1.25}
                      >
                        Enter title (e.g. Leadership journey, Future of work)
                      </Text>
                      <Text style={[styles.cornerThemeCharCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {cornerKeynoteTitle.length}/{CORNER_KEYNOTE_TITLE_MAX_LEN}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cornerEdTitleActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.cornerEdTitleSecondaryBtn,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.background,
                          opacity: savingCornerKeynote ? 0.5 : 1,
                        },
                      ]}
                      onPress={clearCornerKeynoteTitle}
                      disabled={savingCornerKeynote || !cornerKeynoteTitle}
                      accessibilityLabel="Clear keynote title"
                    >
                      <Text
                        style={[styles.cornerEdTitleSecondaryBtnText, { color: theme.colors.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        Clear
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.cornerEdTitlePrimaryBtn,
                        {
                          backgroundColor: theme.colors.primary,
                          opacity: savingCornerKeynote ? 0.5 : 1,
                        },
                      ]}
                      onPress={saveCornerKeynoteTitle}
                      disabled={savingCornerKeynote}
                      accessibilityLabel="Save keynote title"
                    >
                      <View style={styles.cornerThemeSaveBtnInner}>
                        {!savingCornerKeynote && (
                          <Save size={14} color="#FFFFFF" />
                        )}
                        <Text
                          style={[
                            styles.cornerThemeSaveBtnText,
                            styles.cornerThemeSaveBtnTextCompact,
                            { color: '#FFFFFF', marginLeft: savingCornerKeynote ? 0 : 6 },
                          ]}
                          maxFontSizeMultiplier={1.3}
                        >
                          {savingCornerKeynote ? 'Saving...' : 'Save Title'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : keynoteSpeaker?.speech_title?.trim() ? (
                <>
                  <View style={styles.consolidatedThemeLabelRow}>
                    <View style={styles.consolidatedThemeTitleRail} />
                    <Text
                      style={[
                        styles.consolidatedThemeSectionLabel,
                        styles.consolidatedThemeSectionLabelInLabelRow,
                        { color: theme.mode === 'dark' ? '#A3A3A3' : '#8A8FA3' },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      KEYNOTE TITLE
                    </Text>
                    <View style={styles.consolidatedThemeTitleRail}>
                      {isKeynoteSpeaker() ? (
                        <TouchableOpacity
                          style={styles.consolidatedThemeEditHit}
                          onPress={() => setEditingSavedCornerKeynote(true)}
                          accessibilityLabel="Edit keynote title"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Edit3 size={20} color={theme.mode === 'dark' ? '#A3A3A3' : '#777777'} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.consolidatedThemeTitle,
                      { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                    ]}
                    maxFontSizeMultiplier={1.15}
                  >
                    {keynoteSpeaker.speech_title}
                  </Text>
                </>
              ) : (
                <View style={[styles.themeComingSoonInCombined, styles.consolidatedThemeComingSoon]}>
                  <Text
                    style={[
                      styles.themeComingSoonTitle,
                      styles.consolidatedThemeComingSoonText,
                      { color: theme.colors.textSecondary },
                    ]}
                    maxFontSizeMultiplier={1.25}
                  >
                    The Keynote Speaker{'\n'}is preparing the session — stay tuned!
                  </Text>
                </View>
              )}

              <View
                style={[
                  styles.consolidatedBottomDivider,
                  {
                    backgroundColor: theme.mode === 'light' ? NOTION_FLAT_BORDER_LIGHT : theme.colors.border,
                  },
                ]}
              />

              <View style={styles.consolidatedMeetingMetaBlock}>
                <Text
                  style={[
                    styles.consolidatedMeetingMetaSingle,
                    { color: theme.mode === 'dark' ? '#A3A3A3' : '#999999' },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {formatConsolidatedMeetingMetaSingleLine(meeting)}
                </Text>
              </View>
            </View>
        ) : (
          <>
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
                  <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Day: {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </Text>
                  {meeting.meeting_start_time && (
                    <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Time: {meeting.meeting_start_time}
                      {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
                    </Text>
                  )}
                  <Text style={[styles.meetingCardMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Mode:{' '}
                    {meeting.meeting_mode === 'in_person'
                      ? 'In Person'
                      : meeting.meeting_mode === 'online'
                        ? 'Online'
                        : 'Hybrid'}
                  </Text>
                </View>
              </View>
              <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />
              {!keynoteSpeaker?.assigned_user_id ? (
                <View style={styles.noSpeakerCard}>
                  <View style={[styles.noSpeakerIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                    <Mic size={32} color={theme.colors.textSecondary} />
                  </View>
                  <Text style={[styles.noSpeakerText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    The stage is yours — make it count.
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.bookSpeakerButton,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: bookingKeynoteRole || assigningKeynoteRole ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => handleBookKeynoteSpeakerInline()}
                    disabled={bookingKeynoteRole || assigningKeynoteRole}
                  >
                    {bookingKeynoteRole ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.bookSpeakerButtonText} maxFontSizeMultiplier={1.3}>
                        Book Keynote Speaker Role
                      </Text>
                    )}
                  </TouchableOpacity>
                  {isVPEClub ? (
                    <TouchableOpacity
                      style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                      onPress={() => {
                        setShowAssignKeynoteModal(true);
                        void loadClubMembers();
                      }}
                      disabled={bookingKeynoteRole || assigningKeynoteRole}
                      hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }} maxFontSizeMultiplier={1.25}>
                        Assign to a member
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={styles.edSpeakerLoadingRow}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }} maxFontSizeMultiplier={1.3}>
                    Loading speaker profile…
                  </Text>
                </View>
              )}
              <View style={styles.meetingCardDecoration} />
            </View>
          </>
        )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingBottom: tabBarBottomPadding,
            width: isReactNativeWebPlatform() ? windowWidth : '100%',
            paddingHorizontal: Math.max(insets.left, insets.right, 4),
          },
        ]}
      >
        {/* Full-width row + flex:1 per item; horizontal ScrollView on web shrink-wraps and clusters items. */}
        <View style={styles.footerTabBarRow}>
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id } })}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
            </View>
            <Text
              style={[styles.footerNavLabel, { color: theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              Book the role
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() =>
              router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id, initialTab: 'my_bookings' } })
            }
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
            </View>
            <Text
              style={[styles.footerNavLabel, { color: theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              Withdraw role
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
            </View>
            <Text
              style={[styles.footerNavLabel, { color: theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting.id } })}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
            </View>
            <Text
              style={[styles.footerNavLabel, { color: theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              Role completion
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() =>
              router.push({
                pathname: '/keynote-speaker-notes',
                params: { meetingId: meeting.id, clubId: user?.currentClubId ?? '' },
              })
            }
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
            </View>
            <Text
              style={[styles.footerNavLabel, { color: theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              prep space
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
            </View>
            <Text
              style={[styles.footerNavLabel, { color: theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              AGENDA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
            </View>
            <Text
              style={[styles.footerNavLabel, { color: theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              VOTING
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>

      <Modal
        visible={showAssignKeynoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAssignKeynoteModal(false);
          setAssignKeynoteSearch('');
        }}
      >
        <TouchableOpacity
          style={styles.keynoteAssignOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowAssignKeynoteModal(false);
            setAssignKeynoteSearch('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.keynoteAssignModal, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.keynoteAssignHeader}>
              <Text style={[styles.keynoteAssignTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Keynote Speaker
              </Text>
              <TouchableOpacity
                style={styles.keynoteAssignClose}
                onPress={() => {
                  setShowAssignKeynoteModal(false);
                  setAssignKeynoteSearch('');
                }}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.keynoteAssignHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Choose a club member to book the Keynote Speaker role for this meeting.
            </Text>
            <View style={[styles.keynoteAssignSearchWrap, { backgroundColor: theme.colors.background }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.keynoteAssignSearchInput, { color: theme.colors.text }]}
                placeholder="Search by name or email..."
                placeholderTextColor={theme.colors.textSecondary}
                value={assignKeynoteSearch}
                onChangeText={setAssignKeynoteSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {assignKeynoteSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAssignKeynoteSearch('')}>
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.keynoteAssignList} showsVerticalScrollIndicator={false}>
              {assigningKeynoteRole ? (
                <View style={styles.keynoteAssignEmptyWrap}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : filteredMembersForAssignKeynote.length > 0 ? (
                filteredMembersForAssignKeynote.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.keynoteAssignMemberRow, { backgroundColor: theme.colors.background }]}
                    onPress={() => handleAssignKeynoteToMember(member)}
                    disabled={assigningKeynoteRole}
                  >
                    <View style={styles.keynoteAssignAvatar}>
                      {member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.keynoteAssignAvatarImage} />
                      ) : (
                        <User size={20} color="#ffffff" />
                      )}
                    </View>
                    <View style={styles.keynoteAssignMemberTextWrap}>
                      <Text style={[styles.keynoteAssignMemberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {member.full_name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.keynoteAssignEmptyWrap}>
                  <Text style={[styles.keynoteAssignEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No members found
                  </Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Congrats Keynote Speaker modal - shown once per meeting when title not added */}
      <Modal
        visible={showCongratsModal}
        transparent
        animationType="fade"
        onRequestClose={dismissCongratsModal}
      >
        <TouchableOpacity
          style={styles.congratsModalOverlay}
          activeOpacity={1}
          onPress={dismissCongratsModal}
        >
          <TouchableOpacity
            style={[styles.congratsModalContent, { backgroundColor: theme.colors.surface }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={[styles.congratsModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Congrats {user?.fullName?.split(' ')[0] || 'there'}! 🎉
            </Text>
            <Text style={[styles.congratsModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {"You're the Keynote Speaker. Add your "}
              <Text style={styles.congratsModalHighlight}>keynote title</Text>
              {' '}(or use Prep below) so members know what to expect.
            </Text>
            <TouchableOpacity
              style={[styles.congratsModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={dismissCongratsModal}
            >
              <Text style={styles.congratsModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
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
  contentTop: {
    width: '100%',
    alignItems: 'stretch',
  },
  mainBody: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    alignItems: 'stretch',
  },
  scrollMain: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
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
    alignItems: 'center',
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
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  speakerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
    marginBottom: 16,
  },
  speakerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  speakerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  speakerAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  speakerDetails: {
    flex: 1,
  },
  speakerName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  speakerRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  notesIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  speakerEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  speakerRole: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  speakerRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  noSpeakerCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSpeakerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noSpeakerText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
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
  bookSpeakerButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  bookSpeakerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  keynoteAssignOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keynoteAssignModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  keynoteAssignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keynoteAssignTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  keynoteAssignClose: {
    padding: 6,
  },
  keynoteAssignHint: {
    fontSize: 13,
    marginBottom: 10,
  },
  keynoteAssignSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  keynoteAssignSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  keynoteAssignList: {
    maxHeight: 360,
  },
  keynoteAssignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  keynoteAssignAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  keynoteAssignAvatarImage: {
    width: '100%',
    height: '100%',
  },
  keynoteAssignMemberTextWrap: {
    flex: 1,
  },
  keynoteAssignMemberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  keynoteAssignEmptyWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keynoteAssignEmptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  speechContent: {
    marginTop: 16,
  },
  speechContentTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 26,
  },
  summarySectionCard: {
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  summarySectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summarySectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  educationalInstructionsCard: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  educationalInstructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  educationalInstructionsBody: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
  },
  educationalInstructionsHighlight: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  congratsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  congratsModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  congratsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  congratsModalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  congratsModalHighlight: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  congratsModalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  congratsModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  educationalComingSoonCard: {
    position: 'relative',
    alignItems: 'flex-start',
    paddingVertical: 80,
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  educationalComingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  educationalDisplayCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  educationalDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  educationalDisplayHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  decorativeSparkleSmall: {
    fontSize: 16,
  },
  educationalHeaderEmoji: {
    fontSize: 18,
  },
  educationalDisplayDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  educationalDisplayTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  educationalDisplaySummary: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'left',
    marginBottom: 0,
  },
  educationalDisplaySpeaker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  educationalDisplaySpeakerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#f97316',
  },
  educationalDisplayAvatarImage: {
    width: '100%',
    height: '100%',
  },
  educationalDisplaySpeakerInfo: {
    flex: 1,
  },
  educationalDisplaySpeakerName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  educationalDisplaySpeakerRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  educationalDisplayClubName: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyStateSummaryBox: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateEmoji: {
    fontSize: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 40,
  },
  footerNavigationInline: {
    borderTopWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  footerTabBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 1,
    paddingBottom: 2,
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
    lineHeight: 11,
  },
  /** Flat Notion-style block — matches TM Corner. */
  consolidatedCornerCard: {
    marginBottom: 0,
    borderRadius: NOTION_FLAT_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
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
  consolidatedDivider: {
    width: '100%',
    height: 1,
    marginTop: 16,
    marginBottom: 16,
  },
  consolidatedThemeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 4,
  },
  consolidatedThemeSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  consolidatedThemeSectionLabelInLabelRow: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  consolidatedThemeTitleRail: {
    width: 44,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consolidatedThemeEditHit: {
    padding: 4,
  },
  consolidatedThemeTitle: {
    fontSize: 31,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 36,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  consolidatedBottomDivider: {
    width: '100%',
    height: 1,
    marginTop: 22,
    marginBottom: 20,
  },
  consolidatedThemeFormStretch: {
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: 0,
  },
  cornerEdTitleFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  cornerEdTitleFormHeadingText: {
    flex: 1,
    textAlign: 'left',
    marginBottom: 0,
    paddingRight: 8,
  },
  cornerEdTitleCloseHit: {
    padding: 4,
  },
  cornerEdTitleActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    alignSelf: 'stretch',
    width: '100%',
  },
  cornerEdTitleSecondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: NOTION_FLAT_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cornerEdTitleSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cornerEdTitlePrimaryBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: NOTION_FLAT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  themeDaySectionHeading: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  themeDaySectionHeadingConsolidated: {
    textAlign: 'center',
    marginBottom: 14,
  },
  cornerThemeFormInputSection: {
    marginBottom: 16,
  },
  cornerThemeNameInput: {
    borderWidth: 1,
    borderRadius: NOTION_FLAT_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    marginBottom: 8,
  },
  cornerThemeNameInputClean: {
    borderWidth: 1.5,
    marginBottom: 0,
  },
  cornerThemeInputFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cornerThemeHelperCaption: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginRight: 12,
  },
  cornerThemeCharCount: {
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },
  cornerThemeSaveBtn: {
    marginTop: 4,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: NOTION_FLAT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerThemeSaveBtnCompact: {
    alignSelf: 'center',
    width: '70%',
    maxWidth: 260,
    marginTop: 8,
    paddingVertical: 11,
    paddingHorizontal: 17,
    borderRadius: NOTION_FLAT_RADIUS,
  },
  cornerThemeSaveBtnTextCompact: {
    fontSize: 14,
  },
  cornerThemeSaveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerThemeSaveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  consolidatedThemeComingSoon: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  consolidatedThemeComingSoonText: {
    textAlign: 'center',
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
  themeComingSoonInCombined: {
    backgroundColor: 'transparent',
    paddingVertical: 20,
    paddingHorizontal: 0,
    borderRadius: 0,
  },
  themeComingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  edSpeakerLoadingRow: {
    alignItems: 'center',
    paddingVertical: 24,
  },
});
