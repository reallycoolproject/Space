const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function reset() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/space');
    await mongoose.connection.db.dropDatabase();
    console.log('Successfully dropped the remote database.');
  } catch (err) {
    console.error('Error dropping database:', err);
  } finally {
    process.exit(0);
  }
}

reset();
