import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(path.join(UPLOAD_DIR, 'images'), { recursive: true });
  fs.mkdirSync(path.join(UPLOAD_DIR, 'videos'), { recursive: true });
} catch {
  // ignoreUPLOAD_MAX_FILE_SIZE_MB=30

}

const storage = multer.diskStorage({
  destination: (_req: Request, file: Express.Multer.File, cb) => {
    const isVideo = /^video\//.test(file.mimetype) || /\.(mp4|mov|mkv|webm)$/i.test(file.originalname);
    const dir = isVideo ? path.join(UPLOAD_DIR, 'videos') : path.join(UPLOAD_DIR, 'images');
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes('video') ? '.mp4' : '.jpg');
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'];

const UPLOAD_MAX_FILE_SIZE_MB = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB) || 5000;

export const uploadImage = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Type de fichier non autorisé. Utilisez JPEG, PNG, WebP ou GIF.'));
  },
}).single('file');

export const uploadVideo = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_MIMES.includes(file.mimetype) || /\.(mp4|mov|mkv|webm)$/i.test(file.originalname)) return cb(null, true);
    cb(new Error('Type de fichier non autorisé. Utilisez MP4, MOV ou MKV.'));
  },
}).single('file');

/**
 * Return a URL path for a file stored on disk (for local dev).
 * In production, replace with cloud URL (S3/Cloudinary).
 */
export function getFileUrl(filename: string, type: 'images' | 'videos' = 'images'): string {
  const base = process.env.API_BASE_URL || 'http://localhost:3001';
  return `${base}/uploads/${type}/${filename}`;
}
