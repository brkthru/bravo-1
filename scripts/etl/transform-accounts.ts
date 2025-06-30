#!/usr/bin/env bun
/**
 * Transform PostgreSQL accounts data to MongoDB format
 *
 * This script transforms accounts from PostgreSQL backup to the new MongoDB schema
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

// Input and output directories
const POSTGRES_BACKUP_DIR = '../../data/postgres-backups/2025-06-27';
const OUTPUT_DIR = '../../data/transformed/2025-06-27';

// PostgreSQL types
interface PgAccount {
  id: string;
  zoho_account_id: string;
  name: string;
  team_id: string;
  street_address: string | null;
  state: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  referral_percentage: number | null;
  agency_markup_percentage: number | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  created_time: string | null;
  modified_time: string | null;
  owner_user_id: string | null;
  zoho_owner_user_id: string | null;
}

interface PgCampaign {
  id: string;
  account_id: string;
  budget: number | null;
  expected_revenue: number | null;
}

// MongoDB account type (based on AccountSchema)
interface MongoAccount {
  _id: ObjectId;
  name: string;
  accountNumber?: string;
  status: 'active' | 'inactive';

  // Financial settings
  referralRate?: number;
  agencyMarkupRate?: number;

  // Contact information
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;

  // Billing information
  billingAddress?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country: string;
  };

  // Credit information
  creditLimit?: number;
  paymentTerms?: 'net15' | 'net30' | 'net45' | 'net60' | 'prepay';

  // Metadata
  tags: string[];
  notes?: string;

  // Calculated fields (will be updated after campaigns are loaded)
  campaignCount?: number;
  totalRevenue?: number;

  // External IDs
  zohoAccountId?: string;
  teamId?: string;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Helper to generate account number
function generateAccountNumber(index: number, name: string): string {
  // Generate a simple account number based on first letters and index
  const prefix = name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3)
    .padEnd(3, 'X');

  return `${prefix}-${String(index + 1000).padStart(4, '0')}`;
}

// Helper to determine payment terms based on account size
function determinePaymentTerms(
  totalRevenue: number
): 'net15' | 'net30' | 'net45' | 'net60' | 'prepay' {
  if (totalRevenue === 0) return 'prepay';
  if (totalRevenue < 10000) return 'net15';
  if (totalRevenue < 50000) return 'net30';
  if (totalRevenue < 100000) return 'net45';
  return 'net60';
}

async function transformAccounts() {
  console.log('Starting account transformation...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load data
  console.log('Loading PostgreSQL data...');
  const pgAccountsPath = path.join(POSTGRES_BACKUP_DIR, 'accounts.json');
  const pgCampaignsPath = path.join(POSTGRES_BACKUP_DIR, 'campaigns.json');

  const pgAccounts = JSON.parse(await fs.readFile(pgAccountsPath, 'utf-8')) as PgAccount[];
  const pgCampaigns = JSON.parse(await fs.readFile(pgCampaignsPath, 'utf-8')) as PgCampaign[];

  console.log(`Loaded ${pgAccounts.length} accounts and ${pgCampaigns.length} campaigns`);

  // Calculate account metrics from campaigns
  const accountMetrics = new Map<string, { count: number; revenue: number }>();
  for (const campaign of pgCampaigns) {
    const metrics = accountMetrics.get(campaign.account_id) || { count: 0, revenue: 0 };
    metrics.count++;
    metrics.revenue += campaign.expected_revenue || campaign.budget || 0;
    accountMetrics.set(campaign.account_id, metrics);
  }

  // Transform accounts
  const transformedAccounts: MongoAccount[] = [];
  const accountIdMap = new Map<string, ObjectId>();

  for (let i = 0; i < pgAccounts.length; i++) {
    const pgAccount = pgAccounts[i];
    const mongoId = new ObjectId();
    accountIdMap.set(pgAccount.id, mongoId);

    const metrics = accountMetrics.get(pgAccount.id) || { count: 0, revenue: 0 };

    const transformedAccount: MongoAccount = {
      _id: mongoId,
      name: pgAccount.name,
      accountNumber: generateAccountNumber(i, pgAccount.name),
      status: 'active', // All accounts are active by default

      // Financial settings (convert from percentage if provided)
      ...(pgAccount.referral_percentage && {
        referralRate: pgAccount.referral_percentage / 100,
      }),
      ...(pgAccount.agency_markup_percentage && {
        agencyMarkupRate: pgAccount.agency_markup_percentage / 100,
      }),

      // Contact information
      ...(pgAccount.primary_contact_name && {
        primaryContactName: pgAccount.primary_contact_name,
      }),
      ...(pgAccount.primary_contact_email && {
        primaryContactEmail: pgAccount.primary_contact_email,
      }),
      ...(pgAccount.primary_contact_phone && {
        primaryContactPhone: pgAccount.primary_contact_phone,
      }),

      // Billing address
      ...((pgAccount.street_address ||
        pgAccount.city ||
        pgAccount.state ||
        pgAccount.postal_code) && {
        billingAddress: {
          ...(pgAccount.street_address && { street1: pgAccount.street_address }),
          ...(pgAccount.city && { city: pgAccount.city }),
          ...(pgAccount.state && { state: pgAccount.state }),
          ...(pgAccount.postal_code && { postalCode: pgAccount.postal_code }),
          country: pgAccount.country || 'US',
        },
      }),

      // Credit information (estimated based on revenue)
      creditLimit: Math.ceil((metrics.revenue * 0.25) / 1000) * 1000, // 25% of revenue, rounded to nearest 1000
      paymentTerms: determinePaymentTerms(metrics.revenue),

      // Metadata
      tags: [],
      ...(metrics.count > 10 && { tags: ['high-volume'] }),
      ...(metrics.revenue > 100000 && {
        tags: [...(metrics.count > 10 ? ['high-volume'] : []), 'enterprise'],
      }),

      // Calculated fields
      campaignCount: metrics.count,
      totalRevenue: metrics.revenue,

      // External IDs
      zohoAccountId: pgAccount.zoho_account_id,
      teamId: pgAccount.team_id,

      // Audit fields
      createdAt: new Date(pgAccount.created_at),
      updatedAt: new Date(pgAccount.updated_at),
    };

    // Add owner information to custom fields
    if (pgAccount.owner_user_id || pgAccount.zoho_owner_user_id) {
      transformedAccount.customFields = {
        ownerUserId: pgAccount.owner_user_id,
        zohoOwnerUserId: pgAccount.zoho_owner_user_id,
        version: pgAccount.version,
      };
    }

    transformedAccounts.push(transformedAccount);
  }

  // Sort accounts by revenue (descending) for better display
  transformedAccounts.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));

  // Save transformed accounts
  const outputPath = path.join(OUTPUT_DIR, 'accounts.json');
  await fs.writeFile(outputPath, JSON.stringify(transformedAccounts, null, 2));

  // Save account ID mapping for reference
  const mappingPath = path.join(OUTPUT_DIR, 'account-id-mapping.json');
  const mapping = Object.fromEntries(accountIdMap);
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));

  // Generate summary statistics
  const stats = {
    totalAccounts: transformedAccounts.length,
    activeAccounts: transformedAccounts.filter((a) => a.status === 'active').length,
    accountsWithCampaigns: transformedAccounts.filter((a) => a.campaignCount! > 0).length,
    enterpriseAccounts: transformedAccounts.filter((a) => a.tags.includes('enterprise')).length,
    highVolumeAccounts: transformedAccounts.filter((a) => a.tags.includes('high-volume')).length,
    totalRevenue: transformedAccounts.reduce((sum, a) => sum + (a.totalRevenue || 0), 0),
    averageRevenue:
      transformedAccounts.reduce((sum, a) => sum + (a.totalRevenue || 0), 0) /
      transformedAccounts.length,
  };

  console.log(`\nTransformation complete!`);
  console.log(`- Transformed ${stats.totalAccounts} accounts`);
  console.log(`- Accounts with campaigns: ${stats.accountsWithCampaigns}`);
  console.log(`- Enterprise accounts: ${stats.enterpriseAccounts}`);
  console.log(`- High-volume accounts: ${stats.highVolumeAccounts}`);
  console.log(`- Total revenue: $${stats.totalRevenue.toLocaleString()}`);
  console.log(
    `- Average revenue per account: $${Math.round(stats.averageRevenue).toLocaleString()}`
  );
  console.log(`- Output saved to: ${outputPath}`);
  console.log(`- ID mapping saved to: ${mappingPath}`);
}

// Run transformation
transformAccounts().catch(console.error);
