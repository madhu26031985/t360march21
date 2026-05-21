import { MeetingReportsGrid, type MeetingReportsTheme } from '@/components/MeetingReportsGrid';

export type ClubReportsTheme = MeetingReportsTheme;

type ClubReportsListProps = {
  theme: ClubReportsTheme;
  onReportPress: (path: string) => void;
};

/** @deprecated Prefer MeetingReportsGrid — kept for compatibility. */
export function ClubReportsList({ theme, onReportPress }: ClubReportsListProps) {
  return (
    <MeetingReportsGrid
      theme={theme}
      onReportPress={onReportPress}
      showHeader={false}
    />
  );
}
