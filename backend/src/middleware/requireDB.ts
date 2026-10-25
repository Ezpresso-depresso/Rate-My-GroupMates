import type { RequestHandler } from 'express';
import { connectDB } from '../config/db';
import { HttpError } from './errorHandler';

/** Ensures a MongoDB connection exists before hitting data routes (needed for cold serverless starts). */
export const requireDB: RequestHandler = async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    next(new HttpError(503, 'Database unavailable'));
  }
};
