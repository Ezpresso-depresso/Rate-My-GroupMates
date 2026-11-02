/*
 * Creates demo accounts and "Group 16" with everyone already accepted, so
 * reviews are open. Safe to re-run: reuses what exists, never overwrites reviews.
 *
 *   npm run seed                  accounts + group only
 *   npm run seed -- --demo        also add fake peer reviews (Zahi is left to rate)
 *   npm run seed -- --reset       first delete this group's reviews, plus the old
 *                                 pre-login "Group 16" playtest team and its reviews
 *
 * The demo accounts use @example.com emails, so sign in to them with the local
 * test login (DEV_LOGIN=true in backend/.env), e.g. as zahi@example.com.
 */
import mongoose from 'mongoose';
import { CATEGORY_KEYS } from '../config/constants';
import { connectDB } from '../config/db';
import { newInviteCode } from '../lib/util';
import { Review } from '../models/Review';
import { Team } from '../models/Team';
import { User } from '../models/User';

const PEOPLE = [
  { name: 'Kent', color: '#ac6b10' },
  { name: 'Omar', color: '#5762c6' },
  { name: 'Qitai', color: '#338d84' },
  { name: 'Zahi', color: '#a95782' },
];
const TEAM = { name: 'Group 16', course: 'INF 151' };

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

  if (RESET) {
    // Teams from before accounts existed have no owner and can't be used anymore.
    const legacy = await Team.find({ owner: { $exists: false } }, { _id: 1 }).lean<{ _id: mongoose.Types.ObjectId }[]>();
    const legacyIds = legacy.map((t) => t._id);
    const { deletedCount: oldReviews } = await Review.deleteMany({ team: { $in: legacyIds } });
    await Team.deleteMany({ _id: { $in: legacyIds } });
    console.log(`Deleted ${legacyIds.length} old playtest team(s) and ${oldReviews} of their review(s).`);
  }

  const users = [];
  for (const p of PEOPLE) {
    const email = `${p.name.toLowerCase()}@example.com`;
    users.push(
      (await User.findOne({ email })) ?? (await User.create({ email, name: p.name, fullName: p.name, color: p.color })),
    );
  }
  const owner = users[0];

  const team =
    (await Team.findOne({ ...TEAM, owner: owner._id })) ??
    (await Team.create({
      ...TEAM,
      owner: owner._id,
      inviteCode: newInviteCode(),
      reviewsStartedAt: new Date(),
      members: users.map((u) => ({
        email: u.email,
        user: u._id,
        name: u.name,
        color: u.color,
        status: 'accepted',
        joinedAt: new Date(),
      })),
    }));
  const idOf = (name: string) => {
    const member = team.members.find((m) => m.name === name);
    if (!member) throw new Error(`Group "${team.name}" has no member named ${name}`);
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
  console.log(`Group "${team.name}" (${team.course}) ready, reviews open: ${team.members.map((m) => m.name).join(', ')}.`);
  if (DEMO) console.log(`${created} demo review(s) added.`);
  console.log(`${total} review(s) in the database for this group.\n`);
  console.log('Sign in with the local test login (DEV_LOGIN=true) as one of:');
  for (const u of users) console.log(`  ${u.email}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
