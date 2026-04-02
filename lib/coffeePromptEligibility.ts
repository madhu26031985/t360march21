import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const MIN_BOOKED_ROLES = 1;
const MIN_ATTENDED_MEETINGS = 5;
const MIN_VOTES = 2;

function dismissalKey(userId: string, clubId: string | null | undefined): string {
  return `coffee_prompt_dismissed:${userId}:${clubId || 'none'}`;
}

export function useCoffeePromptEligibility() {
  const { user } = useAuth();
  const [shouldShowCoffee, setShouldShowCoffee] = useState(false);
  const [isLoadingCoffeeEligibility, setIsLoadingCoffeeEligibility] = useState(true);

  const key = useMemo(
    () => (user?.id ? dismissalKey(user.id, user.currentClubId) : null),
    [user?.id, user?.currentClubId]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setShouldShowCoffee(false);
          setIsLoadingCoffeeEligibility(false);
        }
        return;
      }

      try {
        if (!key) {
          if (!cancelled) {
            setShouldShowCoffee(false);
            setIsLoadingCoffeeEligibility(false);
          }
          return;
        }

        const dismissed = await AsyncStorage.getItem(key);
        if (dismissed === '1') {
          if (!cancelled) {
            setShouldShowCoffee(false);
            setIsLoadingCoffeeEligibility(false);
          }
          return;
        }

        const [bookedRes, attendanceRes, votesRes] = await Promise.all([
          supabase
            .from('app_meeting_roles_management')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_user_id', user.id)
            .eq('booking_status', 'booked'),
          (supabase as any)
            .from('app_meeting_attendance')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('attendance_status', ['present', 'late']),
          supabase
            .from('simple_poll_votes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

        const bookedCount = bookedRes.count || 0;
        const attendedCount = attendanceRes.count || 0;
        const votesCount = votesRes.count || 0;

        const eligible =
          bookedCount >= MIN_BOOKED_ROLES &&
          attendedCount >= MIN_ATTENDED_MEETINGS &&
          votesCount >= MIN_VOTES;

        if (!cancelled) setShouldShowCoffee(eligible);
      } catch (error) {
        console.error('Error checking coffee eligibility:', error);
        if (!cancelled) setShouldShowCoffee(false);
      } finally {
        if (!cancelled) setIsLoadingCoffeeEligibility(false);
      }
    };

    setIsLoadingCoffeeEligibility(true);
    void run();
    return () => {
      cancelled = true;
    };
  }, [key, user?.id]);

  const dismissCoffeePrompt = async () => {
    if (!key) return;
    try {
      await AsyncStorage.setItem(key, '1');
      setShouldShowCoffee(false);
    } catch (error) {
      console.error('Error dismissing coffee prompt:', error);
    }
  };

  return { shouldShowCoffee, isLoadingCoffeeEligibility, dismissCoffeePrompt };
}

