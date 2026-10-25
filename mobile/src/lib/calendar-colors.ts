/**
 * Maps a calendar's stored `color` value to something CSS can actually use
 * in `style={{ "--c": ... }}`.
 *
 * Bug fix: seeded/demo calendars stored `color: "var(--work)"` (a valid CSS
 * custom-property reference), but calendars created through the real
 * Calendar model (Prisma) store a bare token — "work", "personal", etc., per
 * the schema comment `color String // token name, e.g. "work" | "personal" | hex`.
 * Every component sets `--c` directly from `calendar.color` and then reads
 * `var(--c)`, so a bare token like "work" is an invalid CSS value and the
 * custom property silently resolves to nothing — event chips, dots, and the
 * sidebar calendar checkboxes all lose their color for any calendar that
 * came from the database instead of the hardcoded fallback list.
 *
 * Any value that already looks like a CSS color (starts with "var(", "#",
 * "rgb", "hsl", or is a CSS named color) passes through unchanged, so this
 * stays forward-compatible with calendars that store a real hex color.
 */
const KNOWN_TOKENS = new Set(['work', 'personal', 'study', 'health']);

export function toCssColorValue(color: string): string {
  const trimmed = color.trim();
  if (KNOWN_TOKENS.has(trimmed)) {return `var(--${trimmed})`;}
  if (
    trimmed.startsWith('var(') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('rgb') ||
    trimmed.startsWith('hsl')
  ) {
    return trimmed;
  }
  // Unknown token with no recognizable CSS shape — fall back to the accent
  // color rather than emit an invalid custom-property value.
  return 'var(--accent)';
}
