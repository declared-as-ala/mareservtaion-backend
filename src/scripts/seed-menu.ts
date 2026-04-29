import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { MenuItem } from '../models/MenuItem';
import { Venue } from '../models/Venue';

const menuData = [

  // ─────────────────────────────────────────────────────────
  // ☕  BABOL COFFEE
  // ─────────────────────────────────────────────────────────
  // Boissons
  { venueSlug: 'babol-coffee-tunis', category: 'boisson', name: 'Espresso', description: 'Café serré, corsé et intense.', price: 3.5, isPopular: true },
  { venueSlug: 'babol-coffee-tunis', category: 'boisson', name: 'Cappuccino', description: 'Espresso, lait vapeur et mousse onctueuse.', price: 5.5, isPopular: true },
  { venueSlug: 'babol-coffee-tunis', category: 'boisson', name: 'Latte Caramel', description: 'Café au lait avec sirop de caramel maison.', price: 7.0, isPopular: false },
  { venueSlug: 'babol-coffee-tunis', category: 'boisson', name: 'Matcha Latte', description: 'Thé matcha japonais avec lait d\'amande.', price: 8.0, isPopular: false },
  { venueSlug: 'babol-coffee-tunis', category: 'boisson', name: 'Smoothie Mangue Passion', description: 'Mangue fraîche, fruit de la passion, yaourt.', price: 9.0 },
  { venueSlug: 'babol-coffee-tunis', category: 'boisson', name: 'Jus d\'Orange Frais', description: 'Pressé à la minute, 100% naturel.', price: 6.5 },
  { venueSlug: 'babol-coffee-tunis', category: 'boisson', name: 'Chocolat Chaud Belge', description: 'Chocolat fondu, lait entier, chantilly.', price: 7.5 },

  // Entrées (snacks)
  { venueSlug: 'babol-coffee-tunis', category: 'entree', name: 'Avocado Toast', description: 'Pain au levain grillé, avocat, œuf poché, graines de sésame.', price: 14.0, isPopular: true },
  { venueSlug: 'babol-coffee-tunis', category: 'entree', name: 'Granola Bowl', description: 'Granola maison, fruits de saison, miel, lait de coco.', price: 12.0 },
  { venueSlug: 'babol-coffee-tunis', category: 'entree', name: 'Œufs Brouillés', description: 'Œufs fermiers, crème fraîche, ciboulette, toasts.', price: 11.0 },

  // Plats
  { venueSlug: 'babol-coffee-tunis', category: 'plat', name: 'Club Sandwich Babol', description: 'Poulet grillé, bacon, salade, tomate, mayo maison, frites.', price: 18.0, isPopular: true },
  { venueSlug: 'babol-coffee-tunis', category: 'plat', name: 'Salade César', description: 'Romaine, parmesan, croutons, sauce césar maison, poulet grillé.', price: 16.0 },
  { venueSlug: 'babol-coffee-tunis', category: 'plat', name: 'Burger Maison', description: 'Bœuf 180g, cheddar fondu, oignons caramélisés, frites maison.', price: 22.0 },

  // Desserts
  { venueSlug: 'babol-coffee-tunis', category: 'dessert', name: 'Cheesecake Fruits Rouges', description: 'Base biscuitée, crème cream cheese, coulis fraise-framboise.', price: 10.0, isPopular: true },
  { venueSlug: 'babol-coffee-tunis', category: 'dessert', name: 'Tiramisu Maison', description: 'Biscuits imbibés, mascarpone, cacao amer.', price: 9.0 },
  { venueSlug: 'babol-coffee-tunis', category: 'dessert', name: 'Brownie Chocolat Noisettes', description: 'Fondant, éclats de noisettes, glace vanille.', price: 11.0 },
  { venueSlug: 'babol-coffee-tunis', category: 'dessert', name: 'Crêpe Nutella Banane', description: 'Crêpe fine, Nutella, rondelles de banane, chantilly.', price: 8.0 },

  // ─────────────────────────────────────────────────────────
  // ☕  ASHKAL ARABIA
  // ─────────────────────────────────────────────────────────
  // Boissons
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'boisson', name: 'Café Arabe Cardamome', description: 'Café noir infusé avec cardamome et zeste de citron.', price: 4.0, isPopular: true },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'boisson', name: 'Thé à la Menthe', description: 'Thé vert, menthe fraîche, sucre de canne.', price: 3.5, isPopular: true },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'boisson', name: 'Laban (Ayran)', description: 'Lait fermenté salé, menthe séchée.', price: 4.5 },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'boisson', name: 'Jus de Tamarin', description: 'Boisson rafraîchissante traditionnelle.', price: 5.5 },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'boisson', name: 'Café Turc', description: 'Café finement moulu, préparé à la cezve, servi avec lokum.', price: 5.0 },

  // Entrées
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'entree', name: 'Meze Ashkal', description: 'Houmous, mutabbal, taboulé, fattouche, falafels, pain pita.', price: 18.0, isPopular: true },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'entree', name: 'Fatayer Épinards', description: 'Petits chaussons au four farcis épinards et sumac.', price: 9.0 },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'entree', name: 'Houmous Maison', description: 'Pois chiches, tahini, ail, citron, huile d\'olive, paprika.', price: 8.0 },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'entree', name: 'Sambousek', description: 'Beignets farcis à la viande hachée épicée, pignons de pin.', price: 10.0 },

  // Plats
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'plat', name: 'Shawarma Poulet', description: 'Poulet mariné, pain pita, légumes, sauce tahini.', price: 16.0, isPopular: true },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'plat', name: 'Kefta Grillée', description: 'Brochettes de kefta d\'agneau, riz pilaf, salade.', price: 22.0, isPopular: true },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'plat', name: 'Mansaf', description: 'Agneau mijoté au lait fermenté, riz aux pignons, herbes.', price: 28.0 },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'plat', name: 'Maqluba', description: 'Riz renversé à l\'aubergine, poulet, amandes dorées.', price: 24.0 },

  // Desserts
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'dessert', name: 'Baklava Pistache', description: 'Pâte filo, pistaches, sirop de rose.', price: 8.0, isPopular: true },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'dessert', name: 'Knafeh', description: 'Fromage chaud, cheveux d\'ange, sirop de fleur d\'oranger.', price: 10.0, isPopular: true },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'dessert', name: 'Maamoul Dattes', description: 'Sablés fourrés aux dattes et noix, sucre glace.', price: 7.0 },
  { venueSlug: 'ashkal-arabia-sidi-bou-said', category: 'dessert', name: 'Muhallabia', description: 'Crème de lait à la fleur d\'oranger, pistaches concassées.', price: 7.5 },

  // ─────────────────────────────────────────────────────────
  // 🍽️  IL MONTE CRISTO (Restaurant)
  // ─────────────────────────────────────────────────────────
  // Boissons
  { venueSlug: 'il-monte-cristo-tunis', category: 'boisson', name: 'Eau Minérale 50cl', description: 'Eau plate ou gazeuse.', price: 3.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'boisson', name: 'Limonade Maison', description: 'Citrons frais, menthe, sucre de canne, eau pétillante.', price: 7.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'boisson', name: 'Jus de Grenade', description: 'Grenades pressées à la commande.', price: 9.0, isPopular: true },
  { venueSlug: 'il-monte-cristo-tunis', category: 'boisson', name: 'Café Expresso', description: 'Grain Arabica sélectionné, torréfaction artisanale.', price: 4.5 },

  // Entrées
  { venueSlug: 'il-monte-cristo-tunis', category: 'entree', name: 'Carpaccio de Bœuf', description: 'Fines tranches, roquette, parmesan, câpres, huile d\'olive.', price: 18.0, isPopular: true },
  { venueSlug: 'il-monte-cristo-tunis', category: 'entree', name: 'Burrata & Tomates', description: 'Burrata crémeuse, tomates anciennes, basilic, pesto.', price: 16.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'entree', name: 'Soupe de Poissons', description: 'Rouille, gruyère râpé, croûtons aillés.', price: 14.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'entree', name: 'Risotto aux Champignons', description: 'Arborio, champignons sauvages, parmesan, truffe noire.', price: 22.0, isPopular: true },

  // Plats
  { venueSlug: 'il-monte-cristo-tunis', category: 'plat', name: 'Filet de Bar Grillé', description: 'Bar de ligne, beurre blanc citronné, légumes de saison.', price: 42.0, isPopular: true },
  { venueSlug: 'il-monte-cristo-tunis', category: 'plat', name: 'Magret de Canard', description: 'Magret rosé, sauce cerise-balsamique, pommes sarladaises.', price: 38.0, isPopular: true },
  { venueSlug: 'il-monte-cristo-tunis', category: 'plat', name: 'Entrecôte 300g', description: 'Viande maturée, sauce au poivre, frites maison.', price: 48.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'plat', name: 'Linguine Fruits de Mer', description: 'Crevettes, calamars, coques, tomates cerises, persil.', price: 34.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'plat', name: 'Couscous Royal Maison', description: 'Agneau, poulet, merguez, légumes mijotés, bouillon parfumé.', price: 36.0 },

  // Desserts
  { venueSlug: 'il-monte-cristo-tunis', category: 'dessert', name: 'Moelleux Chocolat Noir', description: 'Cœur coulant, glace vanille, éclats de pralin.', price: 14.0, isPopular: true },
  { venueSlug: 'il-monte-cristo-tunis', category: 'dessert', name: 'Crème Brûlée à la Vanille', description: 'Vanille de Madagascar, caramel craquant.', price: 12.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'dessert', name: 'Tiramisu Monte Cristo', description: 'Espresso, mascarpone, cacao grand cru.', price: 13.0 },
  { venueSlug: 'il-monte-cristo-tunis', category: 'dessert', name: 'Assiette de Fromages', description: 'Sélection de 4 fromages, confiture de figues, noix.', price: 16.0 },

  // ─────────────────────────────────────────────────────────
  // 🍽️  LE GOLFE (Restaurant)
  // ─────────────────────────────────────────────────────────
  // Boissons
  { venueSlug: 'le-golfe-sousse', category: 'boisson', name: 'Citronnade Fraîche', description: 'Citrons pressés, menthe, sirop maison.', price: 6.0, isPopular: true },
  { venueSlug: 'le-golfe-sousse', category: 'boisson', name: 'Boga Citron', description: 'Boisson gazeuse artisanale au citron.', price: 4.5 },
  { venueSlug: 'le-golfe-sousse', category: 'boisson', name: 'Smoothie Tropical', description: 'Ananas, mangue, noix de coco, lait.', price: 9.0 },
  { venueSlug: 'le-golfe-sousse', category: 'boisson', name: 'Café Crème', description: 'Espresso allongé avec mousse de lait.', price: 5.0 },

  // Entrées
  { venueSlug: 'le-golfe-sousse', category: 'entree', name: 'Salade Niçoise', description: 'Thon, olives, haricots verts, œuf dur, anchois, vinaigrette.', price: 15.0, isPopular: true },
  { venueSlug: 'le-golfe-sousse', category: 'entree', name: 'Briks au Thon', description: 'Pâte fine croustillante, thon, câpres, œuf, persil.', price: 12.0, isPopular: true },
  { venueSlug: 'le-golfe-sousse', category: 'entree', name: 'Plateau de Fruits de Mer', description: 'Crevettes, moules, bulots, sauce cocktail, citron.', price: 32.0 },
  { venueSlug: 'le-golfe-sousse', category: 'entree', name: 'Ojja Merguez', description: 'Œufs pochés, merguez, tomates, harissa, poivrons.', price: 16.0 },

  // Plats
  { venueSlug: 'le-golfe-sousse', category: 'plat', name: 'Poisson du Jour Grillé', description: 'Sélection du marché, grillé au feu de bois, chermoula, légumes.', price: 38.0, isPopular: true },
  { venueSlug: 'le-golfe-sousse', category: 'plat', name: 'Paella Le Golfe', description: 'Riz valenciana, fruits de mer, safran, citron.', price: 35.0, isPopular: true },
  { venueSlug: 'le-golfe-sousse', category: 'plat', name: 'Côtelettes d\'Agneau', description: 'Grillées aux herbes, purée de pommes de terre, jus corsé.', price: 40.0 },
  { venueSlug: 'le-golfe-sousse', category: 'plat', name: 'Tagine Poulet Olives Citrons', description: 'Mijotage lent, olives confites, citrons beldi, coriandre.', price: 28.0 },
  { venueSlug: 'le-golfe-sousse', category: 'plat', name: 'Couscous Poisson', description: 'Grondin, merlan, légumes fondants, bouillon de la mer.', price: 32.0 },

  // Desserts
  { venueSlug: 'le-golfe-sousse', category: 'dessert', name: 'Makroudh au Miel', description: 'Semoule fine, dattes, huile de fleur d\'oranger, miel.', price: 7.0, isPopular: true },
  { venueSlug: 'le-golfe-sousse', category: 'dessert', name: 'Glace Artisanale (2 boules)', description: 'Choix : vanille, pistache, fraise, caramel beurre salé.', price: 8.0 },
  { venueSlug: 'le-golfe-sousse', category: 'dessert', name: 'Panna Cotta Fruits Rouges', description: 'Crème cuite vanillée, coulis fraise-framboise.', price: 10.0 },
  { venueSlug: 'le-golfe-sousse', category: 'dessert', name: 'Assiette de Pâtisseries Orientales', description: 'Baklava, cornes de gazelle, cigares aux amandes.', price: 12.0 },
];

async function run() {
  await connectDatabase();
  try {
    const venueSlugs = Array.from(new Set(menuData.map((m) => m.venueSlug)));
    const venues = await Venue.find({ slug: { $in: venueSlugs } }).select('_id slug name').lean();
    const venueIdBySlug = new Map(venues.map((v) => [v.slug, v._id]));

    const missing = venueSlugs.filter((slug) => !venueIdBySlug.has(slug));
    if (missing.length > 0) {
      throw new Error(`Missing venues for slugs: ${missing.join(', ')}. Run main seed first.`);
    }

    const venueIds = venues.map((v) => v._id);
    const deleted = await MenuItem.deleteMany({ venueId: { $in: venueIds } });
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing menu items`);

    const payload = menuData.map((item) => ({
      venueId: venueIdBySlug.get(item.venueSlug),
      category: item.category,
      name: item.name,
      description: item.description,
      price: item.price,
      isPopular: item.isPopular ?? false,
      isAvailable: true,
    }));

    const created = await MenuItem.insertMany(payload);
    console.log(`✅ Seeded ${created.length} menu items across ${venueIds.length} venues`);

    for (const venue of venues) {
      const count = payload.filter((m) => String(m.venueId) === String(venue._id)).length;
      console.log(`   • ${venue.name}: ${count} articles`);
    }
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((err) => {
  console.error('❌ Seed failed:', err);
  mongoose.connection.close().finally(() => process.exit(1));
});
