#!/usr/bin/env bun
/**
 * Comprehensive ETL script to load ALL collections from PostgreSQL export
 * Ensures consistent ObjectId handling across all collections
 */

import { MongoClient, ObjectId, Db } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'bravo-1';
const EXPORT_DIR = '../../exports/raw/20250628-154322';

interface LoadResult {
  collection: string;
  loaded: number;
  errors: number;
}

// Helper to convert string IDs to ObjectId where appropriate
function processDocument(doc: any, collection: string): any {
  const processed = { ...doc };

  // Convert _id to ObjectId if it's a string
  if (processed._id && typeof processed._id === 'string') {
    try {
      processed._id = new ObjectId(processed._id);
    } catch (e) {
      // If it's not a valid ObjectId format, keep as string
      // This handles PostgreSQL UUIDs
    }
  }

  // Convert PostgreSQL UUIDs to MongoDB ObjectIds for specific fields
  if (collection === 'accounts' && processed.id) {
    // For accounts, create a new ObjectId for _id
    if (!processed._id) {
      processed._id = new ObjectId();
    }
    // Keep the original PostgreSQL ID as accountId
    processed.accountId = processed.id;
    delete processed.id;
  }

  return processed;
}

async function loadCollection(
  db: Db,
  pgFileName: string,
  mongoCollection: string,
  transform?: (doc: any) => any
): Promise<LoadResult> {
  console.log(`\nLoading ${mongoCollection}...`);

  try {
    // Read PostgreSQL export
    const filePath = path.join(EXPORT_DIR, pgFileName);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const documents = JSON.parse(fileContent);

    console.log(`  Found ${documents.length} documents in ${pgFileName}`);

    // Get collection
    const collection = db.collection(mongoCollection);

    // Clear existing data
    const deleteResult = await collection.deleteMany({});
    console.log(`  Deleted ${deleteResult.deletedCount} existing documents`);

    if (documents.length === 0) {
      return { collection: mongoCollection, loaded: 0, errors: 0 };
    }

    // Transform documents
    const transformedDocs = documents.map((doc: any) => {
      let transformed = transform ? transform(doc) : doc;
      return processDocument(transformed, mongoCollection);
    });

    // Insert in batches
    const batchSize = 1000;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < transformedDocs.length; i += batchSize) {
      const batch = transformedDocs.slice(i, i + batchSize);
      try {
        const result = await collection.insertMany(batch, { ordered: false });
        inserted += result.insertedCount;
      } catch (error: any) {
        console.error(`  Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errors += batch.length;
      }
    }

    console.log(`  ✅ Loaded ${inserted} documents`);
    if (errors > 0) {
      console.log(`  ❌ Failed to load ${errors} documents`);
    }

    return { collection: mongoCollection, loaded: inserted, errors };
  } catch (error) {
    console.error(`  ❌ Error loading ${mongoCollection}:`, error);
    return { collection: mongoCollection, loaded: 0, errors: 1 };
  }
}

async function loadAllCollections() {
  const client = new MongoClient(MONGODB_URI);
  const results: LoadResult[] = [];

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DATABASE_NAME);

    // Load accounts
    results.push(
      await loadCollection(db, 'accounts.json', 'accounts', (doc) => ({
        ...doc,
        accountNumber: doc.account_number,
        accountName: doc.account_name,
        // Keep other fields as-is
      }))
    );

    // Load users
    results.push(
      await loadCollection(db, 'users.json', 'users', (doc) => ({
        ...doc,
        zohoUserId: doc.zoho_user_id,
        modifiedTime: doc.modified_time,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))
    );

    // Load campaigns (already transformed - use the enhanced version)
    try {
      const campaignsPath = '../../data/transformed/20250628-154322/campaigns-with-traders.json';
      const campaigns = JSON.parse(await fs.readFile(campaignsPath, 'utf-8'));
      const collection = db.collection('campaigns');
      await collection.deleteMany({});

      // Ensure ObjectIds for campaigns
      const processedCampaigns = campaigns.map((c: any) => ({
        ...c,
        _id: new ObjectId(c._id),
      }));

      await collection.insertMany(processedCampaigns);
      results.push({ collection: 'campaigns', loaded: campaigns.length, errors: 0 });
      console.log(`\n✅ Loaded ${campaigns.length} campaigns (with media traders)`);
    } catch (e) {
      console.error('Failed to load transformed campaigns:', e);
    }

    // Load strategies
    results.push(
      await loadCollection(db, 'strategies.json', 'strategies', (doc) => ({
        ...doc,
        strategyId: doc.id,
        campaignId: doc.campaign_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))
    );

    // Load line items
    results.push(
      await loadCollection(db, 'line_items.json', 'lineItems', (doc) => ({
        ...doc,
        lineItemId: doc.id,
        strategyId: doc.strategy_id,
        startDate: doc.start_date,
        endDate: doc.end_date,
        targetMargin: doc.target_margin,
        unitPrice: doc.unit_price,
        unitPriceTypeId: doc.unit_price_type_id,
        mediaTraderUserIds: doc.media_trader_user_ids || [],
        mediaPlatformIds: doc.media_platform_ids || [],
        channelId: doc.channel_id,
        tacticId: doc.tactic_id,
        adFormats: doc.ad_formats,
        pacingType: doc.pacing_type,
        pacingDetails: doc.pacing_details,
        purchaseOrderNumber: doc.purchase_order_number,
        changesetId: doc.changeset_id,
        isDeleted: doc.is_deleted,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))
    );

    // Load media buys (line_item_media_buys)
    results.push(
      await loadCollection(db, 'line_item_media_buys.json', 'lineItemMediaBuys', (doc) => ({
        ...doc,
        mediaBuyId: doc.id,
        lineItemId: doc.line_item_id,
        startDate: doc.start_date,
        endDate: doc.end_date,
        plannedUnits: doc.planned_units,
        plannedSpend: doc.planned_spend,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))
    );

    // Load media buys
    results.push(
      await loadCollection(db, 'media_buys.json', 'mediaBuys', (doc) => ({
        ...doc,
        mediaBuyId: doc.id,
        lineItemMediaBuyId: doc.line_item_media_buy_id,
        mediaPlatformId: doc.media_platform_id,
        platformEntityId: doc.platform_entity_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))
    );

    // Load media platform entities (this is a large collection)
    results.push(
      await loadCollection(db, 'media_platform_entities.json', 'mediaPlatformEntities', (doc) => ({
        ...doc,
        entityId: doc.id,
        mediaPlatformId: doc.media_platform_id,
        externalId: doc.external_id,
        entityType: doc.entity_type,
        parentId: doc.parent_id,
        metadata: doc.metadata,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))
    );

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('LOAD SUMMARY');
    console.log('='.repeat(60));

    let totalLoaded = 0;
    let totalErrors = 0;

    results.forEach((result) => {
      totalLoaded += result.loaded;
      totalErrors += result.errors;

      const status = result.errors === 0 ? '✅' : '⚠️';
      console.log(
        `${status} ${result.collection.padEnd(20)} ${result.loaded.toString().padStart(8)} loaded`
      );
    });

    console.log('='.repeat(60));
    console.log(`Total documents loaded: ${totalLoaded}`);
    if (totalErrors > 0) {
      console.log(`Total errors: ${totalErrors}`);
    }

    // Verify collections
    console.log('\nVerifying collections in database:');
    const collections = await db.listCollections().toArray();
    collections.forEach((col) => {
      console.log(`  - ${col.name}`);
    });
  } catch (error) {
    console.error('Error during load:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the comprehensive load
if (import.meta.main) {
  loadAllCollections().catch(console.error);
}
