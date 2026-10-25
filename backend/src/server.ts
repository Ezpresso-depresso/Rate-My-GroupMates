/* Local development entry. On Vercel, api/index.ts is used instead. */
import app from './app';
import { PORT } from './config/constants';
import { connectDB } from './config/db';

connectDB()
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection failed (data routes will return 503):', err.message));

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}/api`));
