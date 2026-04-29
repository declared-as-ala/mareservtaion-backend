import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import { MenuDuJour } from '../models/MenuDuJour';
import { Venue } from '../models/Venue';

const router = Router();

router.get('/venue/:venueId/active', async (req, res) => {
  const { venueId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(venueId)) return res.status(400).json({ error: 'venueId invalide.' });
  const today = new Date().toISOString().slice(0, 10);
  const menu = await MenuDuJour.findOne({ venueId, date: today, isActive: true }).lean();
  res.json({ success: true, data: menu });
});

router.get('/owner', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Non authentifie.' });
  const menus = await MenuDuJour.find({ ownerId: req.userId }).sort({ date: -1 }).lean();
  res.json({ success: true, data: menus });
});

router.post('/owner', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Non authentifie.' });
  const { venueId, title, date, description, items, isActive } = req.body;
  const venue = await Venue.findById(venueId).select('ownerId type').lean();
  if (!venue) return res.status(404).json({ error: 'Lieu introuvable.' });
  if (String((venue as any).ownerId || '') !== req.userId) return res.status(403).json({ error: 'Acces refuse.' });
  if (!['CAFE', 'RESTAURANT'].includes(String((venue as any).type || ''))) {
    return res.status(400).json({ error: 'Menu du jour reserve aux cafes/restaurants.' });
  }
  const menu = await MenuDuJour.create({ venueId, ownerId: req.userId, title, date, description, items: items || [], isActive: isActive !== false });
  res.status(201).json({ success: true, data: menu });
});

router.patch('/owner/:id', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Non authentifie.' });
  const menu = await MenuDuJour.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!menu) return res.status(404).json({ error: 'Menu introuvable.' });
  Object.assign(menu, req.body || {});
  await menu.save();
  res.json({ success: true, data: menu });
});

router.delete('/owner/:id', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Non authentifie.' });
  await MenuDuJour.deleteOne({ _id: req.params.id, ownerId: req.userId });
  res.json({ success: true });
});

export default router;
