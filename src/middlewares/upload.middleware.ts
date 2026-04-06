import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'];

const UPLOAD_MAX_FILE_SIZE_MB = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB) || 200;

// Cloudinary storage for images
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ma-reservation/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    resource_type: 'image',
  } as any,
});

// Cloudinary storage for videos
const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ma-reservation/videos',
    allowed_formats: ['mp4', 'mov', 'mkv', 'webm'],
    resource_type: 'video',
  } as any,
});

export const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Type de fichier non autorisé. Utilisez JPEG, PNG, WebP ou GIF.'));
  },
}).single('file');

export const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_MIMES.includes(file.mimetype) || /\.(mp4|mov|mkv|webm)$/i.test(file.originalname))
      return cb(null, true);
    cb(new Error('Type de fichier non autorisé. Utilisez MP4, MOV ou MKV.'));
  },
}).single('file');

/**
 * Returns the Cloudinary secure URL for an uploaded file.
 * multer-storage-cloudinary sets req.file.path to the Cloudinary secure URL automatically.
 * This function is kept for backward compatibility — prefer req.file.path directly in route handlers.
 */
export function getFileUrl(filePathOrFilename: string, _type?: 'images' | 'videos'): string {
  return filePathOrFilename;
}

export { cloudinary };
