import { fetchGrammarianCornerSnapshot } from '@/lib/grammarianCornerQuery';

/** Start Grammarian snapshot fetch before navigation so the next screen often hits warm HTTP cache. */
export function prefetchGrammarianCorner(
  meetingId: string | null | undefined,
  userId: string | null | undefined,
  clubId: string | null | undefined
): void {
  if (!meetingId || !userId || !clubId) return;
  void fetchGrammarianCornerSnapshot(meetingId, userId, clubId);
}
