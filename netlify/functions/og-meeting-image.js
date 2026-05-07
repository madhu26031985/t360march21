const sharp = require('sharp');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};
  const clubName = (qs.club || 'T-360 Training Club').trim();
  const date = (qs.date || 'May 15, 2026').trim();
  const meetingNo = (qs.no || '1505').trim();
  const appText = 'app.t360.in';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <style>
    .base { font-family: monospace; }
    .club { font-size: 64px; font-weight: 700; fill: #111827; }
    .meta { font-size: 52px; fill: #374151; }
    .meeting { font-size: 56px; font-weight: 700; fill: #1e40af; }
  </style>
  <rect width="1200" height="630" fill="#dff0dc" />
  <text x="36" y="92" class="base club">${escapeXml(clubName)}</text>
  <text x="36" y="188" class="base meta">${escapeXml(date)}</text>
  <text x="36" y="284" class="base meeting">Meeting ${escapeXml(meetingNo)}</text>
  <text x="36" y="380" class="base meta">${escapeXml(appText)}</text>
</svg>`;

  try {
    const jpegBuffer = await sharp(Buffer.from(svg, 'utf8'))
      .flatten({ background: '#dff0dc' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=300',
      },
      body: jpegBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('OG meeting image error:', error);
    return { statusCode: 500, body: 'Error' };
  }
};
