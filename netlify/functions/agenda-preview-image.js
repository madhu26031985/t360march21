function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalize(value, fallback) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 80);
}

/** Compact square OG image: vertical stack. PNG output for WhatsApp (SVG og:image is often ignored). */
exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};
  const clubName = normalize(qs.clubName, 'T360 Club');
  const meetingDate = normalize(qs.meetingDate, 'Upcoming Meeting');
  const meetingLabel = normalize(qs.meetingLabel, 'Meeting Agenda');
  const meetingTime = String(qs.meetingTime || '').trim().slice(0, 40);

  const safeClub = escapeXml(clubName);
  const safeDate = escapeXml(meetingDate);
  const safeMeeting = escapeXml(meetingLabel);
  const safeTime = escapeXml(meetingTime);
  const safePowered = 'Powered by app.t360.in';

  const timeLine =
    meetingTime !== ''
      ? `<text x="44" y="222" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="500" fill="#475569">${safeTime}</text>`
      : '';

  const poweredY = meetingTime !== '' ? 268 : 222;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-label="Meeting preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d47a1" />
      <stop offset="100%" stop-color="#1976d2" />
    </linearGradient>
  </defs>
  <rect width="480" height="480" fill="url(#bg)" />
  <rect x="20" y="20" width="440" height="440" rx="20" fill="#ffffff" />
  <text x="44" y="58" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="#0f172a">${safeClub}</text>
  <text x="44" y="94" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="500" fill="#64748b">${safeDate}</text>
  <rect x="44" y="108" width="392" height="48" rx="10" fill="#e8f0ff" stroke="#0d47a1" stroke-width="1.5" />
  <text x="56" y="140" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#0d47a1">${safeMeeting}</text>
  ${timeLine}
  <text x="44" y="${poweredY}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="500" fill="#64748b">${safePowered}</text>
</svg>`;

  const cacheHeaders = {
    'Cache-Control': 'public, max-age=300',
  };

  try {
    const sharp = require('sharp');
    const pngBuffer = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
    return {
      statusCode: 200,
      headers: {
        ...cacheHeaders,
        'Content-Type': 'image/png',
      },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('[agenda-preview-image] PNG render failed, falling back to SVG:', err);
    return {
      statusCode: 200,
      headers: {
        ...cacheHeaders,
        'Content-Type': 'image/svg+xml; charset=utf-8',
      },
      body: svg,
    };
  }
};
