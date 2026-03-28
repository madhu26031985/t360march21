import { dateAndMeetingNoBlock, vpeRegardsSignatureBlock } from '@/lib/vpeWhatsAppMessageParts';

type MeetingCtx = {
  meetingDateDisplay: string;
  meetingNumber: string;
};

export function buildToastmasterThemeNudgeWhatsApp(params: {
  toastmasterFirstName: string;
  vpeName: string;
  clubName: string;
} & MeetingCtx): string {
  const { toastmasterFirstName, vpeName, clubName, meetingDateDisplay, meetingNumber } = params;
  return (
    `Hello ${toastmasterFirstName}\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `Thank you for serving as Toastmaster for our upcoming meeting!\n\n` +
    `Please add the Theme of the Day in the app so we can finalize the agenda.` +
    vpeRegardsSignatureBlock(vpeName, clubName)
  );
}

export function buildEducationalSpeakerTitleNudgeWhatsApp(params: {
  speakerFirstName: string;
  vpeName: string;
  clubName: string;
} & MeetingCtx): string {
  const { speakerFirstName, vpeName, clubName, meetingDateDisplay, meetingNumber } = params;
  return (
    `Hello ${speakerFirstName}\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `Thank you for presenting the educational segment!\n\n` +
    `Please add your educational session title in the app to help the team complete the agenda.` +
    vpeRegardsSignatureBlock(vpeName, clubName)
  );
}

/** When the VPE is the booked educational speaker (no WhatsApp self-nudge); copy for their reference. */
export function buildEducationalVpeSelfReminderWhatsApp(params: {
  meetingDateDisplay: string;
  meetingNumber: string;
  vpeFirstName: string;
  clubName: string;
}): string {
  const { meetingDateDisplay, meetingNumber, vpeFirstName, clubName } = params;
  return (
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `You are the educational speaker, please add the title.` +
    `\n\nRegards,\n${vpeFirstName}. VPE\n${clubName}`
  );
}

export function buildKeynoteTitleNudgeWhatsApp(params: {
  speakerFirstName: string;
  vpeName: string;
  clubName: string;
} & MeetingCtx): string {
  const { speakerFirstName, vpeName, clubName, meetingDateDisplay, meetingNumber } = params;
  return (
    `Hello ${speakerFirstName}\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `Thank you for delivering the keynote for our upcoming meeting!\n\n` +
    `Please add your keynote title in the app so it appears correctly on the agenda.` +
    vpeRegardsSignatureBlock(vpeName, clubName)
  );
}

export function buildEvaluatorPrepNudgeWhatsApp(params: {
  evaluatorFirstName: string;
  speakerFullName: string;
  vpeName: string;
  clubName: string;
} & MeetingCtx): string {
  const { evaluatorFirstName, speakerFullName, vpeName, clubName, meetingDateDisplay, meetingNumber } = params;
  return (
    `Hello ${evaluatorFirstName}\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `You are assigned to evaluate ${speakerFullName}'s prepared speech for our upcoming meeting.\n\n` +
    `Please review their speech title, Pathway details, and evaluation form in the app before the meeting so you can give accurate, supportive feedback.\n\n` +
    `Thank you for supporting our members!` +
    vpeRegardsSignatureBlock(vpeName, clubName)
  );
}
