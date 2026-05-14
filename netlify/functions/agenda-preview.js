const PLACEHOLDER_CLUB_ID = '00000000-0000-0000-0000-000000000000';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape text for meta attributes; newlines as &#10; for multi-line OG descriptions (e.g. WhatsApp). */
function escapeOgDescription(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r\n|\n|\r/g, '&#10;');
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

/** Match the requested preview style text line. */
const POWERED_BY = 'Powered by T360';

function buildVerticalOgDescription(lines) {
  const body = lines.filter(Boolean).join('\n');
  return body ? `${body}\n${POWERED_BY}` : POWERED_BY;
}

function parsePathFallback(pathname) {
  const path = String(pathname || '');
  // Original public long agenda paths:
  // /{brand}/agenda/{meetingNo}/{meetingId}
  // /weblogin/{brand}/agenda/{meetingNo}/{meetingId}
  let m = path.match(/^\/(?:weblogin\/)?([^/]+)\/agenda\/([^/]+)\/([^/?#]+)/i);
  if (m) {
    return {
      brand: decodeURIComponent(m[1] || ''),
      meetingNo: decodeURIComponent(m[2] || ''),
      meetingId: decodeURIComponent(m[3] || ''),
      mode: 'agenda',
    };
  }

  // Original branded short paths:
  // /{brand}/a/{meetingId}
  // /weblogin/{brand}/a/{meetingId}
  m = path.match(/^\/(?:weblogin\/)?([^/]+)\/a\/([^/?#]+)/i);
  if (m) {
    return {
      brand: decodeURIComponent(m[1] || ''),
      meetingNo: '',
      meetingId: decodeURIComponent(m[2] || ''),
      mode: '',
    };
  }

  // Original short path:
  // /a/{meetingId}
  m = path.match(/^\/a\/([^/?#]+)/i);
  if (m) {
    return {
      brand: '',
      meetingNo: '',
      meetingId: decodeURIComponent(m[1] || ''),
      mode: '',
    };
  }

  // Function-routed long agenda path:
  // /.netlify/functions/agenda-preview/agenda/{brand}/{meetingNo}/{meetingId}
  m = path.match(/\/\.netlify\/functions\/agenda-preview\/agenda\/([^/]+)\/([^/]+)\/([^/?#]+)/i);
  if (m) {
    return {
      brand: decodeURIComponent(m[1] || ''),
      meetingNo: decodeURIComponent(m[2] || ''),
      meetingId: decodeURIComponent(m[3] || ''),
      mode: 'agenda',
    };
  }

  // Function-routed branded short path:
  // /.netlify/functions/agenda-preview/brand/{brand}/{meetingId}
  m = path.match(/\/\.netlify\/functions\/agenda-preview\/brand\/([^/]+)\/([^/?#]+)/i);
  if (m) {
    return {
      brand: decodeURIComponent(m[1] || ''),
      meetingNo: '',
      meetingId: decodeURIComponent(m[2] || ''),
      mode: '',
    };
  }

  // Function-routed short path:
  // /.netlify/functions/agenda-preview/short/{meetingId}
  m = path.match(/\/\.netlify\/functions\/agenda-preview\/short\/([^/?#]+)/i);
  if (m) {
    return {
      brand: '',
      meetingNo: '',
      meetingId: decodeURIComponent(m[1] || ''),
      mode: '',
    };
  }

  return { brand: '', meetingNo: '', meetingId: '', mode: '' };
}

function buildPreviewImageUrl({ siteOrigin, clubName, dateText, meetingLabel, timeText }) {
  // Bump this when OG image layout changes to force social crawlers to refresh image cache.
  const OG_IMAGE_REV = '2026-05-07-u2c';
  const qs = new URLSearchParams();
  if (clubName) qs.set('club', clubName);
  if (dateText) qs.set('date', dateText);
  if (meetingLabel) qs.set('no', String(meetingLabel).replace(/^Meeting\s+/i, '').trim() || meetingLabel);
  if (timeText) qs.set('time', timeText);
  qs.set('v', OG_IMAGE_REV);
  return `${siteOrigin}/.netlify/functions/agenda-preview-image?${qs.toString()}`;
}

/** Static OG card (1200×630 JPEG) generated at build → /images/og-images/agenda-preview.jpg */
function resolveStaticOgImageUrl(siteOrigin) {
  const fromEnv = process.env.PUBLIC_AGENDA_OG_IMAGE_URL?.trim();
  if (fromEnv) return fromEnv;
  return `${String(siteOrigin).replace(/\/$/, '')}/images/og-images/agenda-preview.jpg`;
}

function findToastmasterOfDayName(items) {
  if (!Array.isArray(items)) return '';
  const row = items.find((it) => {
    const n = String(it.section_name || '').toLowerCase();
    return n.includes('toastmaster') && n.includes('day');
  });
  return row && row.assigned_user_name ? String(row.assigned_user_name).trim() : '';
}

function buildDistrictDivisionAreaLine(club) {
  if (!club || typeof club !== 'object') return '';
  const parts = [club.district, club.division, club.area]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.join(' · ');
}

function buildAgendaHighlightsSnippet(items, maxParts = 4) {
  if (!Array.isArray(items)) return '';
  const labels = [];
  const push = (label) => {
    if (!label || labels.includes(label)) return;
    labels.push(label);
  };
  for (const it of items) {
    if (labels.length >= maxParts) break;
    const low = String(it.section_name || '').toLowerCase();
    if (low.includes('toastmaster of the day')) push('TMOD');
    else if (low.includes('prepared speech')) push('Prepared speeches');
    else if (low.includes('table topic')) push('Table Topics');
    else if (low.includes('general evaluator') && !low.includes('feedback')) push('General Evaluator');
    else if (low.includes('tag team')) push('Tag team');
    else if (low.includes('speech evaluation')) push('Evaluations');
  }
  return labels.join(' · ');
}

function truncateOgText(s, maxLen) {
  const t = String(s || '').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function resolveTargetPath({ meetingId, brand, skin, meetingNo, mode, pv }) {
  if (!meetingId || !isUuid(meetingId)) return '/weblogin/';
  const safeMeetingId = encodeURIComponent(meetingId);
  const normalizedBrand = brand && brand.toLowerCase() === 'weblogin' ? '' : brand;
  const safeBrand = normalizedBrand ? encodeURIComponent(normalizedBrand) : '';
  const safeMeetingNo = encodeURIComponent(String(meetingNo || '0').trim() || '0');
  const isAgendaMode = String(mode || '').toLowerCase() === 'agenda';
  const base = isAgendaMode
    ? `/weblogin/${safeBrand || 'club'}/agenda/${safeMeetingNo}/${safeMeetingId}`
    : safeBrand
      ? `/weblogin/${safeBrand}/a/${safeMeetingId}`
      : `/weblogin/a/${safeMeetingId}`;
  const qp = new URLSearchParams();
  if (skin === 'minimal' || skin === 'vibrant') qp.set('skin', skin);
  if (pv) qp.set('pv', String(pv));
  if (qp.toString()) return `${base}?${qp.toString()}`;
  return base;
}

async function callAgendaRpc({ supabaseUrl, supabaseAnonKey, rpcName, body }) {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${rpcName}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return null;
  const data = await response.json();
  if (!data || typeof data !== 'object') return null;
  return data;
}

async function loadPublicAgendaPayload({ meetingId, supabaseUrl, supabaseAnonKey }) {
  const byClubPayload = await callAgendaRpc({
    supabaseUrl,
    supabaseAnonKey,
    rpcName: 'get_public_meeting_agenda_by_club',
    body: {
      p_club_id: PLACEHOLDER_CLUB_ID,
      p_meeting_no: '0',
      p_meeting_id: meetingId,
    },
  });
  if (byClubPayload) return byClubPayload;

  // Backward-compatible fallback: some environments expose this RPC variant.
  const byMeetingPayload = await callAgendaRpc({
    supabaseUrl,
    supabaseAnonKey,
    rpcName: 'get_public_meeting_agenda',
    body: {
      p_meeting_id: meetingId,
    },
  });
  return byMeetingPayload;
}

exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};
  const fromPath = parsePathFallback(event.path);
  const meetingId = String(qs.meetingId || fromPath.meetingId || '').trim().toLowerCase();
  const brand = String(qs.brand || fromPath.brand || '').trim();
  const meetingNo = String(qs.meetingNo || fromPath.meetingNo || '').trim();
  const mode = String(qs.mode || fromPath.mode || '').trim().toLowerCase();
  const skin = String(qs.skin || '').trim().toLowerCase();
  const pv = String(qs.pv || '').trim();
  const fallbackClubName = prettifyBrandSlug(brand) || 'Club';
  const fallbackMeetingLabel = meetingNo ? `Meeting ${meetingNo}` : 'Meeting Agenda';

  const targetPath = resolveTargetPath({ meetingId, brand, skin, meetingNo, mode, pv });
  const siteOrigin = process.env.EXPO_PUBLIC_AGENDA_WEB_HOST?.replace(/\/$/, '') || 'https://app.t360.in';
  const targetUrl = `${siteOrigin}${targetPath}`;

  let title = fallbackClubName;
  let description = 'Upcoming meeting';
  let previewClubName = fallbackClubName;
  let previewDateText = '';
  let previewMeetingLabel = fallbackMeetingLabel;
  let previewTimeText = 'Time TBD';
  let toastmasterName = '';
  let districtLine = '';
  let highlightsLine = '';
  /** When true, use per-request dynamic PNG from agenda-preview-image (e.g. if static JPEG not deployed). */
  const useDynamicOgImage = String(process.env.PUBLIC_AGENDA_USE_DYNAMIC_OG_IMAGE || '').trim() === '1';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_WEB_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  if (isUuid(meetingId) && supabaseUrl && supabaseAnonKey) {
    try {
      const payload = await loadPublicAgendaPayload({ meetingId, supabaseUrl, supabaseAnonKey });
      const clubName = payload?.club?.club_name?.trim() || fallbackClubName;
      const dateText = formatDateShort(payload?.meeting?.meeting_date);
      const timeText = formatTimeRange(payload?.meeting?.meeting_start_time, payload?.meeting?.meeting_end_time);
      const meetingNumRaw =
        payload?.meeting?.meeting_number != null && String(payload.meeting.meeting_number).trim() !== ''
          ? String(payload.meeting.meeting_number).trim()
          : meetingNo && meetingNo !== '0'
            ? meetingNo
            : '';
      const meetingNoText = meetingNumRaw ? `Meeting ${meetingNumRaw}` : fallbackMeetingLabel;

      toastmasterName = findToastmasterOfDayName(payload?.items);
      districtLine = buildDistrictDivisionAreaLine(payload?.club);
      highlightsLine = buildAgendaHighlightsSnippet(payload?.items);

      previewClubName = clubName;
      previewDateText = dateText;
      previewMeetingLabel = meetingNoText;
      previewTimeText = timeText || 'Time TBD';

      if (meetingNumRaw && dateText) {
        title = `${clubName} - Meeting ${meetingNumRaw} | ${dateText}`;
      } else if (meetingNumRaw) {
        title = `${clubName} - Meeting ${meetingNumRaw}`;
      } else {
        title = clubName;
      }

      const tmodPart = toastmasterName ? `Toastmaster of the Day: ${toastmasterName}` : 'Toastmaster of the Day: TBA';
      const metaParts = [districtLine, highlightsLine].filter(Boolean);
      const tail = metaParts.length ? metaParts.join(' · ') : 'Full meeting agenda';
      description = truncateOgText(`${tmodPart} | ${tail}`, 320);
    } catch {
      // Keep fallback title/description.
    }
  } else {
    description = fallbackMeetingLabel || 'Upcoming meeting';
  }

  const staticOgUrl = resolveStaticOgImageUrl(siteOrigin);
  const previewImageUrl = useDynamicOgImage
    ? buildPreviewImageUrl({
        siteOrigin,
        clubName: previewClubName,
        dateText: previewDateText,
        meetingLabel: previewMeetingLabel,
        timeText: previewTimeText,
      })
    : staticOgUrl;
  const ogImageMime = useDynamicOgImage ? 'image/png' : 'image/jpeg';

  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeOgDescription(description);
  const escapedTargetUrl = escapeHtml(targetUrl);
  const escapedPreviewImageUrl = escapeHtml(previewImageUrl);
  const escapedOgAlt = escapeHtml(
    truncateOgText(`${previewClubName} — ${previewMeetingLabel}${previewDateText ? ` · ${previewDateText}` : ''}`, 200)
  );

  const html = `<!doctype html>
<html lang="en-IN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />
    <link rel="canonical" href="${escapedTargetUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:site_name" content="T-360" />
    <meta property="og:url" content="${escapedTargetUrl}" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:image" content="${escapedPreviewImageUrl}" />
    <meta property="og:image:secure_url" content="${escapedPreviewImageUrl}" />
    <meta property="og:image:type" content="${ogImageMime}" />
    <meta property="og:image:alt" content="${escapedOgAlt}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${escapedPreviewImageUrl}" />
    <meta http-equiv="refresh" content="0;url=${escapedTargetUrl}" />
  </head>
  <body style="margin:0;background:#fff;">
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
    body: html,
  };
};
