import request from 'supertest';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { database } from '../config/database';
import campaignRoutes from './campaigns';

import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';

describe('Campaign Bulk API Endpoints', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;

    // Connect to database
    await database.connect();

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/campaigns', campaignRoutes);
  });

  afterAll(async () => {
    await database.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clear collections after each test
    const db = database.getDb();
    await db.collection('campaigns').deleteMany({});
  });

  describe('POST /api/campaigns/bulk', () => {
    test('should create multiple campaigns', async () => {
      const campaigns = [
        {
          name: 'Campaign 1',
          campaignNumber: 'CN-001',
          status: 'L1',
          accountName: 'Test Account',
          price: {
            targetAmount: 10000,
            actualAmount: 5000,
            remainingAmount: 5000,
            currency: 'USD',
          },
          dates: {
            start: new Date('2025-01-01'),
            end: new Date('2025-12-31'),
          },
          team: {},
          metrics: {
            deliveryPacing: 0.5,
            spendPacing: 0.5,
            marginAmount: 2000,
            marginPercentage: 20,
            units: 100000,
            unitType: 'impressions',
            revenueDelivered: 8000,
            budgetSpent: 6000,
            marginActual: 0.25,
          },
          mediaActivity: 'None active',
          lineItems: [],
        },
        {
          name: 'Campaign 2',
          campaignNumber: 'CN-002',
          status: 'L2',
          accountName: 'Test Account',
          price: {
            targetAmount: 20000,
            actualAmount: 10000,
            remainingAmount: 10000,
            currency: 'USD',
          },
          dates: {
            start: new Date('2025-01-01'),
            end: new Date('2025-12-31'),
          },
          team: {},
          metrics: {
            deliveryPacing: 0.5,
            spendPacing: 0.5,
            marginAmount: 4000,
            marginPercentage: 20,
            units: 200000,
            unitType: 'impressions',
            revenueDelivered: 16000,
            budgetSpent: 12000,
            marginActual: 0.25,
          },
          mediaActivity: 'None active',
          lineItems: [],
        },
      ];

      const response = await request(app)
        .post('/api/campaigns/bulk')
        .send({ campaigns })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.inserted).toBe(2);
      expect(response.body.data.failed).toEqual([]);
      expect(response.body.data.calculationVersion).toBeDefined();

      // Verify campaigns were created
      const db = database.getDb();
      const count = await db.collection('campaigns').countDocuments();
      expect(count).toBe(2);
    });

    test('should validate required fields', async () => {
      const campaigns = [
        {
          name: 'Campaign 1',
          campaignNumber: 'CN-001',
          status: 'L1',
          price: { targetAmount: 10000, currency: 'USD' },
          dates: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        },
        {
          name: 'Campaign 2',
          // Missing campaignNumber
          status: 'L1',
          price: { targetAmount: 10000, currency: 'USD' },
          dates: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        },
      ];

      const response = await request(app)
        .post('/api/campaigns/bulk')
        .send({ campaigns })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.inserted).toBe(1);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].error).toContain('Campaign number is required');
    });

    test('should reject empty array', async () => {
      const response = await request(app)
        .post('/api/campaigns/bulk')
        .send({ campaigns: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cannot be empty');
    });

    test('should enforce batch size limit', async () => {
      const campaigns = Array(1001).fill({
        name: 'Campaign',
        campaignNumber: 'CN-001',
      });

      const response = await request(app)
        .post('/api/campaigns/bulk')
        .send({ campaigns })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('limited to 1000 records');
    });

    test('should apply calculations to price fields', async () => {
      const campaigns = [
        {
          name: 'Campaign with calculations',
          campaignNumber: 'CN-CALC-001',
          status: 'L1',
          price: {
            targetAmount: 10000,
            actualAmount: 5000,
            currency: 'USD',
          },
          dates: {
            start: new Date('2025-01-01'),
            end: new Date('2025-12-31'),
          },
        },
      ];

      const response = await request(app)
        .post('/api/campaigns/bulk')
        .send({ campaigns })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify calculated fields were added
      const db = database.getDb();
      const campaign = await db.collection('campaigns').findOne({ campaignNumber: 'CN-CALC-001' });

      expect(campaign).toBeDefined();
      expect(campaign.calculatedFields).toBeDefined();
      expect(campaign.calculatedFields.spendPercentage).toBeDefined();
      expect(campaign.calculatedFields.remainingPercentage).toBeDefined();
    });
  });

  describe('PUT /api/campaigns/bulk', () => {
    test('should update multiple campaigns', async () => {
      // First create some campaigns
      const db = database.getDb();
      const result1 = await db.collection('campaigns').insertOne({
        name: 'Campaign 1',
        campaignNumber: 'CN-001',
        status: 'L1',
        price: { targetAmount: 10000, actualAmount: 0, remainingAmount: 10000, currency: 'USD' },
        dates: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const result2 = await db.collection('campaigns').insertOne({
        name: 'Campaign 2',
        campaignNumber: 'CN-002',
        status: 'L2',
        price: { targetAmount: 20000, actualAmount: 0, remainingAmount: 20000, currency: 'USD' },
        dates: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updates = [
        {
          id: result1.insertedId.toString(),
          data: { status: 'L3' },
        },
        {
          id: result2.insertedId.toString(),
          data: { status: 'L3' },
        },
      ];

      const response = await request(app).put('/api/campaigns/bulk').send({ updates }).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(2);
      expect(response.body.data.failed).toEqual([]);
    });

    test('should handle non-existent campaigns', async () => {
      const updates = [
        {
          id: '507f1f77bcf86cd799439011',
          data: { status: 'L3' },
        },
      ];

      const response = await request(app).put('/api/campaigns/bulk').send({ updates }).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(0);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].error).toContain('not found');
    });
  });

  describe('POST /api/campaigns/bulk/upsert', () => {
    test('should insert new and update existing campaigns', async () => {
      // Create one existing campaign
      const db = database.getDb();
      const existing = await db.collection('campaigns').insertOne({
        name: 'Existing Campaign',
        campaignNumber: 'CN-001',
        status: 'L1',
        price: { targetAmount: 10000, actualAmount: 0, remainingAmount: 10000, currency: 'USD' },
        dates: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const campaigns = [
        {
          _id: existing.insertedId.toString(),
          name: 'Updated Campaign',
          campaignNumber: 'CN-001',
          status: 'L3',
          price: {
            targetAmount: 10000,
            actualAmount: 5000,
            remainingAmount: 5000,
            currency: 'USD',
          },
          dates: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        },
        {
          name: 'New Campaign',
          campaignNumber: 'CN-002',
          status: 'L1',
          price: { targetAmount: 20000, actualAmount: 0, remainingAmount: 20000, currency: 'USD' },
          dates: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        },
      ];

      const response = await request(app)
        .post('/api/campaigns/bulk/upsert')
        .send({ campaigns })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.inserted).toBe(1);
      expect(response.body.data.updated).toBe(1);

      // Verify results
      const count = await db.collection('campaigns').countDocuments();
      expect(count).toBe(2);

      const updated = await db.collection('campaigns').findOne({ campaignNumber: 'CN-001' });
      expect(updated.name).toBe('Updated Campaign');
      expect(updated.status).toBe('L3');
    });
  });
});
