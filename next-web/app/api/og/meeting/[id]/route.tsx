import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getMeetingOgPayload } from '@/lib/meetingOgPayload';
import { paletteFor } from '@/lib/ogMeetingThemes';
import type { MeetingOgTheme } from '@/lib/meetingOgUrl';

export const runtime = 'edge';

/**
 * WhatsApp renders a small square thumbnail on the left and shows title/description
 * on the right. To keep the right side clean (domain-only), we render *all* meeting
 * details into a square OG image.
 */
const WIDTH = 600;
const HEIGHT = 600;
const INNER_PADDING = 36;

function clip(value: string, max: number) {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const meetingId = decodeURIComponent(params.id ?? '').trim();
  if (!meetingId) {
    return new Response('Missing meeting id', { status: 400 });
  }

  const themeParam = (
    request.nextUrl.searchParams.get('theme') ?? 'default'
  ).toLowerCase();
  const theme: MeetingOgTheme =
    themeParam === 'minimal' || themeParam === 'vibrant' ? themeParam : 'default';
  const p = paletteFor(theme);

  let payload = await getMeetingOgPayload(meetingId);
  if (request.nextUrl.searchParams.get('club')) {
    payload = {
      ...payload,
      clubName: decodeURIComponent(request.nextUrl.searchParams.get('club') ?? ''),
      meetingTitle: decodeURIComponent(request.nextUrl.searchParams.get('title') ?? ''),
      meetingDate: decodeURIComponent(request.nextUrl.searchParams.get('date') ?? ''),
      meetingNumberLabel: decodeURIComponent(
        request.nextUrl.searchParams.get('meetingNumber') ?? '',
      ),
    };
  }

  const clubName = clip(payload.clubName || 'Club', 46);
  const meetingTitle = clip(payload.meetingTitle || 'Agenda', 56);
  const meetingDate = clip(payload.meetingDate || '', 48);
  const meetingNumber = clip(payload.meetingNumberLabel || '', 40);

  return new ImageResponse(
    OGCanvas({
      palette: p,
      clubName,
      meetingTitle,
      meetingDate,
      meetingNumber,
    }),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}

function OGCanvas(props: {
  palette: ReturnType<typeof paletteFor>;
  clubName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingNumber: string;
}) {
  const { palette, clubName, meetingTitle, meetingDate, meetingNumber } = props;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.pageBackground,
      }}
    >
      <div
        style={{
          width: WIDTH - INNER_PADDING * 2,
          height: HEIGHT - INNER_PADDING * 2,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 28,
          overflow: 'hidden',
          border: `2px solid ${palette.frameBorderColor}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          backgroundColor: palette.contentPaneBackground,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingLeft: 38,
            paddingRight: 38,
            paddingTop: 38,
            paddingBottom: 30,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              flexShrink: 0,
              flexGrow: 1,
            }}
          >
            <div
              style={{
                width: 72,
                height: 8,
                borderRadius: 4,
                backgroundColor: palette.accentBar,
                marginBottom: 10,
              }}
            />
            <div
              style={{
                fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
                fontSize: 40,
                lineHeight: 1.1,
                fontWeight: 800,
                letterSpacing: -2,
                color: palette.clubColor,
              }}
            >
              {clubName}
            </div>

            <div
              style={{
                fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
                fontSize: 26,
                lineHeight: 1.24,
                fontWeight: 600,
                letterSpacing: -0.8,
                color: palette.titleColor,
                marginTop: 6,
              }}
            >
              {meetingTitle}
            </div>

            <div
              style={{
                width: '100%',
                height: 1,
                marginTop: 12,
                marginBottom: 4,
                backgroundColor: palette.dividerColor,
              }}
            />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <MetaLine color={palette.metaColor}>📅 {meetingDate || 'Date TBD'}</MetaLine>
              <MetaLine color={palette.metaColor}>🔖 {meetingNumber || 'Meeting'}</MetaLine>
            </div>
          </div>

          <div
            style={{
              fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
              fontSize: 18,
              lineHeight: 1.3,
              fontWeight: 600,
              color: palette.footerColor,
            }}
          >
            Powered by app.t360.in
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaLine(props: { children: any; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        fontSize: 20,
        lineHeight: 1.28,
        fontWeight: 500,
        letterSpacing: -0.2,
        color: props.color,
      }}
    >
      {props.children}
    </div>
  );
}
