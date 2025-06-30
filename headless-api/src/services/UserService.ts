import { Collection, Db, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { User, UserInput, UserUpdate } from '@bravo-1/shared';

export interface BulkUpsertOptions {
  validateAll?: boolean;
  stopOnError?: boolean;
  returnFailedRecords?: boolean;
}

export interface BulkUpsertResult {
  inserted: number;
  updated: number;
  failed: Array<{
    index: number;
    error: string;
    data?: any;
  }>;
}

export class UserService {
  private db: Db;
  private collection: Collection<User>;

  constructor() {
    this.db = database.getDb();
    this.collection = this.db.collection<User>('users');
  }

  async findAll(filter: any = {}, options: any = {}): Promise<User[]> {
    return await this.collection.find(filter, options).toArray();
  }

  async findById(id: string): Promise<User | null> {
    return await this.collection.findOne({ _id: new ObjectId(id) });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.collection.findOne({ email: email.toLowerCase() });
  }

  async findByZohoId(zohoUserId: string): Promise<User | null> {
    return await this.collection.findOne({ zohoUserId });
  }

  async create(input: UserInput): Promise<User> {
    const now = new Date();
    const user: User = {
      _id: new ObjectId(),
      ...input,
      email: input.email.toLowerCase(),
      displayName: input.displayName || `${input.firstName} ${input.lastName}`,
      directReports: [],
      teams: [],
      assignedAccounts: [],
      assignedCampaigns: [],
      outOfOffice: {
        isOutOfOffice: false,
        upcomingPeriods: [],
        historicalPeriods: [],
      },
      preferences: input.preferences || {
        theme: 'system',
        language: 'en',
        timezone: 'UTC',
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
      permissions: [],
      isAdmin: false,
      isActive: true,
      tags: [],
      customFields: {},
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  async update(id: string, update: UserUpdate): Promise<User | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...update,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  async bulkUpsert(users: any[], options: BulkUpsertOptions = {}): Promise<BulkUpsertResult> {
    const { validateAll = true, stopOnError = false, returnFailedRecords = false } = options;

    const result: BulkUpsertResult = {
      inserted: 0,
      updated: 0,
      failed: [],
    };

    for (let i = 0; i < users.length; i++) {
      try {
        const userData = users[i];

        // Prepare user data
        const now = new Date();
        const user: User = {
          _id: userData._id ? new ObjectId(userData._id) : new ObjectId(),
          email: userData.email.toLowerCase(),
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`,
          avatar: userData.avatar,
          jobTitle: userData.jobTitle,
          jobFamily: userData.jobFamily,
          role: userData.role,
          department: userData.department,
          managerId: userData.managerId,
          managerName: userData.managerName,
          directReports: userData.directReports || [],
          teams: userData.teams || [],
          assignedAccounts: userData.assignedAccounts || [],
          assignedCampaigns: userData.assignedCampaigns || [],
          outOfOffice: userData.outOfOffice || {
            isOutOfOffice: false,
            upcomingPeriods: [],
            historicalPeriods: [],
          },
          primaryBackup: userData.primaryBackup,
          secondaryBackup: userData.secondaryBackup,
          preferences: userData.preferences || {
            theme: 'system',
            language: 'en',
            timezone: 'UTC',
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
          zohoUserId: userData.zohoUserId,
          slackUserId: userData.slackUserId,
          googleWorkspaceId: userData.googleWorkspaceId,
          permissions: userData.permissions || [],
          isAdmin: userData.isAdmin || false,
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt) : undefined,
          lastActivityAt: userData.lastActivityAt ? new Date(userData.lastActivityAt) : undefined,
          tags: userData.tags || [],
          customFields: userData.customFields || {},
          createdAt: userData.createdAt ? new Date(userData.createdAt) : now,
          updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : now,
          createdBy: userData.createdBy,
          updatedBy: userData.updatedBy,
        };

        // Check if user exists by email or zohoUserId
        const existingUser = await this.collection.findOne({
          $or: [
            { email: user.email },
            ...(user.zohoUserId ? [{ zohoUserId: user.zohoUserId }] : []),
          ],
        });

        if (existingUser) {
          // Update existing user
          await this.collection.updateOne(
            { _id: existingUser._id },
            { $set: { ...user, _id: existingUser._id, createdAt: existingUser.createdAt } }
          );
          result.updated++;
        } else {
          // Insert new user
          await this.collection.insertOne(user);
          result.inserted++;
        }
      } catch (error) {
        const errorRecord = {
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: returnFailedRecords ? users[i] : undefined,
        };
        result.failed.push(errorRecord);

        if (stopOnError) {
          throw new Error(`Bulk upsert stopped at index ${i}: ${errorRecord.error}`);
        }
      }
    }

    return result;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  async count(filter: any = {}): Promise<number> {
    return await this.collection.countDocuments(filter);
  }
}
