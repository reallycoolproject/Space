const mongoose = require('mongoose');

// Define the GroupChat schema inline
const groupChatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: String, required: true },
  members: [{
    userId: { type: String, required: true },
    role: { type: String, enum: ['Owner', 'Admin', 'Member'], default: 'Member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  nicknames: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const GroupChat = mongoose.model('GroupChat', groupChatSchema);

// MongoDB connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/space-app';

async function clearGroups() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const result = await GroupChat.deleteMany({});
    console.log(`Deleted ${result.deletedCount} groups from database`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing groups:', error);
    process.exit(1);
  }
}

clearGroups();
