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

export function buildGrammarianDailyElementsNudgeWhatsApp(params: {
  grammarianFirstName: string;
  vpeName: string;
  clubName: string;
} & MeetingCtx): string {
  const { grammarianFirstName, vpeName, clubName, meetingDateDisplay, meetingNumber } = params;
  return (
    `Hello ${grammarianFirstName}\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `Thank you for taking up the Grammarian role for this meeting.\n\n` +
    `Please update these details in the app before the meeting:\n` +
    `• Word of the Day\n` +
    `• Quote of the Day\n` +
    `• Idiom of the Day\n\n` +
    `This helps the team and members prepare better.\n\n` +
    `Thank you for your support!` +
    vpeRegardsSignatureBlock(vpeName, clubName)
  );
}

export function buildVpprMeetingUpdateWhatsApp(params: {
  vpeName: string;
  clubName: string;
  toastmasterName?: string | null;
  generalEvaluatorName?: string | null;
  tableTopicMasterName?: string | null;
  educationalSpeakerName?: string | null;
  themeOfTheDay?: string | null;
  educationalTitle?: string | null;
} & MeetingCtx): string {
  const {
    vpeName,
    clubName,
    meetingDateDisplay,
    meetingNumber,
    toastmasterName,
    generalEvaluatorName,
    tableTopicMasterName,
    educationalSpeakerName,
    themeOfTheDay,
    educationalTitle,
  } = params;

  const lines = [
    toastmasterName ? `• Toastmaster of the Day: ${toastmasterName}` : null,
    generalEvaluatorName ? `• General Evaluator: ${generalEvaluatorName}` : null,
    tableTopicMasterName ? `• Table Topics Master: ${tableTopicMasterName}` : null,
    educationalSpeakerName ? `• Educational Speaker: ${educationalSpeakerName}` : null,
    themeOfTheDay ? `• Theme of the Day: ${themeOfTheDay}` : null,
    educationalTitle ? `• Educational Title: ${educationalTitle}` : null,
  ].filter(Boolean) as string[];

  return (
    `Hello VPPR\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `Sharing the latest meeting updates available in the app:\n\n` +
    `${lines.join('\n')}\n\n` +
    `Please use this for promotions and member communication.\n\n` +
    `Thank you!` +
    vpeRegardsSignatureBlock(vpeName, clubName)
  );
}

export function buildInviteGuestWelcomeWhatsApp(params: {
  vpeName: string;
  clubName: string;
} & MeetingCtx): string {
  const { vpeName, clubName, meetingDateDisplay, meetingNumber } = params;
  return (
    `Hello and a Warm Welcome! 🌟\n\n` +
    `I’m ${vpeName}, Vice President Education (VPE) of ${clubName}.\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `We are excited to have you with us. To make your journey smoother and more enjoyable, please install our club app and take a quick look around.\n\n` +
    `In the app, you can:\n` +
    `• Explore upcoming meetings\n` +
    `• Stay updated with club activities\n\n` +
    `You are always welcome here — we look forward to seeing you grow with us! 🚀\n\n` +
    `Warm regards,\n${vpeName}. VPE\n${clubName}`
  );
}
