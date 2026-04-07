/**
 * Convert text to a kebab-case slug suitable for filenames and URLs.
 * Lowercases, collapses non-alphanumerics to hyphens, trims, and truncates.
 */
export function slugify(text: string, maxLength = 60): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}
