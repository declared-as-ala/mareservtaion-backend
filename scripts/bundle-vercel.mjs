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
  outfile: join(root, 'api', 'index.mjs'),
  external: [
    'dotenv', 'mongoose', 'bcryptjs', 'cookie-parser', 'cors', 'express', 'helmet',
    'jsonwebtoken', 'express-rate-limit', 'express-validator', 'zod', 'multer'
  ],
  minify: false,
  sourcemap: false,
  target: 'node20',
}).catch(() => process.exit(1));
