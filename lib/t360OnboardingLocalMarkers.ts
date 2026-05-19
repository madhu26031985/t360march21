import AsyncStorage from '@react-native-async-storage/async-storage';

const shareAppKey = (clubId: string, userId: string) =>
  `t360_onboarding_share_app:${clubId}:${userId}`;

const vpeSmartInsightKey = (clubId: string, userId: string) =>
  `t360_onboarding_vpe_smart_insight:${clubId}:${userId}`;

const myTasksKey = (clubId: string, userId: string) => `t360_onboarding_my_tasks:${clubId}:${userId}`;

const agendaAutofillKey = (clubId: string, userId: string) =>
  `t360_onboarding_agenda_autofill:${clubId}:${userId}`;

const agendaSequenceKey = (clubId: string, userId: string) =>
  `t360_onboarding_agenda_sequence:${clubId}:${userId}`;

const agendaBannerKey = (clubId: string, userId: string) =>
  `t360_onboarding_agenda_banner:${clubId}:${userId}`;

const votingLinkKey = (clubId: string, userId: string) =>
  `t360_onboarding_voting_link:${clubId}:${userId}`;

const roleMovedToDeletedKey = (clubId: string, userId: string) =>
  `t360_onboarding_role_moved_deleted:${clubId}:${userId}`;

const roleMovedToAvailableKey = (clubId: string, userId: string) =>
  `t360_onboarding_role_moved_available:${clubId}:${userId}`;

async function readCounter(key: string): Promise<number> {
  const raw = await AsyncStorage.getItem(key);
  const n = parseInt(raw ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function writeCounter(key: string, value: number): Promise<void> {
  await AsyncStorage.setItem(key, String(Math.max(0, value)));
}

/** Persist that the club creator tapped Settings → Share the App (per club + user). */
export async function markT360ShareAppUsed(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(shareAppKey(clubId, userId), '1');
}

export async function hasT360ShareAppUsed(clubId: string, userId: string): Promise<boolean> {
  if (!clubId || !userId) return false;
  const value = await AsyncStorage.getItem(shareAppKey(clubId, userId));
  return value === '1';
}

export async function getT360VpeSmartInsightUseCount(clubId: string, userId: string): Promise<number> {
  if (!clubId || !userId) return 0;
  return readCounter(vpeSmartInsightKey(clubId, userId));
}

/** Each VPE Smart Insights WhatsApp share from /vpe-nudges counts once. */
export async function incrementT360VpeSmartInsightUse(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  const key = vpeSmartInsightKey(clubId, userId);
  const next = (await readCounter(key)) + 1;
  await writeCounter(key, next);
}

export async function getT360MyTasksUseCount(clubId: string, userId: string): Promise<number> {
  if (!clubId || !userId) return 0;
  return readCounter(myTasksKey(clubId, userId));
}

/** Each tap on a Home → My Tasks reminder action counts once. */
export async function incrementT360MyTasksUse(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  const key = myTasksKey(clubId, userId);
  const next = (await readCounter(key)) + 1;
  await writeCounter(key, next);
}

export async function markT360AgendaAutofillUsed(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(agendaAutofillKey(clubId, userId), '1');
}

export async function hasT360AgendaAutofillUsed(clubId: string, userId: string): Promise<boolean> {
  if (!clubId || !userId) return false;
  return (await AsyncStorage.getItem(agendaAutofillKey(clubId, userId))) === '1';
}

export async function markT360AgendaSequenceUsed(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(agendaSequenceKey(clubId, userId), '1');
}

export async function hasT360AgendaSequenceUsed(clubId: string, userId: string): Promise<boolean> {
  if (!clubId || !userId) return false;
  return (await AsyncStorage.getItem(agendaSequenceKey(clubId, userId))) === '1';
}

export async function markT360AgendaBannerColorChanged(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(agendaBannerKey(clubId, userId), '1');
}

export async function hasT360AgendaBannerColorChanged(clubId: string, userId: string): Promise<boolean> {
  if (!clubId || !userId) return false;
  return (await AsyncStorage.getItem(agendaBannerKey(clubId, userId))) === '1';
}

export async function markT360VotingLinkShared(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(votingLinkKey(clubId, userId), '1');
}

export async function hasT360VotingLinkShared(clubId: string, userId: string): Promise<boolean> {
  if (!clubId || !userId) return false;
  return (await AsyncStorage.getItem(votingLinkKey(clubId, userId))) === '1';
}

/** ExComm used Manage Meeting Roles → move role to Deleted (not auto-seeded Deleted roles). */
export async function markT360RoleMovedToDeleted(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(roleMovedToDeletedKey(clubId, userId), '1');
}

export async function hasT360RoleMovedToDeleted(clubId: string, userId: string): Promise<boolean> {
  if (!clubId || !userId) return false;
  return (await AsyncStorage.getItem(roleMovedToDeletedKey(clubId, userId))) === '1';
}

/** ExComm restored a role from Deleted to Available in Manage Meeting Roles. */
export async function markT360RoleMovedToAvailable(clubId: string, userId: string): Promise<void> {
  if (!clubId || !userId) return;
  await AsyncStorage.setItem(roleMovedToAvailableKey(clubId, userId), '1');
}

export async function hasT360RoleMovedToAvailable(clubId: string, userId: string): Promise<boolean> {
  if (!clubId || !userId) return false;
  return (await AsyncStorage.getItem(roleMovedToAvailableKey(clubId, userId))) === '1';
}
