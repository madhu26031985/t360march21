// netlify/functions/agenda-preview-image.js
const sharp = require('sharp');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

exports.handler = async function (event) {
  const qs = event.queryStringParameters || {};

  const clubName = (qs.club || 'T-360 Training Club').trim();
  const date = (qs.date || 'May 7, 2026').trim();
  const meetingNo = (qs.no || '0205').trim();
  const appText = 'app.t360.in';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <style>
    .base { font-family: monospace; fill: #111827; }
    .club { font-size: 64px; font-weight: 700; }
    .meta { font-size: 50px; fill: #374151; }
    .meeting { font-size: 56px; font-weight: 700; fill: #111827; }
  </style>
  <rect width="1200" height="630" fill="#ffffff" />
  <text x="24" y="80" class="base club">${escapeXml(clubName)}</text>
  <text x="24" y="160" class="base meta">${escapeXml(date)}</text>
  <text x="24" y="238" class="base meeting">Meeting ${escapeXml(meetingNo)}</text>
  <text x="24" y="316" class="base meta">${escapeXml(appText)}</text>
</svg>`;

  try {
    const pngBuffer = await sharp(Buffer.from(svg, 'utf8'))
      .png({ quality: 95 })
      .toBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('OG Image Error:', error);
    return {
      statusCode: 500,
      body: 'Error',
    };
  }
};
