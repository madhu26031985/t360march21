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

/** Full-width OG image text layout (no left thumbnail box). */
const TX = 72;

/** Wide OG image for WhatsApp: 1200x630, vertical text stack. */
exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};
  const clubName = normalize(qs.clubName, 'T360 Club');
  const meetingDate = normalize(qs.meetingDate, 'Upcoming Meeting');
  const meetingLabel = normalize(qs.meetingLabel, 'Meeting Agenda');
  const meetingTime = String(qs.meetingTime || '').trim().slice(0, 40);

  const safeClub = escapeXml(clubName);
  const safeDate = escapeXml(meetingDate);
  const safeMeeting = escapeXml(meetingLabel);
  const safeTime = escapeXml(meetingTime || 'Time TBD');
  const safePowered = 'app.t360.in';

  const meetingY = 292;
  const timeLine = `<text x="${TX}" y="366" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="500" fill="#334155">${safeTime}</text>`;
  const poweredY = 446;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Meeting preview">
  <rect width="1200" height="630" fill="#f8fafc" />
  <rect x="24" y="24" width="1152" height="582" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
  <text x="${TX}" y="146" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#0f172a">${safeClub}</text>
  <text x="${TX}" y="220" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="500" fill="#334155">${safeDate}</text>
  ${timeLine}
  <text x="${TX}" y="${meetingY}" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="700" fill="#0d47a1">${safeMeeting}</text>
  <text x="${TX}" y="${poweredY}" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="600" fill="#64748b">${safePowered}</text>
</svg>`;

  const cacheHeaders = {
    'Cache-Control': 'public, max-age=300',
  };

  try {
    const sharp = require('sharp');
    let raster = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();

    const pngBuffer = await sharp(raster).resize(1200, 630).png().toBuffer();

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
