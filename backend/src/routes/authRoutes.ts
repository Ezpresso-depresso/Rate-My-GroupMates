import { Router } from 'express';
import { authConfig, changePassword, googleLogin, login, me, register } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { requireDB } from '../middleware/requireDB';

// Mounted at /auth
const router = Router();

router.get('/config', authConfig);
router.post('/register', requireDB, register);
router.post('/login', requireDB, login);
router.post('/password', requireDB, requireAuth, changePassword);
router.post('/google', requireDB, googleLogin);
router.get('/me', requireDB, requireAuth, me);

export default router;
