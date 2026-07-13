import { tokens } from './tokens';

/** Resolve candidate photo URL from an election choice object. */
export function resolveChoiceImageUrl(choice = {}) {
  return (
    choice.candidatePic ||
    choice.picture ||
    choice.pic ||
    choice.image ||
    choice.imageUrl ||
    choice.photo ||
    ''
  );
}

/**
 * Initials for avatar fallback.
 * Handles "Last, First" and strips punctuation.
 */
export function candidateInitials(name) {
  let raw = String(name || '').trim();
  if (raw.includes(',')) {
    const [left, ...rest] = raw.split(',');
    const right = rest.join(',').trim();
    raw = right ? `${right} ${left.trim()}` : left.trim();
  }

  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '?';

  const firstLetter = (token) => {
    const match = String(token).match(/[\p{L}\p{N}]/u);
    return match ? match[0].toUpperCase() : '';
  };

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) {
    const letters = parts[0].match(/[\p{L}\p{N}]/gu) || [];
    if (letters.length === 0) return '?';
    if (letters.length === 1) return letters[0].toUpperCase();
    return `${letters[0]}${letters[1]}`.toUpperCase();
  }

  const a = firstLetter(parts[0]);
  const b = firstLetter(parts[parts.length - 1]);
  return a && b ? `${a}${b}` : a || b || '?';
}

export function avatarBorderColor(isWinner) {
  return isWinner ? tokens.gold : tokens.violet;
}

/**
 * Fetch a remote image as a data URL for react-pdf (avoids CORS at render time).
 * Returns null on failure so callers can fall back to initials.
 */
export async function fetchImageAsDataUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;

  try {
    const absolute = toAbsoluteUrl(trimmed);
    const response = await fetch(absolute, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function toAbsoluteUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) {
    return `${typeof window !== 'undefined' ? window.location.protocol : 'https:'}${url}`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(url, window.location.origin).href;
    } catch {
      return url;
    }
  }
  return url;
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Attach imageDataUrl onto each candidate (null when fetch fails / missing).
 */
export async function attachCandidateImageData(candidates = []) {
  const urls = [
    ...new Set(
      candidates
        .map((c) => c.imageUrl || c.candidatePic || '')
        .filter(Boolean),
    ),
  ];

  const urlToData = new Map();
  await Promise.all(
    urls.map(async (url) => {
      const dataUrl = await fetchImageAsDataUrl(url);
      if (dataUrl) urlToData.set(url, dataUrl);
    }),
  );

  return candidates.map((c) => {
    const src = c.imageUrl || c.candidatePic || '';
    return {
      ...c,
      imageDataUrl: src ? urlToData.get(src) || null : null,
    };
  });
}
