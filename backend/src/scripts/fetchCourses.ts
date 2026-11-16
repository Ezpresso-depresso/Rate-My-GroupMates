/*
 * Refreshes data/uciCourses.json: every course in the UCI General Catalogue (department, number,
 * title), via the Anteater API (https://anteaterapi.com), which mirrors the registrar's data.
 * Commit the updated file; servers copy new courses into the database on their own (lib/courses.ts).
 *
 *   npm run courses:fetch
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(__dirname, '..', 'data', 'uciCourses.json');
const API = 'https://anteaterapi.com/v2/rest/courses';
const PAGE = 100;

interface ApiCourse {
  department: string;
  departmentName: string;
  courseNumber: string;
  title: string;
}

async function page(skip: number): Promise<ApiCourse[]> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}?take=${PAGE}&skip=${skip}`);
    if (res.ok) return ((await res.json()) as { data: ApiCourse[] }).data;
    if (attempt === 4) throw new Error(`Anteater API returned ${res.status} (skip=${skip})`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

async function main() {
  const rows: ApiCourse[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const batch = await page(skip);
    rows.push(...batch);
    process.stdout.write(`\r${rows.length} courses`);
    if (batch.length < PAGE) break;
  }

  const departments = new Map<string, string>();
  const courses = new Map<string, { department: string; number: string; title: string }>();
  for (const c of rows) {
    departments.set(c.department, c.departmentName);
    courses.set(`${c.department} ${c.courseNumber}`, { department: c.department, number: c.courseNumber, title: c.title });
  }

  const data = {
    source: 'UCI General Catalogue via Anteater API (anteaterapi.com)',
    fetchedAt: new Date().toISOString().slice(0, 10),
    departments: [...departments].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
    courses: [...courses.values()].sort(
      (a, b) => a.department.localeCompare(b.department) || a.number.localeCompare(b.number, 'en', { numeric: true }),
    ),
  };
  writeFileSync(OUT, JSON.stringify(data) + '\n');
  console.log(`\n${data.courses.length} courses in ${data.departments.length} departments -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
