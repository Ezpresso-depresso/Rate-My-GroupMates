import { Router } from 'express';
import { health } from '../controllers/healthController';
import { requireAuth } from '../middleware/auth';
import { requireDB } from '../middleware/requireDB';
import authRoutes from './authRoutes';
import profileRoutes from './profileRoutes';
import teamRoutes from './teamRoutes';
import userRoutes from './userRoutes';

// Mounted at /api
const router = Router();

router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/teams', requireDB, requireAuth, teamRoutes);
router.use('/profile', requireDB, requireAuth, profileRoutes);
router.use('/users', requireDB, userRoutes);

export default router;
