import { Router } from 'express';
import { Category } from '../models/Category';

const router = Router();

// GET /api/v1/categories — list all categories (active only)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: { $ne: false } })
      .sort({ sortOrder: 1, displayOrder: 1 })
      .lean();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Échec du chargement des catégories.' });
  }
});

// GET /api/v1/categories/:slug — single category by slug
router.get('/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: { $ne: false } }).lean();
    if (!category) return res.status(404).json({ error: 'Catégorie non trouvée' });
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Échec du chargement de la catégorie.' });
  }
});

export default router;
