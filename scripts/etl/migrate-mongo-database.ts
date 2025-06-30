#!/usr/bin/env bun
/**
 * Migrate MongoDB database from old name (mediatool_v2) to new name (bravo-1)
 * This script will:
 * 1. Check if old database exists
 * 2. Create new database with data from old
 * 3. Optionally remove old database
 */

import { MongoClient } from 'mongodb';
import chalk from 'chalk';
import inquirer from 'inquirer';

const DEFAULT_OLD_DB_NAME = 'mediatool_v2';
const DEFAULT_NEW_DB_NAME = 'bravo-1';

// Add support for custom database names
const args = process.argv.slice(2);
let oldDbName = DEFAULT_OLD_DB_NAME;
let newDbName = DEFAULT_NEW_DB_NAME;

if (args.includes('--from') && args.includes('--to')) {
  const fromIndex = args.indexOf('--from');
  const toIndex = args.indexOf('--to');

  if (args[fromIndex + 1] && args[toIndex + 1]) {
    oldDbName = args[fromIndex + 1];
    newDbName = args[toIndex + 1];
  }
}

async function migrateDatabase() {
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    console.log(chalk.blue('🔄 MongoDB Database Migration'));
    console.log(chalk.gray(`  From: ${oldDbName}`));
    console.log(chalk.gray(`  To: ${newDbName}`));
    console.log();

    await client.connect();

    // Check if old database exists
    const admin = client.db().admin();
    const databases = await admin.listDatabases();
    const oldDbExists = databases.databases.some((db) => db.name === oldDbName);
    const newDbExists = databases.databases.some((db) => db.name === newDbName);

    if (!oldDbExists) {
      console.log(chalk.yellow(`⚠️  Database '${oldDbName}' not found`));
      console.log(chalk.gray('   Nothing to migrate'));
      return;
    }

    if (newDbExists) {
      console.log(chalk.yellow(`⚠️  Database '${newDbName}' already exists`));

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Merge data from old database', value: 'merge' },
            { name: 'Replace with data from old database', value: 'replace' },
            { name: 'Skip migration', value: 'skip' },
          ],
        },
      ]);

      if (action === 'skip') {
        console.log(chalk.gray('Migration skipped'));
        return;
      }

      if (action === 'replace') {
        console.log(chalk.yellow('Dropping existing database...'));
        await client.db(newDbName).dropDatabase();
      }
    }

    // Get collections from old database
    const oldDb = client.db(oldDbName);
    const collections = await oldDb.listCollections().toArray();

    console.log(chalk.blue(`\\nMigrating ${collections.length} collections...`));

    for (const collInfo of collections) {
      const collectionName = collInfo.name;
      console.log(chalk.gray(`  Migrating ${collectionName}...`));

      // Get all documents from old collection
      const oldCollection = oldDb.collection(collectionName);
      const documents = await oldCollection.find({}).toArray();

      if (documents.length > 0) {
        // Insert into new database
        const newDb = client.db(newDbName);
        const newCollection = newDb.collection(collectionName);

        // If merging, we might want to handle duplicates
        if (newDbExists) {
          // Use bulkWrite with ordered: false to continue on duplicate key errors
          const operations = documents.map((doc) => ({
            insertOne: { document: doc },
          }));

          try {
            const result = await newCollection.bulkWrite(operations, { ordered: false });
            console.log(chalk.green(`    ✓ Migrated ${result.insertedCount} documents`));
            if (result.writeErrors?.length > 0) {
              console.log(chalk.yellow(`    ⚠ Skipped ${result.writeErrors.length} duplicates`));
            }
          } catch (error: any) {
            if (error.code === 11000) {
              console.log(chalk.yellow(`    ⚠ Some duplicates skipped`));
            } else {
              throw error;
            }
          }
        } else {
          await newCollection.insertMany(documents);
          console.log(chalk.green(`    ✓ Migrated ${documents.length} documents`));
        }

        // Copy indexes
        const indexes = await oldCollection.indexes();
        for (const index of indexes) {
          if (index.name !== '_id_') {
            try {
              await newCollection.createIndex(index.key, {
                name: index.name,
                ...index,
              });
              console.log(chalk.gray(`    ✓ Created index: ${index.name}`));
            } catch (error) {
              console.log(chalk.yellow(`    ⚠ Could not create index: ${index.name}`));
            }
          }
        }
      } else {
        console.log(chalk.gray(`    - Empty collection, skipped`));
      }
    }

    console.log(chalk.green(`\\n✅ Migration completed successfully!`));

    // Ask about removing old database
    const { removeOld } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'removeOld',
        message: `Remove old database '${oldDbName}'?`,
        default: false,
      },
    ]);

    if (removeOld) {
      await client.db(oldDbName).dropDatabase();
      console.log(chalk.green(`✓ Removed old database '${oldDbName}'`));
    } else {
      console.log(chalk.gray(`Old database '${oldDbName}' retained`));
    }

    // Update connection strings reminder
    console.log(chalk.blue('\\n📝 Remember to update:'));
    console.log(chalk.gray('  1. Environment variables: MONGO_DB_NAME=bravo-1'));
    console.log(chalk.gray('  2. Connection strings in your code'));
    console.log(chalk.gray('  3. Backend configuration files'));
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run migration
migrateDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
