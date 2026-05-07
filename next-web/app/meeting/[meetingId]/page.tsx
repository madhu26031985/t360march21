import type { Metadata } from 'next';
import { getMeetingOgPayload } from '@/lib/meetingOgPayload';
import type { OgTheme } from '@/lib/meetingOg';
import { generateOgImageUrl } from '@/lib/meetingOg';

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://app.t360.in';

interface MeetingPageProps {
  params: { meetingId: string };
}

/**
 * Prefer matching your real theme from `?skin=` or persisted club preference —
 * defaults to WhatsApp-safe `default`; override by passing OgTheme.
 */
async function preferredOgTheme(meetingId: string): Promise<OgTheme> {
  void meetingId;
  return 'default';
}

/** Server Component metadata — crawlers consume this HTML head for link previews. */
export async function generateMetadata({ params }: MeetingPageProps): Promise<Metadata> {
  const id = decodeURIComponent(params.meetingId);
  const payload = await getMeetingOgPayload(id);
  const theme = await preferredOgTheme(id);

  const pageUrl = `${SITE_ORIGIN.replace(/\/$/, '')}/agenda/${encodeURIComponent(id)}`;
  const meeting = {
    id,
    formattedDate: payload.meetingDate,
    formattedTime: payload.meetingTime,
    meetingNumber: payload.meetingNumberLabel.replace(/^Meeting\s+/i, ''),
  };
  const club = { name: payload.clubName };
  const ogImageAbsolute = generateOgImageUrl(meeting, club, theme as OgTheme);

  const title = `${club.name} - Meeting ${meeting.meetingNumber || 'Agenda'}`;
  const description = `${meeting.formattedDate} • ${meeting.formattedTime || '20:30 - 21:30'}`;

  return {
    metadataBase: new URL(SITE_ORIGIN.replace(/\/$/, '') || 'https://app.t360.in'),
    title,
    description,
    openGraph: {
      type: 'website',
      url: pageUrl,
      siteName: 'T360',
      title,
      description,
      locale: 'en_US',
      images: [
        {
          url: ogImageAbsolute,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageAbsolute],
    },
  };
}

export default async function MeetingPublicPage({ params }: MeetingPageProps) {
  const id = decodeURIComponent(params.meetingId);
  const payload = await getMeetingOgPayload(id);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>{payload.clubName}</h1>
      <p style={{ margin: '0 0 8px' }}>{payload.meetingTitle}</p>
      <p style={{ margin: 0, opacity: 0.75 }}>
        {payload.meetingDate} · {payload.meetingNumberLabel}
      </p>
      <p style={{ marginTop: 24 }}>
        Embed your SPA / deep link opener here — this page exists so metadata can resolve on the Next app.
      </p>
      <section style={{ marginTop: 32 }}>
        <p style={{ fontSize: 14, opacity: 0.7 }}>Generated OG preview</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- static preview */}
        <img
          alt="Open Graph preview"
          src={generateOgImageUrl(
            {
              id,
              formattedDate: payload.meetingDate,
              formattedTime: payload.meetingTime,
              meetingNumber: payload.meetingNumberLabel.replace(/^Meeting\s+/i, ''),
            },
            { name: payload.clubName },
            'default',
          )}
          width={600}
          style={{ marginTop: 8, borderRadius: 8, border: '1px solid #e2e8f0', maxWidth: '100%' }}
        />
      </section>
    </main>
  );
}
