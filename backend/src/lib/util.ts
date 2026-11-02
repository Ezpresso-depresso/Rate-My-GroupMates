import { randomInt } from 'node:crypto';
import { INVITE_CODE_LENGTH } from '../config/constants';

// Loose on purpose: Google already verified the address; this just catches typos like "kent@" or "kent gmail.com".
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const isEmail = (value: string) => value.length <= 254 && EMAIL.test(value);

/** "kent.kawa@gmail.com" -> "kent.kawa": a placeholder name until the person accepts. */
export const emailName = (email: string) => email.split('@')[0] || email;

/** "Zahi Imaduddin" -> "Zahi". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

const COLORS = ['#ac6b10', '#5762c6', '#338d84', '#a95782', '#6b8e23', '#c2413a', '#4a7fb5', '#8a5cc2'];
/** Stable per email, so a person keeps their color across groups. */
export function colorFor(email: string): string {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

// No 0/O/1/I/L, so codes read out loud or retyped from a screenshot don't get mixed up.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newInviteCode(): string {
  return Array.from({ length: INVITE_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}
/** Users may type the code in lowercase or with spaces/dashes. */
export const normalizeCode = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();
