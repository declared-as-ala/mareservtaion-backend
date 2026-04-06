import { Router } from 'express';
import { AppSettings } from '../models/AppSettings';
import { BannerSlide } from '../models/BannerSlide';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

// GET /api/v1/meta/homepage-config — site name, logo, sections order, banners config, etc.
router.get('/homepage-config', async (_req, res) => {
  try {
    const [settings, bannerSlides] = await Promise.all([
      AppSettings.findOne().lean(),
      BannerSlide.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    ]);
    const config = {
      siteName: settings?.siteName ?? 'Ma Reservation',
      logoUrlLight: settings?.logoUrlLight,
      logoUrlDark: settings?.logoUrlDark,
      supportPhone: settings?.supportPhone,
      supportEmail: settings?.supportEmail,
      defaultLanguage: settings?.defaultLanguage ?? 'fr',
      homeSectionsOrder: settings?.homeSectionsOrder ?? [],
      isMaintenanceMode: settings?.isMaintenanceMode ?? false,
      maintenanceMessageFr: settings?.maintenanceMessageFr,
      socialLinks: settings?.socialLinks ?? {},
      bannerSlides: bannerSlides || [],
    };
    sendSuccess(res, { data: config });
  } catch (error) {
    console.error('Error fetching homepage config:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement de la configuration.' });
  }
});

// GET /api/v1/meta/features — feature flags for frontend
router.get('/features', async (_req, res) => {
  try {
    const settings = await AppSettings.findOne().select('featureFlags').lean();
    sendSuccess(res, { data: settings?.featureFlags ?? {} });
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement des fonctionnalités.' });
  }
});

export default router;
