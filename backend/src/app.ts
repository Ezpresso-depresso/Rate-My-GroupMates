import cors from 'cors';
import express from 'express';
import { CLIENT_ORIGINS } from './config/constants';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes from './routes';

const app = express();

app.use(cors({ origin: CLIENT_ORIGINS }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
