/**
 * Smaller avatar downloads for list/carousel UI. Only rewrites Supabase Storage
 * **public object** URLs on `*.supabase.co` (image transformation API).
 * Proxy / other hosts are returned unchanged.
 *
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */
const OBJECT_PUBLIC = '/storage/v1/object/public/';
const RENDER_PUBLIC = '/storage/v1/render/image/public/';

export function avatarUrlForDisplay(
  url: string | null | undefined,
  maxEdgePx: number
): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  let host = '';
  try {
    host = new URL(raw).hostname;
  } catch {
    return raw;
  }
  if (!host.endsWith('.supabase.co')) {
    return raw;
  }
  if (!raw.includes(OBJECT_PUBLIC)) {
    return raw;
  }

  const edge = Math.min(512, Math.max(24, Math.round(maxEdgePx)));
  const quality = edge <= 40 ? 45 : edge <= 72 ? 55 : 62;
  const base = raw.split('#')[0];
  const rendered = base.replace(OBJECT_PUBLIC, RENDER_PUBLIC);
  if (rendered === base) return raw;

  const sep = base.includes('?') ? '&' : '?';
  return `${rendered}${sep}width=${edge}&height=${edge}&resize=cover&quality=${quality}`;
}
