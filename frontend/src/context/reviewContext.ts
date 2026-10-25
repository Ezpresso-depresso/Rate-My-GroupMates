import { createContext } from 'react';
import type { Member, Review, ReviewDraft, Team } from '../types';

export interface ReviewContextValue {
  team: Team;
  currentUser: Member;
  /** Everyone on the team except the current user. */
  teammates: Member[];
  reviews: Review[];
  hasSubmitted: boolean;
  draftFor: (targetId: string) => ReviewDraft;
  updateDraft: (targetId: string, patch: Partial<ReviewDraft>) => void;
  /** Submits every draft. Returns the id of the first incomplete teammate, or null on success. */
  submitAll: () => string | null;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);
