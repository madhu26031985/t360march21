/**
 * Prepared Speaker slots 1–5 are paired with speech evaluator slots 1–5 for the same meeting.
 * Role names in the wild: "Prepared Speaker N", "Evaluator N", and legacy "Speech Evaluator N".
 */

export const PAIRED_SPEECH_SLOT_MAX = 5;

export type ParsedPairedSpeechRole =
  | { slot: number; kind: 'prepared' }
  | { slot: number; kind: 'evaluator' };

function matchPreparedSpeakerSlot(roleName: string): number | null {
  const m = roleName.trim().match(/^Prepared Speaker (\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= PAIRED_SPEECH_SLOT_MAX ? n : null;
}

function matchEvaluatorSlot(roleName: string): number | null {
  const t = roleName.trim();
  let m = t.match(/^Evaluator (\d+)$/i);
  if (!m) m = t.match(/^Speech Evaluator (\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= PAIRED_SPEECH_SLOT_MAX ? n : null;
}

export function parsePairedSpeechRole(roleName: string): ParsedPairedSpeechRole | null {
  const ps = matchPreparedSpeakerSlot(roleName);
  if (ps != null) return { slot: ps, kind: 'prepared' };
  const ev = matchEvaluatorSlot(roleName);
  if (ev != null) return { slot: ev, kind: 'evaluator' };
  return null;
}

export function isPairedPreparedOrSpeechEvaluatorRole(roleName: string): boolean {
  return parsePairedSpeechRole(roleName) !== null;
}

/** Same slot, opposite kind (prepared ↔ evaluator). */
export function findPairedRoleRow<T extends { role_name: string }>(
  roleName: string,
  rows: T[]
): T | undefined {
  const parsed = parsePairedSpeechRole(roleName);
  if (!parsed) return undefined;
  const wantKind = parsed.kind === 'prepared' ? 'evaluator' : 'prepared';
  return rows.find((r) => {
    const p = parsePairedSpeechRole(r.role_name);
    return p && p.slot === parsed.slot && p.kind === wantKind;
  });
}

export function normalizeRoleStatus(status: string | null | undefined): 'Available' | 'Deleted' {
  return (status ?? 'Available') === 'Deleted' ? 'Deleted' : 'Available';
}

/**
 * If prepared and evaluator rows for the same slot disagree, both become Deleted unless both are Available
 * (symmetric conservative merge).
 */
export function pairedSpeechSlotReconciliationTargets<T extends { role_name: string; role_status: string }>(
  rows: T[]
): { roleNames: string[]; targetStatus: 'Available' | 'Deleted' }[] {
  const fixes: { roleNames: string[]; targetStatus: 'Available' | 'Deleted' }[] = [];

  for (let slot = 1; slot <= PAIRED_SPEECH_SLOT_MAX; slot++) {
    const prepared = rows.find((r) => {
      const p = parsePairedSpeechRole(r.role_name);
      return p?.kind === 'prepared' && p.slot === slot;
    });
    const evaluator = rows.find((r) => {
      const p = parsePairedSpeechRole(r.role_name);
      return p?.kind === 'evaluator' && p.slot === slot;
    });
    if (!prepared || !evaluator) continue;

    const sP = normalizeRoleStatus(prepared.role_status);
    const sE = normalizeRoleStatus(evaluator.role_status);
    if (sP === sE) continue;

    const targetStatus: 'Available' | 'Deleted' =
      sP === 'Available' && sE === 'Available' ? 'Available' : 'Deleted';
    fixes.push({
      roleNames: [prepared.role_name, evaluator.role_name],
      targetStatus,
    });
  }

  return fixes;
}
