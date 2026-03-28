/**
 * VPE WhatsApp nudges for prepared speakers who booked but have not filled
 * Pathway / speech title / evaluation form in app_evaluation_pathway.
 * Logic aligned with My Journey `preparedSpeakerNeedsSpeechDetailsAlert`.
 */

import { dateAndMeetingNoBlock, vpeRegardsSignatureBlock } from '@/lib/vpeWhatsAppMessageParts';

export type EvaluationPathwaySpeechRow = {
  user_id?: string | null;
  role_name?: string | null;
  speech_title?: string | null;
  pathway_name?: string | null;
  level?: number | null;
  project_name?: string | null;
  evaluation_form?: string | null;
  comments_for_evaluator?: string | null;
  assigned_evaluator_id?: string | null;
};

export function pathwayRowHasSpeechDetails(p: EvaluationPathwaySpeechRow | null | undefined): boolean {
  if (!p) return false;
  return !!(
    p.speech_title?.trim() ||
    p.pathway_name?.trim() ||
    p.level != null ||
    p.project_name?.trim() ||
    p.evaluation_form?.trim() ||
    p.comments_for_evaluator?.trim()
  );
}

export function firstNameFromFullName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return 'there';
  return t.split(/\s+/).filter(Boolean)[0] || t;
}

export function buildPreparedSpeakerSpeechDetailsWhatsApp(params: {
  speakerFirstName: string;
  vpeName: string;
  clubName: string;
  meetingDateDisplay: string;
  meetingNumber: string;
}): string {
  const { speakerFirstName, vpeName, clubName, meetingDateDisplay, meetingNumber } = params;
  return (
    `Hello ${speakerFirstName}\n\n` +
    dateAndMeetingNoBlock(meetingDateDisplay, meetingNumber) +
    `Congratulations on confirming your Prepared Speech. Wishing you the very best!\n\n` +
    `Kindly update your Pathway details, speech title, and evaluation form in the app. This will support proper agenda setup and help the evaluator provide accurate feedback.\n\n` +
    `Looking forward to your speech.` +
    vpeRegardsSignatureBlock(vpeName, clubName)
  );
}
