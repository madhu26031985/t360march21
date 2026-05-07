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
  <rect width="1200" height="630" fill="#ffffff" />
  
  <!-- Club Name -->
  <text x="32" y="58" font-family="Arial Black, Arial, sans-serif" font-size="60" font-weight="700" fill="#111827">${escapeXml(clubName)}</text>
  
  <!-- Date -->
  <text x="32" y="132" font-family="Arial, sans-serif" font-size="46" fill="#374151">${escapeXml(date)}</text>
  
  <!-- Meeting Number -->
  <text x="32" y="204" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#1e40af">Meeting ${escapeXml(meetingNo)}</text>
  
  <!-- App -->
  <text x="32" y="278" font-family="Arial, sans-serif" font-size="46" fill="#374151">${appText}</text>
</svg>`;

  try {
    const jpegBuffer = await sharp(Buffer.from(svg, 'utf8'))
      .flatten({ background: '#ffffff' })
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
    console.error('OG Image Error:', error);
    return {
      statusCode: 500,
      body: 'Error',
    };
  }
};
