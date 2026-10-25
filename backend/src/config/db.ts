import mongoose from 'mongoose';
import { MONGODB_DB_NAME, MONGODB_URI } from './constants';

/*
 * Serverless functions reuse warm instances, so cache the connection promise on
 * the global object instead of reconnecting on every request.
 */
const globalForMongoose = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>;
};

export function connectDB(): Promise<typeof mongoose> {
  if (!globalForMongoose.mongooseConnection) {
    globalForMongoose.mongooseConnection = mongoose
      .connect(MONGODB_URI(), { dbName: MONGODB_DB_NAME, serverSelectionTimeoutMS: 5000 })
      .catch((err) => {
        globalForMongoose.mongooseConnection = undefined; // allow a retry on the next request
        throw err;
      });
  }
  return globalForMongoose.mongooseConnection;
}

export function dbStatus(): string {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] ?? 'unknown';
}
