import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS, PASSWORD_MAX_BYTES, PASSWORD_MIN } from '../config/constants';

/** Returns what's wrong with a new password, or null if it's fine. Same rules as the frontend form. */
export function passwordProblem(password: unknown, email: string): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN)
    return `Password must be at least ${PASSWORD_MIN} characters`;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES)
    return `Password must be at most ${PASSWORD_MAX_BYTES} characters`;
  if (password.trim().toLowerCase() === email) return 'Your password can’t be your email';
  return null;
}

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
