import { createContext } from 'react';
import type { Session, User } from '../types';

export interface AuthContextValue {
  user: User;
  signOut: () => void;
  /** Swap in a new session (after a password change). */
  replaceSession: (session: Session) => void;
  /** Swap in updated account details (e.g. a new profile picture); the session stays the same. */
  updateUser: (user: User) => void;
}

export interface AuthGateValue {
  signIn: (session: Session) => void;
  /** Why the user was signed out (e.g. session expired), shown on the login page. */
  notice: string;
}

/** Only provided once signed in. */
export const AuthContext = createContext<AuthContextValue | null>(null);
export const AuthGateContext = createContext<AuthGateValue | null>(null);
