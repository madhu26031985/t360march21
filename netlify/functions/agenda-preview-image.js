const sharp = require('sharp');

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
  return trimmed ? trimmed.slice(0, 90) : fallback;
}

exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};

  const clubName = normalize(qs.club, 'T-360 Training Club');
  const date = normalize(qs.date, 'May 7, 2026');
  const meetingNo = normalize(qs.no, '0205');
  const time = normalize(qs.time, '20:30 - 21:30');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  
  <text x="60" y="130" font-family="Arial Black, Arial, sans-serif" font-size="58" font-weight="700" fill="#111827">
    ${escapeXml(clubName)}
  </text>
  
  <text x="60" y="210" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#374151">
    ${escapeXml(date)}
  </text>
  
  <text x="60" y="290" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="700" fill="#1e40af">
    Meeting ${escapeXml(meetingNo)}
  </text>
  
  <text x="60" y="370" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#374151">
    ${escapeXml(time)}
  </text>
  
  <text x="60" y="480" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="600" fill="#374151">
    Powered by T360
  </text>
</svg>`;

  try {
    const pngBuffer = await sharp(Buffer.from(svg, 'utf8'))
      .png({ quality: 90 })
      .toBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: 'Error generating preview image',
    };
  }
};
