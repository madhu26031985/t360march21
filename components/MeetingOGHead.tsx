import { useEffect } from 'react';
import { Platform } from 'react-native';

type MeetingOGHeadProps = {
  clubName: string;
  date: string;
  meetingNo: string;
  time: string;
  pageUrl?: string;
  imageBaseUrl?: string;
};

function ensureMetaTag(property: string, content: string) {
  const selector = `meta[property="${property}"]`;
  let tag = document.querySelector(selector) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export default function MeetingOGHead({
  clubName,
  date,
  meetingNo,
  time,
  pageUrl,
  imageBaseUrl,
}: MeetingOGHeadProps) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const safeClubName = clubName.trim() || 'T360 Club';
    const safeDate = date.trim() || 'Date TBD';
    const safeMeetingNo = meetingNo.trim() || '0000';
    const safeTime = time.trim() || 'Time TBD';
    const safePageUrl = pageUrl || window.location.href;
    const imageOrigin = imageBaseUrl || window.location.origin;

    const OG_IMAGE_REV = '2026-05-07-x';
    const imageParams = new URLSearchParams({
      club: safeClubName,
      date: safeDate,
      no: safeMeetingNo,
      time: safeTime,
      v: OG_IMAGE_REV,
    });
    const ogImageUrl = `${imageOrigin}/.netlify/functions/agenda-preview-image?${imageParams.toString()}`;

    ensureMetaTag('og:title', `${safeClubName} - Meeting ${safeMeetingNo}`);
    ensureMetaTag('og:description', `${safeDate} • Meeting ${safeMeetingNo} • app.t360.in`);
    ensureMetaTag('og:url', safePageUrl);
    ensureMetaTag('og:image', ogImageUrl);
    ensureMetaTag('og:image:secure_url', ogImageUrl);
    ensureMetaTag('og:image:type', 'image/png');
    ensureMetaTag('og:image:width', '1200');
    ensureMetaTag('og:image:height', '630');
  }, [clubName, date, meetingNo, time, pageUrl, imageBaseUrl]);

  return null;
}
