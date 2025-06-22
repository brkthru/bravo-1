import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'mediatool_v2';
const INPUT_DIR = './data-transformed';

async function loadData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    
    // Load transformed campaigns
    const campaignsPath = path.join(INPUT_DIR, 'campaigns.json');
    
    // Check if file exists
    try {
      await fs.access(campaignsPath);
    } catch {
      console.error(`Transformed campaigns file not found at ${campaignsPath}`);
      console.error('Please run transform-data.ts first.');
      process.exit(1);
    }
    
    const campaigns = JSON.parse(
      await fs.readFile(campaignsPath, 'utf-8')
    );
    
    console.log(`\nLoaded ${campaigns.length} campaigns from file`);
    
    // Get current campaigns collection
    const campaignsCollection = db.collection('campaigns');
    const currentCount = await campaignsCollection.countDocuments();
    
    console.log(`Current campaigns collection has ${currentCount} documents`);
    
    // Create backup of current campaigns
    if (currentCount > 0) {
      console.log('\nBacking up current campaigns...');
      const backupName = `campaigns_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const currentCampaigns = await campaignsCollection.find({}).toArray();
      
      await db.collection(backupName).insertMany(currentCampaigns);
      console.log(`Current campaigns backed up to collection: ${backupName}`);
    }
    
    // Ask for confirmation
    console.log('\n=== IMPORTANT ===');
    console.log(`This will replace ${currentCount} campaigns with ${campaigns.length} campaigns from the backup.`);
    console.log('The current campaigns have been backed up.');
    
    // Clear current campaigns
    console.log('\nClearing current campaigns collection...');
    await campaignsCollection.deleteMany({});
    
    // Load new campaigns in batches
    console.log('\nLoading campaigns...');
    const batchSize = 1000;
    let loaded = 0;
    
    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);
      await campaignsCollection.insertMany(batch);
      loaded += batch.length;
      console.log(`  Loaded ${loaded}/${campaigns.length} campaigns`);
    }
    
    // Create indexes
    console.log('\nCreating indexes...');
    await campaignsCollection.createIndex({ campaignNumber: 1 }, { unique: true });
    await campaignsCollection.createIndex({ name: 'text' });
    await campaignsCollection.createIndex({ 'team.leadAccountManager.id': 1 });
    await campaignsCollection.createIndex({ 'team.mediaTrader.id': 1 });
    await campaignsCollection.createIndex({ status: 1 });
    await campaignsCollection.createIndex({ createdAt: -1 });
    await campaignsCollection.createIndex({ updatedAt: -1 });
    
    // Verify the load
    const finalCount = await campaignsCollection.countDocuments();
    const sampleCampaigns = await campaignsCollection.find({}).limit(5).toArray();
    
    console.log('\n=== Load Complete ===');
    console.log(`Successfully loaded ${finalCount} campaigns`);
    console.log('\nSample campaigns:');
    sampleCampaigns.forEach(c => {
      console.log(`- ${c.campaignNumber}: ${c.name} (${c.lineItems?.length || 0} line items)`);
    });
    
    // Save load summary
    const summaryPath = path.join(INPUT_DIR, 'load-summary.json');
    await fs.writeFile(
      summaryPath,
      JSON.stringify({
        loadedAt: new Date().toISOString(),
        campaignsLoaded: finalCount,
        previousCount: currentCount,
        indexes: [
          'campaignNumber (unique)',
          'name (text)',
          'team.leadAccountManager.id',
          'team.mediaTrader.id',
          'status',
          'createdAt',
          'updatedAt'
        ]
      }, null, 2),
      'utf-8'
    );
    
    console.log(`\nLoad summary saved to: ${path.resolve(summaryPath)}`);
    
  } catch (error) {
    console.error('Load failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the load
loadData();