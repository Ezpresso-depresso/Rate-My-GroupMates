import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { IS_PROD } from '../config/constants';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
};

// Express 5 forwards rejected promises from async handlers here automatically.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = err instanceof HttpError ? err.status : 500;
  let message = err instanceof Error ? err.message : 'Something went wrong';

  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) status = 400;
  // body-parser errors (malformed JSON, body too large) carry their own 4xx status.
  const own = (err as { status?: unknown; type?: unknown }).status;
  if (!(err instanceof HttpError) && typeof own === 'number' && own >= 400 && own < 500) {
    status = own;
    if ((err as { type?: unknown }).type === 'entity.parse.failed') message = 'Request body isn’t valid JSON';
    if ((err as { type?: unknown }).type === 'entity.too.large') message = 'Request is too large';
  }
  if ((err as { code?: number }).code === 11000) {
    status = 409;
    message = 'Duplicate record';
  }

  if (status >= 500 && !(err instanceof HttpError)) console.error(err);
  res.status(status).json({
    message: status >= 500 && IS_PROD ? 'Internal server error' : message,
    ...(IS_PROD ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
};
