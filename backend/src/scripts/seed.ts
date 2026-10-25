/*
 * Creates the team (if missing) and prints the id the frontend needs.
 * Safe to re-run: reuses the existing team and never overwrites existing reviews.
 *
 *   npm run seed                  team only
 *   npm run seed -- --demo        also add fake peer reviews (for trying the UI solo)
 *   npm run seed -- --reset       delete ALL of this team's reviews first
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

const args = process.argv.slice(2);
const DEMO = args.includes('--demo');
const RESET = args.includes('--reset');

// --demo only. target -> reviewer -> [rating, participation, communication, quality]
const DEMO_REVIEWS: Record<string, Record<string, number[]>> = {
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

  if (RESET) {
    const { deletedCount } = await Review.deleteMany({ team: team._id });
    console.log(`Deleted ${deletedCount} review(s) for "${team.name}".`);
  }

  let created = 0;
  for (const [target, byReviewer] of Object.entries(DEMO ? DEMO_REVIEWS : {})) {
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

  const total = await Review.countDocuments({ team: team._id });
  console.log(`Team "${team.name}" (${team.course}) ready: ${team.members.map((m) => m.name).join(', ')}.`);
  if (DEMO) console.log(`${created} demo review(s) added.`);
  console.log(`${total} review(s) in the database for this team.\n`);
  console.log('Put this in frontend/.env:');
  console.log(`  VITE_TEAM_ID=${team._id}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
