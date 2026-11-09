import { Router } from 'express';
import { avatarImage, getUserProfile, searchUsers } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

// Mounted at /users (behind requireDB)
const router = Router();

// Public: <img> tags can't send a sign-in token (see userController.avatarImage).
router.get('/:userId/avatar', avatarImage);

// Signed-in only.
router.get('/search', requireAuth, searchUsers);
router.get('/:userId/profile', requireAuth, getUserProfile);

export default router;
