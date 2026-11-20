/**
 * Uniform Cross-Platform Twemoji Engine
 * Ensures emojis look identical with a beautiful vector design across Windows, macOS, Linux, Android, and iOS.
 */

export const TWEMOJI_BASE_URL = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg';

/**
 * Converts a Unicode emoji string into hyphenated hex code points for Twemoji asset lookup.
 * Strips standalone variation selector 16 (\uFE0F) unless required for specific combinations.
 */
export function toCodePoint(unicode: string): string {
  const r: string[] = [];
  let c = 0;
  let p = 0;
  let i = 0;

  while (i < unicode.length) {
    c = unicode.charCodeAt(i++);
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      p = 0;
    } else if (0xd800 <= c && c <= 0xdbff) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }

  // Remove trailing fe0f (variation selector-16) for standard Twemoji naming,
  // except for keycap sequences (#, *, 0-9) where Twemoji keeps fe0f.
  const hasKeycap = r.includes('20e3');
  const filtered = hasKeycap ? r : r.filter(x => x !== 'fe0f');
  return filtered.join('-');
}

/**
 * Returns the CDN vector SVG URL for any Unicode emoji character.
 */
export function getTwemojiUrl(unicode: string): string {
  const code = toCodePoint(unicode);
  return `${TWEMOJI_BASE_URL}/${code}.svg`;
}

/**
 * Comprehensive Unicode regex for single or multi-character emojis (pictographic, skin tone, ZWJ sequences).
 */
export const UNIFORM_EMOJI_REGEX = /(?:\uD83C[\uDDE6-\uDDFF]){2}|[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}](?:[\uFE00-\uFE0F\u{1F3FB}-\u{1F3FF}]|\u200D[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}](?:[\uFE00-\uFE0F\u{1F3FB}-\u{1F3FF}])?)*/gu;

/**
 * Checks if a string consists entirely of 1 to 10 emojis (for Discord-style enlarged "jumbo" emoji rendering).
 */
export function isOnlyEmojis(text: string): { isOnly: boolean; count: number } {
  const trimmed = text.trim();
  if (!trimmed) return { isOnly: false, count: 0 };
  const matches = trimmed.match(UNIFORM_EMOJI_REGEX);
  if (!matches) return { isOnly: false, count: 0 };
  const joinedMatches = matches.join('');
  const strippedText = trimmed.replace(/\s+/g, '');
  if (joinedMatches === strippedText && matches.length <= 10) {
    return { isOnly: true, count: matches.length };
  }
  return { isOnly: false, count: 0 };
}
