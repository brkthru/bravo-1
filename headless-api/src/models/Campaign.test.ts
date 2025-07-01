import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import { CampaignModel } from './Campaign';
import { Campaign, CampaignStatus, CreateCampaignRequest } from '@bravo-1/shared';
import { database } from '../config/database';

// Helper function to create valid campaign data with new schema
function createMockCampaignData(overrides: Partial<CreateCampaignRequest> = {}): CreateCampaignRequest {
  return {
    name: 'Test Campaign',
    accountName: 'Test Account',
    campaignNumber: 'CAMP-001',
    status: 'L1' as CampaignStatus,
    displayStatus: 'active',
    team: {
      accountManager: {
        id: 'user-1',
        name: 'Test Manager',
        email: 'test@example.com',
      },
      csd: null,
      seniorMediaTraders: [],
      mediaTraders: [],
    },
    dates: {
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31'),
      daysElapsed: 0,
      totalDuration: 365,
    },
    price: {
      targetAmount: 10000,
      actualAmount: 0,
      remainingAmount: 10000,
      currency: 'USD',
    },
    metrics: {
      deliveryPacing: 0,
      spendPacing: 0,
      marginAmount: 3000,
      marginPercentage: 30,
      units: 0,
      unitType: 'impressions',
      revenueDelivered: 0,
      budgetSpent: 0,
      marginActual: 0,
    },
    mediaActivity: 'None active',
    lineItems: [],
    lineItemCount: 0,
    ...overrides,
  };
}

describe('CampaignModel', () => {
  let campaignModel: CampaignModel;

  beforeAll(async () => {
    // Set test environment variables if not already set
    if (!process.env.MONGODB_URI) {
      process.env.MONGODB_URI = 'mongodb://localhost:27017';
    }
    if (!process.env.DATABASE_NAME) {
      process.env.DATABASE_NAME = 'mediatool_test';
    }
    await database.connect();
    campaignModel = new CampaignModel();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    const db = database.getDb();
    await db.collection('campaigns').deleteMany({});
  });

  describe('findAll', () => {
    test('should return empty array when no campaigns exist', async () => {
      const campaigns = await campaignModel.findAll();
      expect(campaigns).toEqual([]);
    });

    test('should return all campaigns with transformed data', async () => {
      const mockCampaignData = createMockCampaignData();
      const mockCampaign = {
        _id: new ObjectId(),
        ...mockCampaignData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const db = database.getDb();
      await db.collection('campaigns').insertOne(mockCampaign);
      const campaigns = await campaignModel.findAll();

      expect(campaigns).toHaveLength(1);
      expect(campaigns[0]).toMatchObject({
        _id: mockCampaign._id.toString(),
        name: mockCampaign.name,
        accountName: mockCampaign.accountName,
        campaignNumber: mockCampaign.campaignNumber,
        status: mockCampaign.status,
      });
      
      // Check price object instead of budget
      expect(campaigns[0].price).toBeDefined();
      expect(campaigns[0].price.targetAmount).toBe(mockCampaign.price.targetAmount);

      // Check that pacing metrics are calculated
      expect(campaigns[0].metrics).toBeDefined();
      expect(campaigns[0].metrics?.deliveryPacing).toBeGreaterThanOrEqual(0);
      expect(campaigns[0].metrics?.spendPacing).toBeGreaterThanOrEqual(0);
    });

    test('should calculate consistent pacing for same campaign ID', async () => {
      const mockCampaignData = createMockCampaignData();
      const mockCampaign = {
        _id: new ObjectId('507f1f77bcf86cd799439011'),
        ...mockCampaignData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const db = database.getDb();
      await db.collection('campaigns').insertOne(mockCampaign);

      const campaigns1 = await campaignModel.findAll();
      const campaigns2 = await campaignModel.findAll();

      expect(campaigns1[0].metrics?.deliveryPacing).toEqual(campaigns2[0].metrics?.deliveryPacing);
      expect(campaigns1[0].metrics?.spendPacing).toEqual(campaigns2[0].metrics?.spendPacing);
    });
  });

  describe('findById', () => {
    test('should return null for non-existent campaign', async () => {
      const campaign = await campaignModel.findById(new ObjectId().toString());
      expect(campaign).toBeNull();
    });

    test('should return campaign by ID', async () => {
      const mockCampaignData = createMockCampaignData();
      const mockCampaign = {
        _id: new ObjectId(),
        ...mockCampaignData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const db = database.getDb();
      await db.collection('campaigns').insertOne(mockCampaign);
      const campaign = await campaignModel.findById(mockCampaign._id.toString());

      expect(campaign).toBeTruthy();
      expect(campaign?._id).toBe(mockCampaign._id.toString());
      expect(campaign?.name).toBe(mockCampaign.name);
    });

    test('should handle invalid ObjectId format', async () => {
      const campaign = await campaignModel.findById('invalid-id');
      expect(campaign).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const campaigns = [
        {
          _id: new ObjectId(),
          ...createMockCampaignData({
            name: 'Holiday Campaign 2025',
            accountName: 'Tech Giant',
            campaignNumber: 'CAMP-001',
            price: { targetAmount: 10000, actualAmount: 0, remainingAmount: 10000, currency: 'USD' },
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          ...createMockCampaignData({
            name: 'Summer Sale',
            accountName: 'Fashion Brand',
            campaignNumber: 'CAMP-002',
            price: { targetAmount: 20000, actualAmount: 0, remainingAmount: 20000, currency: 'USD' },
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          ...createMockCampaignData({
            name: 'Tech Product Launch',
            accountName: 'Tech Giant',
            campaignNumber: 'TECH-003',
            price: { targetAmount: 50000, actualAmount: 0, remainingAmount: 50000, currency: 'USD' },
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const db = database.getDb();
      await db.collection('campaigns').insertMany(campaigns);
    });

    test('should search by campaign name', async () => {
      const results = await campaignModel.search('Holiday');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Holiday Campaign 2025');
    });

    test('should search by account name', async () => {
      const results = await campaignModel.search('Tech Giant');
      expect(results).toHaveLength(2);
      expect(results.every((c) => c.accountName === 'Tech Giant')).toBe(true);
    });

    test('should search by campaign number', async () => {
      const results = await campaignModel.search('TECH');
      expect(results).toHaveLength(1);
      expect(results[0].campaignNumber).toBe('TECH-003');
    });

    test('should be case insensitive', async () => {
      const results = await campaignModel.search('HOLIDAY');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Holiday Campaign 2025');
    });

    test('should return empty array for no matches', async () => {
      const results = await campaignModel.search('NonExistent');
      expect(results).toEqual([]);
    });

    test('should handle special regex characters', async () => {
      const results = await campaignModel.search('Tech.*');
      expect(results).toHaveLength(2);
    });
  });

  describe('create', () => {
    test('should create a new campaign', async () => {
      const newCampaign = createMockCampaignData({
        name: 'New Campaign',
        accountName: 'New Account',
        campaignNumber: 'NEW-001',
        price: { targetAmount: 15000, actualAmount: 0, remainingAmount: 15000, currency: 'USD' },
      });

      const created = await campaignModel.create(newCampaign);

      expect(created._id).toBeDefined();
      expect(created.name).toBe(newCampaign.name);
      expect(created.accountName).toBe(newCampaign.accountName);
      expect(created.price.targetAmount).toBe(newCampaign.price.targetAmount);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();

      // Verify it was saved to database
      const db = database.getDb();
      const saved = await db.collection('campaigns').findOne({ _id: new ObjectId(created._id) });
      expect(saved).toBeTruthy();
    });

    test('should set createdAt and updatedAt timestamps', async () => {
      const newCampaign = createMockCampaignData({
        name: 'New Campaign',
        accountName: 'New Account',
        campaignNumber: 'NEW-001',
        price: { targetAmount: 15000, actualAmount: 0, remainingAmount: 15000, currency: 'USD' },
      });

      const created = await campaignModel.create(newCampaign);

      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(created.createdAt.getTime()).toBe(created.updatedAt.getTime());
    });
  });

  describe('update', () => {
    test('should update an existing campaign', async () => {
      const mockCampaignData = createMockCampaignData({
        name: 'Original Name',
        accountName: 'Test Account',
        campaignNumber: 'CAMP-001',
        price: { targetAmount: 10000, actualAmount: 0, remainingAmount: 10000, currency: 'USD' },
      });
      const mockCampaign = {
        _id: new ObjectId(),
        ...mockCampaignData,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      const db = database.getDb();
      await db.collection('campaigns').insertOne(mockCampaign);

      const updates = {
        name: 'Updated Name',
        price: { targetAmount: 20000, actualAmount: 0, remainingAmount: 20000, currency: 'USD' },
      };

      const updated = await campaignModel.update(mockCampaign._id.toString(), updates);

      expect(updated).toBeTruthy();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.price.targetAmount).toBe(20000);
      expect(updated?.accountName).toBe(mockCampaign.accountName); // Unchanged
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(mockCampaign.updatedAt.getTime());
    });

    test('should return null for non-existent campaign', async () => {
      const updated = await campaignModel.update(new ObjectId().toString(), { name: 'New Name' });
      expect(updated).toBeNull();
    });

    test('should handle invalid ObjectId format', async () => {
      const updated = await campaignModel.update('invalid-id', { name: 'New Name' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    test('should delete an existing campaign', async () => {
      const mockCampaignData = createMockCampaignData({
        name: 'To Delete',
        accountName: 'Test Account',
        campaignNumber: 'CAMP-001',
      });
      const mockCampaign = {
        _id: new ObjectId(),
        ...mockCampaignData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const db = database.getDb();
      await db.collection('campaigns').insertOne(mockCampaign);

      const deleted = await campaignModel.delete(mockCampaign._id.toString());
      expect(deleted).toBe(true);

      const found = await db.collection('campaigns').findOne({ _id: mockCampaign._id });
      expect(found).toBeNull();
    });

    test('should return false for non-existent campaign', async () => {
      const deleted = await campaignModel.delete(new ObjectId().toString());
      expect(deleted).toBe(false);
    });

    test('should handle invalid ObjectId format', async () => {
      const deleted = await campaignModel.delete('invalid-id');
      expect(deleted).toBe(false);
    });
  });

  describe('pacing calculations', () => {
    test('should show ~20% of campaigns as over-pacing', async () => {
      // Create 100 campaigns to test the distribution
      const campaigns = Array.from({ length: 100 }, (_, i) => ({
        _id: new ObjectId(),
        ...createMockCampaignData({
          name: `Campaign ${i}`,
          accountName: `Account ${i}`,
          campaignNumber: `CAMP-${i.toString().padStart(3, '0')}`,
          price: { targetAmount: 10000 + i * 1000, actualAmount: 0, remainingAmount: 10000 + i * 1000, currency: 'USD' },
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const db = database.getDb();
      await db.collection('campaigns').insertMany(campaigns);
      const results = await campaignModel.findAll();

      const overPacingCount = results.filter((c) => (c.metrics?.deliveryPacing || 0) > 1.0).length;

      // Should be roughly 20% (allow 15-25% range for randomness)
      expect(overPacingCount).toBeGreaterThanOrEqual(15);
      expect(overPacingCount).toBeLessThanOrEqual(25);
    });

    test('should ensure spend pacing is usually lower than delivery pacing', async () => {
      const campaigns = Array.from({ length: 50 }, (_, i) => ({
        _id: new ObjectId(),
        ...createMockCampaignData({
          name: `Campaign ${i}`,
          accountName: `Account ${i}`,
          campaignNumber: `CAMP-${i.toString().padStart(3, '0')}`,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const db = database.getDb();
      await db.collection('campaigns').insertMany(campaigns);
      const results = await campaignModel.findAll();

      const lowerSpendCount = results.filter(
        (c) => (c.metrics?.spendPacing || 0) <= (c.metrics?.deliveryPacing || 0)
      ).length;

      // At least 80% should have spend pacing <= delivery pacing
      expect(lowerSpendCount).toBeGreaterThanOrEqual(40);
    });
  });
});
