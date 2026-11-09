import { Router } from 'express';
import { getProfile, setPins } from '../controllers/profileController';

// Mounted at /profile (behind requireDB + requireAuth)
const router = Router();

router.get('/', getProfile);
router.put('/pins', setPins);

export default router;
