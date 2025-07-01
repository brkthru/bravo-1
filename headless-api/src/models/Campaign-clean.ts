import { Collection, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { Campaign, CreateCampaignRequest, UpdateCampaignRequest, MediaActivity } from '@bravo-1/shared';

export class CampaignModel {
  private get collection(): Collection {
    return database.getDb().collection('campaigns');
  }

  async findAll(): Promise<Campaign[]> {
    const campaigns = await this.collection.find({}).toArray();
    return campaigns.map(this.transformFromMongo);
  }

  async findWithPagination(
    page: number = 1,
    limit: number = 50,
    search?: string
  ): Promise<{
    campaigns: Campaign[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Build query
    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { campaignNumber: { $regex: search, $options: 'i' } },
            { accountName: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    // Get total count for pagination
    const total = await this.collection.countDocuments(query);

    // Get paginated results
    const campaigns = await this.collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      campaigns: campaigns.map(this.transformFromMongo),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Campaign | null> {
    try {
      const campaign = await this.collection.findOne({ _id: new ObjectId(id) });
      return campaign ? this.transformFromMongo(campaign) : null;
    } catch (error) {
      // Invalid ObjectId format
      return null;
    }
  }

  async create(campaignData: CreateCampaignRequest): Promise<Campaign> {
    const now = new Date();
    const campaign = {
      ...campaignData,
      _id: new ObjectId(),
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(campaign);

    if (!result.acknowledged) {
      throw new Error('Failed to create campaign');
    }

    return this.transformFromMongo(campaign);
  }

  async update(id: string, updates: UpdateCampaignRequest): Promise<Campaign | null> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      const result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      return result ? this.transformFromMongo(result) : null;
    } catch (error) {
      // Invalid ObjectId format
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      // Invalid ObjectId format
      return false;
    }
  }

  async bulkInsert(campaigns: any[]): Promise<{ insertedCount: number }> {
    if (campaigns.length === 0) {
      return { insertedCount: 0 };
    }

    // Add ObjectIds and timestamps to campaigns that don't have them
    const now = new Date();
    const documentsToInsert = campaigns.map((campaign) => ({
      ...campaign,
      _id: campaign._id || new ObjectId(),
      createdAt: campaign.createdAt || now,
      updatedAt: campaign.updatedAt || now,
    }));

    const result = await this.collection.insertMany(documentsToInsert, {
      ordered: false, // Continue on error
    });

    return { insertedCount: result.insertedCount };
  }

  async bulkUpdate(
    updates: Array<{ filter: any; update: any }>
  ): Promise<{ modifiedCount: number }> {
    if (updates.length === 0) {
      return { modifiedCount: 0 };
    }

    const bulkOps = updates.map(({ filter, update }) => ({
      updateOne: {
        filter,
        update: {
          $set: {
            ...update,
            updatedAt: new Date(),
          },
        },
      },
    }));

    const result = await this.collection.bulkWrite(bulkOps, {
      ordered: false, // Continue on error
    });

    return { modifiedCount: result.modifiedCount };
  }

  async bulkUpsert(campaigns: any[]): Promise<{ insertedCount: number; modifiedCount: number }> {
    if (campaigns.length === 0) {
      return { insertedCount: 0, modifiedCount: 0 };
    }

    const now = new Date();
    const bulkOps = campaigns.map((campaign) => {
      const filter = campaign._id
        ? { _id: new ObjectId(campaign._id) }
        : { campaignNumber: campaign.campaignNumber };

      const update = {
        $set: {
          ...campaign,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: campaign._id || new ObjectId(),
          createdAt: now,
        },
      };

      return { updateOne: { filter, update, upsert: true } };
    });

    const result = await this.collection.bulkWrite(bulkOps, {
      ordered: false, // Continue on error
    });

    return {
      insertedCount: result.insertedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  async search(query: string): Promise<Campaign[]> {
    const campaigns = await this.collection
      .find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { campaignNumber: { $regex: query, $options: 'i' } },
        ],
      })
      .toArray();

    return campaigns.map(this.transformFromMongo);
  }

  // Transform MongoDB document to Campaign type
  // CLEAN VERSION: Uses new field names only
  private transformFromMongo(doc: any): Campaign {
    // Generate realistic pacing values based on campaign ID (for consistency)
    const idHash = parseInt(doc._id.toString().substring(0, 8), 16);

    // About 20% of campaigns should be over-pacing
    const isOverPacing = idHash % 5 === 0; // 20% chance

    let deliveryPacing: number;
    let spendPacing: number;

    if (isOverPacing) {
      // Over-pacing campaigns: 100-150%
      const baseDelivery = 100 + (idHash % 50); // 100-150%
      const baseSpend = 95 + (idHash % 45); // 95-140%

      deliveryPacing = baseDelivery / 100;
      spendPacing = Math.min(baseSpend / 100, deliveryPacing * 0.95);
    } else {
      // Normal pacing: 40-95%
      const baseDelivery = 40 + (idHash % 55); // 40-95%
      const baseSpend = 35 + (idHash % 50); // 35-85%

      // Add some variation
      const deliveryVariation = ((idHash % 7) - 3) * 2;
      const spendVariation = ((idHash % 5) - 2) * 3;

      deliveryPacing = Math.min(95, Math.max(0, baseDelivery + deliveryVariation)) / 100;
      spendPacing = Math.min(90, Math.max(0, baseSpend + spendVariation)) / 100;

      // Ensure spend is usually lower than delivery
      spendPacing = Math.min(spendPacing, deliveryPacing * 0.95);
    }

    // Calculate dates and durations
    let datesObj;
    if (doc.dates) {
      const startDate = new Date(doc.dates.start);
      const endDate = new Date(doc.dates.end);
      const now = new Date();

      const totalDuration = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysElapsed = Math.max(
        0,
        Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      datesObj = {
        start: startDate,
        end: endDate,
        daysElapsed: Math.min(daysElapsed, totalDuration),
        totalDuration: totalDuration,
      };
    }

    // Transform price (NEW FIELD NAME)
    let priceObj;
    if (doc.price && typeof doc.price === 'object') {
      priceObj = {
        targetAmount: doc.price.targetAmount || 0,
        actualAmount: doc.price.actualAmount || 0,
        remainingAmount:
          doc.price.remainingAmount || doc.price.targetAmount - doc.price.actualAmount || 0,
        currency: doc.price.currency || 'USD',
      };
    } else {
      // No price data - use defaults
      priceObj = {
        targetAmount: 0,
        actualAmount: 0,
        remainingAmount: 0,
        currency: 'USD',
      };
    }

    // Transform team - provide default team if not present
    let teamObj;
    if (doc.team) {
      teamObj = {
        accountManager: doc.team.accountManager || doc.team.leadAccountManager || null,
        csd: doc.team.csd || null,
        seniorMediaTraders: doc.team.seniorMediaTraders || [],
        mediaTraders: doc.team.mediaTraders || [],
      };
    } else {
      // Generate random team (for display purposes)
      const teamIndex = idHash % 5;
      const teams = [
        {
          accountManager: {
            id: 'user-1',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@company.com',
          },
          csd: null,
          seniorMediaTraders: [],
          mediaTraders: [],
        },
        {
          accountManager: {
            id: 'user-2',
            name: 'Michael Chen',
            email: 'michael.chen@company.com',
          },
          csd: null,
          seniorMediaTraders: [],
          mediaTraders: [],
        },
        {
          accountManager: {
            id: 'user-3',
            name: 'David Kim',
            email: 'david.kim@company.com',
          },
          csd: null,
          seniorMediaTraders: [],
          mediaTraders: [],
        },
        {
          accountManager: {
            id: 'user-4',
            name: 'Emily Rodriguez',
            email: 'emily.rodriguez@company.com',
          },
          csd: null,
          seniorMediaTraders: [],
          mediaTraders: [],
        },
        {
          accountManager: {
            id: 'user-5',
            name: 'Jessica Thompson',
            email: 'jessica.thompson@company.com',
          },
          csd: null,
          seniorMediaTraders: [],
          mediaTraders: [],
        },
      ];
      teamObj = teams[teamIndex];
    }

    // Determine media activity
    const hasLineItems = doc.lineItemCount > 0;
    let mediaActivity: MediaActivity = 'None active';
    if (hasLineItems) {
      if (deliveryPacing > 0.9) {
        mediaActivity = 'All active';
      } else if (deliveryPacing > 0.5) {
        mediaActivity = 'Some active';
      } else {
        mediaActivity = 'Pending';
      }
    }

    // Transform metrics with NEW field names
    const metricsObj = doc.metrics || {
      deliveryPacing,
      spendPacing,
      marginAmount: priceObj.targetAmount * 0.3, // Default 30% margin
      marginPercentage: 30,
      units: Math.floor(priceObj.targetAmount * 100), // Rough estimate
      unitType: 'impressions',
      revenueDelivered: priceObj.actualAmount * 1.3,
      budgetSpent: priceObj.actualAmount,
      marginActual: 0.25,
    };

    return {
      _id: doc._id.toString(),
      campaignNumber: doc.campaignNumber || '',
      name: doc.name || '',
      status: doc.status || 'active',
      displayStatus: doc.displayStatus || doc.status || 'active',
      accountName: doc.accountName,
      team: teamObj,
      dates: datesObj || {
        start: new Date(),
        end: new Date(),
        daysElapsed: 0,
        totalDuration: 0,
      },
      price: priceObj, // NEW: Using price instead of budget
      metrics: metricsObj,
      mediaActivity,
      lineItems: doc.lineItems || [],
      lineItemCount: doc.lineItemCount || 0,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }

  // Aliases for backward compatibility - can be removed later
  async getAll(): Promise<Campaign[]> {
    return this.findAll();
  }

  async getById(id: string): Promise<Campaign | null> {
    return this.findById(id);
  }
}
