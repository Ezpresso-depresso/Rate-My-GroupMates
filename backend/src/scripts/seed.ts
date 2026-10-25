/*
 * Seeds a demo team plus a few peer reviews, then prints the ids the frontend needs.
 * Safe to re-run: reuses the existing team and never overwrites existing reviews.
 *
 *   npm run seed
 */
import mongoose from 'mongoose';
import { CATEGORY_KEYS } from '../config/constants';
import { connectDB } from '../config/db';
import { Review } from '../models/Review';
import { Team } from '../models/Team';

const TEAM = {
  name: 'Group 16',
  course: 'INF 151',
  members: [
    { name: 'Kent', color: '#ac6b10' },
    { name: 'Omar', color: '#5762c6' },
    { name: 'Qitai', color: '#338d84' },
    { name: 'Zahi', color: '#a95782' },
  ],
};

/** The member the frontend acts as until there's login. */
const CURRENT_USER = 'Zahi';

// target -> reviewer -> [rating, participation, communication, quality]
const PEER_REVIEWS: Record<string, Record<string, number[]>> = {
  Kent: { Omar: [4, 7, 9, 8], Qitai: [3, 7, 6, 8] },
  Omar: { Kent: [4, 8, 8, 8], Qitai: [4, 8, 7, 8] },
  Qitai: { Kent: [5, 9, 8, 9], Omar: [4, 8, 9, 8] },
};

async function seed() {
  await connectDB();

  const team =
    (await Team.findOne({ name: TEAM.name, course: TEAM.course })) ?? (await Team.create(TEAM));
  const idOf = (name: string) => {
    const member = team.members.find((m) => m.name === name);
    if (!member) throw new Error(`Team "${team.name}" has no member named ${name}`);
    return member._id;
  };

  let created = 0;
  for (const [target, byReviewer] of Object.entries(PEER_REVIEWS)) {
    for (const [reviewer, [rating, ...scores]] of Object.entries(byReviewer)) {
      const result = await Review.updateOne(
        { team: team._id, reviewerId: idOf(reviewer), targetId: idOf(target) },
        {
          $setOnInsert: {
            rating,
            scores: Object.fromEntries(CATEGORY_KEYS.map((k, i) => [k, scores[i]])),
            text: '',
            anonymous: true,
          },
        },
        { upsert: true },
      );
      created += result.upsertedCount;
    }
  }

  console.log(`Team "${team.name}" (${team.course}) ready. ${created} new peer review(s) added.\n`);
  console.log('Members:');
  for (const m of team.members) console.log(`  ${m.name.padEnd(8)} ${m._id}`);
  console.log('\nPut these in frontend/.env:');
  console.log(`  VITE_TEAM_ID=${team._id}`);
  console.log(`  VITE_CURRENT_USER_ID=${idOf(CURRENT_USER)}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
