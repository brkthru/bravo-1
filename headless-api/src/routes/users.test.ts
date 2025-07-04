import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import usersRouter from './users';
import { database } from '../config/database';
import { UserRole } from '../models/User';

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

describe('Users API Routes', () => {
  beforeAll(async () => {
    const uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mediatool_test';
    await database.connect(uri);
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    const db = database.getDb();
    await db.collection('users').deleteMany({});
  });

  describe('GET /api/users', () => {
    test('should return empty array when no users exist', async () => {
      const response = await request(app).get('/api/users').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should return all users', async () => {
      const db = database.getDb();
      const users = [
        {
          _id: new ObjectId(),
          email: 'user1@example.com',
          name: 'User One',
          role: 'media_trader' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          email: 'user2@example.com',
          name: 'User Two',
          role: 'account_manager' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('users').insertMany(users);

      const response = await request(app).get('/api/users').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('User One');
      expect(response.body.data[1].name).toBe('User Two');
    });

    test('should filter users by role', async () => {
      const db = database.getDb();
      const users = [
        {
          _id: new ObjectId(),
          email: 'trader@example.com',
          name: 'Trader',
          role: 'media_trader' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          email: 'manager@example.com',
          name: 'Manager',
          role: 'account_manager' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('users').insertMany(users);

      const response = await request(app).get('/api/users?role=media_trader').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].role).toBe('media_trader');
    });

    test('should filter users by active status', async () => {
      const db = database.getDb();
      const users = [
        {
          _id: new ObjectId(),
          email: 'active@example.com',
          name: 'Active User',
          role: 'account_manager' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          email: 'inactive@example.com',
          name: 'Inactive User',
          role: 'account_manager' as const,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('users').insertMany(users);

      const response = await request(app).get('/api/users?isActive=true').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isActive).toBe(true);
    });

    test('should search users', async () => {
      const db = database.getDb();
      const users = [
        {
          _id: new ObjectId(),
          email: 'john.doe@example.com',
          name: 'John Doe',
          role: 'account_manager' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          email: 'jane.smith@example.com',
          name: 'Jane Smith',
          role: 'media_trader' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('users').insertMany(users);

      const response = await request(app).get('/api/users?search=John').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('John Doe');
    });
  });

  describe('GET /api/users/hierarchy', () => {
    test('should return organizational hierarchy', async () => {
      const db = database.getDb();

      const director = {
        _id: new ObjectId(),
        email: 'director@example.com',
        name: 'Director',
        role: 'account_director' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const manager = {
        _id: new ObjectId(),
        email: 'manager@example.com',
        name: 'Manager',
        role: 'account_manager' as const,
        managerId: director._id.toString(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('users').insertMany([director, manager]);

      const response = await request(app).get('/api/users/hierarchy').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Director');
      expect(response.body.data[0].subordinates).toHaveLength(1);
      expect(response.body.data[0].subordinates[0].name).toBe('Manager');
    });
  });

  describe('GET /api/users/:id', () => {
    test('should return user by ID', async () => {
      const db = database.getDb();
      const user = {
        _id: new ObjectId(),
        email: 'test@example.com',
        name: 'Test User',
        role: 'account_manager' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('users').insertOne(user);

      const response = await request(app).get(`/api/users/${user._id.toString()}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(user._id.toString());
      expect(response.body.data.name).toBe('Test User');
    });

    test('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get(`/api/users/${new ObjectId().toString()}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/users', () => {
    test('should create a new user', async () => {
      const newUser = {
        email: 'new@example.com',
        name: 'New User',
        role: UserRole.MEDIA_TRADER,
        department: 'Operations',
      };

      const response = await request(app).post('/api/users').send(newUser).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBeDefined();
      expect(response.body.data.email).toBe('new@example.com');
      expect(response.body.data.name).toBe('New User');
      expect(response.body.data.isActive).toBe(true);
      expect(response.body.data.createdAt).toBeDefined();

      // Verify it was saved to database
      const db = database.getDb();
      const saved = await db.collection('users').findOne({
        _id: new ObjectId(response.body.data._id),
      });
      expect(saved).toBeTruthy();
    });

    test('should handle creation errors', async () => {
      await database.disconnect();

      const newUser = {
        email: 'test@example.com',
        name: 'Test User',
        role: 'account_manager' as const,
      };

      const response = await request(app).post('/api/users').send(newUser).expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create user');

      // Reconnect
      const uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mediatool_test';
      await database.connect(uri);
    });
  });

  describe('PUT /api/users/:id', () => {
    test('should update an existing user', async () => {
      const db = database.getDb();
      const user = {
        _id: new ObjectId(),
        email: 'original@example.com',
        name: 'Original Name',
        role: UserRole.MEDIA_TRADER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('users').insertOne(user);

      const updates = {
        name: 'Updated Name',
        role: 'senior_media_trader' as const,
        department: 'New Department',
      };

      const response = await request(app)
        .put(`/api/users/${user._id.toString()}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.role).toBe('senior_media_trader');
      expect(response.body.data.department).toBe('New Department');
      expect(response.body.data.email).toBe('original@example.com'); // Unchanged
    });

    test('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .put(`/api/users/${new ObjectId().toString()}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('DELETE /api/users/:id', () => {
    test('should delete an existing user', async () => {
      const db = database.getDb();
      const user = {
        _id: new ObjectId(),
        email: 'todelete@example.com',
        name: 'To Delete',
        role: 'account_manager' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('users').insertOne(user);

      const response = await request(app).delete(`/api/users/${user._id.toString()}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);

      // Verify it was deleted from database
      const found = await db.collection('users').findOne({ _id: user._id });
      expect(found).toBeNull();
    });

    test('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete(`/api/users/${new ObjectId().toString()}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });
});
