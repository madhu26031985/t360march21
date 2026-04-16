import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { prefetchToastmasterCorner } from '@/lib/prefetchToastmasterCorner';
import { Building2, Clock, Lock, FileText, ChevronRight, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';
import { MeetingRolesTabPanel } from '@/components/MeetingRolesTabPanel';
import { MeetingActionsTabPanel } from '@/components/MeetingActionsTabPanel';
import { MeetingEvaluationTabPanel } from '@/components/MeetingEvaluationTabPanel';
import type { MeetingFlowTab } from '@/lib/meetingTabsCatalog';

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
  meeting_day: string | null;
  isPlaceholder?: boolean;
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
}

function FeatureCard({ title, description, icon, onPress }: FeatureCardProps) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity style={[styles.featureCard, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.featureTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ClubMeetings() {
  const { theme } = useTheme();
  const { user, isAuthenticated, refreshUserProfile } = useAuth();
  const queryClient = useQueryClient();
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [nextMeetings, setNextMeetings] = useState<Meeting[]>([]);
  /** Completed (`close`) meetings for Meeting History section */
  const [meetingHistory, setMeetingHistory] = useState<Meeting[]>([]);
  const [expandedHistoryMeetingId, setExpandedHistoryMeetingId] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [expandedNextMeeting, setExpandedNextMeeting] = useState<string | null>(null);
  const [openMeetingTab, setOpenMeetingTab] = useState<'actions' | 'roles' | 'evaluation'>('actions');
  /** Expand/collapse the open meeting card (tabs + actions) to reduce scrolling */
  const [openMeetingDetailExpanded, setOpenMeetingDetailExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnlyOneOpenMeeting, setHasOnlyOneOpenMeeting] = useState(false);
  const [vpeName, setVpeName] = useState<string>('VPE');
  const [tmodNeedsThemeByMeeting, setTmodNeedsThemeByMeeting] = useState<Record<string, boolean>>({});
  const [educationalSpeakerNeedsByMeeting, setEducationalSpeakerNeedsByMeeting] = useState<Record<string, boolean>>({});
  const [keynoteSpeakerNeedsByMeeting, setKeynoteSpeakerNeedsByMeeting] = useState<Record<string, boolean>>({});
  const [preparedSpeakerNeedsByMeeting, setPreparedSpeakerNeedsByMeeting] = useState<Record<string, boolean>>({});
  const [grammarianNeedsWotdByMeeting, setGrammarianNeedsWotdByMeeting] = useState<Record<string, boolean>>({});
  const [bookRoleNoRolesByMeeting, setBookRoleNoRolesByMeeting] = useState<Record<string, boolean>>({});
  /** Booked Toastmaster's avatar URL per meeting (for all members to see) */
  const [toastmasterBookedAvatarByMeeting, setToastmasterBookedAvatarByMeeting] = useState<
    Record<string, string | null>
  >({});
  /** Booked Toastmaster's user id per meeting (for merging with local avatar fallback) */
  const [toastmasterBookedUserIdByMeeting, setToastmasterBookedUserIdByMeeting] = useState<
    Record<string, string | null>
  >({});
  /** Signed-in user's avatar (Profile tab); used if meeting query omits URL but user is TM */
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  /** Booked role avatar URL lists per meeting (Speaking + Grammarian rows) */
  const [grammarianAvatarsByMeeting, setGrammarianAvatarsByMeeting] = useState<Record<string, string[]>>({});
  const [educationalSpeakerAvatarsByMeeting, setEducationalSpeakerAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [preparedSpeakerAvatarsByMeeting, setPreparedSpeakerAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [keynoteSpeakerAvatarsByMeeting, setKeynoteSpeakerAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [generalEvaluatorAvatarsByMeeting, setGeneralEvaluatorAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [tableTopicsMasterAvatarsByMeeting, setTableTopicsMasterAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [timerAvatarsByMeeting, setTimerAvatarsByMeeting] = useState<Record<string, string[]>>({});
  const [ahCounterAvatarsByMeeting, setAhCounterAvatarsByMeeting] = useState<Record<string, string[]>>({});
  const lastRefreshTime = useRef<number>(0);
  const hasLoadedOnce = useRef<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (user?.currentClubId) {
      Promise.all([loadOpenMeetings(), loadVPEInfo()]);
    } else if (!hasLoadedOnce.current) {
      setIsLoading(false);
    }
  }, [user?.currentClubId]);

  useEffect(() => {
    setOpenMeetingDetailExpanded(true);
  }, [currentMeeting?.id]);

  useEffect(() => {
    if (!user?.id) {
      setCurrentUserAvatarUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('app_user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const url = (data as { avatar_url?: string | null } | null)?.avatar_url?.trim();
      if (error || !url) setCurrentUserAvatarUrl(null);
      else setCurrentUserAvatarUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      (async () => {
        const { data } = await supabase
          .from('app_user_profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const url = (data as { avatar_url?: string | null } | null)?.avatar_url?.trim();
        setCurrentUserAvatarUrl(url || null);
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastRefresh = (now - lastRefreshTime.current) / 1000;

      // Only refresh if more than 30 seconds have passed
      if (timeSinceLastRefresh < 30) {
        return;
      }

      lastRefreshTime.current = now;

      if (user?.currentClubId) {
        const tasks: Promise<void>[] = [loadOpenMeetings(), loadVPEInfo()];
        if (isAuthenticated) tasks.push(refreshUserProfile());
        Promise.all(tasks);
      }
    }, [user?.currentClubId, isAuthenticated, refreshUserProfile])
  );

  useEffect(() => {
    const meetingIds: string[] = [];
    if (currentMeeting?.id && !currentMeeting?.isPlaceholder) meetingIds.push(currentMeeting.id);
    nextMeetings.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !m.id.startsWith('placeholder')) meetingIds.push(m.id);
    });
    meetingHistory.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !String(m.id).startsWith('placeholder')) meetingIds.push(m.id);
    });
    if (meetingIds.length === 0 || !user?.id) {
      setTmodNeedsThemeByMeeting({});
      setEducationalSpeakerNeedsByMeeting({});
      setKeynoteSpeakerNeedsByMeeting({});
      setPreparedSpeakerNeedsByMeeting({});
      setGrammarianNeedsWotdByMeeting({});
      setToastmasterBookedAvatarByMeeting({});
      setToastmasterBookedUserIdByMeeting({});
      setGrammarianAvatarsByMeeting({});
      setEducationalSpeakerAvatarsByMeeting({});
      setPreparedSpeakerAvatarsByMeeting({});
      setKeynoteSpeakerAvatarsByMeeting({});
      setGeneralEvaluatorAvatarsByMeeting({});
      setTableTopicsMasterAvatarsByMeeting({});
      setTimerAvatarsByMeeting({});
      setAhCounterAvatarsByMeeting({});
      return;
    }
    let cancelled = false;
    (async () => {
      const isMeetingCompletedForAlerts = (m: Meeting) => {
        if (!m?.meeting_date) return false;
        const now = new Date();
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const meetingMidnight = new Date(`${m.meeting_date}T00:00:00`);
        const diffDays = meetingMidnight.getTime() - nowMidnight.getTime();
        const daysToGo = Math.ceil(diffDays / (1000 * 60 * 60 * 24));
        if (daysToGo < 0) return true;
        const hasTimes = !!(m.meeting_start_time || m.meeting_end_time);
        if (!hasTimes) return false;
        const endTime = m.meeting_end_time || '23:59:59';
        const endParts = endTime.split(':').map(Number);
        const meetingEnd = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          endParts[0] || 0,
          endParts[1] || 0,
          0
        );
        return now > meetingEnd;
      };

      const meetingById = new Map<string, Meeting>();
      if (currentMeeting?.id && !currentMeeting?.isPlaceholder) {
        meetingById.set(currentMeeting.id, currentMeeting);
      }
      nextMeetings.forEach((mt) => {
        if (mt?.id && !mt?.isPlaceholder && !String(mt.id).startsWith('placeholder')) {
          meetingById.set(mt.id, mt);
        }
      });
      meetingHistory.forEach((mt) => {
        if (mt?.id && !mt?.isPlaceholder && !String(mt.id).startsWith('placeholder')) {
          meetingById.set(mt.id, mt);
        }
      });

      const pathwayHasSpeechDetails = (p: {
        speech_title?: string | null;
        pathway_name?: string | null;
        level?: number | null;
        project_name?: string | null;
        evaluation_form?: string | null;
        comments_for_evaluator?: string | null;
      } | null) =>
        !!(
          p &&
          (p.speech_title?.trim() ||
            p.pathway_name?.trim() ||
            p.level != null ||
            p.project_name?.trim() ||
            p.evaluation_form?.trim() ||
            p.comments_for_evaluator?.trim())
        );

      const tmodResult: Record<string, boolean> = {};
      const tmodAvatarResult: Record<string, string | null> = {};
      const tmodBookedUserIdResult: Record<string, string | null> = {};
      const edResult: Record<string, boolean> = {};
      const keynoteResult: Record<string, boolean> = {};
      const preparedResult: Record<string, boolean> = {};
      const grammarianResult: Record<string, boolean> = {};
      const grammarianAvatarsResult: Record<string, string[]> = {};
      const educationalAvatarsResult: Record<string, string[]> = {};
      const preparedAvatarsResult: Record<string, string[]> = {};
      const keynoteAvatarsResult: Record<string, string[]> = {};
      const generalEvaluatorAvatarsResult: Record<string, string[]> = {};
      const tableTopicsMasterAvatarsResult: Record<string, string[]> = {};
      const timerAvatarsResult: Record<string, string[]> = {};
      const ahCounterAvatarsResult: Record<string, string[]> = {};

      const fetchOrderedAvatarUrls = async (
        meetingId: string,
        kind:
          | 'grammarian'
          | 'educational'
          | 'prepared'
          | 'keynote'
          | 'general_evaluator'
          | 'table_topic_master'
          | 'timer'
          | 'ah_counter'
      ): Promise<string[]> => {
        let q;
        if (kind === 'grammarian') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%grammarian%');
        } else if (kind === 'educational') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .eq('role_name', 'Educational Speaker');
        } else if (kind === 'keynote') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%keynote speaker%');
        } else if (kind === 'general_evaluator') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%general evaluator%');
        } else if (kind === 'table_topic_master') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .or('role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%');
        } else if (kind === 'timer') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .eq('role_name', 'Timer');
        } else if (kind === 'ah_counter') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%Ah Counter%');
        } else {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%,role_name.ilike.%ice%breaker%');
        }
        const { data, error } = await q;
        if (cancelled || error || !data?.length) return [];
        const seen = new Set<string>();
        const orderedIds: string[] = [];
        for (const row of data as { assigned_user_id: string | null }[]) {
          const id = row.assigned_user_id;
          if (id && !seen.has(id)) {
            seen.add(id);
            orderedIds.push(id);
          }
        }
        if (!orderedIds.length) return [];
        const { data: profiles, error: pErr } = await supabase
          .from('app_user_profiles')
          .select('id, avatar_url')
          .in('id', orderedIds);
        if (cancelled || pErr || !profiles?.length) return [];
        const urlById = new Map(
          (profiles as { id: string; avatar_url: string | null }[]).map((p) => [
            p.id,
            (p.avatar_url || '').trim() || null,
          ])
        );
        return orderedIds.map((id) => urlById.get(id)).filter((u): u is string => !!u);
      };

      for (const mid of meetingIds) {
        if (cancelled) break;
        const { data: roleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', mid)
          .ilike('role_name', '%toastmaster%')
          .eq('booking_status', 'booked')
          .limit(1);
        const role = Array.isArray(roleData) && roleData.length > 0 ? roleData[0] : null;
        const tmodBookedUserId = role?.assigned_user_id as string | undefined;
        tmodBookedUserIdResult[mid] = tmodBookedUserId || null;
        if (!tmodBookedUserId) {
          tmodAvatarResult[mid] = null;
        } else {
          const { data: tmodProfile, error: tmodProfErr } = await supabase
            .from('app_user_profiles')
            .select('avatar_url')
            .eq('id', tmodBookedUserId)
            .maybeSingle();
          const avatarUrl = tmodProfErr
            ? null
            : (tmodProfile as { avatar_url?: string | null } | null)?.avatar_url?.trim() || null;
          tmodAvatarResult[mid] = avatarUrl;
        }
        const isCurrentUserTmod = role && role.assigned_user_id === user.id;
        if (!isCurrentUserTmod) {
          tmodResult[mid] = false;
        } else {
          const { data: themeData } = await supabase
            .from('toastmaster_meeting_data')
            .select('theme_of_the_day')
            .eq('meeting_id', mid)
            .eq('toastmaster_user_id', user.id)
            .maybeSingle();
          const hasTheme = !!(themeData?.theme_of_the_day?.trim());
          tmodResult[mid] = !hasTheme;
        }
        const { data: edRoleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', mid)
          .eq('role_name', 'Educational Speaker')
          .eq('role_status', 'Available')
          .eq('booking_status', 'booked')
          .limit(1);
        const edRole = Array.isArray(edRoleData) && edRoleData.length > 0 ? edRoleData[0] : null;
        const isCurrentUserEdSpeaker = edRole && edRole.assigned_user_id === user.id;
        if (!isCurrentUserEdSpeaker) {
          edResult[mid] = false;
        } else {
          const { data: contentData } = await supabase
            .from('app_meeting_educational_speaker')
            .select('speech_title')
            .eq('meeting_id', mid)
            .eq('speaker_user_id', user.id)
            .maybeSingle();
          const hasContent = !!(contentData?.speech_title?.trim());
          edResult[mid] = !hasContent;
        }
        const { data: keynoteRoleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', mid)
          .ilike('role_name', '%keynote speaker%')
          .eq('booking_status', 'booked')
          .limit(1);
        const keynoteRole = Array.isArray(keynoteRoleData) && keynoteRoleData.length > 0 ? keynoteRoleData[0] : null;
        const isCurrentUserKeynote = keynoteRole && keynoteRole.assigned_user_id === user.id;
        if (!isCurrentUserKeynote) {
          keynoteResult[mid] = false;
        } else {
          const { data: keynoteContentData } = await supabase
            .from('app_meeting_keynote_speaker')
            .select('speech_title')
            .eq('meeting_id', mid)
            .eq('speaker_user_id', user.id)
            .maybeSingle();
          const hasKeynoteContent = !!(keynoteContentData?.speech_title?.trim());
          keynoteResult[mid] = !hasKeynoteContent;
        }

        const mt = meetingById.get(mid);
        const completed = mt ? isMeetingCompletedForAlerts(mt) : false;
        if (completed) {
          preparedResult[mid] = false;
          grammarianResult[mid] = false;
        } else {
          const { data: psRoles, error: rolesErr } = await supabase
            .from('app_meeting_roles_management')
            .select('role_name')
            .eq('meeting_id', mid)
            .eq('assigned_user_id', user.id)
            .eq('booking_status', 'booked')
            .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%,role_name.ilike.%ice%breaker%');

          if (rolesErr || cancelled) {
            preparedResult[mid] = false;
          } else if (!psRoles?.length) {
            preparedResult[mid] = false;
          } else {
            const { data: pathways, error: pathErr } = await supabase
              .from('app_evaluation_pathway')
              .select(
                'role_name, speech_title, pathway_name, level, project_name, evaluation_form, comments_for_evaluator'
              )
              .eq('meeting_id', mid)
              .eq('user_id', user.id);

            if (pathErr || cancelled) {
              preparedResult[mid] = false;
            } else {
              const byRole = new Map((pathways || []).map((row: { role_name: string }) => [row.role_name, row]));
              let needsPrepared = false;
              for (const row of psRoles) {
                const p = byRole.get(row.role_name);
                if (!pathwayHasSpeechDetails(p || null)) {
                  needsPrepared = true;
                  break;
                }
              }
              preparedResult[mid] = needsPrepared;
            }
          }

          const { data: gRole, error: gErr } = await supabase
            .from('app_meeting_roles_management')
            .select('id')
            .eq('meeting_id', mid)
            .eq('assigned_user_id', user.id)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%grammarian%')
            .limit(1)
            .maybeSingle();

          if (gErr || cancelled || !gRole) {
            grammarianResult[mid] = false;
          } else {
            const [dailyRes, wotdRes] = await Promise.all([
              supabase
                .from('app_grammarian_daily_elements')
                .select('word_of_the_day')
                .eq('meeting_id', mid)
                .eq('grammarian_user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from('grammarian_word_of_the_day')
                .select('word, grammarian_user_id')
                .eq('meeting_id', mid)
                .maybeSingle(),
            ]);
            if (cancelled) {
              grammarianResult[mid] = false;
            } else {
              const dailyWord = (dailyRes.data?.word_of_the_day || '').trim();
              const wotd = wotdRes.data;
              const structuredWord =
                wotd && wotd.grammarian_user_id === user.id ? (wotd.word || '').trim() : '';
              grammarianResult[mid] = !(dailyWord || structuredWord);
            }
          }
        }

        if (!cancelled) {
          const [
            gAv,
            eAv,
            pAv,
            knAv,
            geAv,
            ttmAv,
            timerAv,
            ahAv,
          ] = await Promise.all([
            fetchOrderedAvatarUrls(mid, 'grammarian'),
            fetchOrderedAvatarUrls(mid, 'educational'),
            fetchOrderedAvatarUrls(mid, 'prepared'),
            fetchOrderedAvatarUrls(mid, 'keynote'),
            fetchOrderedAvatarUrls(mid, 'general_evaluator'),
            fetchOrderedAvatarUrls(mid, 'table_topic_master'),
            fetchOrderedAvatarUrls(mid, 'timer'),
            fetchOrderedAvatarUrls(mid, 'ah_counter'),
          ]);
          grammarianAvatarsResult[mid] = gAv;
          educationalAvatarsResult[mid] = eAv;
          preparedAvatarsResult[mid] = pAv;
          keynoteAvatarsResult[mid] = knAv;
          generalEvaluatorAvatarsResult[mid] = geAv;
          tableTopicsMasterAvatarsResult[mid] = ttmAv;
          timerAvatarsResult[mid] = timerAv;
          ahCounterAvatarsResult[mid] = ahAv;
        }
      }
      if (!cancelled) {
        setTmodNeedsThemeByMeeting(tmodResult);
        setToastmasterBookedAvatarByMeeting(tmodAvatarResult);
        setToastmasterBookedUserIdByMeeting(tmodBookedUserIdResult);
        setEducationalSpeakerNeedsByMeeting(edResult);
        setKeynoteSpeakerNeedsByMeeting(keynoteResult);
        setPreparedSpeakerNeedsByMeeting(preparedResult);
        setGrammarianNeedsWotdByMeeting(grammarianResult);
        setGrammarianAvatarsByMeeting(grammarianAvatarsResult);
        setEducationalSpeakerAvatarsByMeeting(educationalAvatarsResult);
        setPreparedSpeakerAvatarsByMeeting(preparedAvatarsResult);
        setKeynoteSpeakerAvatarsByMeeting(keynoteAvatarsResult);
        setGeneralEvaluatorAvatarsByMeeting(generalEvaluatorAvatarsResult);
        setTableTopicsMasterAvatarsByMeeting(tableTopicsMasterAvatarsResult);
        setTimerAvatarsByMeeting(timerAvatarsResult);
        setAhCounterAvatarsByMeeting(ahCounterAvatarsResult);
      }
    })();
    return () => { cancelled = true; };
  }, [currentMeeting, nextMeetings, meetingHistory, user?.id]);

  const refreshBookRoleAttention = useCallback(() => {
    if (!user?.id || !user?.currentClubId) {
      setBookRoleNoRolesByMeeting({});
      return;
    }
    const r = (user.clubRole || user.role || '').toLowerCase();
    if (r === 'guest') {
      setBookRoleNoRolesByMeeting({});
      return;
    }
    const ids = new Set<string>();
    if (currentMeeting?.id && !currentMeeting.isPlaceholder) ids.add(currentMeeting.id);
    nextMeetings.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !String(m.id).startsWith('placeholder')) ids.add(m.id);
    });
    meetingHistory.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !String(m.id).startsWith('placeholder')) ids.add(m.id);
    });
    if (selectedMeeting?.id && !selectedMeeting.isPlaceholder) ids.add(selectedMeeting.id);
    if (expandedNextMeeting && !String(expandedNextMeeting).startsWith('placeholder')) {
      ids.add(expandedNextMeeting);
    }
    if (expandedHistoryMeetingId && !String(expandedHistoryMeetingId).startsWith('placeholder')) {
      ids.add(expandedHistoryMeetingId);
    }
    if (ids.size === 0) {
      setBookRoleNoRolesByMeeting({});
      return;
    }

    const isMeetingCompletedForHighlight = (m: Meeting) => {
      if (!m?.meeting_date) return false;

      const now = new Date();
      const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const meetingMidnight = new Date(`${m.meeting_date}T00:00:00`);

      const diffDays = meetingMidnight.getTime() - nowMidnight.getTime();
      const daysToGo = Math.ceil(diffDays / (1000 * 60 * 60 * 24));
      if (daysToGo < 0) return true;

      const hasTimes = !!(m.meeting_start_time || m.meeting_end_time);
      if (!hasTimes) return false;

      const endTime = m.meeting_end_time || '23:59:59';
      const endParts = endTime.split(':').map(Number);
      const meetingEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endParts[0] || 0, endParts[1] || 0, 0);
      return now > meetingEnd;
    };

    let cancelled = false;
    (async () => {
      const next: Record<string, boolean> = {};

      const meetingById = new Map<string, Meeting>();
      if (currentMeeting?.id && !currentMeeting.isPlaceholder) meetingById.set(currentMeeting.id, currentMeeting);
      nextMeetings.forEach((m) => {
        if (m?.id && !m?.isPlaceholder) meetingById.set(m.id, m);
      });
      if (selectedMeeting?.id && !selectedMeeting.isPlaceholder) meetingById.set(selectedMeeting.id, selectedMeeting);
      if (expandedNextMeeting && !String(expandedNextMeeting).startsWith('placeholder')) {
        // We may not have the full object here, so completion-by-time only applies when meetingById has it.
      }

      for (const mid of ids) {
        const m = meetingById.get(mid);
        if (m && isMeetingCompletedForHighlight(m)) {
          next[mid] = false;
          continue;
        }

        const { count, error } = await supabase
          .from('app_meeting_roles_management')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', user.currentClubId)
          .eq('meeting_id', mid)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked');
        next[mid] = !error && (count ?? 0) === 0;
      }
      if (!cancelled) setBookRoleNoRolesByMeeting(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.currentClubId, user?.clubRole, user?.role, currentMeeting, nextMeetings, meetingHistory, selectedMeeting, expandedNextMeeting, expandedHistoryMeetingId]);

  useEffect(() => {
    const cleanup = refreshBookRoleAttention();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [refreshBookRoleAttention]);

  useFocusEffect(
    useCallback(() => {
      const cleanup = refreshBookRoleAttention();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [refreshBookRoleAttention])
  );

  const loadVPEInfo = async () => {
    if (!user?.currentClubId) return;

    setVpeName('VPE');

    try {
      // Optimized single query with join - fetches VPE name in one call
      const { data: clubProfile, error } = await supabase
        .from('club_profiles')
        .select(`
          vpe_id,
          app_user_profiles!club_profiles_vpe_id_fkey (
            full_name
          )
        `)
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (error) {
        console.error('Error loading VPE info:', error);
        return;
      }

      // Access the joined VPE profile data
      const vpeProfile = clubProfile?.app_user_profiles as { full_name: string } | null;
      if (vpeProfile?.full_name) {
        setVpeName(vpeProfile.full_name);
      }
    } catch (error) {
      console.error('Error loading VPE info:', error);
    }
  };

  const loadOpenMeetings = async () => {
    if (!user?.currentClubId) {
      setMeetingHistory([]);
      setExpandedHistoryMeetingId(null);
      if (!hasLoadedOnce.current) {
        setIsLoading(false);
      }
      return;
    }

    const isFirstLoad = !hasLoadedOnce.current;
    if (isFirstLoad) setIsLoading(true);

    try {
      const fourHoursAgo = new Date();
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
      const cutoffDate = fourHoursAgo.toISOString().split('T')[0];

      const meetingSelect =
        'id, meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, meeting_location, meeting_link, meeting_status, meeting_day';

      const [openRes, historyRes] = await Promise.all([
        supabase
          .from('app_club_meeting')
          .select(meetingSelect)
          .eq('club_id', user.currentClubId)
          .eq('meeting_status', 'open')
          .gte('meeting_date', cutoffDate)
          .order('meeting_date', { ascending: true })
          .order('meeting_start_time', { ascending: true }),
        supabase
          .from('app_club_meeting')
          .select(meetingSelect)
          .eq('club_id', user.currentClubId)
          .eq('meeting_status', 'close')
          .order('meeting_date', { ascending: false })
          .order('meeting_start_time', { ascending: false })
          .limit(50),
      ]);

      const { data: openData, error: openError } = openRes;
      const { data: historyData, error: historyError } = historyRes;

      if (historyError) {
        console.error('Error loading meeting history:', historyError);
        setMeetingHistory([]);
      } else {
        setMeetingHistory(historyData || []);
      }

      if (openError) {
        console.error('Error loading open meetings:', openError);
        setIsLoading(false);
        return;
      }

      const allOpenMeetings = openData || [];

      const now = new Date();
      const openMeetings = allOpenMeetings.filter(meeting => {
        const meetingEndDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`);
        const hoursSinceMeetingEnd = (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
        return hoursSinceMeetingEnd < 4;
      });

      if (openMeetings.length > 0) {
        setCurrentMeeting(openMeetings[0]);
        setHasOnlyOneOpenMeeting(openMeetings.length === 1);

        const nextOpenMeetings = openMeetings.slice(1, 3);

        const totalMeetingsNeeded = 3;
        const placeholdersNeeded = Math.max(0, totalMeetingsNeeded - openMeetings.length);

        const placeholders: Meeting[] = Array.from({ length: placeholdersNeeded }, (_, index) => ({
          id: `placeholder-${index}`,
          meeting_title: 'Coming Soon',
          meeting_date: '',
          meeting_number: null,
          meeting_start_time: null,
          meeting_end_time: null,
          meeting_mode: '',
          meeting_location: null,
          meeting_link: null,
          meeting_status: 'placeholder',
          meeting_day: null,
          isPlaceholder: true,
        }));

        setNextMeetings([...nextOpenMeetings, ...placeholders].slice(0, 2));
      } else {
        setCurrentMeeting(null);
        setNextMeetings([]);
        setHasOnlyOneOpenMeeting(false);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      hasLoadedOnce.current = true;
      if (isFirstLoad) setIsLoading(false);
    }
  };

  const handleNextMeetingPress = (meetingId: string) => {
    if (expandedNextMeeting === meetingId) {
      setExpandedNextMeeting(null);
    } else {
      setExpandedNextMeeting(meetingId);
      setOpenMeetingTab('actions');
    }
  };

  const handleTabPress = (tab: MeetingFlowTab, meetingId: string) => {
    if (tab.route) {
      let routeWithId = tab.route.replace('meetingId=undefined', `meetingId=${meetingId}`);
      if (tab.id === 'toastmaster_corner') {
        prefetchToastmasterCorner(queryClient, meetingId, user?.id, user?.currentClubId);
      }
      if (tab.id === 'toastmaster_corner' && tmodNeedsThemeByMeeting[meetingId]) {
        routeWithId += '&showCongrats=1';
      }
      if (tab.id === 'educational_corner' && educationalSpeakerNeedsByMeeting[meetingId]) {
        routeWithId += '&showCongrats=1';
      }
      if (tab.id === 'keynote_speaker' && keynoteSpeakerNeedsByMeeting[meetingId]) {
        routeWithId += '&showCongrats=1';
      }
      router.push(routeWithId as Href);
      return;
    }

    if (tab.comingSoon) {
      Alert.alert('Coming Soon', `${tab.title} will be available in a future update.`);
      return;
    }

    if (tab.id === 'overview') {
      router.push(`/quick-overview?meetingId=${meetingId}` as Href);
      return;
    }

    if (tab.id === 'book_role') {
      router.push(`/book-a-role?meetingId=${meetingId}` as Href);
      return;
    }

    if (tab.id === 'live_voting') {
      router.push(`/live-voting?meetingId=${meetingId}` as Href);
      return;
    }
  };

  const renderActionsTabContent = (meetingId: string) => (
    <MeetingActionsTabPanel
      meetingId={meetingId}
      bookRoleShowAttention={bookRoleNoRolesByMeeting[meetingId] === true}
      onTabPress={(tab) => handleTabPress(tab, meetingId)}
      onOpenClubReports={() => router.push('/meeting-reports')}
    />
  );

  const renderRolesTabContent = (meetingId: string) => {
    const tmBookedUserId = toastmasterBookedUserIdByMeeting[meetingId];
    const tmAvatarFromDb = toastmasterBookedAvatarByMeeting[meetingId]?.trim() || null;
    const toastmasterDisplayAvatarUrl =
      tmAvatarFromDb ||
      (tmBookedUserId && user?.id === tmBookedUserId ? currentUserAvatarUrl : null) ||
      null;
    const toastmasterAvatarUrlsForCard = toastmasterDisplayAvatarUrl
      ? [toastmasterDisplayAvatarUrl]
      : [];

    return (
      <MeetingRolesTabPanel
        meetingId={meetingId}
        onTabPress={(tab) => handleTabPress(tab, meetingId)}
        roleUi={{
          tmodNeedsAlert: tmodNeedsThemeByMeeting[meetingId] === true,
          educationalSpeakerNeedsAlert: educationalSpeakerNeedsByMeeting[meetingId] === true,
          keynoteSpeakerNeedsAlert: keynoteSpeakerNeedsByMeeting[meetingId] === true,
          preparedSpeakerNeedsAlert: preparedSpeakerNeedsByMeeting[meetingId] === true,
          grammarianNeedsAlert: grammarianNeedsWotdByMeeting[meetingId] === true,
          toastmasterAvatarUrls: toastmasterAvatarUrlsForCard,
          generalEvaluatorAvatarUrls: generalEvaluatorAvatarsByMeeting[meetingId] ?? [],
          tableTopicsMasterAvatarUrls: tableTopicsMasterAvatarsByMeeting[meetingId] ?? [],
          preparedSpeakerAvatarUrls: preparedSpeakerAvatarsByMeeting[meetingId],
          educationalSpeakerAvatarUrls: educationalSpeakerAvatarsByMeeting[meetingId],
          keynoteSpeakerAvatarUrls: keynoteSpeakerAvatarsByMeeting[meetingId],
          timerAvatarUrls: timerAvatarsByMeeting[meetingId],
          ahCounterAvatarUrls: ahCounterAvatarsByMeeting[meetingId],
          grammarianAvatarUrls: grammarianAvatarsByMeeting[meetingId],
        }}
      />
    );
  };

  const renderEvaluationTabContent = (meetingId: string) => (
    <MeetingEvaluationTabPanel meetingId={meetingId} onTabPress={(tab) => handleTabPress(tab, meetingId)} />
  );

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const handleFeaturePress = (featurePath: string) => {
    // Check if user has a club
    if (!user?.currentClubId) {
      Alert.alert(
        'Join a Club',
        'To access this feature, please join a club by reaching out to your ExComm or create a club under Settings.',
        [
          {
            text: 'Create Club',
            onPress: () => router.push('/create-club'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    // User has a club, navigate to the feature
    router.push(featurePath as any);
  };

  // Early return if user is not loaded yet
  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Meetings</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Meetings</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {user?.currentClubId ? (
          <View style={[styles.meetingsMasterBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <ClubSwitcher
              showRole={true}
              embedded
              variant="notion"
              clubIconBackgroundColor="#F1F5F9"
              clubIconColor="#334155"
            />
            <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
            {/* Open Meetings Section */}
            <View style={styles.meetingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Open Meetings
            </Text>

            {isLoading ? (
              <View style={[styles.noMeetingsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.noMeetingsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Loading meetings...
                </Text>
              </View>
            ) : currentMeeting ? (
              <View style={styles.meetingsList}>
                {(() => {
                  const meetingDate = new Date(currentMeeting.meeting_date);
                  const isToday = new Date().toDateString() === meetingDate.toDateString();
                  const dayNum = meetingDate.getDate();
                  const month = meetingDate.toLocaleString('default', { month: 'short' }).toUpperCase();

                  return (
                    <View key={currentMeeting.id}>
                      {openMeetingDetailExpanded ? (
                        /* Unified expanded box - meeting bar + tabs + content in one card */
                        <View style={[styles.unifiedExpandedMeetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                          <View style={styles.unifiedMeetingBar}>
                            <View style={styles.heroCardContent}>
                              <View style={[styles.dateBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                                <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                              </View>
                              <View style={styles.heroMeetingInfo}>
                                <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{currentMeeting.meeting_title}</Text>
                                <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                                </Text>
                                {currentMeeting.meeting_start_time && (
                                  <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                    Time: {formatTime(currentMeeting.meeting_start_time)}
                                    {currentMeeting.meeting_end_time && ` - ${formatTime(currentMeeting.meeting_end_time)}`}
                                  </Text>
                                )}
                                <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Mode: {formatMeetingMode(currentMeeting.meeting_mode)}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.enterMeetingButton, { backgroundColor: theme.colors.primary }]}
                                onPress={() => {
                                  setOpenMeetingDetailExpanded(false);
                                  setSelectedMeeting(null);
                                }}
                                activeOpacity={0.8}
                                accessibilityLabel="Collapse meeting details"
                              >
                                <Text style={styles.enterMeetingButtonText} maxFontSizeMultiplier={1.3}>
                                  Close
                                </Text>
                                <ChevronUp size={14} color="#ffffff" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                          <View style={[styles.openMeetingTabs, { backgroundColor: theme.colors.textSecondary + '08', borderColor: theme.colors.border }]}>
                            {(['actions', 'roles', 'evaluation'] as const).map((tab) => (
                              <TouchableOpacity
                                key={tab}
                                style={[
                                  styles.openMeetingTab,
                                  openMeetingTab === tab && styles.openMeetingTabActive,
                                  openMeetingTab === tab && { backgroundColor: theme.colors.textSecondary + '15' },
                                ]}
                                onPress={() => setOpenMeetingTab(tab)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.openMeetingTabText,
                                    { color: openMeetingTab === tab ? theme.colors.text : theme.colors.textSecondary },
                                    openMeetingTab === tab ? styles.openMeetingTabTextActive : undefined,
                                  ]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  {tab === 'actions' ? 'Actions' : tab === 'roles' ? 'Roles' : 'Evaluation'}
                                </Text>
                                {openMeetingTab === tab && <View style={[styles.openMeetingTabIndicator, { backgroundColor: theme.colors.primary }]} />}
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                          <View style={styles.unifiedMeetingContent}>
                            {openMeetingTab === 'actions' && renderActionsTabContent(currentMeeting.id)}
                            {openMeetingTab === 'roles' && renderRolesTabContent(currentMeeting.id)}
                            {openMeetingTab === 'evaluation' && renderEvaluationTabContent(currentMeeting.id)}
                          </View>
                        </View>
                      ) : (
                        /* Collapsed - standalone meeting card */
                        <View style={[styles.heroMeetingCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                          <View style={styles.heroCardContent}>
                            <View style={[styles.dateBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                              <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                              <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                            </View>
                            <View style={styles.heroMeetingInfo}>
                              <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{currentMeeting.meeting_title}</Text>
                              <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                              </Text>
                              {currentMeeting.meeting_start_time && (
                                <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Time: {formatTime(currentMeeting.meeting_start_time)}
                                  {currentMeeting.meeting_end_time && ` - ${formatTime(currentMeeting.meeting_end_time)}`}
                                </Text>
                              )}
                              <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Mode: {formatMeetingMode(currentMeeting.meeting_mode)}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.enterMeetingButton, { backgroundColor: theme.colors.primary }]}
                              onPress={() => {
                                setOpenMeetingDetailExpanded(true);
                                setSelectedMeeting(currentMeeting);
                                setOpenMeetingTab('actions');
                              }}
                              activeOpacity={0.8}
                              accessibilityLabel="Expand meeting details"
                            >
                              <Text style={styles.enterMeetingButtonText} maxFontSizeMultiplier={1.3}>Open</Text>
                              <ChevronDown size={14} color="#ffffff" />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.heroCardDecoration} />
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            ) : (
              <View style={[styles.noMeetingsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.noMeetingsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Something exciting is coming! 🚀
                </Text>
                <Text style={[styles.noMeetingsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Your VPE is preparing upcoming meetings.
                </Text>
                <Text style={[styles.noMeetingsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Stay tuned or connect with{' '}
                  <Text style={[styles.vpeName, { color: theme.colors.primary, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                    {vpeName.trim().split(/\s+/).filter(Boolean)[0] || vpeName}
                  </Text>
                  {' '}for details.
                </Text>
              </View>
            )}
          </View>

          {nextMeetings.length > 0 && (
            <>
              <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.nextMeetingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Next Meetings
            </Text>

            <View style={styles.nextMeetingsList}>
              {nextMeetings.map((meeting) => {
                const isPlaceholder = meeting.isPlaceholder;
                const meetingDate = meeting.meeting_date ? new Date(meeting.meeting_date) : new Date();
                const dayNum = meetingDate.getDate();
                const month = meetingDate.toLocaleString('default', { month: 'short' }).toUpperCase();

                return (
                  <View key={meeting.id}>
                    {isPlaceholder ? (
                      <View style={[styles.lockedHeroMeetingCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                        <View style={styles.heroCardContent}>
                          <View style={[styles.comingSoonIcon, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                            <Lock size={20} color="#F59E0B" />
                          </View>
                          <View style={styles.comingSoonContent}>
                            <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Coming Soon</Text>
                            <View style={styles.vpeContactRow}>
                              <Text style={[styles.comingSoonSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Contact VPE:{' '}
                              </Text>
                              <Text style={[styles.comingSoonSubtitle, { color: theme.colors.primary, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                                {vpeName}
                              </Text>
                              <ChevronRight size={12} color={theme.colors.primary} style={{ marginLeft: 2 }} />
                            </View>
                          </View>
                        </View>
                        <View style={styles.heroCardDecoration} />
                      </View>
                    ) : true ? (
                      /* Unified expanded box for Next Meeting */
                      <View style={[styles.unifiedExpandedMeetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.unifiedMeetingBar}>
                          <View style={styles.heroCardContent}>
                            <View style={[styles.dateBadge, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                              <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                              <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                            </View>
                            <View style={styles.heroMeetingInfo}>
                              <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{meeting.meeting_title}</Text>
                              <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                              </Text>
                              {meeting.meeting_start_time && (
                                <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Time: {formatTime(meeting.meeting_start_time)}
                                  {meeting.meeting_end_time && ` - ${formatTime(meeting.meeting_end_time)}`}
                                </Text>
                              )}
                              <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Mode: {formatMeetingMode(meeting.meeting_mode)}
                              </Text>
                            </View>
                            <View style={styles.meetingActionSpacer} />
                          </View>
                        </View>
                        <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={[styles.openMeetingTabs, { backgroundColor: theme.colors.textSecondary + '08', borderColor: theme.colors.border }]}>
                          {(['actions', 'roles', 'evaluation'] as const).map((tab) => (
                            <TouchableOpacity
                              key={tab}
                              style={[
                                styles.openMeetingTab,
                                openMeetingTab === tab && styles.openMeetingTabActive,
                                openMeetingTab === tab && { backgroundColor: theme.colors.textSecondary + '15' },
                              ]}
                              onPress={() => setOpenMeetingTab(tab)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.openMeetingTabText,
                                  { color: openMeetingTab === tab ? theme.colors.text : theme.colors.textSecondary },
                                  openMeetingTab === tab ? styles.openMeetingTabTextActive : undefined,
                                ]}
                                maxFontSizeMultiplier={1.3}
                              >
                                {tab === 'actions' ? 'Actions' : tab === 'roles' ? 'Roles' : 'Evaluation'}
                              </Text>
                              {openMeetingTab === tab && <View style={[styles.openMeetingTabIndicator, { backgroundColor: theme.colors.primary }]} />}
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.unifiedMeetingContent}>
                          {openMeetingTab === 'actions' && renderActionsTabContent(meeting.id)}
                          {openMeetingTab === 'roles' && renderRolesTabContent(meeting.id)}
                          {openMeetingTab === 'evaluation' && renderEvaluationTabContent(meeting.id)}
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.lockedHeroMeetingCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                        <View style={styles.heroCardContent}>
                          <View style={[styles.dateBadge, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                            <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                            <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                          </View>
                          <View style={styles.heroMeetingInfo}>
                            <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{meeting.meeting_title}</Text>
                            <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                            </Text>
                            {meeting.meeting_start_time && (
                              <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Time: {formatTime(meeting.meeting_start_time)}
                                {meeting.meeting_end_time && ` - ${formatTime(meeting.meeting_end_time)}`}
                              </Text>
                            )}
                            <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              Mode: {formatMeetingMode(meeting.meeting_mode)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.preplanButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => handleNextMeetingPress(meeting.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.preplanButtonText} maxFontSizeMultiplier={1.3}>Plan</Text>
                            <ChevronDown size={16} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.heroCardDecoration} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
            </>
          )}

          <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.meetingHistorySection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting History
            </Text>
            <TouchableOpacity
              style={[
                styles.meetingHistoryEntryCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push('/meeting-history')}
              activeOpacity={0.8}
              accessibilityLabel="Open meeting history page"
            >
              <View style={[styles.comingSoonIcon, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                <Clock size={20} color="#6366F1" />
              </View>
              <View style={styles.comingSoonContent}>
                <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {isLoading ? 'Loading meeting history…' : 'View meeting history'}
                </Text>
                <Text style={[styles.comingSoonSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {isLoading
                    ? 'Preparing completed meetings.'
                    : `${meetingHistory.length} completed meeting${meetingHistory.length === 1 ? '' : 's'} available`}
                </Text>
              </View>
              <ChevronRight size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.meetingHistorySection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting Reports
            </Text>
            <TouchableOpacity
              style={[
                styles.meetingHistoryEntryCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push('/meeting-reports')}
              activeOpacity={0.8}
              accessibilityLabel="Open meeting reports page"
            >
              <View style={[styles.comingSoonIcon, { backgroundColor: '#3b82f615' }]}>
                <ClipboardList size={20} color="#0EA5E9" />
              </View>
              <View style={styles.comingSoonContent}>
                <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  View meeting reports
                </Text>
                <Text style={[styles.comingSoonSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  Historical reports available
                </Text>
              </View>
              <ChevronRight size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          </View>
        ) : (
          <View style={[styles.noClubCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.noClubIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
              <Building2 size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.noClubInfo}>
              <Text style={[styles.noClubText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                No club
              </Text>
              <Text style={[styles.noClubSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Join or create a club to get started
              </Text>
            </View>
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  featuresGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  featureCard: {
    borderRadius: 0,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: '#e7f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  noClubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  noClubIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noClubInfo: {
    flex: 1,
  },
  noClubText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  noClubSubtext: {
    fontSize: 13,
  },
  meetingsMasterBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  meetingsMasterDivider: {
    height: 1,
    marginVertical: 20,
  },
  meetingsSection: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  meetingsList: {
    gap: 16,
  },
  heroMeetingCard: {
    borderRadius: 0,
    padding: 14,
    minHeight: 84,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    zIndex: 1,
  },
  heroCardDecoration: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  dateBadge: {
    width: 49,
    height: 49,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeDay: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  dateBadgeMonth: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -2,
  },
  heroMeetingInfo: {
    flex: 1,
  },
  meetingActionSpacer: {
    width: 72,
  },
  heroMeetingTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  heroMeetingTime: {
    fontSize: 9,
    fontWeight: '500',
    marginBottom: 1,
  },
  heroMeetingMode: {
    fontSize: 9,
    fontWeight: '500',
  },
  enterMeetingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
    gap: 4,
  },
  enterMeetingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  unifiedExpandedMeetingCard: {
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  unifiedMeetingBar: {
    padding: 14,
  },
  unifiedMeetingDivider: {
    height: 1,
    marginHorizontal: 0,
  },
  unifiedMeetingContent: {
    padding: 18,
  },
  meetingActionsContainer: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  meetingMasterBox: {
    padding: 20,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  openMeetingTabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginVertical: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  openMeetingTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  openMeetingTabActive: {
    fontWeight: '600',
  },
  openMeetingTabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  openMeetingTabTextActive: {
    fontWeight: '600',
  },
  openMeetingTabIndicator: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 3,
    borderRadius: 0,
  },
  rolesTabContainer: {
    paddingBottom: 8,
  },
  rolesSection: {
    marginBottom: 20,
  },
  rolesSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  rolesSectionDivider: {
    height: 1,
    marginBottom: 12,
  },
  keyRolesList: {
    gap: 10,
  },
  keyRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyRoleIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  keyRoleContent: {
    flex: 1,
  },
  keyRoleTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  keyRoleSubtitle: {
    fontSize: 10,
    lineHeight: 14,
  },
  speakingRolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speakingRoleCard: {
    width: '30%',
    minWidth: 0,
    padding: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    position: 'relative',
  },
  speakingRoleIcon: {
    width: 44,
    height: 44,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  speakingRoleTitle: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  evaluationTabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  evaluationCard: {
    width: '31%',
    padding: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  emptyTabState: {
    padding: 24,
    borderRadius: 0,
    alignItems: 'center',
  },
  emptyTabText: {
    fontSize: 12,
  },
  actionsTabContainer: {
    paddingBottom: 8,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  actionsSectionDivider: {
    height: 1,
    marginBottom: 12,
  },
  actionsCardsColumn: {
    gap: 10,
    marginBottom: 10,
  },
  actionsCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  actionCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionCardHalf: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionComingSoonBadge: {
    marginTop: 4,
  },
  actionComingSoonText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#f59e0b',
  },
  actionSection: {
    marginBottom: 14,
  },
  actionSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '31%',
    padding: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    minHeight: 85,
    justifyContent: 'center',
  },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  actionTitle: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 11,
  },
  noMeetingsCard: {
    padding: 24,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  noMeetingsText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  noMeetingsSubtext: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  vpeName: {
    fontWeight: '600',
  },
  nextMeetingsSection: {
    paddingBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  nextMeetingsList: {
    gap: 16,
  },
  meetingHistorySection: {
    paddingBottom: 0,
  },
  meetingHistoryEntryCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    minHeight: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    overflow: 'hidden',
  },
  lockedHeroMeetingCard: {
    borderRadius: 0,
    padding: 14,
    minHeight: 84,
    overflow: 'hidden',
    position: 'relative',
  },
  nextMeetingPlanButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 0,
  },
  nextMeetingPlanButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  lockedIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  preplanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 17,
    borderRadius: 0,
    gap: 4,
  },
  preplanButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  lockedMeetingCard: {
    width: '48%',
    borderRadius: 0,
    padding: 20,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockedDateBadge: {
    width: 60,
    height: 60,
    borderRadius: 0,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lockedDateDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  lockedDateMonth: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: -2,
  },
  lockedMeetingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  lockedMeetingTime: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  lockedMeetingSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  comingSoonIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  comingSoonContent: {
    flex: 1,
    justifyContent: 'center',
  },
  comingSoonTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  comingSoonSubtitle: {
    fontSize: 10,
    lineHeight: 13,
  },
  vpeContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
 