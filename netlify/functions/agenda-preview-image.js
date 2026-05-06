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

exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};
  const clubName = normalize(qs.clubName, 'T360 Club');
  const meetingDate = normalize(qs.meetingDate, 'Upcoming Meeting');
  const meetingLabel = normalize(qs.meetingLabel, 'Meeting Agenda');

  const safeClubName = escapeXml(clubName);
  const safeMeetingDate = escapeXml(meetingDate);
  const safeMeetingLabel = escapeXml(meetingLabel);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" role="img" aria-label="Meeting preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d47a1" />
      <stop offset="100%" stop-color="#1976d2" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)" />
  <rect x="48" y="48" width="504" height="504" rx="24" fill="#ffffff" />
  <text x="76" y="128" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="400" fill="#0f172a">${safeClubName}</text>
  <rect x="76" y="168" width="448" height="120" rx="12" fill="#e8f0ff" stroke="#0d47a1" stroke-width="2" />
  <text x="96" y="242" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700" fill="#0d47a1">${safeMeetingLabel}</text>
  <text x="76" y="332" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500" fill="#334155">${safeMeetingDate}</text>
  <text x="76" y="388" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="500" fill="#475569">Powered by app.t360.in</text>
</svg>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
    body: svg,
  };
};
