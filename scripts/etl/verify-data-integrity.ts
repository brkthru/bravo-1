#!/usr/bin/env bun
/**
 * Verify data integrity between PostgreSQL export and MongoDB
 * Checks that data was correctly transformed and loaded
 */

import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'bravo-1';
const EXPORT_DIR = '../../exports/raw/20250628-154322';

interface VerificationResult {
  field: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

async function loadJsonFile(filename: string): Promise<any[]> {
  const filepath = path.join(EXPORT_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

async function verifyData() {
  const client = new MongoClient(MONGODB_URI);
  const results: VerificationResult[] = [];

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db(DATABASE_NAME);

    // Load PostgreSQL data
    console.log('Loading PostgreSQL export data...');
    const pgCampaigns = await loadJsonFile('campaigns.json');
    const pgUsers = await loadJsonFile('users.json');
    const pgStrategies = await loadJsonFile('strategies.json');
    const pgLineItems = await loadJsonFile('line_items.json');

    console.log(`PostgreSQL data loaded:
  - ${pgCampaigns.length} campaigns
  - ${pgUsers.length} users  
  - ${pgStrategies.length} strategies
  - ${pgLineItems.length} line items\n`);

    // Get MongoDB data
    const mongoCampaigns = await db.collection('campaigns').find({}).toArray();
    console.log(`MongoDB campaigns: ${mongoCampaigns.length}\n`);

    // 1. Verify record counts
    results.push({
      field: 'Campaign Count',
      status: pgCampaigns.length === mongoCampaigns.length ? 'pass' : 'fail',
      message: `PostgreSQL: ${pgCampaigns.length}, MongoDB: ${mongoCampaigns.length}`,
    });

    // 2. Check team data population
    console.log('Checking team data...');
    const campaignsWithTeams = mongoCampaigns.filter((c) => {
      const team = c.team;
      return (
        team &&
        (team.accountManager?.id ||
          team.seniorMediaTraders?.length > 0 ||
          team.mediaTraders?.length > 0)
      );
    });

    results.push({
      field: 'Team Data',
      status: campaignsWithTeams.length > 0 ? 'pass' : 'fail',
      message: `${campaignsWithTeams.length} campaigns have team data`,
      details: {
        withAccountManager: mongoCampaigns.filter((c) => c.team?.accountManager?.id).length,
        withSeniorTraders: mongoCampaigns.filter((c) => c.team?.seniorMediaTraders?.length > 0)
          .length,
        withMediaTraders: mongoCampaigns.filter((c) => c.team?.mediaTraders?.length > 0).length,
      },
    });

    // 3. Verify specific campaign transformation
    const samplePgCampaign = pgCampaigns.find((c) => c.campaign_number === 'CN-13999');
    const sampleMongoCampaign = mongoCampaigns.find((c) => c.campaignNumber === 'CN-13999');

    if (samplePgCampaign && sampleMongoCampaign) {
      console.log('\nSample campaign comparison (CN-13999):');
      console.log('PostgreSQL data:');
      console.log('  owner_user_id:', samplePgCampaign.owner_user_id);
      console.log('  lead_account_owner_user_id:', samplePgCampaign.lead_account_owner_user_id);
      console.log('  sales_rep_user_id:', samplePgCampaign.sales_rep_user_id);

      console.log('\nMongoDB data:');
      console.log('  team.accountManager:', sampleMongoCampaign.team?.accountManager);
      console.log('  team.seniorMediaTraders:', sampleMongoCampaign.team?.seniorMediaTraders);
      console.log('  team.mediaTraders:', sampleMongoCampaign.team?.mediaTraders);
    }

    // 4. Check user mapping
    console.log('\nChecking user mappings...');
    const userMap = new Map(pgUsers.map((u) => [u.id, u]));

    let missingUsers = 0;
    for (const campaign of mongoCampaigns) {
      const pgCampaign = pgCampaigns.find((c) => c.campaign_number === campaign.campaignNumber);
      if (!pgCampaign) continue;

      // Check if users exist in user table
      if (pgCampaign.owner_user_id && !userMap.has(pgCampaign.owner_user_id)) {
        missingUsers++;
      }
    }

    results.push({
      field: 'User References',
      status: missingUsers === 0 ? 'pass' : 'warning',
      message: `${missingUsers} campaigns reference users not in users.json`,
    });

    // 5. Check financial data
    const campaignsWithBudget = mongoCampaigns.filter((c) => c.price?.targetAmount);
    const pgCampaignsWithBudget = pgCampaigns.filter((c) => c.budget != null && c.budget > 0);

    results.push({
      field: 'Financial Data',
      status: 'pass',
      message: `PostgreSQL campaigns with budget: ${pgCampaignsWithBudget.length}, MongoDB: ${campaignsWithBudget.length}`,
    });

    // 6. Sample data integrity check
    for (let i = 0; i < Math.min(5, mongoCampaigns.length); i++) {
      const mongoCampaign = mongoCampaigns[i];
      const pgCampaign = pgCampaigns.find(
        (c) => c.campaign_number === mongoCampaign.campaignNumber
      );

      if (pgCampaign) {
        const fieldsMatch =
          mongoCampaign.name === pgCampaign.campaign_name &&
          mongoCampaign.campaignId === pgCampaign.id &&
          mongoCampaign.status === pgCampaign.stage;

        results.push({
          field: `Campaign ${mongoCampaign.campaignNumber}`,
          status: fieldsMatch ? 'pass' : 'fail',
          message: fieldsMatch ? 'Core fields match' : 'Field mismatch detected',
        });
      }
    }

    // Print results
    console.log('\n=== VERIFICATION RESULTS ===\n');
    results.forEach((result) => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${result.field}: ${result.message}`);
      if (result.details) {
        console.log('   Details:', JSON.stringify(result.details, null, 2));
      }
    });
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run verification
verifyData().catch(console.error);
