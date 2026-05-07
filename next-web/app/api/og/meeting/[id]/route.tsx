import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

type ThemeName = 'default' | 'minimal' | 'vibrant';

const themes: Record<
  ThemeName,
  { bg: string; squareBg: string; accent: string; text: string; muted: string; border: string }
> = {
  default: {
    bg: '#f8fafc',
    squareBg: '#ffffff',
    accent: '#1e88e5',
    text: '#0f172a',
    muted: '#475569',
    border: '#e2e8f0',
  },
  minimal: {
    bg: '#f1f5f9',
    squareBg: '#ffffff',
    accent: '#475569',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
  },
  vibrant: {
    bg: '#0f172a',
    squareBg: '#1e2937',
    accent: '#67e8f9',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.82)',
    border: 'rgba(148,163,184,0.25)',
  },
};

function clip(value: string, max: number) {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function extractMeetingId(requestUrl: string): string {
  try {
    const u = new URL(requestUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    // /api/og/meeting/[id]
    const idx = parts.lastIndexOf('meeting');
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch {
    // ignore
  }
  return 'meeting-id';
}

function siteOriginFromEnv() {
  return (process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://app.t360.in').replace(/\/$/, '');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const meetingId = extractMeetingId(request.url);

  const clubName = clip(searchParams.get('club') || 'T-360 Training Club', 54);
  const date = clip(searchParams.get('date') || 'May 7, 2026', 40);
  const meetingNo = clip(searchParams.get('no') || '0205', 10);

  const themeParam = (searchParams.get('theme') || 'default').toLowerCase();
  const theme: ThemeName =
    themeParam === 'minimal' || themeParam === 'vibrant' ? themeParam : 'default';
  const t = themes[theme];

  const agendaLink = `${siteOriginFromEnv()}/meeting/${encodeURIComponent(meetingId)}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: WIDTH,
          height: HEIGHT,
          background: t.bg,
          padding: 56,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Inter, sans-serif',
          color: t.text,
        }}
      >
        {/* Left Square Box (no logo) */}
        <div
          style={{
            width: 380,
            height: 380,
            background: t.squareBg,
            borderRadius: 26,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow:
              theme === 'vibrant'
                ? '0 18px 70px rgba(0,0,0,0.45)'
                : '0 14px 60px rgba(15, 23, 42, 0.12)',
            marginRight: 64,
            border: `1px solid ${t.border}`,
            paddingLeft: 30,
            paddingRight: 30,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: -1,
              color: t.text,
              lineHeight: 1.1,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            {clubName}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: t.muted,
              lineHeight: 1.2,
              textAlign: 'center',
              marginBottom: 18,
            }}
          >
            {date}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: 3,
                color: t.muted,
              }}
            >
              MEETING
            </div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 950,
                color: t.accent,
                lineHeight: 1,
                letterSpacing: -2,
              }}
            >
              {meetingNo}
            </div>
          </div>
        </div>

        {/* Right Side Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 26,
          }}
        >
          <div
            style={{
              fontSize: 58,
              fontWeight: 900,
              lineHeight: 1.06,
              letterSpacing: -2,
              color: t.text,
            }}
          >
            Meeting agenda
          </div>

          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: t.muted,
              lineHeight: 1.2,
            }}
          >
            {agendaLink}
          </div>

          <div
            style={{
              marginTop: 'auto',
              fontSize: 30,
              color: t.muted,
              fontWeight: 700,
              alignSelf: 'flex-end',
            }}
          >
            app.t360.in
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
