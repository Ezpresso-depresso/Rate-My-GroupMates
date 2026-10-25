/* Demo data used until the app reads teams and reviews from the backend. */
import { categories } from '../lib/ratingCore';
import type { Review, Team } from '../types';

export const sampleTeam: Team = {
  id: 'review-slice-demo',
  name: 'Group 16',
  course: 'INF 151',
  members: [
    { id: 'kent', name: 'Kent', color: '#ac6b10' },
    { id: 'omar', name: 'Omar', color: '#5762c6' },
    { id: 'qitai', name: 'Qitai', color: '#338d84' },
    { id: 'zahi', name: 'Zahi', color: '#a95782' },
  ],
};

/** Stand-in for the signed-in user until auth exists. */
export const SAMPLE_CURRENT_USER_ID = 'zahi';

// [rating, participation, communication, quality]
const peerValues: Record<string, Record<string, number[]>> = {
  kent: { omar: [4, 8, 8, 8], qitai: [5, 9, 8, 9] },
  omar: { kent: [4, 7, 9, 8], qitai: [4, 8, 9, 8] },
  qitai: { kent: [3, 7, 6, 8], omar: [4, 8, 7, 8] },
};

export const samplePeerReviews: Review[] = Object.entries(peerValues).flatMap(([targetId, byReviewer]) =>
  Object.entries(byReviewer).map(([reviewerId, [rating, ...values]]) => ({
    teamId: sampleTeam.id,
    reviewerId,
    targetId,
    rating,
    scores: Object.fromEntries(categories.map((c, i) => [c.key, values[i]])),
    text: '',
    anonymous: true,
    sample: true,
  })),
);
