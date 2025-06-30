#!/usr/bin/env bun
/**
 * Analyze user mappings between PostgreSQL export and MongoDB
 * Understand why user references are missing
 */

import fs from 'fs/promises';
import path from 'path';

const EXPORT_DIR = '../../exports/raw/20250628-154322';

async function loadJsonFile(filename: string): Promise<any[]> {
  const filepath = path.join(EXPORT_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

async function analyzeUserMappings() {
  console.log('Analyzing user mappings...\n');

  // Load data
  const campaigns = await loadJsonFile('campaigns.json');
  const users = await loadJsonFile('users.json');

  console.log(`Loaded ${campaigns.length} campaigns and ${users.length} users\n`);

  // Create user maps
  const userById = new Map(users.map((u) => [u.id, u]));
  const userByZohoId = new Map(users.map((u) => [u.zoho_user_id, u]));

  // Analyze user fields in campaigns
  const userFields = ['owner_user_id', 'lead_account_owner_user_id', 'sales_rep_user_id'];

  const missingUsers = new Set<string>();
  const foundUsers = new Set<string>();

  for (const field of userFields) {
    let found = 0;
    let missing = 0;
    const uniqueIds = new Set<string>();

    for (const campaign of campaigns) {
      const userId = campaign[field];
      if (userId) {
        uniqueIds.add(userId);
        if (userById.has(userId) || userByZohoId.has(userId)) {
          found++;
          foundUsers.add(userId);
        } else {
          missing++;
          missingUsers.add(userId);
        }
      }
    }

    console.log(`${field}:`);
    console.log(`  - Total campaigns with this field: ${found + missing}`);
    console.log(`  - Found in users table: ${found}`);
    console.log(`  - Missing from users table: ${missing}`);
    console.log(`  - Unique IDs: ${uniqueIds.size}\n`);
  }

  // Sample missing users
  console.log('Sample missing user IDs:');
  const sampleMissing = Array.from(missingUsers).slice(0, 5);
  sampleMissing.forEach((id) => console.log(`  - ${id}`));

  // Sample users that exist
  console.log('\nSample users that exist:');
  users.slice(0, 5).forEach((user) => {
    console.log(`  - ID: ${user.id}, Zoho: ${user.zoho_user_id}, Name: ${user.name}`);
  });

  // Check ID format patterns
  console.log('\nID format analysis:');
  console.log('Campaign user ID format:', Array.from(missingUsers)[0]);
  console.log('Users table ID format:', users[0]?.id);
  console.log('Users table Zoho ID format:', users[0]?.zoho_user_id);

  // Check if IDs might be Zoho IDs
  let matchedByZoho = 0;
  for (const userId of missingUsers) {
    if (userByZohoId.has(userId)) {
      matchedByZoho++;
    }
  }
  console.log(`\nMissing users that match by Zoho ID: ${matchedByZoho}`);

  // Check for media trader roles
  console.log('\nUser roles in users table:');
  const roleCount: Record<string, number> = {};
  users.forEach((user) => {
    const role = user.role || 'unknown';
    roleCount[role] = (roleCount[role] || 0) + 1;
  });
  console.log(roleCount);
}

analyzeUserMappings().catch(console.error);
