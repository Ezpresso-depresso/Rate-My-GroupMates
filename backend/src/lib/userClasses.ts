/*
 * The classes on someone's profile: the courses of every group they've joined, plus classes they
 * added themselves, minus ones they dropped. Find Groupmates searches the same list.
 */
import { Types } from 'mongoose';
import { Team } from '../models/Team';
import { User } from '../models/User';
import { allCourses } from './courses';

export interface ProfileClass {
  code: string;
  title: string;
  /** Names of the user's groups for this class (empty if they only added it themselves). */
  groups: string[];
  /** On the profile because the user added it. */
  added: boolean;
}

/** course code -> names of the user's groups for it (groups they've accepted). */
async function groupCourses(userId: Types.ObjectId) {
  const teams = await Team.find({ members: { $elemMatch: { user: userId, status: 'accepted' } } }).select('name course').lean();
  const byCourse = new Map<string, string[]>();
  for (const t of teams) byCourse.set(t.course, [...(byCourse.get(t.course) ?? []), t.name]);
  return byCourse;
}

export async function profileClasses(userId: Types.ObjectId): Promise<ProfileClass[]> {
  const [user, fromGroups, courses] = await Promise.all([
    User.findById(userId).select('addedCourses droppedCourses').lean(),
    groupCourses(userId),
    allCourses(),
  ]);
  const titles = new Map(courses.map((c) => [c.code, c.title]));
  const added = new Set(user?.addedCourses ?? []);
  const dropped = new Set(user?.droppedCourses ?? []);

  // Only real courses (old "Test Class" groups don't count), in course-list order.
  return courses
    .filter((c) => (added.has(c.code) || fromGroups.has(c.code)) && !dropped.has(c.code))
    .map((c) => ({ code: c.code, title: titles.get(c.code) ?? '', groups: fromGroups.get(c.code) ?? [], added: added.has(c.code) }))
    .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

/** Everyone whose profile lists this class (a course code). */
export async function userIdsInClass(code: string): Promise<Types.ObjectId[]> {
  const [teams, adders, droppers] = await Promise.all([
    Team.find({ course: code }).select('members.user members.status').limit(1000).lean(),
    User.find({ addedCourses: code }).select('_id').limit(1000).lean(),
    User.find({ droppedCourses: code }).select('_id').lean(),
  ]);
  const ids = new Set(adders.map((u) => String(u._id)));
  for (const t of teams) for (const m of t.members) if (m.status === 'accepted' && m.user) ids.add(String(m.user));
  for (const u of droppers) ids.delete(String(u._id));
  return [...ids].map((id) => new Types.ObjectId(id));
}

/** Whether one of the user's groups is for this class. */
export async function inGroupFor(userId: Types.ObjectId, code: string) {
  return (await groupCourses(userId)).has(code);
}
