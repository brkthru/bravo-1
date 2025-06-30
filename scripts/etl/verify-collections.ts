#!/usr/bin/env bun
/**
 * Verify all collections are loaded with proper ObjectId formatting
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'bravo-1';

async function verifyCollections() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);

    console.log('MongoDB Collection Verification\n' + '='.repeat(60));

    // Check each collection
    const collections = [
      'accounts',
      'zohoUsers',
      'campaigns',
      'strategies',
      'lineItems',
      'lineItemMediaBuys',
      'mediaBuys',
      'mediaPlatformEntities',
      'mediaPlatforms',
      'channels',
      'tactics',
      'teams',
    ];

    for (const collName of collections) {
      const coll = db.collection(collName);
      const count = await coll.countDocuments();
      const sample = await coll.findOne();

      console.log(`\n${collName}:`);
      console.log(`  Total documents: ${count.toLocaleString()}`);

      if (sample) {
        console.log(`  Sample _id type: ${typeof sample._id}`);
        console.log(`  Sample _id: ${sample._id}`);

        // Check for specific fields based on collection
        if (collName === 'campaigns' && sample.team?.mediaTraders) {
          console.log(`  Media traders: ${sample.team.mediaTraders.length}`);
        }
        if (collName === 'accounts' && sample.accountId) {
          console.log(`  Has accountId: ${sample.accountId}`);
        }
      }
    }

    // Check specific campaign
    console.log('\n' + '='.repeat(60));
    console.log('Looking up campaign CN-11274:');

    const campaign = await db.collection('campaigns').findOne({
      campaignNumber: 'CN-11274',
    });

    if (campaign) {
      console.log('  Found campaign:', campaign.name);
      console.log('  ObjectId:', campaign._id);
      console.log('  Media traders:', campaign.team?.mediaTraders?.length || 0);

      if (campaign.team?.mediaTraders?.length > 0) {
        console.log(
          '  Trader names:',
          campaign.team.mediaTraders.map((t: any) => t.name).join(', ')
        );
      }
    } else {
      console.log('  Campaign not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verifyCollections().catch(console.error);
