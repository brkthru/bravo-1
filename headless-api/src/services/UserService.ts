import { Collection, Db, ObjectId, Document } from 'mongodb';
import { database } from '../config/database';
import { UserEntity as User, UserInput, UserUpdate } from '@bravo-1/shared';

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
  private collection: Collection<Document>;

  constructor() {
    this.db = database.getDb();
    this.collection = this.db.collection('users');
  }

  async findAll(filter: any = {}, options: any = {}): Promise<User[]> {
    const docs = await this.collection.find(filter, options).toArray();
    return docs.map(doc => ({
      ...doc,
      _id: doc._id.toString(),
    })) as User[];
  }

  async findById(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    } as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.collection.findOne({ email: email.toLowerCase() });
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    } as User;
  }

  async findByZohoId(zohoUserId: string): Promise<User | null> {
    const doc = await this.collection.findOne({ zohoUserId });
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    } as User;
  }

  async create(input: UserInput): Promise<User> {
    const now = new Date();
    const objectId = new ObjectId();
    const user: User = {
      _id: objectId.toString(),
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

    // Create document for MongoDB with ObjectId
    const mongoDoc = { ...user, _id: objectId };
    const result = await this.collection.insertOne(mongoDoc);
    return user; // Return the user with string _id
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
    if (!result) return null;
    return {
      ...result,
      _id: result._id.toString(),
    } as User;
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
        const objectId = userData._id ? new ObjectId(userData._id) : new ObjectId();
        const user: any = {
          _id: objectId.toString(),
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
          // Insert new user - convert _id back to ObjectId for MongoDB
          const mongoDoc = { ...user, _id: objectId };
          await this.collection.insertOne(mongoDoc);
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
