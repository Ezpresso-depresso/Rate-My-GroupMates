import { Router } from 'express';
import { health } from '../controllers/healthController';
import { requireDB } from '../middleware/requireDB';
import teamRoutes from './teamRoutes';

// Mounted at /api
const router = Router();

router.get('/health', health);
router.use('/teams', requireDB, teamRoutes);

export default router;
