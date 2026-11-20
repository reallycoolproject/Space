const mongoose = require('mongoose');

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://spaceappsupport_db_user:wdw9A6LlUiiqM5Bj@space.96o83cy.mongodb.net/?appName=Space', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to MongoDB Atlas');

  // Get all collections
  const collections = await mongoose.connection.db.collections();

  // Drop each collection
  for (const collection of collections) {
    await collection.deleteMany({});
    console.log(`Cleared collection: ${collection.collectionName}`);
  }

  console.log('All collections cleared successfully');
  process.exit(0);
}).catch(err => {
  console.error('Error connecting to MongoDB Atlas:', err);
  process.exit(1);
});
