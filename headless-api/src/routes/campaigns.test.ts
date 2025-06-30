import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import campaignsRouter from './campaigns';
import { database } from '../config/database';

const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRouter);

describe('Campaigns API Routes', () => {
  beforeAll(async () => {
    const uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mediatool_test';
    await database.connect(uri);
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    const db = database.getDb();
    await db.collection('campaigns').deleteMany({});
  });

  describe('GET /api/campaigns', () => {
    test('should return empty array when no campaigns exist', async () => {
      const response = await request(app).get('/api/campaigns').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should return all campaigns', async () => {
      const db = database.getDb();
      const campaigns = [
        {
          _id: new ObjectId(),
          name: 'Campaign 1',
          accountName: 'Account 1',
          campaignNumber: 'CAMP-001',
          budget: 10000,
          status: 'active',
          dates: {
            start: new Date('2025-01-01'),
            end: new Date('2025-12-31'),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          name: 'Campaign 2',
          accountName: 'Account 2',
          campaignNumber: 'CAMP-002',
          budget: 20000,
          status: 'active',
          dates: {
            start: new Date('2025-01-01'),
            end: new Date('2025-12-31'),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('campaigns').insertMany(campaigns);

      const response = await request(app).get('/api/campaigns').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Campaign 1');
      expect(response.body.data[1].name).toBe('Campaign 2');
    });

    test('should search campaigns by query parameter', async () => {
      const db = database.getDb();
      const campaigns = [
        {
          _id: new ObjectId(),
          name: 'Holiday Campaign',
          accountName: 'Retail Co',
          campaignNumber: 'HOLI-001',
          budget: 15000,
          status: 'active',
          dates: {
            start: new Date('2025-01-01'),
            end: new Date('2025-12-31'),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          name: 'Summer Sale',
          accountName: 'Fashion Brand',
          campaignNumber: 'SUMM-001',
          budget: 25000,
          status: 'active',
          dates: {
            start: new Date('2025-06-01'),
            end: new Date('2025-08-31'),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('campaigns').insertMany(campaigns);

      const response = await request(app).get('/api/campaigns?search=Holiday').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Holiday Campaign');
    });

    test('should handle database errors gracefully', async () => {
      // Temporarily disconnect to simulate error
      await database.disconnect();

      const response = await request(app).get('/api/campaigns').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch campaigns');

      // Reconnect for other tests
      const uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mediatool_test';
      await database.connect(uri);
    });
  });

  describe('GET /api/campaigns/:id', () => {
    test('should return campaign by ID', async () => {
      const db = database.getDb();
      const campaign = {
        _id: new ObjectId(),
        name: 'Test Campaign',
        accountName: 'Test Account',
        campaignNumber: 'TEST-001',
        budget: 30000,
        status: 'active',
        dates: {
          start: new Date('2025-01-01'),
          end: new Date('2025-12-31'),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('campaigns').insertOne(campaign);

      const response = await request(app)
        .get(`/api/campaigns/${campaign._id.toString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(campaign._id.toString());
      expect(response.body.data.name).toBe('Test Campaign');
    });

    test('should return 404 for non-existent campaign', async () => {
      const response = await request(app)
        .get(`/api/campaigns/${new ObjectId().toString()}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Campaign not found');
    });

    test('should handle invalid ObjectId format', async () => {
      const response = await request(app).get('/api/campaigns/invalid-id').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('POST /api/campaigns', () => {
    test('should create a new campaign', async () => {
      const newCampaign = {
        name: 'New Campaign',
        accountName: 'New Account',
        campaignNumber: 'NEW-001',
        budget: 50000,
        status: 'draft',
        dates: {
          start: '2025-01-01',
          end: '2025-12-31',
        },
      };

      const response = await request(app).post('/api/campaigns').send(newCampaign).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBeDefined();
      expect(response.body.data.name).toBe('New Campaign');
      expect(response.body.data.budget).toBe(50000);
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();

      // Verify it was saved to database
      const db = database.getDb();
      const saved = await db.collection('campaigns').findOne({
        _id: new ObjectId(response.body.data._id),
      });
      expect(saved).toBeTruthy();
    });

    test('should validate required fields', async () => {
      const invalidCampaign = {
        // Missing name and campaignNumber
        budget: 50000,
        status: 'draft',
      };

      const response = await request(app).post('/api/campaigns').send(invalidCampaign).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name and campaign number are required');
    });

    test('should handle creation errors', async () => {
      await database.disconnect();

      const newCampaign = {
        name: 'New Campaign',
        campaignNumber: 'NEW-001',
        budget: 50000,
      };

      const response = await request(app).post('/api/campaigns').send(newCampaign).expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create campaign');

      // Reconnect
      const uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mediatool_test';
      await database.connect(uri);
    });
  });

  describe('PUT /api/campaigns/:id', () => {
    test('should update an existing campaign', async () => {
      const db = database.getDb();
      const campaign = {
        _id: new ObjectId(),
        name: 'Original Name',
        accountName: 'Test Account',
        campaignNumber: 'TEST-001',
        budget: 30000,
        status: 'active',
        dates: {
          start: new Date('2025-01-01'),
          end: new Date('2025-12-31'),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('campaigns').insertOne(campaign);

      const updates = {
        name: 'Updated Name',
        budget: 40000,
        status: 'paused',
      };

      const response = await request(app)
        .put(`/api/campaigns/${campaign._id.toString()}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.budget).toBe(40000);
      expect(response.body.data.status).toBe('paused');
      expect(response.body.data.accountName).toBe('Test Account'); // Unchanged
    });

    test('should return 404 for non-existent campaign', async () => {
      const response = await request(app)
        .put(`/api/campaigns/${new ObjectId().toString()}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Campaign not found');
    });

    test('should allow partial updates', async () => {
      const db = database.getDb();
      const campaign = {
        _id: new ObjectId(),
        name: 'Original Name',
        accountName: 'Test Account',
        campaignNumber: 'TEST-001',
        budget: 30000,
        status: 'active',
        dates: {
          start: new Date('2025-01-01'),
          end: new Date('2025-12-31'),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('campaigns').insertOne(campaign);

      const response = await request(app)
        .put(`/api/campaigns/${campaign._id.toString()}`)
        .send({ budget: 35000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.budget).toBe(35000);
      expect(response.body.data.name).toBe('Original Name'); // Unchanged
      expect(response.body.data.status).toBe('active'); // Unchanged
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    test('should delete an existing campaign', async () => {
      const db = database.getDb();
      const campaign = {
        _id: new ObjectId(),
        name: 'To Delete',
        accountName: 'Test Account',
        campaignNumber: 'DEL-001',
        budget: 10000,
        status: 'active',
        dates: {
          start: new Date('2025-01-01'),
          end: new Date('2025-12-31'),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('campaigns').insertOne(campaign);

      const response = await request(app)
        .delete(`/api/campaigns/${campaign._id.toString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);

      // Verify it was deleted from database
      const found = await db.collection('campaigns').findOne({ _id: campaign._id });
      expect(found).toBeNull();
    });

    test('should return 404 for non-existent campaign', async () => {
      const response = await request(app)
        .delete(`/api/campaigns/${new ObjectId().toString()}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Campaign not found');
    });

    test('should handle deletion errors', async () => {
      await database.disconnect();

      const response = await request(app)
        .delete(`/api/campaigns/${new ObjectId().toString()}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to delete campaign');

      // Reconnect
      const uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mediatool_test';
      await database.connect(uri);
    });
  });
});
