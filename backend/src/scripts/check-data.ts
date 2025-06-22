import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // List all databases
    const dbs = await client.db().admin().listDatabases();
    console.log('\nAvailable databases:');
    dbs.databases.forEach(db => {
      console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // Check mediatool_v2
    const db = client.db('mediatool_v2');
    const collections = await db.listCollections().toArray();
    console.log('\nCollections in mediatool_v2:');
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} documents`);
    }
    
    // Check if there's a mediatool database (without _v2)
    const dbOrig = client.db('mediatool');
    const collectionsOrig = await dbOrig.listCollections().toArray();
    if (collectionsOrig.length > 0) {
      console.log('\nCollections in mediatool:');
      for (const col of collectionsOrig) {
        const count = await dbOrig.collection(col.name).countDocuments();
        console.log(`- ${col.name}: ${count} documents`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkData();