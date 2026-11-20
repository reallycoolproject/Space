import mongoose from 'mongoose';
import Ticket from '../models/Ticket';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/space';

async function clearAllTickets() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Ticket.deleteMany({});
    console.log(`Deleted ${result.deletedCount} tickets from database`);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing tickets:', error);
    process.exit(1);
  }
}

clearAllTickets();
