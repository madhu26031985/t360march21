/**
 * Toastmasters-style default qualification by speech category and total seconds.
 * User selection always overrides; this only supplies suggestions when not overridden.
 */

export type TimerSpeechCategory =
  | 'prepared_speaker'
  | 'table_topic_speaker'
  | 'educational_session'
  | 'evaluation'
  | string;

const SEC = 1;
const MIN = 60 * SEC;

/** Prepared: 0–5 min No, 5:00–7:30 Yes, after 7:30 No */
function preparedSpeakerQualified(totalSeconds: number): boolean {
  if (totalSeconds < 5 * MIN) return false;
  if (totalSeconds <= 7.5 * MIN) return true;
  return false;
}

/** Table topics: 0–1 min No, 1:00–1:59 Yes, 2:00+ No */
function tableTopicQualified(totalSeconds: number): boolean {
  if (totalSeconds < 1 * MIN) return false;
  if (totalSeconds < 2 * MIN) return true;
  return false;
}

/** Educational: 0–15 min No, above 15 through 25 Yes, above 25 No */
function educationalQualified(totalSeconds: number): boolean {
  if (totalSeconds <= 15 * MIN) return false;
  if (totalSeconds <= 25 * MIN) return true;
  return false;
}

/** Evaluation: 0–2 min No, 2:00–3:30 Yes, above 3:30 No */
function evaluationQualified(totalSeconds: number): boolean {
  if (totalSeconds < 2 * MIN) return false;
  if (totalSeconds <= 3.5 * MIN) return true;
  return false;
}

/**
 * @returns suggested qualified flag, or `null` if category has no rule (leave unchanged).
 */
export function suggestTimerQualification(
  speechCategory: TimerSpeechCategory,
  totalSeconds: number
): boolean | null {
  if (totalSeconds <= 0) return null;

  switch (speechCategory) {
    case 'prepared_speaker':
      return preparedSpeakerQualified(totalSeconds);
    case 'table_topic_speaker':
      return tableTopicQualified(totalSeconds);
    case 'educational_session':
      return educationalQualified(totalSeconds);
    case 'evaluation':
      return evaluationQualified(totalSeconds);
    default:
      return null;
  }
}
