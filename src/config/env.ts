import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  MONGODB_URI: z.string().min(1).optional().or(z.literal('')),
  MONGO_URI: z.string().optional(), // alias
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required in production').optional().default('your-super-secret-jwt-key-change-in-production'),
  REFRESH_SECRET: z.string().optional(),
  ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  CORS_ORIGIN: z.string().optional(),
  FRONTEND_URL: z.string().url().optional().or(z.literal('')),
  // Upload / storage (optional for MVP)
  UPLOAD_MAX_FILE_SIZE_MB: z.string().default('50').transform(Number),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const raw = {
    ...process.env,
    MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI || (process.env.NODE_ENV === 'production' ? undefined : 'mongodb://localhost:27017/mareservation'),
  };
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.flatten().fieldErrors;
    console.error('Invalid environment:', msg);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
    }
  }
  cached = result.success ? result.data : envSchema.parse({ ...raw, MONGODB_URI: raw.MONGODB_URI || 'mongodb://localhost:27017/mareservation' });
  return cached;
}
