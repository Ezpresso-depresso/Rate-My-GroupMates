/* Turns the reviews you've received into profile awards, using the same rules as the awards page. */
import type { ProfileData, Tone } from '../types';
import { funnyAward, medal, summary } from './ratingCore';

export const MAX_PINS = 3; // keep in sync with backend/src/config/constants.ts

export interface ProfileAward {
  /** "<teamId>:<kind>:<id>": what gets pinned. Stable as long as the award doesn't change. */
  key: string;
  kind: 'funny' | 'medal' | 'badge';
  title: string;
  icon: string;
  tone: Tone;
  desc: string;
  groupName: string;
  course: string;
  /** When the latest review behind this award came in. */
  receivedAt: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every award across your groups, newest first. Each group gives its funny award, achievement tier and badges. */
export function profileAwards({ groups, reviews }: ProfileData): ProfileAward[] {
  return groups
    .flatMap((group) => {
      const received = reviews.filter((r) => r.teamId === group.id);
      if (!received.length) return [];
      const s = summary(received);
      const funny = funnyAward(s);
      const tier = medal(s);
      const base = {
        groupName: group.name,
        course: group.course,
        receivedAt: received.reduce((latest, r) => (r.submittedAt > latest ? r.submittedAt : latest), ''),
      };
      return [
        { ...base, key: `${group.id}:funny:${funny.id}`, kind: 'funny' as const, title: funny.title, icon: funny.icon, tone: funny.tone, desc: funny.desc },
        { ...base, key: `${group.id}:medal:${slug(tier.name)}`, kind: 'medal' as const, title: tier.name, icon: tier.symbol, tone: tier.tone, desc: 'Achievement tier, from your average stars' },
        ...s.awards.map((b) => ({
          ...base,
          key: `${group.id}:badge:${slug(b.name)}`,
          kind: 'badge' as const,
          title: b.name,
          icon: b.icon,
          tone: 'gold' as Tone,
          desc: b.reason,
        })),
      ];
    })
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
