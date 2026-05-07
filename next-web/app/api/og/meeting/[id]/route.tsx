import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const clubName = searchParams.get('club') || 'T-360 Training Club';
  const date = searchParams.get('date') || 'May 7, 2026';
  const meetingNo = searchParams.get('no') || '0205';
  const time = searchParams.get('time') || '20:30 - 21:30';
  const theme = (searchParams.get('theme') || 'default').toLowerCase();

  const themes = {
    default: { bg: '#ffffff', text: '#111827', subtext: '#374151', accent: '#1e88e5' },
    minimal: { bg: '#f8fafc', text: '#0f172a', subtext: '#475569', accent: '#334155' },
    vibrant: { bg: '#0f172a', text: '#ffffff', subtext: '#e2e8f0', accent: '#67e8f9' },
  };

  const t = themes[theme as keyof typeof themes] || themes.default;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: 1200,
          height: 630,
          background: t.bg,
          padding: '80px 90px',
          flexDirection: 'column',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: t.text,
          gap: '28px',
        }}
      >
        <div style={{ fontSize: '58px', fontWeight: '700', lineHeight: 1.1 }}>
          {clubName}
        </div>

        <div style={{ fontSize: '42px', color: t.subtext }}>
          {date}
        </div>

        <div style={{ fontSize: '46px', fontWeight: '700', color: t.accent }}>
          Meeting {meetingNo}
        </div>

        <div style={{ fontSize: '42px', color: t.subtext }}>
          {time}
        </div>

        <div
          style={{
            marginTop: 'auto',
            fontSize: '32px',
            color: '#64748b',
            fontWeight: '600',
          }}
        >
          app.t360.in
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
