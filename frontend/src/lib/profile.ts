/* Turns the reviews you've received into profile awards: each group's signature award, as on its awards page. */
import type { ProfileData, Tone } from '../types';
import { summary } from './ratingCore';

export const MAX_PINS = 3; // keep in sync with backend/src/config/constants.ts

export interface ProfileAward {
  /** "<teamId>:funny:<awardId>": what gets pinned. Stable as long as the award doesn't change. */
  key: string;
  /** The award's id (for its icon, see AwardIcon). */
  awardId: string;
  title: string;
  icon: string;
  tone: Tone;
  desc: string;
  groupName: string;
  course: string;
  /** When the latest review behind this award came in. */
  receivedAt: string;
}

/**
 * Your signature award from each group (the one your teammates picked most), newest first. Ranks
 * aren't listed here: your overall rank is the badge beside your bio.
 */
export function profileAwards({ groups, reviews }: ProfileData): ProfileAward[] {
  return groups
    .flatMap((group) => {
      const received = reviews.filter((r) => r.teamId === group.id);
      const award = summary(received).award;
      if (!award) return [];
      return [
        {
          key: `${group.id}:funny:${award.id}`,
          awardId: award.id,
          title: award.title,
          icon: award.icon,
          tone: award.tone,
          desc: award.desc,
          groupName: group.name,
          course: group.course,
          receivedAt: received.reduce((latest, r) => (r.submittedAt > latest ? r.submittedAt : latest), ''),
        },
      ];
    })
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
