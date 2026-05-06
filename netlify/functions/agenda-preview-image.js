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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="Meeting preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d47a1" />
      <stop offset="100%" stop-color="#1976d2" />
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)" />
  <rect x="120" y="120" width="960" height="960" rx="40" fill="#ffffff" />
  <text x="180" y="280" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="400" fill="#0f172a">${safeClubName}</text>
  <text x="180" y="365" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="500" fill="#334155">${safeMeetingDate}</text>
  <rect x="180" y="470" width="840" height="180" rx="20" fill="#e8f0ff" stroke="#0d47a1" stroke-width="3" />
  <text x="230" y="585" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="700" fill="#0d47a1">${safeMeetingLabel}</text>
  <text x="180" y="760" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="500" fill="#475569">Powered by app.t360.in</text>
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
