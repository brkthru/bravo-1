import request from 'supertest';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { database } from '../config/database';
import campaignRoutes from './campaigns';

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
    it('should create multiple campaigns', async () => {
      const campaigns = [
        {
          name: 'Campaign 1',
          campaignNumber: 'CN-001',
          status: 'active',
          budget: {
            total: 10000,
            allocated: 8000,
            spent: 5000,
          },
        },
        {
          name: 'Campaign 2',
          campaignNumber: 'CN-002',
          status: 'active',
          budget: {
            total: 20000,
            allocated: 15000,
            spent: 10000,
          },
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

    it('should validate required fields', async () => {
      const campaigns = [
        {
          name: 'Campaign 1',
          campaignNumber: 'CN-001',
        },
        {
          name: 'Campaign 2',
          // Missing campaignNumber
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

    it('should reject empty array', async () => {
      const response = await request(app)
        .post('/api/campaigns/bulk')
        .send({ campaigns: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cannot be empty');
    });

    it('should enforce batch size limit', async () => {
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

    it('should apply calculations to budget fields', async () => {
      const campaigns = [
        {
          name: 'Campaign with calculations',
          campaignNumber: 'CN-CALC-001',
          budget: {
            total: 10000,
            allocated: 8000,
            spent: 5000,
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
      expect(campaign.calculatedFields.allocationPercentage).toBeDefined();
      expect(campaign.calculatedFields.spendPercentage).toBeDefined();
    });
  });

  describe('PUT /api/campaigns/bulk', () => {
    it('should update multiple campaigns', async () => {
      // First create some campaigns
      const db = database.getDb();
      const result1 = await db.collection('campaigns').insertOne({
        name: 'Campaign 1',
        campaignNumber: 'CN-001',
        status: 'active',
      });
      const result2 = await db.collection('campaigns').insertOne({
        name: 'Campaign 2',
        campaignNumber: 'CN-002',
        status: 'active',
      });

      const updates = [
        {
          id: result1.insertedId.toString(),
          data: { status: 'paused' },
        },
        {
          id: result2.insertedId.toString(),
          data: { status: 'completed' },
        },
      ];

      const response = await request(app).put('/api/campaigns/bulk').send({ updates }).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(2);
      expect(response.body.data.failed).toEqual([]);
    });

    it('should handle non-existent campaigns', async () => {
      const updates = [
        {
          id: '507f1f77bcf86cd799439011',
          data: { status: 'paused' },
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
    it('should insert new and update existing campaigns', async () => {
      // Create one existing campaign
      const db = database.getDb();
      const existing = await db.collection('campaigns').insertOne({
        name: 'Existing Campaign',
        campaignNumber: 'CN-001',
        status: 'active',
      });

      const campaigns = [
        {
          _id: existing.insertedId.toString(),
          name: 'Updated Campaign',
          campaignNumber: 'CN-001',
          status: 'paused',
        },
        {
          name: 'New Campaign',
          campaignNumber: 'CN-002',
          status: 'active',
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
      expect(updated.status).toBe('paused');
    });
  });
});
