/* The session token, kept in localStorage so it survives refreshes (30 days, set by the backend). */
import { SESSION_KEY } from '../config';
import { readStorage, writeStorage } from '../lib/storage';

let token: string | null = readStorage<string | null>(SESSION_KEY, null);

export const getToken = () => token;

export function setToken(value: string | null) {
  token = value;
  writeStorage(SESSION_KEY, value ?? undefined);
}
