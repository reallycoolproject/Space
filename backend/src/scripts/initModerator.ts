import mongoose from 'mongoose';
import Moderator from '../models/Moderator';
import dotenv from 'dotenv';

dotenv.config();

const initModerator = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/space');
    console.log('MongoDB connected');

    // Check if moderator already exists
    const existingModerator = await Moderator.findOne({ username: 'soly' });
    if (existingModerator) {
      console.log('Moderator "soly" already exists');
      process.exit(0);
    }

    // Create moderator
    const moderator = new Moderator({
      username: 'soly',
      password: '123',
      isActive: true,
      claimedTickets: []
    });

    await moderator.save();
    console.log('Moderator "soly" created successfully with password "123"');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing moderator:', error);
    process.exit(1);
  }
};

initModerator();
