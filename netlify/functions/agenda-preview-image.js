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
  const time = (qs.time || '20:30 - 21:30').trim();

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff" />
  
  <!-- Club Name -->
  <text x="40" y="66" font-family="Arial Black, Arial, sans-serif" font-size="58" font-weight="700" fill="#111827">${escapeXml(clubName)}</text>
  
  <!-- Date -->
  <text x="40" y="140" font-family="Arial, sans-serif" font-size="44" fill="#374151">${escapeXml(date)}</text>
  
  <!-- Meeting Number -->
  <text x="40" y="210" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#1e40af">Meeting ${escapeXml(meetingNo)}</text>
  
  <!-- Time -->
  <text x="40" y="280" font-family="Arial, sans-serif" font-size="44" fill="#374151">${escapeXml(time)}</text>
  
  <!-- Powered by T360 -->
  <text x="40" y="600" font-family="Arial, sans-serif" font-size="38" font-weight="600" fill="#374151">Powered by T360</text>
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
