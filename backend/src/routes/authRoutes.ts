import { Router } from 'express';
import {
  authConfig,
  changePassword,
  googleLogin,
  login,
  me,
  register,
  removeAvatar,
  setAvatar,
  setName,
} from '../controllers/authController';
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
router.put('/name', requireDB, requireAuth, setName);
router.put('/avatar', requireDB, requireAuth, setAvatar);
router.delete('/avatar', requireDB, requireAuth, removeAvatar);

export default router;
