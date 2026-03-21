/**
 * Utility functions for formatting and displaying social media links
 */

export interface SocialMediaPlatform {
  name: string;
  label: string;
  icon: string;
  color: string;
  urlPatterns: string[];
}

export const socialMediaPlatforms: SocialMediaPlatform[] = [
  {
    name: 'facebook',
    label: 'Facebook Profile',
    icon: 'facebook',
    color: '#1877f2',
    urlPatterns: ['facebook.com', 'fb.com', 'm.facebook.com']
  },
  {
    name: 'linkedin',
    label: 'LinkedIn Profile',
    icon: 'linkedin',
    color: '#0a66c2',
    urlPatterns: ['linkedin.com']
  },
  {
    name: 'instagram',
    label: 'Instagram Profile',
    icon: 'instagram',
    color: '#e4405f',
    urlPatterns: ['instagram.com', 'instagr.am']
  },
  {
    name: 'twitter',
    label: 'Twitter Profile',
    icon: 'twitter',
    color: '#1da1f2',
    urlPatterns: ['twitter.com', 'x.com', 't.co']
  },
  {
    name: 'youtube',
    label: 'YouTube Channel',
    icon: 'youtube',
    color: '#ff0000',
    urlPatterns: ['youtube.com', 'youtu.be']
  },
  {
    name: 'whatsapp',
    label: 'WhatsApp',
    icon: 'message-circle',
    color: '#25d366',
    urlPatterns: ['wa.me', 'whatsapp.com', 'chat.whatsapp.com']
  }
];

/**
 * Detects the social media platform from a URL
 */
export function detectSocialMediaPlatform(url: string): SocialMediaPlatform | null {
  if (!url) return null;
  
  const normalizedUrl = url.toLowerCase();
  
  for (const platform of socialMediaPlatforms) {
    if (platform.urlPatterns.some(pattern => normalizedUrl.includes(pattern))) {
      return platform;
    }
  }
  
  return null;
}

/**
 * Formats a social media URL into a clean, readable label
 */
export function formatSocialMediaLabel(url: string): string {
  if (!url) return 'Not provided';
  
  const platform = detectSocialMediaPlatform(url);
  if (!platform) {
    // For unknown platforms, try to extract domain name
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      return `${domain.charAt(0).toUpperCase() + domain.slice(1)} Link`;
    } catch {
      return 'External Link';
    }
  }
  
  // Special handling for different types of content
  const normalizedUrl = url.toLowerCase();
  
  if (platform.name === 'linkedin') {
    if (normalizedUrl.includes('/posts/')) {
      return 'LinkedIn Post';
    } else if (normalizedUrl.includes('/in/')) {
      return 'LinkedIn Profile';
    } else if (normalizedUrl.includes('/company/')) {
      return 'LinkedIn Company';
    } else {
      return 'LinkedIn Profile';
    }
  }
  
  if (platform.name === 'instagram') {
    if (normalizedUrl.includes('/p/')) {
      return 'Instagram Post';
    } else if (normalizedUrl.includes('/reel/')) {
      return 'Instagram Reel';
    } else if (normalizedUrl.includes('/stories/')) {
      return 'Instagram Story';
    } else {
      return 'Instagram Profile';
    }
  }
  
  if (platform.name === 'twitter') {
    if (normalizedUrl.includes('/status/')) {
      return 'Twitter Post';
    } else {
      return 'Twitter Profile';
    }
  }
  
  if (platform.name === 'facebook') {
    if (normalizedUrl.includes('/posts/')) {
      return 'Facebook Post';
    } else if (normalizedUrl.includes('/photos/')) {
      return 'Facebook Photo';
    } else if (normalizedUrl.includes('/videos/')) {
      return 'Facebook Video';
    } else {
      return 'Facebook Profile';
    }
  }
  
  if (platform.name === 'youtube') {
    if (normalizedUrl.includes('/watch?v=')) {
      return 'YouTube Video';
    } else if (normalizedUrl.includes('/playlist')) {
      return 'YouTube Playlist';
    } else if (normalizedUrl.includes('/shorts/')) {
      return 'YouTube Short';
    } else {
      return 'YouTube Channel';
    }
  }
  
  if (platform.name === 'whatsapp') {
    return 'WhatsApp Group';
  }
  
  return platform.label;
}

/**
 * Gets the appropriate icon name for a social media platform
 */
export function getSocialMediaIcon(url: string): string {
  if (!url) return 'globe';
  
  const platform = detectSocialMediaPlatform(url);
  return platform?.icon || 'external-link';
}

/**
 * Gets the brand color for a social media platform
 */
export function getSocialMediaColor(url: string): string {
  if (!url) return '#6b7280';
  
  const platform = detectSocialMediaPlatform(url);
  return platform?.color || '#6b7280';
}

/**
 * Validates if a URL is a valid social media link
 */
export function isValidSocialMediaUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncates a URL for display purposes while keeping it readable
 */
export function truncateUrl(url: string, maxLength: number = 50): string {
  if (!url || url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname + urlObj.search;
    
    if (domain.length + path.length <= maxLength) {
      return domain + path;
    }
    
    const availablePathLength = maxLength - domain.length - 3; // 3 for "..."
    if (availablePathLength > 0) {
      return domain + path.substring(0, availablePathLength) + '...';
    }
    
    return domain;
  } catch {
    return url.substring(0, maxLength - 3) + '...';
  }
}