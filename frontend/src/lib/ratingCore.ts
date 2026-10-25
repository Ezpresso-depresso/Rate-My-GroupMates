/* Pure rating rules shared by the UI. No React, no storage. */
import type {
  Category,
  CategoryKey,
  FunnyAward,
  Medal,
  Review,
  ReviewDraft,
  Summary,
} from '../types';

export const MAX_COMMENT_LENGTH = 700;

export const categories: Category[] = [
  { key: 'participation', name: 'Participation', hint: 'Contributed to meetings and shared tasks' },
  { key: 'communication', name: 'Communication', hint: 'Kept teammates informed and responded clearly' },
  { key: 'quality', name: 'Quality of work', hint: 'Delivered thoughtful, useful work' },
];

const isStar = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
const isScore = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10;

export function valid(r?: Partial<ReviewDraft>): boolean {
  return isStar(r?.rating) && categories.every((c) => isScore(r?.scores?.[c.key]));
}

export function emptyDraft(): ReviewDraft {
  return { rating: 0, scores: {}, text: '', anonymous: false };
}

export function summary(reviews: Pick<Review, 'rating' | 'scores'>[]): Summary {
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
  const awards = [];
  if (average !== null && average >= 3.5) awards.push({ name: 'Top Groupmate', icon: '🏆', reason: 'Average overall rating of 3.5 stars or higher' });
  if (rated.length >= 10) awards.push({ name: 'Celebrity', icon: '🌟', reason: 'Received at least 10 reviews' });
  return { average, count: rated.length, scores, awards, top: best && best.value! >= 7 ? best : null };
}

// Ordered, deterministic score patterns; the first matching joke wins.
export const funnyAwards: FunnyAward[] = [
  { id: 'phantom', title: 'The Phantom', trait: 'Ghost Protocol', icon: '👻', tone: 'lilac', desc: 'Assigned a task. Entered witness protection.', rule: 'Participation and communication both average 5.5/10 or lower.' },
  { id: 'yapper', title: 'Chief Yapping Officer', trait: 'All Talk, No Task', icon: '🎙️', tone: 'peach', desc: 'A TED Talk in every meeting. Zero slides in the deck.', rule: 'Communication ≥7; quality ≤6.75, at least 1.25 below communication.' },
  { id: 'deadline', title: 'The Deadline Houdini', trait: 'Last-Minute Legend', icon: '⏰', tone: 'peach', desc: 'Submitted at 11:59. Somehow it was incredible.', rule: 'Participation ≤6.5 and quality ≥8.' },
  { id: 'fonts', title: 'Director of Font Operations', trait: 'Only Changed the Fonts', icon: '🎨', tone: 'pink', desc: 'Changed Arial to Calibri. Called it a contribution.', rule: 'Quality ≥6.5 and participation ≤6.5.' },
  { id: 'loading', title: 'VP of Coming Soon', trait: 'Human Loading Screen', icon: '⏳', tone: 'peach', desc: '“Working on it” since the first meeting.', rule: 'Participation averages 6.5/10 or lower.' },
  { id: 'watcher', title: 'The Watcher', trait: 'Seen, Never Replied', icon: '👀', tone: 'lilac', desc: 'Read receipts: 100%. Response rate: a side quest.', rule: 'Communication averages 6.5/10 or lower.' },
  { id: 'carry', title: 'The Backpack', trait: 'Carried the Team', icon: '💪', tone: 'gold', desc: 'A group project with a single-player campaign.', rule: 'Average category score ≥8.5 and overall stars ≥4.' },
  { id: 'rubric', title: 'The Rubric Whisperer', trait: 'Actually Read the Rubric', icon: '📋', tone: 'mint', desc: 'The only person who knew what we were supposed to be doing.', rule: 'Quality ≥8.5 and communication ≥8.' },
  { id: 'bug', title: 'The Bug Exorcist', trait: 'Bug Hunter', icon: '🐛', tone: 'mint', desc: 'Fixed in five minutes what broke us for five hours.', rule: 'Quality averages at least 8.5/10.' },
  { id: 'hype', title: 'Minister of Morale', trait: 'Group Chat Hype', icon: '📣', tone: 'pink', desc: 'Kept spirits alive when the Google Doc was dead.', rule: 'Communication averages at least 8.5/10.' },
  { id: 'planner', title: 'The Human Calendar', trait: 'Actually Read the Rubric', icon: '🗓️', tone: 'lilac', desc: 'Sent three reminders. Still had to send a fourth.', rule: 'Participation averages at least 8/10.' },
  { id: 'plot', title: 'The Plot Twist', trait: 'Unpredictable Project Energy', icon: '🎬', tone: 'lilac', desc: 'Nobody knew what to expect. Including the rubric.', rule: 'Mixed scores that do not match an earlier pattern.' },
  { id: 'mystery', title: 'Mystery Member', trait: 'The Lore Is Loading', icon: '❓', tone: 'lilac', desc: 'The group chat awaits their origin story.', rule: 'No category ratings yet.' },
];

const awardById = (id: string) => funnyAwards.find((a) => a.id === id)!;

export function funnyAward(s: Summary): FunnyAward {
  const v = Object.fromEntries(s.scores.map((c) => [c.key, c.value])) as Record<CategoryKey, number | null>;
  if (categories.some((c) => v[c.key] === null)) return awardById('mystery');
  const { participation: p, communication: c, quality: q } = v as Record<CategoryKey, number>;
  const overall = (p + c + q) / 3;
  const patterns: [string, boolean][] = [
    ['phantom', p <= 5.5 && c <= 5.5],
    ['yapper', c >= 7 && q <= 6.75 && c - q >= 1.25],
    ['deadline', p <= 6.5 && q >= 8],
    ['fonts', q >= 6.5 && p <= 6.5],
    ['loading', p <= 6.5],
    ['watcher', c <= 6.5],
    ['carry', overall >= 8.5 && (s.average ?? 0) >= 4],
    ['rubric', q >= 8.5 && c >= 8],
    ['bug', q >= 8.5],
    ['hype', c >= 8.5],
    ['planner', p >= 8],
  ];
  return awardById(patterns.find(([, yes]) => yes)?.[0] ?? 'plot');
}

export function medal(s: Summary): Medal {
  const a = s.average ?? 0;
  if (a >= 4.5) return { name: 'Certified Carry', tone: 'gold', symbol: '✦' };
  if (a >= 3.5) return { name: 'Group Chat MVP', tone: 'silver', symbol: '✧' };
  if (a >= 2.5) return { name: 'Looks Good Guys', tone: 'bronze', symbol: '✧' };
  return { name: 'Present in Spirit', tone: 'mint', symbol: '✳' };
}

/** Reviews received by `targetId`, excluding self-reviews. */
export function incoming(reviews: Review[], targetId: string): Review[] {
  return reviews.filter((r) => r.targetId === targetId && r.reviewerId !== targetId);
}

export const starHints = ['Your call', 'Needs work', 'Could be better', 'Solid', 'Great teammate', 'Above & beyond'];

export function initials(name: string): string {
  return name.split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}
