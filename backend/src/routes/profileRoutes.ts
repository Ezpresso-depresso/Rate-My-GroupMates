import { Router } from 'express';
import { getProfile, setBackground, setBio, setPins } from '../controllers/profileController';

// Mounted at /profile (behind requireDB + requireAuth)
const router = Router();

router.get('/', getProfile);
router.put('/pins', setPins);
router.put('/background', setBackground);
router.put('/bio', setBio);

export default router;
