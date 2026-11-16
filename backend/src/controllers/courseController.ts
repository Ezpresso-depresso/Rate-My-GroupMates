import type { Request, Response } from 'express';
import { coursesIn, departments, searchCourses } from '../lib/courses';

const MAX_QUERY_LENGTH = 60;

/** GET /courses/departments — every department with courses, ICS ones first. */
export async function listDepartments(_req: Request, res: Response) {
  res.json(await departments());
}

/** GET /courses?department=COMPSCI — that department's courses, by number. */
export async function listCourses(req: Request, res: Response) {
  const department = typeof req.query.department === 'string' ? req.query.department.trim().toUpperCase() : '';
  res.json(department ? await coursesIn(department) : []);
}

/** GET /courses/search?q= — typeahead matches for a course code or title (up to 12). */
export async function findCourses(req: Request, res: Response) {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').slice(0, MAX_QUERY_LENGTH);
  res.json(await searchCourses(q));
}
