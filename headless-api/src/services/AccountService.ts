import { Collection, Db, ObjectId } from 'mongodb';
import { database } from '../config/database';

export interface Account {
  _id: ObjectId;
  name: string;
  accountNumber?: string;
  status: 'active' | 'inactive';
  referralRate?: number;
  agencyMarkupRate?: number;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  billingAddress?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  creditLimit?: number;
  paymentTerms?: 'net15' | 'net30' | 'net45' | 'net60' | 'prepay';
  tags: string[];
  notes?: string;
  customFields?: Record<string, any>;
  zohoAccountId?: string;
  teamId?: string;
  campaignCount?: number;
  totalRevenue?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

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

export class AccountService {
  private db: Db;
  private collection: Collection<Account>;

  constructor() {
    this.db = database.getDb();
    this.collection = this.db.collection<Account>('accounts');
  }

  async findAll(filter: any = {}, options: any = {}): Promise<Account[]> {
    return await this.collection.find(filter, options).toArray();
  }

  async findById(id: string): Promise<Account | null> {
    return await this.collection.findOne({ _id: new ObjectId(id) });
  }

  async findByName(name: string): Promise<Account | null> {
    return await this.collection.findOne({ name });
  }

  async findByZohoId(zohoAccountId: string): Promise<Account | null> {
    return await this.collection.findOne({ zohoAccountId });
  }

  async create(input: Partial<Account>): Promise<Account> {
    const now = new Date();
    const account: Account = {
      _id: new ObjectId(),
      name: input.name!,
      accountNumber: input.accountNumber,
      status: input.status || 'active',
      referralRate: input.referralRate,
      agencyMarkupRate: input.agencyMarkupRate,
      primaryContactName: input.primaryContactName,
      primaryContactEmail: input.primaryContactEmail,
      primaryContactPhone: input.primaryContactPhone,
      billingAddress: input.billingAddress,
      creditLimit: input.creditLimit,
      paymentTerms: input.paymentTerms,
      tags: input.tags || [],
      notes: input.notes,
      customFields: input.customFields || {},
      zohoAccountId: input.zohoAccountId,
      teamId: input.teamId,
      campaignCount: input.campaignCount || 0,
      totalRevenue: input.totalRevenue || 0,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      updatedBy: input.updatedBy,
    };

    const result = await this.collection.insertOne(account);
    return { ...account, _id: result.insertedId };
  }

  async update(id: string, update: Partial<Account>): Promise<Account | null> {
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

  async bulkUpsert(accounts: any[], options: BulkUpsertOptions = {}): Promise<BulkUpsertResult> {
    const { validateAll = true, stopOnError = false, returnFailedRecords = false } = options;

    const result: BulkUpsertResult = {
      inserted: 0,
      updated: 0,
      failed: [],
    };

    for (let i = 0; i < accounts.length; i++) {
      try {
        const accountData = accounts[i];

        // Prepare account data
        const now = new Date();
        const account: Account = {
          _id: accountData._id ? new ObjectId(accountData._id) : new ObjectId(),
          name: accountData.name,
          accountNumber: accountData.accountNumber,
          status: accountData.status || 'active',
          referralRate: accountData.referralRate,
          agencyMarkupRate: accountData.agencyMarkupRate,
          primaryContactName: accountData.primaryContactName,
          primaryContactEmail: accountData.primaryContactEmail,
          primaryContactPhone: accountData.primaryContactPhone,
          billingAddress: accountData.billingAddress,
          creditLimit: accountData.creditLimit,
          paymentTerms: accountData.paymentTerms,
          tags: accountData.tags || [],
          notes: accountData.notes,
          customFields: accountData.customFields || {},
          zohoAccountId: accountData.zohoAccountId,
          teamId: accountData.teamId,
          campaignCount: accountData.campaignCount || 0,
          totalRevenue: accountData.totalRevenue || 0,
          createdAt: accountData.createdAt ? new Date(accountData.createdAt) : now,
          updatedAt: accountData.updatedAt ? new Date(accountData.updatedAt) : now,
          createdBy: accountData.createdBy,
          updatedBy: accountData.updatedBy,
        };

        // Check if account exists by name or zohoAccountId
        const existingAccount = await this.collection.findOne({
          $or: [
            { name: account.name },
            ...(account.zohoAccountId ? [{ zohoAccountId: account.zohoAccountId }] : []),
          ],
        });

        if (existingAccount) {
          // Update existing account
          await this.collection.updateOne(
            { _id: existingAccount._id },
            { $set: { ...account, _id: existingAccount._id, createdAt: existingAccount.createdAt } }
          );
          result.updated++;
        } else {
          // Insert new account
          await this.collection.insertOne(account);
          result.inserted++;
        }
      } catch (error) {
        const errorRecord = {
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: returnFailedRecords ? accounts[i] : undefined,
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

  async updateCampaignMetrics(accountId: string): Promise<void> {
    const campaigns = await this.db.collection('campaigns').find({ accountId }).toArray();

    const campaignCount = campaigns.length;
    const totalRevenue = campaigns.reduce((sum, c) => sum + (c.price?.targetAmount || 0), 0);

    await this.collection.updateOne(
      { _id: new ObjectId(accountId) },
      {
        $set: {
          campaignCount,
          totalRevenue,
          updatedAt: new Date(),
        },
      }
    );
  }
}
