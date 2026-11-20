import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { AuthCredential } from '../models/AuthCredential';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const initAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/space';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    const username = 'omg';
    const plainPassword = '123';
    const email = 'omg@space.chat';

    let user = await User.findOne({ username });
    if (!user) {
      const generatedUserId = 'admin_' + Math.random().toString(36).substring(2, 10);
      user = new User({
        username,
        email,
        userId: generatedUserId,
        displayName: 'OMG Admin',
        role: 'admin',
        provider: 'local',
        hasCompletedOnboarding: true,
        status: 'active'
      });
      await user.save();
      console.log('Created user "omg" with role "admin", userId:', generatedUserId);
    } else {
      user.role = 'admin';
      await user.save();
      console.log('Updated existing user "omg" to role "admin"');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(plainPassword, salt);

    let cred = await AuthCredential.findOne({ userId: user._id, provider: 'local' });
    if (!cred) {
      cred = new AuthCredential({
        userId: user._id,
        provider: 'local',
        passwordHash
      });
      await cred.save();
      console.log('Created AuthCredential for "omg"');
    } else {
      cred.passwordHash = passwordHash;
      await cred.save();
      console.log('Updated AuthCredential password for "omg"');
    }

    console.log('Admin user setup complete: username: "omg", password: "123"');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing admin:', error);
    process.exit(1);
  }
};

initAdmin();
