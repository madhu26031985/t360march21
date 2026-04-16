import { supabase } from '@/lib/supabase';

export type LiveVotingPoll = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
};

export type LiveVotingPollItem = {
  id: string;
  poll_id: string;
  question_id: string;
  option_id: string;
  option_text: string;
  question_text: string;
  question_order: number;
  option_order: number;
  vote_count: number;
  avatar_url?: string | null;
};

export type LiveVotingUserVote = {
  poll_id: string;
  question_id: string;
  option_id: string;
};

export type LiveVotingPollBundle = {
  poll_items: LiveVotingPollItem[];
  user_votes: LiveVotingUserVote[];
  has_voted: boolean;
};

export type LiveVotingSnapshot = {
  polls: LiveVotingPoll[];
  firstPollBundle: LiveVotingPollBundle | null;
};

const TTL_MS = 30_000;
const recent = new Map<string, { at: number; value: LiveVotingSnapshot }>();
const inflight = new Map<string, Promise<LiveVotingSnapshot>>();

export function getCachedLiveVotingSnapshot(clubId: string): LiveVotingSnapshot | null {
  const hit = recent.get(clubId);
  if (!hit) return null;
  if (Date.now() - hit.at >= TTL_MS) return null;
  return hit.value;
}

async function fetchPollBundle(pollId: string): Promise<LiveVotingPollBundle | null> {
  const { data, error } = await (supabase as any).rpc('get_live_voting_poll_bundle', {
    p_poll_id: pollId,
  });
  if (error || data == null || typeof data !== 'object') return null;
  const bundle = data as Partial<LiveVotingPollBundle>;
  return {
    poll_items: Array.isArray(bundle.poll_items) ? bundle.poll_items : [],
    user_votes: Array.isArray(bundle.user_votes) ? bundle.user_votes : [],
    has_voted: !!bundle.has_voted,
  };
}

export async function fetchLiveVotingSnapshot(clubId: string): Promise<LiveVotingSnapshot> {
  const hit = recent.get(clubId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let pending = inflight.get(clubId);
  if (!pending) {
    const p = (async (): Promise<LiveVotingSnapshot> => {
      try {
        const { data, error } = await supabase
          .from('polls')
          .select('id, title, description, status, created_at')
          .eq('club_id', clubId)
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        const polls = (error ? [] : data || []) as LiveVotingPoll[];
        const firstPollBundle = polls[0] ? await fetchPollBundle(polls[0].id) : null;
        const value = { polls, firstPollBundle };
        recent.set(clubId, { at: Date.now(), value });
        return value;
      } finally {
        if (inflight.get(clubId) === p) inflight.delete(clubId);
      }
    })();
    inflight.set(clubId, p);
    pending = p;
  }
  return pending;
}

export function prefetchLiveVotingSnapshot(clubId: string | null | undefined): void {
  if (!clubId) return;
  void fetchLiveVotingSnapshot(clubId).catch(() => {});
}
