import AsyncStorage from '@react-native-async-storage/async-storage';

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const MAX_SHOWS_PER_CYCLE = 2;

type PromptCycleState = {
  cycleStartedAt: number;
  showCount: number;
  lastShownAt: number;
};

function storageKey(clubId: string, userId: string): string {
  return `t360_club_profile_prompt:${clubId}:${userId}`;
}

async function readState(clubId: string, userId: string): Promise<PromptCycleState | null> {
  if (!clubId || !userId) return null;
  try {
    const raw = await AsyncStorage.getItem(storageKey(clubId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PromptCycleState;
    if (
      typeof parsed.cycleStartedAt !== 'number' ||
      typeof parsed.showCount !== 'number' ||
      typeof parsed.lastShownAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeState(clubId: string, userId: string, state: PromptCycleState): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(storageKey(clubId, userId), JSON.stringify(state));
}

/**
 * ExComm club-profile popup: up to 2 shows per 24h cycle — first immediately,
 * second after 3 hours, then wait until the cycle resets (24h from cycle start).
 */
export async function shouldShowClubProfileIncompletePrompt(
  clubId: string,
  userId: string
): Promise<boolean> {
  if (!clubId || !userId) return false;

  const now = Date.now();
  const state = await readState(clubId, userId);

  if (!state) return true;

  if (now - state.cycleStartedAt >= TWENTY_FOUR_HOURS_MS) {
    return true;
  }

  if (state.showCount >= MAX_SHOWS_PER_CYCLE) {
    return false;
  }

  if (state.showCount === 0) {
    return true;
  }

  return now - state.lastShownAt >= THREE_HOURS_MS;
}

/** Call when the popup is displayed (not on dismiss). */
export async function recordClubProfileIncompletePromptShown(
  clubId: string,
  userId: string
): Promise<void> {
  if (!clubId || !userId) return;

  const now = Date.now();
  let state = await readState(clubId, userId);

  if (!state || now - state.cycleStartedAt >= TWENTY_FOUR_HOURS_MS) {
    state = { cycleStartedAt: now, showCount: 0, lastShownAt: 0 };
  }

  await writeState(clubId, userId, {
    cycleStartedAt: state.cycleStartedAt,
    showCount: state.showCount + 1,
    lastShownAt: now,
  });
}
