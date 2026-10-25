import cors from 'cors';
import express from 'express';
import { CLIENT_ORIGINS, IS_PROD } from './config/constants';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// In development, also allow any localhost port (Vite moves to 5174+ when 5173 is taken).
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
app.use(cors({ origin: IS_PROD ? CLIENT_ORIGINS : [...CLIENT_ORIGINS, LOCALHOST] }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
