import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

await esbuild.build({
  entryPoints: [join(root, 'src', 'vercel-handler.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(root, 'api', 'handler.mjs'),
  external: [
    'dotenv',
    'mongoose', 'bcryptjs', 'cookie-parser', 'cors', 'express', 'helmet',
    'jsonwebtoken', 'express-rate-limit', 'express-validator', 'zod', 'multer',
    'cloudinary', 'multer-storage-cloudinary',
    // CJS + Node builtins (e.g. require("events")) break when inlined into ESM on Vercel
    'nodemailer',
  ],
  minify: false,
  sourcemap: false,
  target: 'node20',
}).catch(() => process.exit(1));
