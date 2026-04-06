/**
 * Generate URL-safe slug from string (French-friendly: strip accents).
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip diacritics/marks
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // keep letters, numbers, spaces, hyphens
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
