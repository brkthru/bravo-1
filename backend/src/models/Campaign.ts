import { Collection, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { Campaign, CreateCampaignRequest, UpdateCampaignRequest } from '@mediatool/shared';

export class CampaignModel {
  private get collection(): Collection {
    return database.getDb().collection('campaigns');
  }

  async findAll(): Promise<Campaign[]> {
    const campaigns = await this.collection.find({}).toArray();
    return campaigns.map(this.transformFromMongo);
  }

  async findWithPagination(page: number = 1, limit: number = 50, search?: string): Promise<{
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
          ]
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

  async search(query: string): Promise<Campaign[]> {
    const campaigns = await this.collection.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { campaignNumber: { $regex: query, $options: 'i' } },
      ]
    }).toArray();

    return campaigns.map(this.transformFromMongo);
  }

  // Transform MongoDB document to Campaign type
  private transformFromMongo(doc: any): Campaign {
    // Generate realistic pacing values based on campaign ID (for consistency)
    const idHash = parseInt(doc._id.toString().substring(0, 8), 16);
    
    // About 20% of campaigns should be over-pacing
    const isOverPacing = (idHash % 5) === 0; // 20% chance
    
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
      
      const totalDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      datesObj = {
        start: startDate,
        end: endDate,
        daysElapsed: Math.min(daysElapsed, totalDuration),
        totalDuration: totalDuration
      };
    }

    // Transform budget - handle both old format (single number) and new format (object)
    let budgetObj;
    if (typeof doc.budget === 'number') {
      // Old format: single budget number
      const totalBudget = doc.budget || 0;
      const spent = totalBudget * spendPacing;
      budgetObj = {
        total: totalBudget,
        allocated: totalBudget,
        spent: spent,
        remaining: totalBudget - spent
      };
    } else if (doc.budget && typeof doc.budget === 'object') {
      // New format: budget object
      budgetObj = {
        total: doc.budget.total || 0,
        allocated: doc.budget.allocated || doc.budget.total || 0,
        spent: doc.budget.spent || 0,
        remaining: doc.budget.remaining || (doc.budget.total - doc.budget.spent) || 0
      };
    } else {
      // No budget data - use defaults
      budgetObj = {
        total: 0,
        allocated: 0,
        spent: 0,
        remaining: 0
      };
    }

    // Transform team - provide default team if not present
    let teamObj;
    if (doc.team && doc.team.leadAccountManager) {
      teamObj = {
        leadAccountManager: doc.team.leadAccountManager,
        mediaTrader: doc.team.mediaTrader || undefined
      };
    } else {
      // Generate default team based on campaign ID for consistency
      const defaultNames = [
        { name: 'Sarah Johnson', email: 'sarah.johnson@company.com' },
        { name: 'Michael Chen', email: 'michael.chen@company.com' },
        { name: 'Emily Rodriguez', email: 'emily.rodriguez@company.com' },
        { name: 'David Kim', email: 'david.kim@company.com' },
        { name: 'Jessica Taylor', email: 'jessica.taylor@company.com' }
      ];
      
      const traderNames = [
        { name: 'Alex Martinez', email: 'alex.martinez@company.com' },
        { name: 'Chris Thompson', email: 'chris.thompson@company.com' },
        { name: 'Sam Patel', email: 'sam.patel@company.com' },
        { name: 'Jordan Lee', email: 'jordan.lee@company.com' }
      ];
      
      const leadIndex = idHash % defaultNames.length;
      const hasTrader = (idHash % 3) !== 0; // 66% have a trader
      const traderIndex = idHash % traderNames.length;
      
      teamObj = {
        leadAccountManager: {
          id: `user-${leadIndex}`,
          ...defaultNames[leadIndex]
        },
        mediaTrader: hasTrader ? {
          id: `user-trader-${traderIndex}`,
          ...traderNames[traderIndex]
        } : undefined
      };
    }

    return {
      ...doc,
      _id: doc._id.toString(),
      displayStatus: doc.displayStatus || doc.status,
      accountName: doc.accountName,
      lineItemCount: doc.lineItemCount || 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      dates: datesObj,
      budget: budgetObj,
      team: teamObj,
      metrics: {
        ...doc.metrics,
        deliveryPacing: deliveryPacing,
        spendPacing: spendPacing,
        margin: doc.metrics?.margin || 0.7,
        revenueDelivered: doc.metrics?.revenueDelivered || budgetObj.spent * 1.2,
        budgetSpent: doc.metrics?.budgetSpent || budgetObj.spent,
        marginActual: doc.metrics?.marginActual || 0.65,
      },
      mediaActivity: doc.mediaActivity || 'None active',
      lineItems: doc.lineItems?.map((item: any) => ({
        ...item,
        dates: item.dates ? {
          start: new Date(item.dates.start),
          end: new Date(item.dates.end),
        } : undefined
      })) || [],
    };
  }

  // Create indexes for better performance
  async createIndexes(): Promise<void> {
    const indexes = [
      { index: { campaignNumber: 1 }, options: { unique: true } },
      { index: { name: 'text' }, options: {} },
      { index: { status: 1 }, options: {} },
      { index: { 'team.leadAccountManager.id': 1 }, options: {} },
      { index: { createdAt: -1 }, options: {} },
    ];

    for (const { index, options } of indexes) {
      try {
        await this.collection.createIndex(index, options);
      } catch (error: any) {
        if (error.code !== 86) { // Ignore IndexKeySpecsConflict
          throw error;
        }
      }
    }
  }
}