import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** Notion-style palette for the timer module. */
export const NOTION_TIMER = {
  pageBg: '#F7F7F5',
  card: '#FFFFFF',
  border: '#E5E5E3',
  text: '#111111',
  textSecondary: '#787774',
  accent: '#2F3437',
} as const;

const MINUTE_MS = 60_000;

type TimerMinuteProgressRingProps = {
  size: number;
  /** Total elapsed time in milliseconds (sub-minute rotation uses remainder). */
  elapsedMs: number;
  trackColor?: string;
  progressColor?: string;
  dotColor?: string;
  strokeWidth?: number;
};

/**
 * One full ring = 60 seconds; progress and dot reset each minute.
 * Expect `elapsedMs` to update smoothly while running (parent drives re-renders).
 */
export function TimerMinuteProgressRing({
  size,
  elapsedMs,
  trackColor = NOTION_TIMER.border,
  progressColor = NOTION_TIMER.accent,
  dotColor = NOTION_TIMER.accent,
  strokeWidth,
}: TimerMinuteProgressRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const sw = strokeWidth ?? Math.max(5, size * 0.045);
  const r = size / 2 - sw / 2 - 2;
  const circ = 2 * Math.PI * r;

  const frac = useMemo(() => {
    const m = ((elapsedMs % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
    return m / MINUTE_MS;
  }, [elapsedMs]);

  const dashOffset = circ * (1 - frac);

  const dot = useMemo(() => {
    const rad = -Math.PI / 2 + frac * 2 * Math.PI;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }, [cx, cy, r, frac]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={trackColor}
          strokeWidth={sw}
          fill="none"
        />
        {frac > 0.001 ? (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={progressColor}
            strokeWidth={sw}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : null}
        <Circle cx={dot.x} cy={dot.y} r={Math.max(4, sw * 0.55)} fill={dotColor} />
      </Svg>
    </View>
  );
}
