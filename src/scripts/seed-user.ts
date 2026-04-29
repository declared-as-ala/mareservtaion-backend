import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database';
import { User } from '../models/User';

dotenv.config();

async function seedUser() {
  await connectDatabase();

  const hash = await bcrypt.hash('password123', 10);

  const user = await User.findOneAndUpdate(
    { email: 'ala@ala.com' },
    {
      fullName: 'Ala',
      email: 'ala@ala.com',
      passwordHash: hash,
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
    },
    { upsert: true, new: true }
  );

  await User.findOneAndUpdate(
    { email: 'owner.cafe@matable.tn' },
    {
      fullName: 'Owner Cafe MaTable',
      email: 'owner.cafe@matable.tn',
      passwordHash: hash,
      role: 'ESTABLISHMENT_OWNER',
      isActive: true,
      emailVerified: true,
    },
    { upsert: true, new: true }
  );

  console.log(`✅ User upserted: ${user.email} (role: ${user.role}, id: ${user._id})`);
  process.exit(0);
}

seedUser().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
