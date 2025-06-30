#!/usr/bin/env bun
/**
 * Transform PostgreSQL users data to MongoDB format
 *
 * This script transforms users from PostgreSQL backup to the new MongoDB schema
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

// Input and output directories
const POSTGRES_BACKUP_DIR = '../../data/postgres-backups/2025-06-27';
const OUTPUT_DIR = '../../data/transformed/2025-06-27';

// PostgreSQL user type
interface PgUser {
  id: string;
  zoho_user_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  org_id: string;
  role: string | null;
  zoho_role: string | null;
  is_confirmed: boolean;
  user_status: string | null;
  created_time: string | null;
  modified_time: string | null;
  version: number;
  team_id: string | null;
}

// MongoDB user type (based on UserEntitySchema)
interface MongoUser {
  _id: ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;

  // Professional info
  jobTitle: string;
  jobFamily: string;
  role: string;
  department?: string;

  // Manager relationship
  managerId?: string;
  managerName?: string;
  directReports: string[];

  // Team memberships
  teams: Array<{
    teamId: string;
    teamName: string;
    role: 'lead' | 'member';
    joinedAt: Date;
  }>;

  // Account assignments
  assignedAccounts: Array<{
    accountId: string;
    accountName: string;
    role: 'primary' | 'secondary' | 'backup';
    assignedAt: Date;
  }>;

  // Campaign assignments
  assignedCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    role: 'csd' | 'account_manager' | 'media_trader' | 'viewer';
    assignedAt: Date;
  }>;

  // Out of office
  outOfOffice: {
    isOutOfOffice: boolean;
    currentPeriod?: any;
    upcomingPeriods: any[];
    historicalPeriods: any[];
  };

  // Preferences
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    dateFormat: string;
    numberFormat: 'comma' | 'period';
    emailNotifications: {
      campaignUpdates: boolean;
      performanceAlerts: boolean;
      systemAnnouncements: boolean;
      dailyDigest: boolean;
    };
    defaultDashboard: 'campaigns' | 'performance' | 'financial' | 'custom';
    favoriteMetrics: string[];
    aiAssistant: {
      enabled: boolean;
      personalizedPrompts: any[];
      summaryPreferences: {
        includeFinancials: boolean;
        includePerformance: boolean;
        includeRisks: boolean;
        customPriorities: string[];
      };
    };
  };

  // External system IDs
  zohoUserId?: string;
  slackUserId?: string;
  googleWorkspaceId?: string;

  // Permissions
  permissions: string[];
  isAdmin: boolean;

  // Status
  isActive: boolean;
  lastLoginAt?: Date;
  lastActivityAt?: Date;

  // Metadata
  tags: string[];
  customFields: Record<string, any>;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Map PostgreSQL role to MongoDB role/job family
function mapRole(
  pgRole: string | null,
  zohoRole: string | null
): { role: string; jobFamily: string; jobTitle: string } {
  const roleStr = (pgRole || zohoRole || 'viewer').toLowerCase();

  if (roleStr.includes('sales') || roleStr.includes('csd')) {
    return { role: 'csd', jobFamily: 'sales', jobTitle: 'Client Services Director' };
  } else if (roleStr.includes('account') && roleStr.includes('manager')) {
    return {
      role: 'account_manager',
      jobFamily: 'account_management',
      jobTitle: 'Account Manager',
    };
  } else if (roleStr.includes('senior') && roleStr.includes('media')) {
    return {
      role: 'senior_media_trader',
      jobFamily: 'media_trading',
      jobTitle: 'Senior Media Trader',
    };
  } else if (roleStr.includes('media') && roleStr.includes('trader')) {
    return { role: 'media_trader', jobFamily: 'media_trading', jobTitle: 'Media Trader' };
  } else if (roleStr.includes('media') && roleStr.includes('director')) {
    return { role: 'media_director', jobFamily: 'media_trading', jobTitle: 'Media Director' };
  } else if (roleStr.includes('operations')) {
    return { role: 'operations_manager', jobFamily: 'operations', jobTitle: 'Operations Manager' };
  } else if (roleStr.includes('finance')) {
    return { role: 'finance_manager', jobFamily: 'finance', jobTitle: 'Finance Manager' };
  } else if (roleStr.includes('admin')) {
    return { role: 'admin', jobFamily: 'technology', jobTitle: 'Administrator' };
  } else {
    return { role: 'viewer', jobFamily: 'other', jobTitle: 'Team Member' };
  }
}

// Extract first and last name from full name
function extractNames(
  fullName: string,
  firstName: string | null,
  lastName: string | null
): { firstName: string; lastName: string } {
  if (firstName && lastName) {
    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };
  }

  const parts = fullName.trim().split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function transformUsers() {
  console.log('Starting user transformation...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load users
  console.log('Loading PostgreSQL users...');
  const pgUsersPath = path.join(POSTGRES_BACKUP_DIR, 'users.json');
  const pgUsers = JSON.parse(await fs.readFile(pgUsersPath, 'utf-8')) as PgUser[];

  console.log(`Loaded ${pgUsers.length} users`);

  // Transform users
  const transformedUsers: MongoUser[] = [];
  const userIdMap = new Map<string, ObjectId>();

  for (const pgUser of pgUsers) {
    const mongoId = new ObjectId();
    userIdMap.set(pgUser.zoho_user_id, mongoId);

    const names = extractNames(pgUser.name, pgUser.first_name, pgUser.last_name);
    const roleInfo = mapRole(pgUser.role, pgUser.zoho_role);

    const transformedUser: MongoUser = {
      _id: mongoId,
      email: pgUser.email.toLowerCase(),
      firstName: names.firstName || 'Unknown',
      lastName: names.lastName || 'User',
      displayName: pgUser.name,

      // Professional info
      jobTitle: roleInfo.jobTitle,
      jobFamily: roleInfo.jobFamily,
      role: roleInfo.role,

      // Empty relationships - will be populated later
      directReports: [],
      teams: [],
      assignedAccounts: [],
      assignedCampaigns: [],

      // Out of office
      outOfOffice: {
        isOutOfOffice: false,
        upcomingPeriods: [],
        historicalPeriods: [],
      },

      // Default preferences
      preferences: {
        theme: 'system',
        language: 'en',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        numberFormat: 'comma',
        emailNotifications: {
          campaignUpdates: true,
          performanceAlerts: true,
          systemAnnouncements: true,
          dailyDigest: false,
        },
        defaultDashboard: 'campaigns',
        favoriteMetrics: [],
        aiAssistant: {
          enabled: true,
          personalizedPrompts: [],
          summaryPreferences: {
            includeFinancials: true,
            includePerformance: true,
            includeRisks: true,
            customPriorities: [],
          },
        },
      },

      // External IDs
      zohoUserId: pgUser.zoho_user_id,

      // Permissions
      permissions: roleInfo.role === 'admin' ? ['*'] : [],
      isAdmin: roleInfo.role === 'admin',

      // Status
      isActive: pgUser.is_active && pgUser.is_confirmed,

      // Metadata
      tags: [],
      customFields: {
        pgUserId: pgUser.id,
        orgId: pgUser.org_id,
        teamId: pgUser.team_id,
        userStatus: pgUser.user_status,
        version: pgUser.version,
      },

      // Audit fields
      createdAt: new Date(pgUser.created_at),
      updatedAt: new Date(pgUser.updated_at),
    };

    // Set activity dates if active
    if (transformedUser.isActive) {
      transformedUser.lastActivityAt = new Date(pgUser.updated_at);
    }

    transformedUsers.push(transformedUser);
  }

  // Save transformed users
  const outputPath = path.join(OUTPUT_DIR, 'users.json');
  await fs.writeFile(outputPath, JSON.stringify(transformedUsers, null, 2));

  // Save user ID mapping for reference
  const mappingPath = path.join(OUTPUT_DIR, 'user-id-mapping.json');
  const mapping = Object.fromEntries(userIdMap);
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));

  console.log(`\nTransformation complete!`);
  console.log(`- Transformed ${transformedUsers.length} users`);
  console.log(`- Active users: ${transformedUsers.filter((u) => u.isActive).length}`);
  console.log(`- Admin users: ${transformedUsers.filter((u) => u.isAdmin).length}`);
  console.log(`- Output saved to: ${outputPath}`);
  console.log(`- ID mapping saved to: ${mappingPath}`);
}

// Run transformation
transformUsers().catch(console.error);
