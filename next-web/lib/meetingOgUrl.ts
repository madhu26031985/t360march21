/** Where the OG API will be served from (preview + production use the same canonical host when possible). */
const DEFAULT_SITE_ORIGIN = 'https://app.t360.in';

export type MeetingOgTheme = 'default' | 'minimal' | 'vibrant';

export interface MeetingOgImageOptions {
  theme?: MeetingOgTheme;
  /** Absolute URL for the logo; defaults to NEXT_PUBLIC_OG_LOGO_URL (or OG_LOGO_URL in server bundles). */
  logoUrl?: string;
}

/** URL for `/api/og/meeting/[id]` — use inside `generateMetadata`, layout `metadata`, or share builders. */
export function meetingOgImageUrl(
  meetingId: string,
  options?: MeetingOgImageOptions,
): string {
  const origin =
    typeof process.env.NEXT_PUBLIC_SITE_ORIGIN === 'string'
      ? process.env.NEXT_PUBLIC_SITE_ORIGIN.replace(/\/$/, '')
      : DEFAULT_SITE_ORIGIN;

  const pathname = `/api/og/meeting/${encodeURIComponent(meetingId)}`;
  const url = new URL(pathname, origin);

  const theme = options?.theme ?? 'default';
  url.searchParams.set('theme', theme);

  if (options?.logoUrl) {
    url.searchParams.set('logo', options.logoUrl);
  }

  return url.toString();
}
