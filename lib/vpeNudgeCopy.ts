/**
 * Copy for VPE role-booking nudges (next open meeting only).
 * Day 1 = opening announcement; days 2–7 = follow-ups with gaps from live bookings.
 */

export type VpeNudgeRoleRow = {
  role_name: string;
  role_metric: string;
  role_classification: string | null;
  booking_status: string | null;
  assigned_user_id: string | null;
};

export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatMeetingDateDisplay(isoDate: string): string {
  if (!isoDate) return '—';
  const [y, mo, da] = isoDate.split('-').map((x) => parseInt(x, 10));
  if (!y || !mo || !da) return isoDate;
  const dt = new Date(y, mo - 1, da);
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Whole calendar days from today (local) to meeting date; 0 = meeting is today. */
export function daysUntilMeeting(meetingISODate: string, todayISODate: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
    if (!y || !m || !d) return NaN;
    return new Date(y, m - 1, d).getTime();
  };
  const tMeet = parse(meetingISODate);
  const tToday = parse(todayISODate);
  if (Number.isNaN(tMeet) || Number.isNaN(tToday)) return 0;
  return Math.round((tMeet - tToday) / 86400000);
}

/**
 * Which nudge template (0..6) applies today. Maps 7 days out → index 0 … meeting today → index 6.
 * More than 7 days until meeting uses index 0 (earliest template).
 */
export function todayNudgeIndex(daysUntil: number): number {
  if (daysUntil > 7) return 0;
  if (daysUntil <= 1) return 6;
  return 7 - daysUntil;
}

/** Indices of nudge slots before today’s slot (what the VPE may have missed sending). */
export function missedNudgeIndices(daysUntil: number): number[] {
  const t = todayNudgeIndex(daysUntil);
  return Array.from({ length: t }, (_, i) => i);
}

/** Heading for each stored nudge row (matches countdown to meeting). */
export const NUDGE_HEADING_BY_INDEX = [
  'Meeting in 7 days',
  'In 6 days',
  'In 5 days',
  'In 4 days',
  'In 3 days',
  'In 2 days',
  'Tomorrow',
] as const;

/** Heading for the single “today’s hint” card (meeting day vs day before use Today / Tomorrow). */
export function todayTabHeading(daysUntil: number): string {
  if (daysUntil <= 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil === 2) return 'In 2 days';
  if (daysUntil === 3) return 'In 3 days';
  if (daysUntil === 4) return 'In 4 days';
  if (daysUntil === 5) return 'In 5 days';
  if (daysUntil === 6) return 'In 6 days';
  return 'Meeting in 7 days';
}

/** Card title: "Your meeting number - {n} starts in X days" (or today / tomorrow). */
export function formatMeetingStartsTitle(meetingNo: string, daysUntil: number): string {
  const no = String(meetingNo ?? '—').trim() || '—';
  if (daysUntil <= 0) return `Your meeting number - ${no} starts today`;
  if (daysUntil === 1) return `Your meeting number - ${no} starts tomorrow`;
  return `Your meeting number - ${no} starts in ${daysUntil} days`;
}

/** Missed-slot title: same pattern using the countdown that applied to that nudge (slot 0 → 7 days out). */
export function formatMeetingStartsTitleForMissedSlot(meetingNo: string, slotIndex: number): string {
  const d = 7 - slotIndex;
  return formatMeetingStartsTitle(meetingNo, d);
}

function isBooked(r: VpeNudgeRoleRow): boolean {
  return r.booking_status === 'booked' && !!r.assigned_user_id;
}

/** All role rows on the agenda that are booked (for “X roles already booked” on Day 2+). */
export function countBookedMeetingRoles(roles: VpeNudgeRoleRow[]): number {
  return roles.filter(isBooked).length;
}

function isTmodRole(r: VpeNudgeRoleRow): boolean {
  const n = (r.role_name || '').toLowerCase();
  return n.includes('toastmaster') && (n.includes('day') || n.includes('of the'));
}

function isGeneralEvaluatorRole(r: VpeNudgeRoleRow): boolean {
  const c = (r.role_classification || '').toLowerCase();
  const n = (r.role_name || '').toLowerCase();
  return c.includes('master eval') || n === 'general evaluator';
}

function isSpeechEvaluatorRole(r: VpeNudgeRoleRow): boolean {
  const n = (r.role_name || '').toLowerCase().trim();
  const c = (r.role_classification || '').toLowerCase();
  if (c.includes('master eval')) return false;
  if (n.includes('table topic') && n.includes('eval')) return false;
  if (r.role_metric !== 'evaluations_given') return false;
  if (c.includes('speech') && c.includes('eval')) return true;
  if (n.startsWith('speech evaluator')) return true;
  if (/^evaluator\s+\d+$/i.test(n)) return true;
  return false;
}

function isPreparedSpeakerSlot(r: VpeNudgeRoleRow): boolean {
  return r.role_metric === 'speeches_delivered';
}

function isTableTopicsMaster(r: VpeNudgeRoleRow): boolean {
  return (r.role_name || '').trim().toLowerCase() === 'table topics master';
}

function isTimer(r: VpeNudgeRoleRow): boolean {
  return (r.role_name || '').trim().toLowerCase() === 'timer';
}

function isGrammarian(r: VpeNudgeRoleRow): boolean {
  return (r.role_name || '').trim().toLowerCase() === 'grammarian';
}

function isAhCounter(r: VpeNudgeRoleRow): boolean {
  const n = (r.role_name || '').trim().toLowerCase();
  return n === 'ah counter' || n === 'ah-counter';
}

const PREPARED_MIN = 2;
const EVALUATOR_MIN_DEFAULT = 2;
/** When ≥3 prepared speeches are booked, Days 5–6 expect this many speech evaluators (capped by slots). */
const EVALUATOR_MIN_WHEN_THREE_PREPARED = 3;

function countPreparedSpeakersBooked(roles: VpeNudgeRoleRow[]): number {
  return roles.filter(isPreparedSpeakerSlot).filter(isBooked).length;
}

export type RoleGapOptions = {
  /** Include Timer, Grammarian, Ah Counter in the list (Days 5–6 and 7). Day 4 omits these. */
  includeTagTeam: boolean;
  /** Minimum speech evaluators to treat as “filled” (Days 5–6 may use 3 if enough prepared speeches are booked). */
  evaluatorTargetMin: number;
};

/**
 * Days 2–3 only: Toastmaster, General Evaluator, Table Topics Master, and prepared speakers (until 2 booked).
 */
export function analyzeRoleGapsDay2And3(roles: VpeNudgeRoleRow[]): string[] {
  const missing: string[] = [];

  const tmodSlots = roles.filter(isTmodRole);
  if (tmodSlots.length > 0 && tmodSlots.filter(isBooked).length < 1) {
    missing.push('Toastmaster of the Day');
  }

  const geSlots = roles.filter(isGeneralEvaluatorRole);
  if (geSlots.length > 0 && geSlots.filter(isBooked).length < 1) {
    missing.push('General Evaluator');
  }

  const ttmSlots = roles.filter(isTableTopicsMaster);
  if (ttmSlots.length > 0 && ttmSlots.filter(isBooked).length < 1) {
    missing.push('Table Topics Master');
  }

  const prepSlots = roles.filter(isPreparedSpeakerSlot);
  const prepTarget = Math.min(PREPARED_MIN, Math.max(prepSlots.length, 0));
  const prepBooked = prepSlots.filter(isBooked).length;
  if (prepSlots.length > 0 && prepBooked < prepTarget) {
    missing.push(`Prepared speakers (need ${prepTarget - prepBooked} more)`);
  }

  return missing;
}

/**
 * Flexible gap list: Day 4 = no tag team; Days 5–6 = tag team + higher evaluator bar when 3+ prepared booked; Day 7 = tag team, default eval bar.
 */
export function analyzeRoleGapsWithOptions(roles: VpeNudgeRoleRow[], opts: RoleGapOptions): string[] {
  const missing: string[] = [];

  const tmodSlots = roles.filter(isTmodRole);
  if (tmodSlots.length > 0 && tmodSlots.filter(isBooked).length < 1) {
    missing.push('Toastmaster of the Day');
  }

  const geSlots = roles.filter(isGeneralEvaluatorRole);
  if (geSlots.length > 0 && geSlots.filter(isBooked).length < 1) {
    missing.push('General Evaluator');
  }

  const prepSlots = roles.filter(isPreparedSpeakerSlot);
  const prepTarget = Math.min(PREPARED_MIN, Math.max(prepSlots.length, 0));
  const prepBooked = prepSlots.filter(isBooked).length;
  if (prepSlots.length > 0 && prepBooked < prepTarget) {
    missing.push(`Prepared speakers (need ${prepTarget - prepBooked} more)`);
  }

  const evalSlots = roles.filter(isSpeechEvaluatorRole);
  const evalTarget = Math.min(opts.evaluatorTargetMin, Math.max(evalSlots.length, 0));
  const evalBooked = evalSlots.filter(isBooked).length;
  if (evalSlots.length > 0 && evalBooked < evalTarget) {
    missing.push(`Speech evaluators (need ${evalTarget - evalBooked} more)`);
  }

  const ttmSlots = roles.filter(isTableTopicsMaster);
  if (ttmSlots.length > 0 && ttmSlots.filter(isBooked).length < 1) {
    missing.push('Table Topics Master');
  }

  if (opts.includeTagTeam) {
    const timerSlots = roles.filter(isTimer);
    if (timerSlots.length > 0 && timerSlots.filter(isBooked).length < 1) {
      missing.push('Timer');
    }

    const gramSlots = roles.filter(isGrammarian);
    if (gramSlots.length > 0 && gramSlots.filter(isBooked).length < 1) {
      missing.push('Grammarian');
    }

    const ahSlots = roles.filter(isAhCounter);
    if (ahSlots.length > 0 && ahSlots.filter(isBooked).length < 1) {
      missing.push('Ah Counter');
    }
  }

  return missing;
}

/** Full checklist: tag team + default 2 evaluators (e.g. Day 7). */
export function analyzeRoleGaps(roles: VpeNudgeRoleRow[]): string[] {
  return analyzeRoleGapsWithOptions(roles, {
    includeTagTeam: true,
    evaluatorTargetMin: EVALUATOR_MIN_DEFAULT,
  });
}

function meetingBlock(clubName: string, dateStr: string, meetingNo: string): string {
  return `📍 Club Name: ${clubName}\n📅 Date: ${dateStr}\n🔢 Meeting No: ${meetingNo}\n`;
}

function signatureBlock(vpeName: string): string {
  return `\n\nRegards,\n${vpeName}\nVPE`;
}

/** Unique salutation per day (avoid repeating “Hello everyone” on every nudge). */
const GREETING_BY_DAY: Record<number, string> = {
  1: `Hi club 👋`,
  2: `Good day, everyone ☀️`,
  3: `Hello, members!`,
  4: `Team —`,
  5: `Fellow Toastmasters,`,
  6: `Everyone — quick heads-up:`,
  7: `One last shout-out before we meet 📣`,
};

const FOLLOW_UP_BODIES: Record<number, string> = {
  2: `A friendly reminder about our upcoming meeting — roles are open for booking. If you haven’t picked yours yet, now is a great time!\n\n`,
  3: `Quick update: we still have openings for the next meeting. Your participation helps us run a full agenda.\n\n`,
  4: `We’re getting closer to meeting day! Some important roles are still open — please consider signing up.\n\n`,
  5: `We still need volunteers for a few core roles before our upcoming meeting. Thank you for stepping up when you can!\n\n`,
  6: `Time is short — please book any open role you can support so we can finalize the roster.\n\n`,
  7: `Final call for role bookings for this meeting. Huge thanks to everyone who has already signed up!\n\n`,
};

/** Same intent (use T-360 → Book a Role), different wording per day. Uses *asterisks* for WhatsApp-friendly bold. */
const CALL_TO_ACTION_BY_DAY: Record<number, string> = {
  1: `Please go ahead and book in the *T-360* app (*Book a Role*) at your earliest convenience. Let’s make this meeting amazing! 🚀`,
  2: `Open *T-360*, tap *Book a Role*, and grab your spot — the sooner we fill the roster, the easier it is to plan. 🚀`,
  3: `Head to *Book a Role* inside *T-360* to reserve your place on the agenda. Every signup helps! 🚀`,
  4: `When you have a moment, use *Book a Role* in *T-360* to pick up any open role. Thanks for jumping in! 🚀`,
  5: `If you haven’t booked yet, open *T-360* → *Book a Role* and join the lineup — we’d love to have you. 🚀`,
  6: `Please use *Book a Role* in *T-360* as soon as you can so we can lock the final roster. 🚀`,
  7: `Last call: *Book a Role* in *T-360* now if you can still help. See you at the meeting! 🚀`,
};

function bookedProgressLine(bookedCount: number): string {
  if (bookedCount <= 0) {
    return `📊 So far, no roles are booked yet — you can be the first!\n\n`;
  }
  if (bookedCount === 1) {
    return `📊 1 role is already booked — thank you!\n\n`;
  }
  return `📊 ${bookedCount} roles are already booked — thank you!\n\n`;
}

function missingSection(missing: string[], heading: 'looking' | 'still_looking'): string {
  if (missing.length === 0) {
    return `✅ Our priority roles look covered — thank you! If you can still help with any remaining slots, check Book a Role in T-360.\n\n`;
  }
  const line =
    heading === 'looking'
      ? `We're looking for:\n${missing.map((m) => `• ${m}`).join('\n')}\n\n`
      : `We're still looking for:\n${missing.map((m) => `• ${m}`).join('\n')}\n\n`;
  return line;
}

export type NudgeContext = {
  clubName: string;
  meetingDateDisplay: string;
  meetingNumber: string;
  vpeName: string;
};

export function buildDay1Message(ctx: NudgeContext): string {
  const { clubName, meetingDateDisplay, meetingNumber, vpeName } = ctx;
  const cta = CALL_TO_ACTION_BY_DAY[1];
  const greet = GREETING_BY_DAY[1];
  return (
    `${greet}\n\n` +
    `The meeting is now open for role booking.\n\n` +
    meetingBlock(clubName, meetingDateDisplay, meetingNumber) +
    `\n` +
    cta +
    signatureBlock(vpeName)
  );
}

/** Days 2–7 (inclusive). Days 2–3: early list. Day 4: no Timer/Grammarian/Ah Counter, 2 evaluators. Days 5–6: add tag team + 3 evaluators if ≥3 prepared speeches booked, else 2. Day 7: full roster, 2 evaluators. */
export function buildFollowUpMessage(
  day: number,
  ctx: NudgeContext,
  missing: string[],
  listHeading: 'looking' | 'still_looking',
  bookedCount: number
): string {
  const greet = GREETING_BY_DAY[day] ?? GREETING_BY_DAY[7];
  const body = FOLLOW_UP_BODIES[day] ?? FOLLOW_UP_BODIES[7];
  const intro = `${greet}\n\n${body}`;
  const { clubName, meetingDateDisplay, meetingNumber, vpeName } = ctx;
  const cta = CALL_TO_ACTION_BY_DAY[day] ?? CALL_TO_ACTION_BY_DAY[7];
  return (
    intro +
    meetingBlock(clubName, meetingDateDisplay, meetingNumber) +
    `\n` +
    bookedProgressLine(bookedCount) +
    missingSection(missing, listHeading) +
    cta +
    signatureBlock(vpeName)
  );
}

export function buildAllNudgeMessages(ctx: NudgeContext, roles: VpeNudgeRoleRow[]): string[] {
  const bookedCount = countBookedMeetingRoles(roles);
  const missingEarly = analyzeRoleGapsDay2And3(roles);
  const prepBooked = countPreparedSpeakersBooked(roles);
  const evaluatorMinDay56 =
    prepBooked >= EVALUATOR_MIN_WHEN_THREE_PREPARED
      ? EVALUATOR_MIN_WHEN_THREE_PREPARED
      : EVALUATOR_MIN_DEFAULT;

  const missingDay4 = analyzeRoleGapsWithOptions(roles, {
    includeTagTeam: false,
    evaluatorTargetMin: EVALUATOR_MIN_DEFAULT,
  });
  const missingDay56 = analyzeRoleGapsWithOptions(roles, {
    includeTagTeam: true,
    evaluatorTargetMin: evaluatorMinDay56,
  });
  const missingDay7 = analyzeRoleGaps(roles);

  const day1 = buildDay1Message(ctx);
  const day2 = buildFollowUpMessage(2, ctx, missingEarly, 'looking', bookedCount);
  const day3 = buildFollowUpMessage(3, ctx, missingEarly, 'looking', bookedCount);
  const day4 = buildFollowUpMessage(4, ctx, missingDay4, 'still_looking', bookedCount);
  const day5 = buildFollowUpMessage(5, ctx, missingDay56, 'still_looking', bookedCount);
  const day6 = buildFollowUpMessage(6, ctx, missingDay56, 'still_looking', bookedCount);
  const day7 = buildFollowUpMessage(7, ctx, missingDay7, 'still_looking', bookedCount);
  return [day1, day2, day3, day4, day5, day6, day7];
}
