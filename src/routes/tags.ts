import { Router } from 'express';
import { Tag } from '../models/Tag';

const router = Router();

// GET /api/v1/tags — list active tags
router.get('/', async (req, res) => {
  try {
    const tags = await Tag.find({ isActive: true }).sort({ nameFr: 1 }).lean();
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Échec du chargement des tags.' });
  }
});

export default router;
