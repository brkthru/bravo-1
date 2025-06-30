#!/usr/bin/env bun
/**
 * Setup Bravo Users Collection
 *
 * Creates bravoUsers collection with enhanced user data
 * Links to zohoUsers where applicable
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'bravo-1';

interface BravoUser {
  _id?: ObjectId;
  email: string;
  zohoUserId?: string;

  // Profile
  name: string;
  title?: string;
  department?: string;
  managerId?: ObjectId;

  // Status
  isActive: boolean;
  outOfOffice?: {
    enabled: boolean;
    startDate?: Date;
    endDate?: Date;
    backupUserId?: ObjectId;
  };

  // Access Control
  roles: Array<'admin' | 'super_admin' | 'media_trader' | 'account_manager' | 'user'>;
  permissions?: string[];

  // Preferences
  preferences?: {
    theme?: 'light' | 'dark';
    notifications?: {
      email: boolean;
      inApp: boolean;
      campaigns?: boolean;
      assignments?: boolean;
    };
    dashboardLayout?: any;
    aiSettings?: {
      enabled: boolean;
      suggestions: boolean;
      autoComplete: boolean;
    };
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

async function setupBravoUsers() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DATABASE_NAME);
    const zohoUsers = db.collection('zohoUsers');
    const bravoUsers = db.collection<BravoUser>('bravoUsers');

    // Create indexes
    await bravoUsers.createIndex({ email: 1 }, { unique: true });
    await bravoUsers.createIndex({ zohoUserId: 1 }, { sparse: true });
    await bravoUsers.createIndex({ isActive: 1 });
    await bravoUsers.createIndex({ roles: 1 });
    console.log('✅ Created indexes on bravoUsers');

    // Get all Zoho users
    const zohoUsersList = await zohoUsers.find({}).toArray();
    console.log(`Found ${zohoUsersList.length} Zoho users`);

    // Create Bravo users from Zoho users
    const bravoUserDocs: BravoUser[] = [];

    for (const zohoUser of zohoUsersList) {
      // Skip if already exists
      const existing = await bravoUsers.findOne({ email: zohoUser.email });
      if (existing) continue;

      // Determine role based on Zoho data or defaults
      let roles: BravoUser['roles'] = ['user'];

      // Check if they're an account manager (lead_account_owner)
      const isAccountManager = await db.collection('campaigns').findOne({
        'team.accountManager.email': zohoUser.email,
      });
      if (isAccountManager) {
        roles.push('account_manager');
      }

      // Check if they're a media trader
      const isMediaTrader = await db.collection('campaigns').findOne({
        'team.mediaTraders': { $elemMatch: { email: zohoUser.email } },
      });
      if (isMediaTrader) {
        roles.push('media_trader');
      }

      // Create Bravo user
      const bravoUser: BravoUser = {
        email: zohoUser.email,
        zohoUserId: zohoUser.zohoUserId,
        name: zohoUser.name,
        isActive: true,
        roles,
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            inApp: true,
            campaigns: true,
            assignments: true,
          },
          aiSettings: {
            enabled: true,
            suggestions: true,
            autoComplete: true,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      bravoUserDocs.push(bravoUser);
    }

    if (bravoUserDocs.length > 0) {
      const result = await bravoUsers.insertMany(bravoUserDocs);
      console.log(`✅ Created ${result.insertedCount} Bravo users`);
    }

    // Add some example admin users (you can customize these)
    const adminEmails = ['ryan@brkthru.com', 'admin@brkthru.com'];

    for (const email of adminEmails) {
      const updated = await bravoUsers.updateOne(
        { email },
        {
          $addToSet: { roles: 'admin' },
          $set: { updatedAt: new Date() },
        }
      );
      if (updated.matchedCount > 0) {
        console.log(`✅ Added admin role to ${email}`);
      }
    }

    // Summary
    const stats = await bravoUsers
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
            withZohoId: { $sum: { $cond: [{ $ne: ['$zohoUserId', null] }, 1, 0] } },
            admins: { $sum: { $cond: [{ $in: ['admin', '$roles'] }, 1, 0] } },
            accountManagers: { $sum: { $cond: [{ $in: ['account_manager', '$roles'] }, 1, 0] } },
            mediaTraders: { $sum: { $cond: [{ $in: ['media_trader', '$roles'] }, 1, 0] } },
          },
        },
      ])
      .toArray();

    if (stats[0]) {
      console.log('\n📊 Bravo Users Summary:');
      console.log(`  Total users: ${stats[0].total}`);
      console.log(`  Active: ${stats[0].active}`);
      console.log(`  Linked to Zoho: ${stats[0].withZohoId}`);
      console.log(`  Admins: ${stats[0].admins}`);
      console.log(`  Account Managers: ${stats[0].accountManagers}`);
      console.log(`  Media Traders: ${stats[0].mediaTraders}`);
    }
  } catch (error) {
    console.error('Error setting up Bravo users:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the setup
if (import.meta.main) {
  setupBravoUsers().catch(console.error);
}
