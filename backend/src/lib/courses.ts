/*
 * The UCI course list groups pick from. data/uciCourses.json (refreshed by `npm run courses:fetch`)
 * is copied into the `courses` collection the first time it's needed, so a fresh database fills
 * itself; after that each server instance keeps one in-memory copy for fast lookups and typeahead.
 */
import catalog from '../data/uciCourses.json';
import { Course } from '../models/Course';

export interface CourseInfo {
  code: string;
  department: string;
  departmentName: string;
  number: string;
  title: string;
}

export interface DepartmentInfo {
  code: string;
  name: string;
  courseCount: number;
  /** ICS departments, listed first in pickers. */
  featured: boolean;
}

/** What old free-typed courses that can't be matched to a real one become (see scripts/migrateCourses.ts). */
export const TEST_CLASS = 'Test Class';

/** Shown first in pickers and ranked first in search: the departments this app's students use most. */
const FEATURED = ['COMPSCI', 'SWE', 'IN4MATX', 'I&C SCI', 'STATS', 'CSE'];

/** Common short names → the registrar's department code. Keys are compact (no spaces or "&"). */
const DEPT_ALIASES: Record<string, string> = {
  CS: 'COMPSCI',
  COMPSCI: 'COMPSCI',
  COMPUTERSCIENCE: 'COMPSCI',
  INF: 'IN4MATX',
  INFX: 'IN4MATX',
  INFO: 'IN4MATX',
  INFORMATICS: 'IN4MATX',
  IN4MTX: 'IN4MATX',
  ICS: 'I&C SCI',
  SE: 'SWE',
  SOFTWAREENGINEERING: 'SWE',
  STAT: 'STATS',
};

export const courseCode = (department: string, number: string) => `${department} ${number}`;
const compact = (s: string) => s.toUpperCase().replace(/[\s&]/g, '');
const byNumber = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

const deptRank = (dept: string) => {
  const i = FEATURED.indexOf(dept);
  return i === -1 ? FEATURED.length : i;
};

function compareCourses(a: CourseInfo, b: CourseInfo) {
  return deptRank(a.department) - deptRank(b.department) || a.department.localeCompare(b.department) || byNumber(a.number, b.number);
}

let loaded: Promise<CourseInfo[]> | undefined;

/** Copies the bundled catalogue into the database if it's missing courses (once per server instance). */
async function syncCatalog() {
  const have = await Course.estimatedDocumentCount();
  if (have >= catalog.courses.length) return;
  const names = new Map(catalog.departments.map((d) => [d.code, d.name]));
  await Course.bulkWrite(
    catalog.courses.map((c) => {
      const code = courseCode(c.department, c.number);
      return {
        updateOne: {
          filter: { code },
          update: { $set: { code, department: c.department, departmentName: names.get(c.department) ?? c.department, number: c.number, title: c.title } },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
}

/** Every selectable course, from the database. */
export function allCourses(): Promise<CourseInfo[]> {
  loaded ??= (async () => {
    await syncCatalog();
    const rows = await Course.find().select('-_id code department departmentName number title').lean<CourseInfo[]>();
    return rows.sort(compareCourses);
  })().catch((err) => {
    loaded = undefined; // try again on the next request
    throw err;
  });
  return loaded;
}

export async function findCourse(code: string): Promise<CourseInfo | undefined> {
  const wanted = code.trim().toUpperCase().replace(/\s+/g, ' ');
  return (await allCourses()).find((c) => c.code === wanted);
}

export async function departments(): Promise<DepartmentInfo[]> {
  const byDept = new Map<string, DepartmentInfo>();
  for (const c of await allCourses()) {
    const d = byDept.get(c.department);
    if (d) d.courseCount++;
    else byDept.set(c.department, { code: c.department, name: c.departmentName, courseCount: 1, featured: FEATURED.includes(c.department) });
  }
  return [...byDept.values()]; // already in display order: featured first, then A–Z
}

export async function coursesIn(department: string): Promise<CourseInfo[]> {
  return (await allCourses()).filter((c) => c.department === department);
}

/** "inf 151", "CS161", "ics 33" → the registrar's department code, or undefined. */
function resolveDepartment(text: string, known: Set<string>): string | undefined {
  const key = compact(text);
  if (DEPT_ALIASES[key]) return DEPT_ALIASES[key];
  for (const dept of known) if (compact(dept) === key) return dept;
  return undefined;
}

/**
 * Best-effort reading of a course someone typed by hand ("inf 151", "CS-161", "swe113") as a real
 * course code. Undefined when it can't be pinned to exactly one course (e.g. just "161").
 */
export async function parseCourse(raw: string): Promise<string | undefined> {
  const courses = await allCourses();
  const codes = new Set(courses.map((c) => c.code));
  if (codes.has(raw.trim().toUpperCase())) return raw.trim().toUpperCase();

  const m = /^(.*?)\s*(\d+[A-Z]{0,3})$/.exec(raw.toUpperCase().replace(/[-_.,]/g, ' ').trim().replace(/\s+/g, ' '));
  if (!m || !m[1].trim()) return undefined;
  const dept = resolveDepartment(m[1], new Set(courses.map((c) => c.department)));
  if (!dept) return undefined;

  const code = courseCode(dept, m[2]);
  if (codes.has(code)) return code;
  // Many SWE courses were IN4MATX courses until recently (and vice versa).
  const crossListed = dept === 'SWE' ? 'IN4MATX' : dept === 'IN4MATX' ? 'SWE' : undefined;
  if (crossListed && codes.has(courseCode(crossListed, m[2]))) return courseCode(crossListed, m[2]);
  return undefined;
}

// Reverse of DEPT_ALIASES: "COMPSCI" → ["CS", ...], so "cs 161" finds COMPSCI 161.
const ALIASES_BY_DEPT = Object.entries(DEPT_ALIASES).reduce<Record<string, string[]>>((acc, [alias, dept]) => {
  (acc[dept] ??= []).push(alias);
  return acc;
}, {});

/** Typeahead: courses matching what's typed so far ("compsci 16", "cs161", "algorithms"), best first. */
export async function searchCourses(query: string, limit = 12): Promise<CourseInfo[]> {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const cq = compact(q);
  if (!cq) return [];
  const digitsOnly = /^\d+[a-z]*$/i.test(cq);

  const score = (c: CourseInfo) => {
    const keys = [compact(c.code), ...(ALIASES_BY_DEPT[c.department] ?? []).map((a) => a + compact(c.number))];
    if (keys.includes(cq)) return 100;
    if (keys.some((k) => k.startsWith(cq))) return 80;
    if (digitsOnly) return c.number.toUpperCase() === cq ? 60 : c.number.toUpperCase().startsWith(cq) ? 50 : 0;
    if (q.length >= 3) {
      const title = c.title.toLowerCase();
      if (title.split(/[\s:,()/-]+/).some((w) => w.startsWith(q))) return 35;
      if (title.includes(q)) return 30;
    }
    return 0;
  };

  return (await allCourses())
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || compareCourses(a.c, b.c))
    .slice(0, limit)
    .map((x) => x.c);
}
