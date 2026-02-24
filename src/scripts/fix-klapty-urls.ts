/**
 * Fix Klapty URLs in VenueMedia.
 * Finds any TOUR_360_EMBED_URL (or TOUR_360_VIDEO used as embed) that contains:
 *   - storage.klapty.com
 *   - /p/ (public page)
 *   - /t/ (public page path, but not /tour/tunnel/)
 *   or does NOT contain www.klapty.com/tour/tunnel/
 * Replaces invalid URLs with a placeholder tunnel URL and prints a report.
 *
 * Run: npm run fix-klapty-urls   (add script to package.json)
 * Or:  npx tsx src/scripts/fix-klapty-urls.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { VenueMedia } from '../models/VenueMedia';

dotenv.config();

const VALID_PREFIX = 'https://www.klapty.com/tour/tunnel/';
const PLACEHOLDER_URL = 'https://www.klapty.com/tour/tunnel/IBJ0xpE8hq';

function isInvalidKlaptyUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  const u = url.trim().toLowerCase();
  if (u.includes('storage.klapty.com')) return true;
  if (u.includes('klapty.com') && u.includes('/p/')) return true;
  if (u.includes('klapty.com') && u.includes('/t/') && !u.includes('/tour/tunnel/')) return true;
  if (!u.startsWith('https://www.klapty.com/tour/tunnel/')) return true;
  return false;
}

async function main() {
  await connectDatabase();

  const allEmbed = await VenueMedia.find({
    kind: { $in: ['TOUR_360_EMBED_URL', 'TOUR_360_VIDEO'] },
  }).lean();

  const invalid: Array<{ _id: string; venueId: string; kind: string; url: string }> = [];
  for (const doc of allEmbed) {
    const url = (doc as any).url;
    if (isInvalidKlaptyUrl(url)) {
      invalid.push({
        _id: (doc as any)._id.toString(),
        venueId: (doc as any).venueId.toString(),
        kind: (doc as any).kind,
        url: url || '',
      });
    }
  }

  if (invalid.length === 0) {
    console.log('✅ All Klapty URLs are valid (tunnel format). Nothing to fix.');
    await mongoose.connection.close();
    process.exit(0);
    return;
  }

  console.log(`\n⚠️  Found ${invalid.length} invalid Klapty URL(s):\n`);
  for (const item of invalid) {
    console.log(`  VenueMedia ${item._id} (venueId: ${item.venueId}, kind: ${item.kind})`);
    console.log(`    Invalid URL: ${item.url}`);
  }

  const fix = process.argv.includes('--fix');
  if (fix) {
    console.log('\n🔧 Replacing with placeholder tunnel URL:', PLACEHOLDER_URL);
    for (const item of invalid) {
      await VenueMedia.updateOne(
        { _id: item._id },
        { $set: { url: PLACEHOLDER_URL, kind: 'TOUR_360_EMBED_URL' } }
      );
    }
    console.log('✅ Updated', invalid.length, 'document(s). Replace placeholder with real tunnel IDs from Klapty dashboard.');
  } else {
    console.log('\n💡 Run with --fix to replace invalid URLs with placeholder:', 'node scripts/fix-klapty-urls.js --fix');
    console.log('   Or: npx tsx src/scripts/fix-klapty-urls.ts --fix');
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error:', err);
  await mongoose.connection.close();
  process.exit(1);
});
