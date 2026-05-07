import type { MeetingOgTheme } from './meetingOgUrl';

export interface OgMeetingThemePalette {
  pageBackground: string;
  frameBorderColor: string;
  logoPaneBackground: string;
  logoPaneBorder: string;
  contentPaneBackground: string;
  dividerColor: string;
  clubColor: string;
  titleColor: string;
  metaColor: string;
  accentBar: string;
  footerColor: string;
}

const themes: Record<MeetingOgTheme, OgMeetingThemePalette> = {
  default: {
    pageBackground: 'linear-gradient(135deg, #0f172a 0%, #1e3a8f 52%, #0d47a1 100%)',
    frameBorderColor: 'rgba(255,255,255,0.12)',
    logoPaneBackground: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
    logoPaneBorder: 'rgba(15,23,42,0.08)',
    contentPaneBackground: '#ffffff',
    dividerColor: 'rgba(148,163,184,0.35)',
    clubColor: '#0f172a',
    titleColor: '#1e293b',
    metaColor: '#475569',
    accentBar: '#0d47a1',
    footerColor: '#64748b',
  },
  minimal: {
    pageBackground: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    frameBorderColor: 'rgba(148,163,184,0.45)',
    logoPaneBackground: '#ffffff',
    logoPaneBorder: 'rgba(51,65,85,0.12)',
    contentPaneBackground: '#ffffff',
    dividerColor: 'rgba(148,163,184,0.55)',
    clubColor: '#0f172a',
    titleColor: '#334155',
    metaColor: '#64748b',
    accentBar: '#334155',
    footerColor: '#94a3b8',
  },
  vibrant: {
    pageBackground: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 38%, #db2777 100%)',
    frameBorderColor: 'rgba(255,255,255,0.22)',
    logoPaneBackground: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, #fef08a 140%)',
    logoPaneBorder: 'rgba(255,255,255,0.45)',
    contentPaneBackground: 'rgba(255,255,255,0.98)',
    dividerColor: 'rgba(236,72,153,0.35)',
    clubColor: '#1e0936',
    titleColor: '#4c1d95',
    metaColor: '#5b21b6',
    accentBar: '#db2777',
    footerColor: '#6d28d9',
  },
};

export function paletteFor(theme: MeetingOgTheme): OgMeetingThemePalette {
  return themes[theme] ?? themes.default;
}
