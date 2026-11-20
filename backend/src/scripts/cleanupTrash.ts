import mongoose from 'mongoose';
import Ticket from '../models/Ticket';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/space';

async function cleanupTrash() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Ticket.deleteMany({
      inTrash: true,
      trashDate: { $lt: thirtyDaysAgo }
    });

    console.log(`Deleted ${result.deletedCount} tickets from trash (older than 30 days)`);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning up trash:', error);
    process.exit(1);
  }
}

cleanupTrash();
