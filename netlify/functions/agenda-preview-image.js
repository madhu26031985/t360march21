const fs = require('fs');
const path = require('path');

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

function readT360LogoBuffer() {
  const candidates = [
    path.join(__dirname, 'assets/images/icon.png'),
    path.join(__dirname, '../../assets/images/icon.png'),
    path.join(process.cwd(), 'assets/images/icon.png'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

/**
 * App store icons are often square with large empty margins. Cropping the central
 * ~53% (typical logo bounds) before resize makes colors fill the OG thumbnail; otherwise
 * WhatsApp's small preview looks like a plain white box.
 */
async function buildLogoTilePng(sharp, logoBuffer, tileSize) {
  const meta = await sharp(logoBuffer).metadata();
  const w = meta.width || tileSize;
  const h = meta.height || tileSize;
  let pipeline = sharp(logoBuffer);
  if (w === h && w >= 128) {
    const frac = 0.53;
    const side = (1 - frac) / 2;
    const left = Math.floor(w * side);
    const top = Math.floor(h * side);
    const cw = w - 2 * left;
    const ch = h - 2 * top;
    pipeline = pipeline.extract({ left, top, width: cw, height: ch });
  }
  return pipeline
    .resize(tileSize, tileSize, { fit: 'fill' })
    .png()
    .toBuffer();
}

/** Text-only compact OG card (no left logo/square). */
const TX = 52;

/** Compact square OG image: logo left + text stack; PNG for WhatsApp. */
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
  const safePowered = 'app.t360.in';

  const timeLine =
    meetingTime !== ''
      ? `<text x="${TX}" y="164" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="500" fill="#475569">${safeTime}</text>`
      : '';
  const meetingY = meetingTime !== '' ? 204 : 164;
  const poweredY = meetingTime !== '' ? 244 : 204;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-label="Meeting preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d47a1" />
      <stop offset="100%" stop-color="#1976d2" />
    </linearGradient>
  </defs>
  <rect width="480" height="480" fill="url(#bg)" />
  <rect x="24" y="24" width="432" height="432" rx="20" fill="#ffffff" />
  <text x="${TX}" y="58" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="#0f172a">${safeClub}</text>
  <text x="${TX}" y="94" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="500" fill="#64748b">${safeDate}</text>
  ${timeLine}
  <text x="${TX}" y="${meetingY}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#0d47a1">${safeMeeting}</text>
  <text x="${TX}" y="${poweredY}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="500" fill="#64748b">${safePowered}</text>
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
