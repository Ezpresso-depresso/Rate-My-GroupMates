/*
 * Sets a new password for someone who forgot theirs, and signs them out everywhere.
 *
 *   npm run reset-password -- someone@uci.edu their-new-password
 *
 * Uses MONGODB_URI from backend/.env, so point that at the database you mean (e.g. production).
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { hashPassword, passwordProblem } from '../lib/password';
import { normalizeEmail } from '../lib/util';
import { User } from '../models/User';

async function main() {
  const [rawEmail, password] = process.argv.slice(2);
  if (!rawEmail || !password) throw new Error('Usage: npm run reset-password -- <email> <new password>');
  const email = normalizeEmail(rawEmail);
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(problem);

  await connectDB();
  const result = await User.updateOne(
    { email },
    {
      $set: { passwordHash: await hashPassword(password), failedLogins: 0, failedLoginsSince: null, lockedUntil: null },
      $inc: { sessionVersion: 1 },
    },
  );
  if (result.matchedCount === 0) throw new Error(`No account with the email ${email}`);
  console.log(`Password reset for ${email}. Tell them the new password; they can change it on their Account page.`);
}

main()
  .catch((err) => {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
