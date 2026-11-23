/* Pure rating rules shared by the UI. No React, no storage. */
import type {
  Category,
  FunnyAward,
  Medal,
  Review,
  ReviewDraft,
  Summary,
} from '../types';

export const MAX_COMMENT_LENGTH = 700;

export const categories: Category[] = [
  { key: 'participation', name: 'Participation', hint: 'Actually consistently worked without you having to police them' },
  { key: 'communication', name: 'Communication', hint: `Responded and updated groupmates, doesn\'t use invisible on discord`},
  { key: 'quality', name: 'Quality of work', hint: 'Contributions didn\'t need to be revised multiple times' },
];

const isStar = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
const isScore = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10;

/** Complete: a star rating, every category score, and an award picked. */
export function valid(r?: Partial<ReviewDraft>): boolean {
  return isStar(r?.rating) && categories.every((c) => isScore(r?.scores?.[c.key])) && isAwardId(r?.award);
}

export function emptyDraft(): ReviewDraft {
  return { rating: 0, scores: {}, text: '', anonymous: false, award: null };
}

export function summary(reviews: (Pick<Review, 'rating' | 'scores'> & { award?: string | null })[]): Summary {
  const rated = reviews.filter((r) => isStar(r.rating));
  const average = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null;
  const scores = categories.map((c) => {
    const values = reviews.map((r) => r.scores?.[c.key]).filter(isScore);
    return {
      ...c,
      value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      count: values.length,
    };
  });
  const best = scores.filter((c) => c.value !== null).sort((a, b) => b.value! - a.value!)[0];
  return { average, count: rated.length, scores, award: signatureAward(reviews), top: best && best.value! >= 7 ? best : null };
}

/*
 * Signature awards. Each reviewer picks one for every teammate they rate; a teammate's award is
 * the one picked for them most often (ties go to the one earlier in this list). Shown as a 3×3
 * grid on the rating page, in this order. Keep ids in sync with AWARD_IDS in the backend.
 * Icons are plain characters (U+FE0E asks for the text version, never an emoji). The Third Wheel,
 * Hard Carry and Group Leader are drawn instead (components/awards/AwardIcon.tsx); their `icon`
 * is a stand-in where only text fits.
 */
export const funnyAwards: FunnyAward[] = [
  { id: 'avatar', title: 'The Avatar', icon: '↓', tone: 'silver', desc: 'Vanished when the world needed them most.' },
  { id: 'cyo', title: 'CYO', icon: '❝', tone: 'peach', desc: 'Chief Yapping Officer.' },
  { id: 'houdini', title: 'Houdini', icon: '♠︎', tone: 'lilac', desc: 'Made miracles happen.' },
  { id: 'picasso', title: 'Picasso', icon: '✎', tone: 'pink', desc: 'Excellent at non-technical changes.' },
  { id: 'gta6', title: 'GTA 6', icon: '⧖', tone: 'bronze', desc: '13 years for an update.' },
  { id: 'thirdwheel', title: 'The Third Wheel', icon: '⊙', tone: 'platinum', desc: 'Saw everything but did nothing.' },
  { id: 'carry', title: 'Hard Carry', icon: '▲', tone: 'gold', desc: 'That guy.' },
  { id: 'leader', title: 'Group Leader', icon: '⚑︎', tone: 'grandmaster', desc: 'The alpha.' },
  { id: 'aimerchant', title: 'AI Merchant', icon: '⌘', tone: 'mint', desc: 'Make no mistakes.' },
];

const isAwardId = (v: unknown): v is string => typeof v === 'string' && funnyAwards.some((a) => a.id === v);
export const awardById = (id: string | null | undefined) => funnyAwards.find((a) => a.id === id);

/** The award picked most often across these reviews (ties: earlier in funnyAwards); null if none picked. */
export function signatureAward(reviews: { award?: string | null }[]): FunnyAward | null {
  const votes = new Map<string, number>();
  for (const r of reviews) if (isAwardId(r.award)) votes.set(r.award, (votes.get(r.award) ?? 0) + 1);
  let best: FunnyAward | null = null;
  for (const a of funnyAwards) if ((votes.get(a.id) ?? 0) > (best ? votes.get(best.id)! : 0)) best = a;
  return best;
}

export interface Tier extends Medal {
  /** Lowest average stars for this tier; null = no ratings yet. */
  min: number | null;
  /** How it's earned, in words ("3.5+ stars on average"). */
  requirement: string;
  /** What it says about you. */
  meaning: string;
}

/** Achievement tiers, lowest to highest: you get the highest whose minimum your average stars reach. */
export const TIERS: Tier[] = [
  { name: 'Schrödinger’s Teammate', tone: 'unranked', symbol: '○', min: null, requirement: 'No ratings yet', meaning: 'Both a carry and a ghost until someone rates them.' },
  { name: 'Burger Teammate', tone: 'burger', symbol: '≡', min: 0, requirement: 'Below 1.5 stars on average', meaning: 'Everyone starts somewhere. Even on the grill.' },
  { name: 'Silver Teammate', tone: 'silver', symbol: '✧', min: 1.5, requirement: '1.5+ stars on average', meaning: 'Got it done, with room to step up.' },
  { name: 'Gold Teammate', tone: 'gold', symbol: '✦', min: 2.5, requirement: '2.5+ stars on average', meaning: 'A solid teammate who pulls their weight.' },
  { name: 'Platinum Teammate', tone: 'platinum', symbol: '◆', min: 3.5, requirement: '3.5+ stars on average', meaning: 'A reliable teammate who goes above and beyond.' },
  { name: 'Grandmaster Arbiter of Teamwork Teammate', tone: 'grandmaster', symbol: '♛', min: 4.5, requirement: '4.5+ stars on average', meaning: 'Teammates would sign up with you again in a heartbeat.' },
  { name: 'The Pope', tone: 'pope', symbol: '✝', min: 5, requirement: 'A perfect 5.0 average', meaning: 'Every single rating, five stars. Infallible.' },
];

/** Your tier from your average stars (null = no ratings yet = Unranked). */
export function tierFor(average: number | null): Tier {
  if (average === null) return TIERS[0];
  // Tiny tolerance so an average like 3.4999999999 (floating point) still counts as 3.5.
  return [...TIERS].reverse().find((t) => t.min !== null && average >= t.min - 1e-9) ?? TIERS[1];
}

export function medal(s: Summary): Medal {
  const { name, tone, symbol } = tierFor(s.average);
  return { name, tone, symbol };
}

/** Reviews received by `targetId`, excluding self-reviews. */
export function incoming(reviews: Review[], targetId: string): Review[] {
  return reviews.filter((r) => r.targetId === targetId && r.reviewerId !== targetId);
}

export const starHints = ['Your call', 'Needs work', 'Could be better', 'Solid', 'Great teammate', 'Above & beyond'];

export function initials(name: string): string {
  return name.split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}
