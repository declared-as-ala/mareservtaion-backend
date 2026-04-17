import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import categoriesRouter from './routes/categories';
import tagsRouter from './routes/tags';
import metaRouter from './routes/meta';
import venuesRouter from './routes/venues';
import tablesRouter from './routes/tables';
import eventsRouter from './routes/events';
import reservationsRouter from './routes/reservations';
import authRouter from './routes/auth';
import searchRouter from './routes/search';
import adminRouter from './routes/admin';
import uploadsRouter from './routes/uploads';
import organizerRouter from './routes/organizer';
import sosConseilRouter from './routes/sos-conseil';
import favoritesRouter from './routes/favorites';
import scenesRouter from './routes/scenes';
import menuItemsRouter from './routes/menuItems';
import paymentsRouter from './routes/payments';
import { errorMiddleware } from './middlewares/error.middleware';
import { apiLimiter } from './middlewares/rateLimit.middleware';
import path from 'path';

dotenv.config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
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
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Ma Reservation API',
    version: '1.0',
    health: '/api/v1/health',
    message: 'Use /api/v1/* endpoints. Health check at GET /api/v1/health',
  });
});

// Avoid 404s from browser favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// API v1 — primary (rate limited)
app.get('/api/v1/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', apiLimiter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/tags', tagsRouter);
app.use('/api/v1/meta', metaRouter);
app.use('/api/v1/venues', venuesRouter);
app.use('/api/v1/tables', tablesRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/reservations', reservationsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/uploads', uploadsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/organizer', organizerRouter);
app.use('/api/v1/sos-conseil', sosConseilRouter);
app.use('/api/v1/favorites', favoritesRouter);
app.use('/api/v1/scenes', scenesRouter);
app.use('/api/v1/menu', menuItemsRouter);
app.use('/api/v1/payments', paymentsRouter);

// Legacy /api/* (backward compatibility during migration)
app.get('/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});
app.use('/api/categories', categoriesRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);
app.use('/api/menu', menuItemsRouter);

// Explicit 404 — ensures clear JSON response for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path,
    message: 'Use /api/v1/* endpoints. Health check at GET /api/v1/health',
  });
});

// Centralized error handler (must be last)
app.use(errorMiddleware);

export default app;
