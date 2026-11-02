import { Router } from 'express';
import {
  acceptInvite,
  addInvites,
  createTeam,
  deleteTeam,
  getTeam,
  leaveTeam,
  listTeams,
  regenerateCode,
  removeMember,
} from '../controllers/teamController';
import { validateObjectIds } from '../middleware/validate';
import reviewRoutes from './reviewRoutes';

// Mounted at /teams (behind requireDB + requireAuth)
const router = Router();
const team = validateObjectIds('teamId');

router.get('/', listTeams);
router.post('/', createTeam);
router.get('/:teamId', team, getTeam);
router.delete('/:teamId', team, deleteTeam);
router.post('/:teamId/accept', team, acceptInvite);
router.post('/:teamId/leave', team, leaveTeam); // decline an invite, or leave while waiting
router.post('/:teamId/invites', team, addInvites);
router.delete('/:teamId/members/:memberId', team, removeMember); // cancel a pending invite
router.post('/:teamId/code', team, regenerateCode);
router.use('/:teamId/reviews', team, reviewRoutes);

export default router;
