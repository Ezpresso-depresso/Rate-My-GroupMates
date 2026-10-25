import type { Request, Response } from 'express';
import { dbStatus } from '../config/db';

export function health(_req: Request, res: Response) {
  res.json({ status: 'ok', db: dbStatus() });
}
