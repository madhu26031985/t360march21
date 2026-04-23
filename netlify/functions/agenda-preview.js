const PLACEHOLDER_CLUB_ID = '00000000-0000-0000-0000-000000000000';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function prettifyBrandSlug(rawBrand) {
  if (!rawBrand) return '';
  const normalized = String(rawBrand).trim().replace(/[-_]+/g, ' ');
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDateShort(rawDate) {
  if (!rawDate) return '';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatTimePart(rawTime) {
  if (!rawTime) return '';
  const t = String(rawTime).trim();
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function formatTimeRange(startTime, endTime) {
  const a = formatTimePart(startTime);
  const b = formatTimePart(endTime);
  if (a && b) return `${a} - ${b}`;
  return a || b || '';
}

function resolveTargetPath({ meetingId, brand, skin }) {
  const safeMeetingId = encodeURIComponent(meetingId);
  const safeBrand = brand ? encodeURIComponent(brand) : '';
  const base = safeBrand ? `/weblogin/${safeBrand}/a/${safeMeetingId}` : `/weblogin/a/${safeMeetingId}`;
  if (skin === 'minimal' || skin === 'vibrant') return `${base}?skin=${skin}`;
  return base;
}

async function loadPublicAgendaPayload({ meetingId, supabaseUrl, supabaseAnonKey }) {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_public_meeting_agenda_by_club`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_club_id: PLACEHOLDER_CLUB_ID,
      p_meeting_no: '0',
      p_meeting_id: meetingId,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  if (!data || typeof data !== 'object') return null;
  return data;
}

exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};
  const meetingId = String(qs.meetingId || '').trim().toLowerCase();
  const brand = String(qs.brand || '').trim();
  const skin = String(qs.skin || '').trim().toLowerCase();
  const fallbackClubName = prettifyBrandSlug(brand) || 'Club';

  const targetPath = resolveTargetPath({ meetingId, brand, skin });
  const siteOrigin = process.env.EXPO_PUBLIC_AGENDA_WEB_HOST?.replace(/\/$/, '') || 'https://app.t360.in';
  const targetUrl = `${siteOrigin}${targetPath}`;

  let title = `${fallbackClubName} - Meeting Agenda`;
  let description = 'Public meeting agenda';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_WEB_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  if (isUuid(meetingId) && supabaseUrl && supabaseAnonKey) {
    try {
      const payload = await loadPublicAgendaPayload({ meetingId, supabaseUrl, supabaseAnonKey });
      const clubName = payload?.club?.club_name?.trim() || fallbackClubName;
      const dateText = formatDateShort(payload?.meeting?.meeting_date);
      const timeText = formatTimeRange(payload?.meeting?.meeting_start_time, payload?.meeting?.meeting_end_time);
      const meetingNo = payload?.meeting?.meeting_number ? `Meeting ${payload.meeting.meeting_number}` : '';

      title = `${clubName} - Meeting Agenda`;
      const parts = [dateText, timeText, meetingNo].filter(Boolean);
      description = parts.length > 0 ? parts.join(' | ') : clubName;
    } catch {
      // Keep fallback title/description.
    }
  } else {
    description = fallbackClubName;
  }

  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedTargetUrl = escapeHtml(targetUrl);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapedTargetUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta http-equiv="refresh" content="0;url=${escapedTargetUrl}" />
  </head>
  <body>
    <p>Redirecting to agenda... <a href="${escapedTargetUrl}">Open</a></p>
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
    },
    body: html,
  };
};
