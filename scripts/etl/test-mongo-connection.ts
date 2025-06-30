#!/usr/bin/env bun

import { MongoClient } from 'mongodb';

async function test() {
  console.log('Testing MongoDB connection...');
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    await client.connect();
    console.log('✓ Connected successfully');

    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log(
      'Databases:',
      dbs.databases.map((d) => d.name)
    );
  } catch (error) {
    console.error('✗ Connection failed:', error);
  } finally {
    await client.close();
  }
}

test();
