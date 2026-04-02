import React from 'react';
import { TimerMinuteProgressRing } from '@/components/timer/TimerMinuteProgressRing';

/** @deprecated Kept for bundle compatibility; the timer UI uses a 60s Notion-style ring. */
export const TIMER_DIAL_MAX_SEC = 600;
export const TIMER_ZONE_GREEN_UNTIL_SEC = 5 * 60;
export const TIMER_ZONE_YELLOW_UNTIL_SEC = 7 * 60;

export type TimerDialStopwatchProps = {
  size: number;
  /** Prefer for smooth sub-second motion on the minute ring. */
  elapsedMs?: number;
  /** Whole seconds; used when `elapsedMs` is omitted (legacy). */
  elapsedSeconds?: number;
  /** Legacy; ignored. */
  dialMaxSec?: number;
  greenUntilSec?: number;
  yellowUntilSec?: number;
  handColor?: string;
  trackColor?: string;
  faceFill?: string;
};

/**
 * Notion-style minute progress ring (one lap per 60s). Implements the legacy name
 * `TimerDialStopwatch` so older call sites and imports do not throw at runtime.
 */
export function TimerDialStopwatch({
  size,
  elapsedMs,
  elapsedSeconds = 0,
  trackColor,
}: TimerDialStopwatchProps) {
  const ms = elapsedMs ?? elapsedSeconds * 1000;
  return (
    <TimerMinuteProgressRing
      size={size}
      elapsedMs={ms}
      {...(trackColor ? { trackColor } : {})}
    />
  );
}

/** Parse MM:SS → total seconds, or null if invalid (minutes 0–99, seconds 0–59). */
export function parseMmSs(input: string): number | null {
  const t = input.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  if (Number.isNaN(min) || Number.isNaN(sec) || sec > 59 || min > 99) return null;
  return min * 60 + sec;
}
