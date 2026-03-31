import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchEvaluationCornerSnapshot, getCachedEvaluationCornerSnapshot, type EvaluationCornerSnapshot } from '@/lib/evaluationCornerSnapshot';
import { ArrowLeft, Calendar, User, BookOpen, GraduationCap, Target, MessageSquare, NotebookPen, X, ChevronDown, Plus, Info, FileText, Bell, Users, Star, Mic, CheckSquare, FileBarChart, Clock, CheckCircle, Link as LinkIcon } from 'lucide-react-native';
import { RefreshCw, RotateCcw } from 'lucide-react-native';
import { Image } from 'react-native';

const FOOTER_NAV_ICON_SIZE = 15;

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_status: string;
  meeting_day: string | null;
}

interface RoleBooking {
  id: string;
  user_id: string;
  role_name: string;
  role_metric: string;
  booking_status: string;
  role_classification: string | null;
  app_user_profiles: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface ExistingEvaluationPathway {
  id: string;
  meeting_id: string;
  club_id: string;
  user_id: string;
  role_name: string;
  speech_title: string | null;
  pathway_name: string | null;
  level: number | null;
  project_name: string | null;
  evaluation_form: string | null;
  comments_for_evaluator: string | null;
  evaluation_title: string | null;
  table_topics_title: string | null;
  assigned_evaluator_id: string | null;
  completed_evaluation_form: string | null;
  comments_by_evaluator: string | null;
  project_number: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
  vpe_approval_requested: boolean | null;
  vpe_approval_requested_at: string | null;
  vpe_approval_request_id: string | null;
  vpe_approved: boolean | null;
  vpe_approved_at: string | null;
  vpe_approved_by: string | null;
  vpe_approval_decision_id: string | null;
  is_locked: boolean;
  locked_at: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export default function EvaluationCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [roleBookings, setRoleBookings] = useState<RoleBooking[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleBooking[]>([]);
  const [existingEvaluationPathways, setExistingEvaluationPathways] = useState<Record<string, ExistingEvaluationPathway>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('speeches_delivered');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<RoleBooking | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editForm, setEditForm] = useState({
    speech_title: '',
    pathway_name: '',
    level: '',
    project_name: '',
    project_number: '',
    evaluation_title: '',
    table_topics_title: '',
    evaluation_form: '',
    comments_for_evaluator: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [bookingRoleId, setBookingRoleId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetBooking, setAssignTargetBooking] = useState<RoleBooking | null>(null);
  const [evaluatorSearchQuery, setEvaluatorSearchQuery] = useState('');
  const [assigningEvaluatorForRoleId, setAssigningEvaluatorForRoleId] = useState<string | null>(null);
  const mainScrollRef = useRef<ScrollView | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);

  const currentUserRole = (user?.clubRole || user?.role || '').toLowerCase();
  const isExcomm = currentUserRole === 'excomm';
  const isMember = currentUserRole === 'member';

  const tabs = [
    {
      key: 'speeches_delivered',
      title: 'Prepared Speakers',
      metric: 'speeches_delivered',
      color: theme.colors.textSecondary,
    }
  ];

  // Single load path: initial mount + every focus (e.g. return from pathway form).
  // Avoid duplicating useEffect + useFocusEffect — that fired loadData twice and doubled
  // heavy queries (e.g. full-club app_club_user_relationship embed).
  useFocusEffect(
    useCallback(() => {
      if (meetingId) {
        void loadData();
      }
    }, [meetingId, user?.currentClubId])
  );

  const showPreparedSpeakerInfo = () => {
    setShowInfoModal(true);
  };

  const upsertAssignedEvaluator = async (booking: RoleBooking, evaluatorId: string | null) => {
    if (!meetingId || !user?.currentClubId || !user?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setAssigningEvaluatorForRoleId(booking.id);
    try {
      const { data: existingData, error: checkError } = await supabase
        .from('app_evaluation_pathway')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('user_id', booking.user_id)
        .eq('role_name', booking.role_name)
        .maybeSingle();

      if (checkError && (checkError as any).code !== 'PGRST116') {
        console.error('Error checking existing pathway:', checkError);
        Alert.alert('Error', 'Failed to check existing pathway');
        return;
      }

      const base = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        user_id: booking.user_id,
        role_name: booking.role_name,
        assigned_evaluator_id: evaluatorId,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (existingData?.id) {
        const { error } = await supabase.from('app_evaluation_pathway').update(base).eq('id', existingData.id);
        if (error) {
          console.error('Error updating evaluator assignment:', error);
          Alert.alert('Error', 'Failed to assign evaluator');
          return;
        }
      } else {
        const { error } = await supabase
          .from('app_evaluation_pathway')
          .insert({ ...base, created_at: new Date().toISOString() });
        if (error) {
          console.error('Error creating evaluator assignment:', error);
          Alert.alert('Error', 'Failed to assign evaluator');
          return;
        }
      }

      await refreshRolesPathwaysAndProfiles();
    } catch (e) {
      console.error('Error assigning evaluator:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setAssigningEvaluatorForRoleId(null);
    }
  };

  const openAssignModal = (booking: RoleBooking) => {
    setAssignTargetBooking(booking);
    setEvaluatorSearchQuery('');
    setAssignModalOpen(true);
    void loadMemberDirectoryForAssignModal();
  };

  const parsePreparedOrIceSlot = (roleName: string): { kind: 'prepared' | 'ice'; slot: number } | null => {
    const value = (roleName || '').trim().toLowerCase();
    const preparedMatch = value.match(/^prepared\s*(?:speaker|speech)\s*(\d+)$/i);
    if (preparedMatch) {
      const slot = Number(preparedMatch[1]);
      if (slot >= 1 && slot <= 5) return { kind: 'prepared', slot };
      return null;
    }
    const iceMatch = value.match(/^ice\s*breaker(?:\s*speech)?\s*(\d+)$/i);
    if (iceMatch) {
      const slot = Number(iceMatch[1]);
      if (slot >= 1 && slot <= 5) return { kind: 'ice', slot };
      return null;
    }
    return null;
  };

  const pathwayHasSpeechDetails = (row: any) =>
    !!(
      (row?.speech_title || '').trim() ||
      (row?.pathway_name || '').trim() ||
      (row?.project_name || '').trim() ||
      (row?.project_number || '').trim() ||
      row?.level != null ||
      (row?.evaluation_form || '').trim() ||
      (row?.comments_for_evaluator || '').trim()
    );

  const transferSpeechDetailsForSlotMove = async (newRoleName: string, targetMeetingId: string, targetUserId: string) => {
    const targetSlot = parsePreparedOrIceSlot(newRoleName);
    if (!targetSlot) return;

    try {
      const { data: targetRow, error: targetErr } = await supabase
        .from('app_evaluation_pathway')
        .select(`
          id,
          speech_title,
          pathway_name,
          level,
          project_name,
          project_number,
          evaluation_form,
          comments_for_evaluator
        `)
        .eq('meeting_id', targetMeetingId)
        .eq('user_id', targetUserId)
        .eq('role_name', newRoleName)
        .maybeSingle();

      if (targetErr) {
        console.error('Error checking target pathway row:', targetErr);
        return;
      }

      const { data: candidates, error: sourceErr } = await supabase
        .from('app_evaluation_pathway')
        .select(`
          id,
          role_name,
          speech_title,
          pathway_name,
          level,
          project_name,
          project_number,
          evaluation_form,
          comments_for_evaluator,
          evaluation_title,
          table_topics_title,
          updated_at
        `)
        .eq('meeting_id', targetMeetingId)
        .eq('user_id', targetUserId)
        .or('role_name.ilike.%prepared%speaker%,role_name.ilike.%prepared%speech%,role_name.ilike.%ice%breaker%')
        .neq('role_name', newRoleName)
        .order('updated_at', { ascending: false });

      if (sourceErr) {
        console.error('Error loading source pathway rows:', sourceErr);
        return;
      }
      if (!candidates?.length) return;

      const scopedCandidates = candidates.filter((item: any) => !!parsePreparedOrIceSlot(item.role_name));
      if (!scopedCandidates.length) return;

      const source = scopedCandidates.find(pathwayHasSpeechDetails) || scopedCandidates[0];
      if (!source?.id) return;

      if (targetRow?.id) {
        if (pathwayHasSpeechDetails(targetRow)) return;

        const { error: mergeErr } = await supabase
          .from('app_evaluation_pathway')
          .update({
            speech_title: source.speech_title,
            pathway_name: source.pathway_name,
            level: source.level,
            project_name: source.project_name,
            project_number: source.project_number,
            evaluation_form: source.evaluation_form,
            comments_for_evaluator: source.comments_for_evaluator,
            evaluation_title: source.evaluation_title,
            table_topics_title: source.table_topics_title,
            updated_at: new Date().toISOString(),
            updated_by: targetUserId,
          })
          .eq('id', targetRow.id);

        if (mergeErr) {
          console.error('Error merging speech details to target slot:', mergeErr);
        }
        return;
      }

      const { error: moveErr } = await supabase
        .from('app_evaluation_pathway')
        .update({
          role_name: newRoleName,
          updated_at: new Date().toISOString(),
          updated_by: targetUserId,
        })
        .eq('id', source.id);

      if (moveErr) {
        console.error('Error moving speech details to new slot:', moveErr);
      }
    } catch (error) {
      console.error('Error in transferSpeechDetailsForSlotMove:', error);
    }
  };

  const handleBookAvailableSlot = async (role: RoleBooking) => {
    if (!meetingId || !user?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }
    if (bookingRoleId) return;
    setBookingRoleId(role.id);
    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: user.id,
          booking_status: 'booked',
          booked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', role.id)
        .eq('meeting_id', meetingId)
        .eq('booking_status', 'open');

      if (error) {
        console.error('Error booking slot:', error);
        Alert.alert('Error', 'Failed to book this slot. It may have been booked by someone else.');
        return;
      }

      await transferSpeechDetailsForSlotMove(role.role_name, meetingId, user.id);
      await refreshRolesPathwaysAndProfiles();
      Alert.alert('Booked', `${role.role_name} booked successfully.`);
    } catch (e) {
      console.error('Error booking slot:', e);
      Alert.alert('Error', 'An unexpected error occurred while booking.');
    } finally {
      setBookingRoleId(null);
    }
  };

  const applySnapshotPayload = (
    snap: EvaluationCornerSnapshot
  ): {
    roleRows: RoleBooking[];
    pathwaysRecord: Record<string, ExistingEvaluationPathway>;
    hasMeetingInSnapshot: boolean;
  } => {
    const pathwaysArr = Array.isArray(snap.pathways) ? snap.pathways : [];
    const rolesArr = Array.isArray(snap.roles) ? snap.roles : [];

    const hasMeetingInSnapshot = !!(
      snap.meeting &&
      typeof snap.meeting === 'object' &&
      (snap.meeting as Meeting).id
    );
    if (hasMeetingInSnapshot) {
      setMeeting(snap.meeting as Meeting);
    }

    const pathwaysRecord: Record<string, ExistingEvaluationPathway> = {};
    pathwaysArr.forEach((raw) => {
      const pathway = raw as unknown as ExistingEvaluationPathway;
      pathwaysRecord[`${pathway.user_id}_${pathway.role_name}`] = pathway;
    });
    setExistingEvaluationPathways(pathwaysRecord);

    const booked: RoleBooking[] = [];
    const available: RoleBooking[] = [];
    for (const raw of rolesArr) {
      const row = raw as {
        id: string;
        assigned_user_id: string | null;
        role_name: string;
        role_metric: string;
        booking_status: string;
        role_classification: string | null;
        app_user_profiles?: UserProfile | null;
      };
      const roleData: RoleBooking = {
        id: row.id,
        user_id: row.assigned_user_id || '',
        role_name: row.role_name,
        role_metric: row.role_metric,
        booking_status: row.booking_status,
        role_classification: row.role_classification,
        app_user_profiles: row.app_user_profiles as RoleBooking['app_user_profiles'],
      };
      if (row.booking_status === 'booked' && row.assigned_user_id) {
        booked.push(roleData);
      } else if (row.booking_status === 'open') {
        available.push(roleData);
      }
    }
    setRoleBookings(booked);
    setAvailableRoles(available);

    return {
      roleRows: [...booked, ...available],
      pathwaysRecord,
      hasMeetingInSnapshot,
    };
  };

  /** One DB round-trip for pathways + roles when migration is applied; else REST fallback. */
  const tryLoadRolesAndPathwaysViaRpc = async (): Promise<
    | {
        ok: true;
        roleRows: RoleBooking[];
        pathwaysRecord: Record<string, ExistingEvaluationPathway>;
        /** False if server RPC predates `meeting` in payload — caller should loadMeeting(). */
        hasMeetingInSnapshot: boolean;
      }
    | { ok: false }
  > => {
    if (!meetingId) return { ok: false };

    const snap = await fetchEvaluationCornerSnapshot(meetingId);
    if (!snap) return { ok: false };
    const applied = applySnapshotPayload(snap);

    return {
      ok: true,
      roleRows: applied.roleRows,
      pathwaysRecord: applied.pathwaysRecord,
      hasMeetingInSnapshot: applied.hasMeetingInSnapshot,
    };
  };

  const loadData = async () => {
    if (loadInFlightRef.current) {
      return loadInFlightRef.current;
    }

    const run = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    const cached = getCachedEvaluationCornerSnapshot(meetingId);
    if (cached) {
      const applied = applySnapshotPayload(cached);
      hydrateUserProfilesForScreen(applied.roleRows, applied.pathwaysRecord);
      setIsLoading(false);
      // Refresh in background to keep data current without blocking first paint.
      void refreshRolesPathwaysAndProfiles();
      return;
    }

    try {
      const rpc = await tryLoadRolesAndPathwaysViaRpc();

      if (rpc.ok) {
        if (!rpc.hasMeetingInSnapshot) {
          await loadMeeting();
        }
        hydrateUserProfilesForScreen(rpc.roleRows, rpc.pathwaysRecord);
      } else {
        const [, roleRows, pathwaysRecord] = await Promise.all([
          loadMeeting(),
          loadRoleBookings(),
          loadExistingEvaluationPathways(),
        ]);
        hydrateUserProfilesForScreen(roleRows, pathwaysRecord);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load evaluation data');
    } finally {
      setIsLoading(false);
    }
    };

    const promise = run();
    loadInFlightRef.current = promise;
    try {
      await promise;
    } finally {
      loadInFlightRef.current = null;
    }
  };

  const loadMeeting = async () => {
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

  const loadRoleBookings = async (): Promise<RoleBooking[]> => {
    if (!meetingId || !user?.currentClubId) return [];

    try {
      // Load prepared-speaker and evaluator roles for this meeting
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          assigned_user_id,
          role_name,
          role_metric,
          booking_status,
          role_classification,
          role_status,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('role_status', 'Available')
        .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%,role_name.ilike.%evaluator%');

      if (error) {
        console.error('Error loading role bookings:', error);
        return [];
      }

      // Separate booked and available roles
      const booked: RoleBooking[] = [];
      const available: RoleBooking[] = [];

      (data || []).forEach(role => {
        const roleData = {
          id: role.id,
          user_id: role.assigned_user_id || '',
          role_name: role.role_name,
          role_metric: role.role_metric,
          booking_status: role.booking_status,
          role_classification: role.role_classification,
          app_user_profiles: (role as any).app_user_profiles
        };

        if (role.booking_status === 'booked' && role.assigned_user_id) {
          booked.push(roleData);
        } else if (role.booking_status === 'open') {
          available.push(roleData);
        }
      });

      setRoleBookings(booked);
      setAvailableRoles(available);
      return [...booked, ...available];
    } catch (error) {
      console.error('Error loading role bookings:', error);
      return [];
    }
  };

  const loadExistingEvaluationPathways = async (): Promise<Record<string, ExistingEvaluationPathway>> => {
    if (!meetingId || !user) return {};

    try {
      const { data, error } = await supabase
        .from('app_evaluation_pathway')
        .select(`
          id,
          meeting_id,
          club_id,
          user_id,
          role_name,
          speech_title,
          pathway_name,
          level,
          project_name,
          evaluation_form,
          comments_for_evaluator,
          evaluation_title,
          table_topics_title,
          assigned_evaluator_id,
          completed_evaluation_form,
          comments_by_evaluator,
          project_number,
          created_at,
          updated_at,
          updated_by,
          vpe_approval_requested,
          vpe_approval_requested_at,
          vpe_approval_request_id,
          vpe_approved,
          vpe_approved_at,
          vpe_approved_by,
          vpe_approval_decision_id,
          is_locked,
          locked_at
        `)
        .eq('meeting_id', meetingId);

      if (error) {
        console.error('Error loading existing evaluation pathways:', error);
        return {};
      }

      const pathways: Record<string, ExistingEvaluationPathway> = {};
      (data || []).forEach(pathway => {
        const key = `${pathway.user_id}_${pathway.role_name}`;
        pathways[key] = pathway as ExistingEvaluationPathway;
      });

      setExistingEvaluationPathways(pathways);
      return pathways;
    } catch (error) {
      console.error('Error loading existing evaluation pathways:', error);
      return {};
    }
  };

  /** Main list: profiles from role rows + any assigned evaluators not on those rows (one small IN query). */
  const hydrateUserProfilesForScreen = (
    roles: RoleBooking[],
    pathways: Record<string, ExistingEvaluationPathway>
  ) => {
    const byId = new Map<string, UserProfile>();
    for (const r of roles) {
      const p = r.app_user_profiles;
      if (p?.id) {
        byId.set(p.id, p);
      }
    }
    const missing = new Set<string>();
    for (const p of Object.values(pathways)) {
      const eid = p.assigned_evaluator_id;
      if (eid && !byId.has(eid)) {
        missing.add(eid);
      }
    }
    setUserProfiles(Object.fromEntries(byId));
    if (missing.size > 0) {
      void supabase
        .from('app_user_profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', [...missing])
        .then(({ data, error }) => {
          if (error || !data) return;
          setUserProfiles((prev) => {
            const next = { ...prev };
            for (const row of data as UserProfile[]) {
              next[row.id] = row;
            }
            return next;
          });
        });
    }
  };

  const refreshRolesPathwaysAndProfiles = async () => {
    const rpc = await tryLoadRolesAndPathwaysViaRpc();
    if (rpc.ok) {
      if (!rpc.hasMeetingInSnapshot) {
        await loadMeeting();
      }
      hydrateUserProfilesForScreen(rpc.roleRows, rpc.pathwaysRecord);
      return;
    }
    const [roleRows, pathwaysRecord] = await Promise.all([
      loadRoleBookings(),
      loadExistingEvaluationPathways(),
    ]);
    hydrateUserProfilesForScreen(roleRows, pathwaysRecord);
  };

  /** Full club roster for “Assign evaluator” modal only (RPC — avoids heavy relationship embed). */
  const loadMemberDirectoryForAssignModal = async () => {
    if (!user?.currentClubId) return;
    try {
      const { data, error } = await supabase.rpc('get_club_member_directory', {
        target_club_id: user.currentClubId,
      });
      if (error) {
        console.error('get_club_member_directory error:', error);
        const { data: relData, error: relErr } = await supabase
          .from('app_club_user_relationship')
          .select(
            `
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `
          )
          .eq('club_id', user.currentClubId)
          .eq('is_authenticated', true);
        if (relErr) {
          console.error('Fallback club profile load failed:', relErr);
          return;
        }
        const profiles: Record<string, UserProfile> = {};
        (relData || []).forEach((item) => {
          const profile = (item as { app_user_profiles: UserProfile }).app_user_profiles;
          if (profile?.id) profiles[profile.id] = profile;
        });
        setUserProfiles((prev) => ({ ...profiles, ...prev }));
        return;
      }
      const rows = (data || []) as {
        user_id: string;
        full_name: string;
        email: string;
        avatar_url: string | null;
      }[];
      const fromRpc: Record<string, UserProfile> = {};
      for (const row of rows) {
        fromRpc[row.user_id] = {
          id: row.user_id,
          full_name: row.full_name,
          email: row.email,
          avatar_url: row.avatar_url,
        };
      }
      setUserProfiles((prev) => ({ ...fromRpc, ...prev }));
    } catch (e) {
      console.error('loadMemberDirectoryForAssignModal:', e);
    }
  };

  const getFilteredBookings = () => {
    let filtered = roleBookings.filter(
      (booking) =>
        booking.role_classification === 'Prepared Speaker' ||
        /prepared\s*speaker/i.test(booking.role_name || '')
    );

    // Sort by role name to maintain sequence (Prepared Speaker 1, 2, 3, etc.)
    return filtered.sort((a, b) => {
      // Extract numbers from role names for proper sorting
      const getSequenceNumber = (roleName: string) => {
        const match = roleName.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const aNumber = getSequenceNumber(a.role_name);
      const bNumber = getSequenceNumber(b.role_name);

      // Same role type, sort by number
      return aNumber - bNumber;
    });
  };

  const getFilteredAvailableRoles = () => {
    let filtered = availableRoles.filter(
      (role) =>
        role.role_classification === 'Prepared Speaker' ||
        /prepared\s*speaker/i.test(role.role_name || '') ||
        /evaluator/i.test(role.role_name || '')
    );

    // Sort by role name to maintain sequence
    return filtered.sort((a, b) => {
      const getSequenceNumber = (roleName: string) => {
        const match = roleName.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const aNumber = getSequenceNumber(a.role_name);
      const bNumber = getSequenceNumber(b.role_name);

      return aNumber - bNumber;
    });
  };

  const getEvaluationPathwayKey = (userId: string, roleName: string) => {
    return `${userId}_${roleName}`;
  };

  const getSequenceNumber = (roleName: string) => {
    const match = roleName.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 999;
  };

  const isEvaluatorRole = (role: RoleBooking) => {
    const roleName = (role.role_name || '').trim();
    const classification = (role.role_classification || '').toLowerCase();
    const isPairedByName = /^evaluator\s*\d+$/i.test(roleName);
    const isSpeechEvaluatorClass =
      classification === 'speech evaluvator' ||
      classification === 'speech_evaluator' ||
      classification === 'speech evaluator';
    return isPairedByName || (isSpeechEvaluatorClass && /^evaluator/i.test(roleName));
  };

  const isPreparedSpeakerRole = (role: RoleBooking) =>
    role.role_classification === 'Prepared Speaker' || /prepared\s*speaker/i.test(role.role_name || '');

  const handleEditPathway = (booking: RoleBooking) => {
    const key = getEvaluationPathwayKey(booking.user_id, booking.role_name);
    const pathway = existingEvaluationPathways[key];

    if (pathway?.vpe_approval_requested) {
      Alert.alert(
        'Cannot Edit',
        'Speech details cannot be edited after requesting VPE approval.'
      );
      return;
    }

    setSelectedBooking(booking);
    setEditForm({
      speech_title: pathway?.speech_title || '',
      pathway_name: pathway?.pathway_name || '',
      level: pathway?.level != null ? String(pathway.level) : '',
      project_name: pathway?.project_name || '',
      project_number: pathway?.project_number || '',
      evaluation_title: pathway?.evaluation_title || '',
      table_topics_title: pathway?.table_topics_title || '',
      evaluation_form: pathway?.evaluation_form || '',
      comments_for_evaluator: pathway?.comments_for_evaluator || '',
    });
    setShowEditModal(true);
  };

  const handleSavePathway = async () => {
    if (!selectedBooking || !meetingId || !user?.currentClubId) return;

    // Validate mandatory evaluation form field
    if (!editForm.evaluation_form.trim()) {
      Alert.alert('Error', 'Evaluation form link is required');
      return;
    }

    setIsSaving(true);

    try {
      const currentTab = tabs.find(t => t.key === selectedTab);
      if (!currentTab) return;

      let saveData: any = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        user_id: selectedBooking.user_id,
        role_name: selectedBooking.role_name,
        pathway_name: editForm.pathway_name.trim() || null,
        level: editForm.level ? parseInt(editForm.level) : null,
        project_name: editForm.project_name.trim() || null,
        project_number: editForm.project_number.trim() || null,
        evaluation_form: editForm.evaluation_form.trim() || null,
        comments_for_evaluator: editForm.comments_for_evaluator.trim() || null,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };

      // Add speech title
      saveData.speech_title = editForm.speech_title.trim() || null;

      // Check if pathway already exists
      const { data: existingData, error: checkError } = await supabase
        .from('app_evaluation_pathway')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('user_id', selectedBooking.user_id)
        .eq('role_name', selectedBooking.role_name)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing pathway:', checkError);
        Alert.alert('Error', 'Failed to check existing pathway');
        return;
      }

      if (existingData) {
        // Update existing pathway
        const { error } = await supabase
          .from('app_evaluation_pathway')
          .update(saveData)
          .eq('id', existingData.id);

        if (error) {
          console.error('Error updating evaluation pathway:', error);
          Alert.alert('Error', `Failed to update pathway information: ${error.message}`);
          return;
        }
      } else {
        // Create new pathway
        const { error } = await supabase
          .from('app_evaluation_pathway')
          .insert({
            ...saveData,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error creating evaluation pathway:', error);
          Alert.alert('Error', `Failed to save pathway information: ${error.message}`);
          return;
        }
      }

      Alert.alert('Success', 'Pathway information saved successfully');
      setShowEditModal(false);
      setSelectedBooking(null);
      void refreshRolesPathwaysAndProfiles();
    } catch (error) {
      console.error('Error saving pathway:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEvaluationForm = async (url: string) => {
    try {
      // Validate and fix URL format
      let formattedUrl = url.trim();

      // Check if URL has a protocol, if not add https://
      if (!formattedUrl.match(/^https?:\/\//i)) {
        formattedUrl = 'https://' + formattedUrl;
      }

      // Validate it's a valid URL
      try {
        new URL(formattedUrl);
      } catch (e) {
        Alert.alert('Error', 'Invalid evaluation form URL. Please update the form link.');
        return;
      }

      const supported = await Linking.canOpenURL(formattedUrl);
      if (supported) {
        await Linking.openURL(formattedUrl);
      } else {
        Alert.alert('Error', 'Cannot open this evaluation form link');
      }
    } catch (error) {
      console.error('Error opening evaluation form:', error);
      Alert.alert('Error', 'Failed to open evaluation form');
    }
  };

  const isMeetingDay = () => {
    if (!meeting) return false;

    const today = new Date();
    const meetingDate = new Date(meeting.meeting_date);

    // Reset time parts to compare only dates
    today.setHours(0, 0, 0, 0);
    meetingDate.setHours(0, 0, 0, 0);

    return today.getTime() === meetingDate.getTime();
  };

  const handleRequestVPEApproval = async (pathway: ExistingEvaluationPathway) => {
    if (!user?.currentClubId) return;

    // Check if it's the meeting day
    if (!isMeetingDay()) {
      Alert.alert(
        'Not Available',
        'This feature will be enabled only on the day of the meeting.'
      );
      return;
    }

    // Validate all required fields are present
    const validationErrors: string[] = [];
    if (!pathway.speech_title?.trim()) validationErrors.push('Speech Title');
    if (!pathway.pathway_name?.trim()) validationErrors.push('Pathway');
    if (!pathway.level) validationErrors.push('Level');
    if (!pathway.project_name?.trim()) validationErrors.push('Project Name');
    if (!pathway.evaluation_form?.trim()) validationErrors.push('Evaluation Form');
    if (!pathway.assigned_evaluator_id) validationErrors.push('Evaluator');

    if (validationErrors.length > 0) {
      Alert.alert(
        'Missing Information',
        `Please complete the following before requesting VPE approval:\n\n${validationErrors.join('\n')}`
      );
      return;
    }

    Alert.alert(
      'Request VPE Approval',
      'Please verify all speech, pathway, and evaluator details. Once submitted, no changes can be made.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_evaluation_pathway')
                .update({
                  vpe_approval_requested: true,
                  vpe_approval_requested_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  updated_by: user.id
                })
                .eq('id', pathway.id);

              if (error) {
                console.error('Error requesting VPE approval:', error);
                Alert.alert('Error', 'Failed to submit approval request');
                return;
              }

              Alert.alert('Success', 'Your speech has been submitted for VPE approval');
              void refreshRolesPathwaysAndProfiles();
            } catch (error) {
              console.error('Error requesting VPE approval:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const canRequestVPEApproval = (pathway: ExistingEvaluationPathway | undefined) => {
    if (!pathway) return false;
    if (pathway.vpe_approval_requested) return false;
    if (!isMeetingDay()) return false;

    return !!(
      pathway.speech_title?.trim() &&
      pathway.pathway_name?.trim() &&
      pathway.level &&
      pathway.project_name?.trim() &&
      pathway.evaluation_form?.trim() &&
      pathway.assigned_evaluator_id
    );
  };

  const ParticipantCard = ({ booking, isLastCard = false }: { booking: RoleBooking; isLastCard?: boolean }) => {
    const key = getEvaluationPathwayKey(booking.user_id, booking.role_name);
    const pathway = existingEvaluationPathways[key];
    const assignedEvaluator = pathway?.assigned_evaluator_id ? userProfiles[pathway.assigned_evaluator_id] : null;
    const bookingSequence = getSequenceNumber(booking.role_name || '');
    const pairedEvaluatorOpenRole = availableRoles.find(
      (role) => isEvaluatorRole(role) && getSequenceNumber(role.role_name || '') === bookingSequence
    );
    const pairedEvaluatorBookedRole = roleBookings.find(
      (role) => isEvaluatorRole(role) && getSequenceNumber(role.role_name || '') === bookingSequence
    );
    const pairedEvaluatorBookedName = pairedEvaluatorBookedRole?.app_user_profiles?.full_name || null;
    const pairedEvaluatorBookedAvatar = pairedEvaluatorBookedRole?.app_user_profiles?.avatar_url || null;
    const evaluatorDisplayName = pairedEvaluatorOpenRole
      ? 'Available to book'
      : assignedEvaluator?.full_name || pairedEvaluatorBookedName || 'TBA';
    const evaluatorAvatarUrl = assignedEvaluator?.avatar_url || pairedEvaluatorBookedAvatar || null;
    const isEvaluatorBooked = evaluatorDisplayName !== 'Available to book' && evaluatorDisplayName !== 'TBA';
    const isSpeechInfoIncomplete = !(
      pathway?.speech_title?.trim() &&
      pathway?.pathway_name?.trim() &&
      pathway?.project_name?.trim() &&
      pathway?.level &&
      pathway?.project_number?.trim() &&
      pathway?.evaluation_form?.trim()
    );

    const editIconBlinkAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      let blinkLoop: Animated.CompositeAnimation | null = null;
      const shouldBlink =
        isSpeechInfoIncomplete && !pathway?.is_locked && !pathway?.vpe_approval_requested;

      if (shouldBlink) {
        blinkLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(editIconBlinkAnim, {
              toValue: 0.25,
              duration: 650,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(editIconBlinkAnim, {
              toValue: 1,
              duration: 650,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        blinkLoop.start();
      } else {
        editIconBlinkAnim.stopAnimation();
        editIconBlinkAnim.setValue(1);
      }

      return () => {
        if (blinkLoop) blinkLoop.stop();
      };
    }, [isSpeechInfoIncomplete, pathway?.is_locked, pathway?.vpe_approval_requested, editIconBlinkAnim]);

    const openSpeechDetailsPage = () => {
      if (!meetingId) return;
      router.push({ pathname: '/pathway-form', params: { meetingId, roleId: booking.id } });
    };

    return (
      <View
        style={[
          styles.participantCard,
          styles.participantCardNotionItem,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        {/* User Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: theme.colors.background }]}>
          <View style={styles.profileContent}>
            <View style={[styles.profileAvatar, { backgroundColor: theme.colors.border }]}>
              {booking.app_user_profiles.avatar_url ? (
                <Image
                  source={{ uri: booking.app_user_profiles.avatar_url }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <User size={32} color={theme.colors.textSecondary} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {booking.app_user_profiles.full_name}
              </Text>
              <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {booking.role_name}
              </Text>
            </View>
          </View>
          {/* Toggle Details (only self can edit) */}
          {!pathway?.is_locked && !pathway?.vpe_approval_requested && (
            <TouchableOpacity
              style={styles.detailsToggleBtn}
              onPress={openSpeechDetailsPage}
              activeOpacity={0.8}
              accessibilityLabel="Edit Speech"
            >
              <Animated.View style={{ opacity: editIconBlinkAnim }}>
                <NotebookPen size={20} color="#1f2937" />
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        {/* Speech Information Section */}
        <View style={[styles.speechInfoSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitleSubsection, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Speech Information
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Title:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {pathway?.speech_title?.trim() || ''}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pathway:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {pathway?.pathway_name?.trim() || ''}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Project
            </Text>
            {(pathway?.project_name?.trim() || pathway?.level || pathway?.project_number) ? (
              <View style={styles.infoValueRowWrap}>
                {pathway?.project_name?.trim() ? (
                  <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {pathway.project_name}
                  </Text>
                ) : (
                  <Text style={[styles.infoValueMuted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    
                  </Text>
                )}
                {pathway?.level ? (
                  <View style={[styles.levelPill, { backgroundColor: '#dbeafe' }]}>
                    <Text style={[styles.levelPillText, { color: '#1d4ed8' }]} maxFontSizeMultiplier={1.3}>
                      L{pathway.level}
                    </Text>
                  </View>
                ) : null}
                {pathway?.project_number ? (
                  <View style={[styles.levelPill, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.levelPillText, { color: '#15803d' }]} maxFontSizeMultiplier={1.3}>
                      P{pathway.project_number}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.infoValueMuted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                
              </Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Evaluation Form:
            </Text>
            {pathway?.evaluation_form?.trim() ? (
              <TouchableOpacity
                style={[styles.levelPill, { backgroundColor: '#dbeafe' }]}
                onPress={() => handleOpenEvaluationForm(pathway.evaluation_form || '')}
                activeOpacity={0.85}
              >
                <Text style={[styles.levelPillText, { color: '#1d4ed8' }]} maxFontSizeMultiplier={1.2}>
                  Open
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
          </View>
        </View>

        {/* Evaluator assignment row */}
        <View
          style={[
            styles.evalRow,
            isEvaluatorBooked && styles.evalRowBooked,
            { borderTopWidth: 1, borderTopColor: theme.colors.border },
          ]}
        >
          <View style={styles.evalRowLeft}>
            {evaluatorDisplayName === 'Available to book' ? (
              <>
                <Text style={[styles.availableSlotName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {`Evaluator ${bookingSequence === 999 ? '' : bookingSequence}`.trim()}
                </Text>
                <Text style={[styles.availableSlotSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  Available to book
                </Text>
              </>
            ) : evaluatorDisplayName === 'TBA' ? (
              <>
                <Text style={[styles.availableSlotName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {`Evaluator ${bookingSequence === 999 ? '' : bookingSequence}`.trim()}
                </Text>
                <Text
                  style={[
                    styles.availableSlotSubtext,
                    { color: theme.colors.textSecondary, fontStyle: 'italic' },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  TBA
                </Text>
              </>
            ) : (
              <View style={styles.evaluatorBookedProfileRow}>
                <View style={[styles.profileAvatar, { backgroundColor: theme.colors.border }]}>
                  {evaluatorAvatarUrl ? (
                    <Image source={{ uri: evaluatorAvatarUrl }} style={styles.profileAvatarImage} />
                  ) : (
                    <User size={32} color={theme.colors.textSecondary} />
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {evaluatorDisplayName}
                  </Text>
                  <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    {`Evaluator ${bookingSequence === 999 ? '' : bookingSequence}`.trim()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.evalRowActions}>
            {pairedEvaluatorOpenRole ? (
              <TouchableOpacity
                style={[
                  styles.bookSlotButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: bookingRoleId === pairedEvaluatorOpenRole.id ? 0.7 : 1,
                  },
                ]}
                onPress={() => handleBookAvailableSlot(pairedEvaluatorOpenRole)}
                activeOpacity={0.85}
                disabled={bookingRoleId === pairedEvaluatorOpenRole.id}
              >
                <Text style={styles.bookSlotButtonText} maxFontSizeMultiplier={1.2}>
                  {bookingRoleId === pairedEvaluatorOpenRole.id ? 'Booking…' : 'Book'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {isExcomm && !pairedEvaluatorOpenRole && evaluatorDisplayName === 'TBA' && (
              <TouchableOpacity
                style={styles.evalActionBtnPrimary}
                onPress={() => openAssignModal(booking)}
                activeOpacity={0.85}
              >
                <Text style={styles.evalActionBtnPrimaryText} maxFontSizeMultiplier={1.2}>Assign</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        

        {/* Approval Status Badge */}
        {pathway?.vpe_approval_requested && (
          <View style={[styles.approvalStatusBadge, {
            backgroundColor: pathway.vpe_approved === true
              ? '#10b98130'
              : pathway.vpe_approved === false
              ? '#ef444430'
              : '#f59e0b30',
            borderWidth: 1,
            borderColor: pathway.vpe_approved === true
              ? '#10b981'
              : pathway.vpe_approved === false
              ? '#ef4444'
              : '#f59e0b'
          }]}>
            <CheckCircle size={18} color={
              pathway.vpe_approved === true
                ? '#10b981'
                : pathway.vpe_approved === false
                ? '#ef4444'
                : '#f59e0b'
            } />
            <View style={{ flex: 1, flexDirection: 'column' }}>
              <Text style={[styles.approvalStatusText, {
                color: pathway.vpe_approved === true
                  ? '#10b981'
                  : pathway.vpe_approved === false
                  ? '#ef4444'
                  : '#f59e0b'
              }]} maxFontSizeMultiplier={1.3}>
                {pathway.vpe_approved === true
                  ? 'VPE Approved'
                  : pathway.vpe_approved === false
                  ? 'VPE Denied'
                  : 'Pending VPE Approval'}
              </Text>
              {pathway.is_locked && (
                <Text style={[styles.lockedSubtext, {
                  color: theme.colors.textSecondary,
                  fontSize: 11,
                  fontStyle: 'italic',
                  marginTop: 2
                }]} maxFontSizeMultiplier={1.3}>
                  Record locked - No changes allowed
                </Text>
              )}
            </View>
          </View>
        )}

      </View>
    );
  };

  const OpenPreparedSlotCard = ({
    speakerRole,
    evaluatorRole,
    isLastCard = false,
  }: {
    speakerRole: RoleBooking;
    evaluatorRole?: RoleBooking;
    isLastCard?: boolean;
  }) => {
    const pairNumber = getSequenceNumber(speakerRole.role_name);
    const bookedEvaluatorForPair = roleBookings.find(
      (role) => isEvaluatorRole(role) && getSequenceNumber(role.role_name || '') === pairNumber
    );
    const bookedEvaluatorName = bookedEvaluatorForPair?.app_user_profiles?.full_name || '';
    const bookedEvaluatorAvatar = bookedEvaluatorForPair?.app_user_profiles?.avatar_url || null;
    return (
      <View
        style={[
          styles.participantCard,
          styles.participantCardNotionItem,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={[styles.profileHeader, { backgroundColor: theme.colors.background }]}>
          <View style={styles.profileContent}>
            <View style={[styles.profileAvatar, { backgroundColor: theme.colors.border }]}>
              <User size={24} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                Prepared Speaker {pairNumber}
              </Text>
              <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Open role
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.bookSlotButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => handleBookAvailableSlot(speakerRole)}
            disabled={bookingRoleId === speakerRole.id}
            activeOpacity={0.85}
          >
            <Text style={styles.bookSlotButtonText} maxFontSizeMultiplier={1.2}>
              {bookingRoleId === speakerRole.id ? 'Booking…' : 'Book'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.speechInfoSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitleSubsection, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Speech Information
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Title:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>{''}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Pathway:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>{''}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Project</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>{''}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Evaluation Form:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>{''}</Text>
          </View>
        </View>

        <View style={[styles.evalRow, { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
          <View style={styles.evalRowLeft}>
            {bookedEvaluatorForPair ? (
              <View style={styles.evaluatorBookedProfileRow}>
                <View style={[styles.profileAvatar, { backgroundColor: theme.colors.border }]}>
                  {bookedEvaluatorAvatar ? (
                    <Image source={{ uri: bookedEvaluatorAvatar }} style={styles.profileAvatarImage} />
                  ) : (
                    <User size={24} color={theme.colors.textSecondary} />
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {bookedEvaluatorName}
                  </Text>
                  <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Evaluator {pairNumber}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.availableSlotName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Evaluator {pairNumber}
                </Text>
                <Text style={[styles.availableSlotSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {evaluatorRole ? 'Available to book' : ''}
                </Text>
              </>
            )}
          </View>
          {evaluatorRole && !bookedEvaluatorForPair ? (
            <TouchableOpacity
              style={[
                styles.bookSlotButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: bookingRoleId === evaluatorRole.id ? 0.7 : 1,
                },
              ]}
              onPress={() => handleBookAvailableSlot(evaluatorRole)}
              disabled={bookingRoleId === evaluatorRole.id}
              activeOpacity={0.85}
            >
              <Text style={styles.bookSlotButtonText} maxFontSizeMultiplier={1.2}>
                {bookingRoleId === evaluatorRole.id ? 'Booking…' : 'Book'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading pathway progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredBookings = getFilteredBookings();
  const filteredAvailableRoles = getFilteredAvailableRoles();
  const preparedAvailableRoles = filteredAvailableRoles
    .filter((role) => isPreparedSpeakerRole(role))
    .sort((a, b) => getSequenceNumber(a.role_name) - getSequenceNumber(b.role_name));
  const preparedBookingBySeq = new Map(
    filteredBookings
      .filter((role) => isPreparedSpeakerRole(role))
      .map((role) => [getSequenceNumber(role.role_name), role])
  );
  const preparedAvailableBySeq = new Map(
    preparedAvailableRoles.map((role) => [getSequenceNumber(role.role_name), role])
  );
  const evaluatorAvailableRoleBySeq = new Map(
    filteredAvailableRoles
      .filter((role) => isEvaluatorRole(role))
      .map((role) => [getSequenceNumber(role.role_name), role])
  );
  const preparedSlotsInOrder = [1, 2, 3, 4, 5];
  const availablePairCount = preparedAvailableRoles.length;
  const currentTab = tabs.find(t => t.key === selectedTab);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
      }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Prepared Speeches
        </Text>
        <TouchableOpacity style={styles.infoButton} onPress={showPreparedSpeakerInfo}>
          <Info size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView ref={mainScrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.unifiedNotionBlock, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.unifiedMeetingSection, { borderBottomColor: theme.colors.border }]}>
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
                  Mode: {meeting.meeting_mode === 'in_person' ? 'In Person' : meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
                </Text>
              </View>
            </View>
          </View>

          {(filteredBookings.length + preparedAvailableRoles.length) > 0 ? (
            <View
              style={[
                styles.participantsNotionList,
                {
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              {preparedSlotsInOrder.map((slotNumber, idx) => {
                const bookedRole = preparedBookingBySeq.get(slotNumber);
                const openRole = preparedAvailableBySeq.get(slotNumber);
                const evaluatorRole = evaluatorAvailableRoleBySeq.get(slotNumber);
                const totalCards = preparedSlotsInOrder.length;

                if (bookedRole) {
                  return (
                    <ParticipantCard
                      key={`booked-slot-${slotNumber}-${bookedRole.id}`}
                      booking={bookedRole}
                      isLastCard={idx === totalCards - 1}
                    />
                  );
                }

                if (openRole) {
                  return (
                    <OpenPreparedSlotCard
                      key={`open-slot-${slotNumber}-${openRole.id}-${evaluatorRole?.id || 'none'}`}
                      speakerRole={openRole}
                      evaluatorRole={evaluatorRole}
                      isLastCard={idx === totalCards - 1}
                    />
                  );
                }

                return null;
              })}
            </View>
          ) : null}
        </View>

        {/* Navigation Quick Actions */}
        <View style={[styles.quickActionsBoxContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                <Bell size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId, initialTab: 'my_bookings' } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#f97316" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational Corner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/general-evaluator-notes', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Star size={FOOTER_NAV_ICON_SIZE} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#8b5cf6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Mic size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote Speaker</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Quick Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role Completion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FECACA' }]}>
                <FileBarChart size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Evaluation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                <Clock size={FOOTER_NAV_ICON_SIZE} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <MessageSquare size={FOOTER_NAV_ICON_SIZE} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Table Topics</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={assignModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.assignModalCard, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}>
            <View style={styles.assignModalHeader}>
              <Text style={styles.assignModalTitle} maxFontSizeMultiplier={1.2}>
                Assign evaluator
              </Text>
              <TouchableOpacity onPress={() => setAssignModalOpen(false)} activeOpacity={0.8} style={styles.assignModalCloseBtn}>
                <X size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={evaluatorSearchQuery}
              onChangeText={setEvaluatorSearchQuery}
              placeholder="Search member"
              placeholderTextColor="#9CA3AF"
              style={styles.assignSearchInput}
              autoCapitalize="none"
            />

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {Object.values(userProfiles)
                .filter((p) => {
                  const q = evaluatorSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return p.full_name.toLowerCase().includes(q);
                })
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.assignRow}
                    activeOpacity={0.85}
                    onPress={async () => {
                      if (!assignTargetBooking) return;
                      await upsertAssignedEvaluator(assignTargetBooking, p.id);
                      setAssignModalOpen(false);
                      setAssignTargetBooking(null);
                    }}
                  >
                    <Text style={styles.assignRowName} maxFontSizeMultiplier={1.2}>
                      {p.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                Prepared Speaker 🎤
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
              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                All the best for your speech!
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, marginBottom: 0 }]} maxFontSizeMultiplier={1.3}>
                Kindly add your speech details (title, pathway, level, and project) and upload your evaluation form. Your VPE will assign an evaluator, and you may connect with your mentor for guidance and rehearsal.
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
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    letterSpacing: -0.5,
  },
  infoButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  unifiedNotionBlock: {
    marginHorizontal: 13,
    marginTop: 13,
    marginBottom: 24,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  unifiedMeetingSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  unifiedSectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
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
  categoryTabsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabActive: {
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  participantsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  participantCard: {
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'visible',
    width: '100%',
  },
  participantCardNotionItem: {
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 0,
    borderRadius: 14,
    overflow: 'hidden',
  },
  participantsNotionBox: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  participantsNotionList: {
    overflow: 'hidden',
    paddingBottom: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 0,
  },
  speechInfoSection: {
    padding: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  sectionTitleSubsection: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 120,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoValueMuted: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  infoValueRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: 8,
  },
  infoOpenButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoOpenButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  evaluatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  evaluatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  evaluatorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  evaluatorInfo: {
    flex: 1,
  },
  evaluatorLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  evaluatorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  evaluationInfoSection: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  evaluationFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  evaluationFormLabel: {
    flex: 1,
  },
  evaluatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  evaluatorIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  evaluatorAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  evaluatorInfoInline: {
    flex: 1,
  },
  evaluatorLabelSmall: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  evaluatorNameInline: {
    fontSize: 15,
    fontWeight: '600',
  },
  openFormButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  openFormButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  approvalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
  },
  approvalStatusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonsContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  approvalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  approvalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyStateSubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  bookRoleButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  bookRoleButtonText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  availableSlotsSection: {
    marginTop: 24,
  },
  availableHeader: {
    marginBottom: 12,
  },
  availableTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  availableSlotCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  availableSlotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  availableSlotPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  availableSlotPairInfo: {
    flex: 1,
    minWidth: 0,
  },
  availableSlotPairDivider: {
    height: 1,
    marginVertical: 10,
  },
  availableSlotIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableSlotInfo: {
    flex: 1,
  },
  availableSlotName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  availableSlotSubtext: {
    fontSize: 14,
  },
  bookSlotButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookSlotButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  textInputModal: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 40,
  },
  textAreaModal: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 92,
    lineHeight: 19,
  },
  formRowGap: {
    gap: 12,
  },
  saveInfoButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
  },
  saveInfoButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  inlineEditSection: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  speechDetailsTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  speechFormLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  speechInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 14,
    minHeight: 50,
  },
  speechTextArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 160,
    lineHeight: 20,
  },
  speechSegmentWrap: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  speechSegmentBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speechSegmentBtnActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  speechSegmentBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  speechUploadButton: {
    minHeight: 50,
    borderRadius: 10,
  },
  detailsToggleBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 2,
  },
  evalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  evalRowBooked: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  evalRowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  evalRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  evalRowValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  evalRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  evaluatorBookedProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  evalActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  evalActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  evalActionBtnPrimary: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  evalActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  evalTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  evalTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flex: 1,
  },
  evalTypeBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  uploadButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  uploadButtonInlineText: {
    fontSize: 13,
    fontWeight: '700',
  },
  uploadedFileInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  uploadedFileInlineName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  readOnlyPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  readOnlyPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  assignModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  assignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  assignModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  assignModalCloseBtn: {
    padding: 6,
  },
  assignSearchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
  },
  assignRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  assignRowName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
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
  quickActionsBoxContainer: {
    borderTopWidth: 0,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 6,
  },
  quickActionItem: {
    alignItems: 'center',
    minWidth: 45,
  },
  quickActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  quickActionLabel: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveConfirmModalCard: {
    width: '92%',
    maxWidth: 460,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  saveConfirmModalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  saveConfirmModalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  saveConfirmRows: {
    gap: 6,
  },
  saveConfirmRow: {
    fontSize: 13,
    lineHeight: 18,
  },
  saveConfirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  saveConfirmEditBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveConfirmEditBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveConfirmSaveBtn: {
    flex: 1.2,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveConfirmSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});