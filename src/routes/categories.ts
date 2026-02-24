import { Router } from 'express';
import { Category } from '../models/Category';

const router = Router();

// GET /api/v1/categories — list all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1 }).lean();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Échec du chargement des catégories.' });
  }
});

export default router;
