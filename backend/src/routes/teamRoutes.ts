import { Router } from 'express';
import { createTeam, getTeam, joinTeam, listTeams } from '../controllers/teamController';
import { validateObjectIds, validateTeam } from '../middleware/validate';
import reviewRoutes from './reviewRoutes';

// Mounted at /teams
const router = Router();

router.get('/', listTeams);
router.post('/', validateTeam, createTeam);
router.get('/:teamId', validateObjectIds('teamId'), getTeam);
router.post('/:teamId/members', validateObjectIds('teamId'), joinTeam); // PLAYTEST ONLY: see joinTeam
router.use('/:teamId/reviews', validateObjectIds('teamId'), reviewRoutes);

export default router;
