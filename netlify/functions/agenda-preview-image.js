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

/** Compact square OG image thumbnail used by WhatsApp card. */
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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-label="Meeting preview">
  <rect width="480" height="480" fill="#ffffff" />
  <rect x="22" y="22" width="436" height="436" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="44" y="90" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#0f172a">${safeClub}</text>
  <text x="44" y="138" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="500" fill="#475569">${safeDate}</text>
  <text x="44" y="178" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600" fill="#0d47a1">${safeMeeting}</text>
  <text x="44" y="218" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="500" fill="#475569">${safeTime}</text>
</svg>`;

  const cacheHeaders = {
    'Cache-Control': 'public, max-age=300',
  };

  try {
    const sharp = require('sharp');
    let raster = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();

    const pngBuffer = await sharp(raster).resize(240, 240).png().toBuffer();

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
