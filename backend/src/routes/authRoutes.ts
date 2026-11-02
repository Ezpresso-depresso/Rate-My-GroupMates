import { Router } from 'express';
import { authConfig, devLogin, googleLogin, me } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { requireDB } from '../middleware/requireDB';

// Mounted at /auth
const router = Router();

router.get('/config', authConfig);
router.post('/google', requireDB, googleLogin);
router.post('/dev', requireDB, devLogin);
router.get('/me', requireDB, requireAuth, me);

export default router;
