#!/usr/bin/env bun
/**
 * Simple MongoDB database migration without prompts
 */

import { MongoClient } from 'mongodb';

const OLD_DB = 'mediatool_v2';
const NEW_DB = 'bravo-1';

async function migrate() {
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    console.log(`Migrating ${OLD_DB} → ${NEW_DB}`);
    await client.connect();

    // Check databases
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    const hasOld = dbs.databases.some((d) => d.name === OLD_DB);
    const hasNew = dbs.databases.some((d) => d.name === NEW_DB);

    if (!hasOld) {
      console.log(`Source database ${OLD_DB} not found`);
      return;
    }

    if (hasNew) {
      console.log(`Target database ${NEW_DB} already exists - skipping migration`);
      console.log('To force migration, drop the target database first');
      return;
    }

    // Get collections
    const oldDb = client.db(OLD_DB);
    const collections = await oldDb.listCollections().toArray();

    console.log(`Found ${collections.length} collections to migrate`);

    // Migrate each collection
    for (const coll of collections) {
      const name = coll.name;
      console.log(`  Migrating ${name}...`);

      const docs = await oldDb.collection(name).find({}).toArray();
      if (docs.length > 0) {
        await client.db(NEW_DB).collection(name).insertMany(docs);
        console.log(`    ✓ ${docs.length} documents`);
      }
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrate();
