import { Router } from 'express';
import { findCourses, listCourses, listDepartments } from '../controllers/courseController';

// Mounted at /courses (behind requireDB + requireAuth)
const router = Router();

router.get('/', listCourses);
router.get('/departments', listDepartments);
router.get('/search', findCourses);

export default router;
