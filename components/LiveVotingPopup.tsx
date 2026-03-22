import { View, Text, StyleSheet, Modal, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Vote, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function LiveVotingPopup() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);
  const [showCount, setShowCount] = useState(0);
  const [currentOpenMeetingId, setCurrentOpenMeetingId] = useState<string | null>(null);

  const MAX_POPUP_SHOWS = 2;

  const checkAndShow = useCallback(async () => {
    if (!user?.currentClubId || !user?.id) return;

    try {
      // Get current open meeting
      const thirtysixHoursAgo = new Date();
      thirtysixHoursAgo.setHours(thirtysixHoursAgo.getHours() - 36);
      const cutoffDate = thirtysixHoursAgo.toISOString().split('T')[0];

      const { data: meetingData } = await supabase
        .from('app_club_meeting')
        .select('id')
        .eq('club_id', user.currentClubId)
        .eq('meeting_status', 'open')
        .gte('meeting_date', cutoffDate)
        .order('meeting_date', { ascending: true })
        .limit(1);

      const meetingId = meetingData?.[0]?.id || null;
      setCurrentOpenMeetingId(meetingId);

      // Get active polls
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('id')
        .eq('club_id', user.currentClubId)
        .eq('status', 'published');

      const hasActivePoll = !pollsError && polls && polls.length > 0;
      if (!hasActivePoll || !polls?.length) return;

      // Check if user has voted
      const pollIds = polls.map((p: { id: string }) => p.id);
      const { data: votes, error: votesError } = await supabase
        .from('simple_poll_votes')
        .select('poll_id')
        .eq('user_id', user.id)
        .in('poll_id', pollIds)
        .limit(1);

      const hasVoted = !votesError && votes && votes.length > 0;
      if (hasVoted) return;

      // Don't show if recently dismissed (within 90 seconds)
      if (Date.now() < dismissedUntil) return;

      // Show at most 2 times per session
      if (showCount >= MAX_POPUP_SHOWS) return;

      setShowCount((c) => c + 1);
      setVisible(true);
    } catch {
      // Silent fail
    }
  }, [user?.currentClubId, user?.id, dismissedUntil, showCount]);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user?.currentClubId || !user?.id) {
      setVisible(false);
      return;
    }

    checkAndShow();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkAndShow();
      }
      appState.current = nextState;
    };

    const appSub = AppState.addEventListener('change', handleAppStateChange);

    // Realtime: show popup as soon as poll is published (any screen)
    const channel = supabase
      .channel('live-voting-polls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'polls',
        filter: `club_id=eq.${user.currentClubId}`,
      }, (payload) => {
        const row = payload.new as { status?: string } | null;
        if (row?.status === 'published') {
          checkAndShow();
        }
      })
      .subscribe();

    return () => {
      appSub.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.currentClubId, user?.id, checkAndShow]);

  const handleVoteNow = () => {
    setVisible(false);
    if (currentOpenMeetingId) {
      router.push(`/live-voting?meetingId=${currentOpenMeetingId}`);
    } else {
      router.push('/live-voting');
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissedUntil(Date.now() + 90 * 1000); // Don't show again for 90 seconds
  };

  const firstName = user?.fullName?.split(' ')[0] || 'Member';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleDismiss}
      >
        <TouchableOpacity
          style={[styles.popup, { backgroundColor: theme.colors.surface }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.popupHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#0a66c2' }]}>
              <Vote size={24} color="#ffffff" />
            </View>
            <View style={styles.popupText}>
              <Text style={[styles.popupTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {firstName}, your voice matters
              </Text>
              <Text style={[styles.popupSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Make your vote count.
              </Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} hitSlop={12}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.voteButton, { backgroundColor: '#0a66c2' }]}
            onPress={handleVoteNow}
            activeOpacity={0.85}
          >
            <Text style={styles.voteButtonText} maxFontSizeMultiplier={1.3}>Cast your vote</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  popup: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  popupText: {
    flex: 1,
  },
  popupTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  popupSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeBtn: {
    padding: 4,
  },
  voteButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  voteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
