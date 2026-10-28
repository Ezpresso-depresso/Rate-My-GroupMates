import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler';
import { Team } from '../models/Team';

export async function listTeams(_req: Request, res: Response) {
  const teams = await Team.find().sort({ createdAt: -1 });
  res.json(teams);
}

export async function getTeam(req: Request<{ teamId: string }>, res: Response) {
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new HttpError(404, 'Team not found');
  res.json(team);
}

export async function createTeam(req: Request, res: Response) {
  const { name, course, members } = req.body;
  const team = await Team.create({
    name,
    course,
    members: members.map((m: { name: string; color?: string }) => ({ name: m.name, color: m.color })),
  });
  res.status(201).json(team);
}

// PLAYTEST ONLY: lets anyone add themselves to a team so each tester gets their own reviewerId.
// Remove (with its route, api.joinTeam and the MemberPicker form) once real auth/membership exists.
const PLAYTEST_COLORS = ['#ac6b10', '#5762c6', '#338d84', '#a95782', '#6b8e23', '#c2413a', '#4a7fb5', '#8a5cc2'];
export async function joinTeam(req: Request<{ teamId: string }>, res: Response) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 40) throw new HttpError(400, 'Name must be 1–40 characters');

  const team = await Team.findById(req.params.teamId);
  if (!team) throw new HttpError(404, 'Team not found');
  if (team.members.some((m) => m.name.toLowerCase() === name.toLowerCase()))
    throw new HttpError(409, `"${name}" is already on this team — pick it from the list`);

  team.members.push({ name, color: PLAYTEST_COLORS[team.members.length % PLAYTEST_COLORS.length] });
  await team.save();
  res.status(201).json((team.toJSON() as { members: unknown[] }).members.at(-1));
}
