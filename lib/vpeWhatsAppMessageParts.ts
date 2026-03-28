/** Shared lines for VPE WhatsApp messages (date/meeting + signature). */

function firstWordOfName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return 'VPE';
  return t.split(/\s+/).filter(Boolean)[0] || t;
}

export function dateAndMeetingNoBlock(meetingDateDisplay: string, meetingNumber: string): string {
  const no = String(meetingNumber ?? '—').trim() || '—';
  return `📅 Date: ${meetingDateDisplay}\n🔢 Meeting No: ${no}\n\n`;
}

/** Regards,\n{First}. VPE\n{Club} */
export function vpeRegardsSignatureBlock(vpeFullName: string, clubName: string): string {
  const first = firstWordOfName(vpeFullName);
  return `\n\nRegards,\n${first}. VPE\n${clubName}`;
}
