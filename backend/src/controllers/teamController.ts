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
