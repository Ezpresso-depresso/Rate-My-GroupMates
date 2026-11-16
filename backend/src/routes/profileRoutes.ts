import { Router } from 'express';
import { addClass, dropClass, getClasses, getProfile, setBackground, setBio, setPins } from '../controllers/profileController';

// Mounted at /profile (behind requireDB + requireAuth)
const router = Router();

router.get('/', getProfile);
router.put('/pins', setPins);
router.put('/background', setBackground);
router.put('/bio', setBio);
router.get('/classes', getClasses);
router.post('/classes', addClass);
router.post('/classes/drop', dropClass);

export default router;
