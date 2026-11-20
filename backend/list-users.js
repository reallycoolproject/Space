const mongoose = require('mongoose');
const path = require('path');

// Define User schema inline
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true },
  username: { type: String, required: true, trim: true, unique: true },
  userId: { type: String, required: true, unique: true },
  displayName: { type: String, trim: true },
  avatar: { type: String },
  banner: { type: String },
  bio: { type: String, trim: true, maxlength: 200 },
  pronouns: { type: String, trim: true, maxlength: 50 },
  publicKey: { type: String },
  encryptedPrivateKey: { type: String },
  provider: { type: String, required: true, enum: ['local', 'google'], default: 'local' },
  contacts: { type: [String], default: [] },
  pendingRequests: { type: [String], default: [] },
  blockedUsers: { type: [String], default: [] },
  hasCompletedOnboarding: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Connect to MongoDB
mongoose.connect('mongodb+srv://spaceappsupport_db_user:wdw9A6LlUiiqM5Bj@space.96o83cy.mongodb.net/?appName=Space')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Get all users
    const users = await User.find({}).select('username email displayName userId createdAt').exec();
    
    console.log('\n=== ALL USERS ===\n');
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Display Name: ${user.displayName || 'N/A'}`);
      console.log(`  User ID: ${user.userId}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log('');
    });
    
    console.log(`Total users: ${users.length}`);
    console.log('\nNote: Passwords are hashed and cannot be retrieved. You can reset passwords by using the "Forgot Password" feature or by creating a new account.');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
