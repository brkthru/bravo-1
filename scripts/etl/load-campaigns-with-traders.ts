#!/usr/bin/env bun
/**
 * Load campaigns with media trader assignments into MongoDB
 */

import { MongoClient } from 'mongodb';
import fs from 'fs/promises';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'bravo-1';
const INPUT_FILE = '../../data/transformed/20250628-154322/campaigns-with-traders.json';

async function loadEnhancedData() {
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
    console.log('Loading campaigns with media traders...');
    const campaigns = JSON.parse(await fs.readFile(INPUT_FILE, 'utf-8'));
    console.log(`Loaded ${campaigns.length} campaigns from file`);

    // Count campaigns with media traders
    const withMediaTraders = campaigns.filter((c: any) => c.team.mediaTraders.length > 0).length;
    console.log(`  - ${withMediaTraders} campaigns have media traders assigned`);

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

    // Verify media traders
    const sampleWithTraders = await collection.findOne({
      'team.mediaTraders.0': { $exists: true },
    });
    if (sampleWithTraders) {
      console.log('\nSample campaign with media traders:');
      console.log(`  Campaign: ${sampleWithTraders.campaignNumber} - ${sampleWithTraders.name}`);
      console.log(`  Account Manager: ${sampleWithTraders.team.accountManager?.name || 'None'}`);
      console.log(
        `  Media Traders: ${sampleWithTraders.team.mediaTraders.map((t: any) => t.name).join(', ')}`
      );
    }

    // Summary stats
    const stats = await collection
      .aggregate([
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            withAccountManager: {
              $sum: { $cond: [{ $ne: ['$team.accountManager', null] }, 1, 0] },
            },
            withMediaTraders: {
              $sum: { $cond: [{ $gt: [{ $size: '$team.mediaTraders' }, 0] }, 1, 0] },
            },
            avgMediaTraders: {
              $avg: { $size: '$team.mediaTraders' },
            },
          },
        },
      ])
      .toArray();

    if (stats[0]) {
      console.log('\nTeam assignment summary:');
      console.log(`  Total campaigns: ${stats[0].totalCampaigns}`);
      console.log(
        `  With account manager: ${stats[0].withAccountManager} (${((stats[0].withAccountManager / stats[0].totalCampaigns) * 100).toFixed(1)}%)`
      );
      console.log(
        `  With media traders: ${stats[0].withMediaTraders} (${((stats[0].withMediaTraders / stats[0].totalCampaigns) * 100).toFixed(1)}%)`
      );
      console.log(`  Average media traders per campaign: ${stats[0].avgMediaTraders.toFixed(2)}`);
    }
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

loadEnhancedData().catch(console.error);
