import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';

dotenv.config();

const EMAIL = 'admin@mareservation.tn';
const NEW_PASSWORD = 'password123';

async function updatePassword() {
  try {
    await connectDatabase();
    console.log('✅ Connected to MongoDB');

    let user = await User.findOne({ email: EMAIL });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(NEW_PASSWORD, salt);

    if (!user) {
      console.log(`⚠️ User with email ${EMAIL} not found. Creating new admin user...`);
      user = new User({
        email: EMAIL,
        fullName: 'Admin Ma Reservation',
        role: 'ADMIN',
        passwordHash: hash
      });
      await user.save();
      console.log(`✅ Admin user successfully created with password "${NEW_PASSWORD}"`);
    } else {
      user.passwordHash = hash;
      await user.save();
      console.log(`✅ Password successfully updated for ${EMAIL}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

updatePassword();
