import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

async function seedUser() {
  try {
    await connectDatabase();

    const email = 'ala@ala.com';
    const password = 'password123';
    const fullName = 'Ala';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`User ${email} already exists.`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await User.create({
        fullName,
        email,
        passwordHash,
        role: 'ESTABLISHMENT_OWNER',
        isActive: true,
        emailVerified: true
      });
      console.log(`User ${email} created successfully with password: ${password}`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding user:', error);
    process.exit(1);
  }
}

seedUser();
