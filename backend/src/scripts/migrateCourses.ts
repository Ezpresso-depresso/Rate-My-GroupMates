/*
 * Loads the UCI course list into the database, then converts groups whose course was typed by hand
 * (before courses were picked from a list) into real course codes: "inf 151" -> "IN4MATX 151".
 * Anything that can't be pinned to exactly one course ("161", "a class that's cool") becomes
 * "Test Class". Safe to re-run.
 *
 *   npm run courses:migrate             show what would change (changes nothing)
 *   npm run courses:migrate -- --apply  make the changes
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { allCourses, parseCourse, TEST_CLASS } from '../lib/courses';
import { Team } from '../models/Team';

const APPLY = process.argv.includes('--apply');

async function main() {
  await connectDB();
  const courses = await allCourses(); // also fills the courses collection if needed
  console.log(`${courses.length} courses in the database.`);
  const valid = new Set(courses.map((c) => c.code));

  const teams = await Team.find().select('name course').lean();
  const changes: { id: unknown; name: string; from: string; to: string }[] = [];
  for (const team of teams) {
    if (valid.has(team.course) || team.course === TEST_CLASS) continue;
    changes.push({ id: team._id, name: team.name, from: team.course, to: (await parseCourse(team.course)) ?? TEST_CLASS });
  }

  if (!changes.length) {
    console.log(`All ${teams.length} groups already use a listed course. Nothing to do.`);
  } else {
    console.log(`${changes.length} of ${teams.length} groups ${APPLY ? 'updated' : 'would change'}:`);
    for (const c of changes) console.log(`  "${c.from}" -> "${c.to}"   (group "${c.name}")`);
    if (APPLY) {
      await Team.bulkWrite(changes.map((c) => ({ updateOne: { filter: { _id: c.id }, update: { $set: { course: c.to } } } })));
      console.log('Done.');
    } else {
      console.log('\nNothing was changed. Run again with --apply to make these changes.');
    }
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
