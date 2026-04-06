import { Router } from 'express';
import { uploadImage, uploadVideo } from '../middlewares/upload.middleware';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { VirtualTour } from '../models/VirtualTour';

const router = Router();

// POST /api/v1/uploads/image — upload single image (admin or authenticated)
router.post('/image', authenticate, uploadImage, (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Aucun fichier envoyé.' });
    // multer-storage-cloudinary stores the Cloudinary secure URL in file.path
    const url = (file as any).path;
    const publicId = (file as any).filename;
    res.status(201).json({ success: true, data: { url, filename: publicId } });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload.' });
  }
});

// POST /api/v1/uploads/video — upload video (admin); creates or updates VirtualTour with processingStatus pending
router.post('/video', authenticate, requireAdmin, uploadVideo, async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Aucun fichier vidéo envoyé.' });
    const { venueId } = req.body;
    if (!venueId) return res.status(400).json({ success: false, message: 'venueId requis.' });
    // multer-storage-cloudinary stores the Cloudinary secure URL in file.path
    const videoUrl = (file as any).path;
    const tour = await VirtualTour.create({
      venueId,
      sourceType: 'uploaded_video',
      provider: 'custom',
      videoUrl,
      videoOriginalUrl: videoUrl,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      isActive: true,
      isDefault: false,
      processingStatus: 'pending',
      is360: false,
    });
    res.status(201).json({
      success: true,
      data: {
        id: tour._id,
        url: videoUrl,
        processingStatus: tour.processingStatus,
        message: 'Vidéo uploadée. Le traitement peut prendre quelques instants.',
      },
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload vidéo.' });
  }
});

// GET /api/v1/uploads/:id/status — get processing status (e.g. for VirtualTour by id)
router.get('/:id/status', async (req, res) => {
  try {
    const tour = await VirtualTour.findById(req.params.id).select('processingStatus videoUrl posterImageUrl').lean();
    if (!tour) return res.status(404).json({ success: false, message: 'Upload introuvable.' });
    res.json({
      success: true,
      data: {
        processingStatus: (tour as any).processingStatus,
        videoUrl: (tour as any).videoUrl,
        posterImageUrl: (tour as any).posterImageUrl,
      },
    });
  } catch (error) {
    console.error('Error fetching upload status:', error);
    res.status(500).json({ success: false, message: 'Erreur.' });
  }
});

export default router;
