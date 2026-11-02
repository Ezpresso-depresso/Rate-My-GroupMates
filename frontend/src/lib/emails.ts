/* Mirrors backend/src/lib/util.ts so the form can flag problems before submitting. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const isEmail = (value: string) => value.length <= 254 && EMAIL.test(value);

/**
 * Splits pasted text on commas, semicolons, whitespace and newlines and drops duplicates.
 * Strips wrappers like <kent@uci.edu> or "kent@uci.edu" (Gmail-style pastes).
 */
export function splitEmails(text: string): string[] {
  // "Omar Ali <omar@uci.edu>" → "omar@uci.edu": drop display names in front of a bracketed address.
  const withoutNames = text.replace(/[^<>,;\n]*<([^<>\s]+@[^<>\s]+)>/g, ' $1 ');
  const tokens = withoutNames.split(/[\s,;]+/).map((t) => normalizeEmail(t.replace(/^[<("']+|[>)"']+$/g, '')));
  return [...new Set(tokens.filter(Boolean))];
}
