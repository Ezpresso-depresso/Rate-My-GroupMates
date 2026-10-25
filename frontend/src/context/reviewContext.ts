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
  /**
   * Submits every draft to the API. Resolves to the id of the first incomplete
   * teammate (nothing sent), or null on success. Rejects if the request fails.
   */
  submitAll: () => Promise<string | null>;
  /** Forget which member this browser is acting as and show the picker again. */
  switchMember: () => void;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);
