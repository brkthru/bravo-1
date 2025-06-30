#!/usr/bin/env bun
/**
 * Load converted campaign data with new schema into MongoDB
 */

import { MongoClient, Db } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.MONGO_DB || 'bravo-1';
const INPUT_FILE = '../../data/transformed/20250628-154322/campaigns-from-postgres.json';

async function loadData() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection('campaigns');

    // Clear existing data
    console.log('Clearing existing campaigns...');
    const deleteResult = await collection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing campaigns`);

    // Load new data
    console.log('Loading converted campaigns...');
    const campaigns = JSON.parse(await fs.readFile(INPUT_FILE, 'utf-8'));
    console.log(`Loaded ${campaigns.length} campaigns from file`);

    // Insert in batches
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);
      const result = await collection.insertMany(batch, { ordered: false });
      inserted += result.insertedCount;
      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1}: ${result.insertedCount} documents`
      );
    }

    console.log(`\nTotal inserted: ${inserted} campaigns`);

    // Verify a sample
    const sample = await collection.findOne({ campaignNumber: 'STR-D1F227C0' });
    console.log('\nSample campaign from DB:');
    console.log(
      JSON.stringify(
        {
          campaignNumber: sample?.campaignNumber,
          name: sample?.name,
          hasPrice: !!sample?.price,
          hasBudget: !!sample?.budget,
          'price.targetAmount': sample?.price?.targetAmount,
          'metrics.units': sample?.metrics?.units,
          'metrics.marginAmount': sample?.metrics?.marginAmount,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the load
loadData().catch(console.error);
