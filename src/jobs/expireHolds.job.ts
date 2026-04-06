import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { ReservationHold } from '../models/ReservationHold';

/**
 * Mark expired reservation holds as expired.
 * Run via: npx tsx src/jobs/expireHolds.job.ts
 * Or schedule with cron: every 5 min.
 */
async function expireHolds() {
  await connectDatabase();
  const result = await ReservationHold.updateMany(
    { status: 'active', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
  console.log(`Expired ${result.modifiedCount} holds.`);
  process.exit(0);
}

expireHolds().catch((err) => {
  console.error(err);
  process.exit(1);
});
