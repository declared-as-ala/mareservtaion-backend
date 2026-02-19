import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import venuesRouter from './routes/venues';
import tablesRouter from './routes/tables';
import eventsRouter from './routes/events';
import reservationsRouter from './routes/reservations';
import authRouter from './routes/auth';
import searchRouter from './routes/search';
import adminRouter from './routes/admin';

dotenv.config();

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://mareservtaion-frontend.vercel.app',
  CORS_ORIGIN,
].filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, origin || ALLOWED_ORIGINS[0]);
    else cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const apiInfo = (req: express.Request, res: express.Response) => {
  res.status(200).json({
    name: 'MaTable API',
    version: '1.0',
    docs: '/health',
    message: 'Use /api/* endpoints. Health check at /health',
  });
};

// Handle both / and /api (Vercel may pass /api when root is rewritten)
app.get('/', apiInfo);
app.get('/api', apiInfo);

app.get('/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Avoid 404s from browser favicon requests (handle both paths for Vercel)
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());
app.get('/api/favicon.ico', (req, res) => res.status(204).end());
app.get('/api/favicon.png', (req, res) => res.status(204).end());

app.use('/api/venues', venuesRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);

app.use((err: any, req: express.Request, res: express.Response) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Explicit 404 — ensures we never surface unclear NOT_FOUND from unhandled routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: 'Use /api/* endpoints. Health check at /health',
  });
});

export default app;
