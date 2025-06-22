import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import { UserModel } from './User';
import { database } from '../config/database';

describe('UserModel', () => {
  let userModel: UserModel;

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mediatool_test';
    await database.connect(uri);
    userModel = new UserModel();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    const db = database.getDb();
    await db.collection('users').deleteMany({});
  });

  describe('findAll', () => {
    test('should return empty array when no users exist', async () => {
      const users = await userModel.findAll();
      expect(users).toEqual([]);
    });

    test('should return all users', async () => {
      const mockUsers = [
        {
          _id: new ObjectId(),
          email: 'user1@example.com',
          name: 'User One',
          role: 'media_trader',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'user2@example.com',
          name: 'User Two',
          role: 'account_manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const db = database.getDb();
      await db.collection('users').insertMany(mockUsers);
      const users = await userModel.findAll();

      expect(users).toHaveLength(2);
      expect(users[0]._id).toBe(mockUsers[0]._id.toString());
      expect(users[1]._id).toBe(mockUsers[1]._id.toString());
    });

    test('should filter by role', async () => {
      const mockUsers = [
        {
          _id: new ObjectId(),
          email: 'trader1@example.com',
          name: 'Trader One',
          role: 'media_trader',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'manager1@example.com',
          name: 'Manager One',
          role: 'account_manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'trader2@example.com',
          name: 'Trader Two',
          role: 'media_trader',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const db = database.getDb();
      await db.collection('users').insertMany(mockUsers);
      const traders = await userModel.findAll({ role: UserRole.MEDIA_TRADER });

      expect(traders).toHaveLength(2);
      expect(traders.every(u => u.role === UserRole.MEDIA_TRADER)).toBe(true);
    });

    test('should filter by isActive status', async () => {
      const mockUsers = [
        {
          _id: new ObjectId(),
          email: 'active@example.com',
          name: 'Active User',
          role: 'account_manager',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'inactive@example.com',
          name: 'Inactive User',
          role: 'account_manager',
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const db = database.getDb();
      await db.collection('users').insertMany(mockUsers);
      const activeUsers = await userModel.findAll({ isActive: true });

      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].isActive).toBe(true);
    });

    test('should filter by department', async () => {
      const mockUsers = [
        {
          _id: new ObjectId(),
          email: 'sales1@example.com',
          name: 'Sales User',
          role: 'account_manager',
          department: 'Sales',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'tech1@example.com',
          name: 'Tech User',
          role: 'media_trader',
          department: 'Technology',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const db = database.getDb();
      await db.collection('users').insertMany(mockUsers);
      const salesUsers = await userModel.findAll({ department: 'Sales' });

      expect(salesUsers).toHaveLength(1);
      expect(salesUsers[0].department).toBe('Sales');
    });

    test('should filter by managerId', async () => {
      const managerId = new ObjectId();
      const mockUsers = [
        {
          _id: new ObjectId(),
          email: 'user1@example.com',
          name: 'User with Manager',
          role: 'media_trader',
          managerId: managerId.toString(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'user2@example.com',
          name: 'User without Manager',
          role: 'media_trader',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const db = database.getDb();
      await db.collection('users').insertMany(mockUsers);
      const usersWithManager = await userModel.findAll({ managerId: managerId.toString() });

      expect(usersWithManager).toHaveLength(1);
      expect(usersWithManager[0].managerId).toBe(managerId.toString());
    });
  });

  describe('findById', () => {
    test('should return null for non-existent user', async () => {
      const user = await userModel.findById(new ObjectId().toString());
      expect(user).toBeNull();
    });

    test('should return user by ID', async () => {
      const mockUser = {
        _id: new ObjectId(),
        email: 'test@example.com',
        name: 'Test User',
        role: 'account_manager',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const db = database.getDb();
      await db.collection('users').insertOne(mockUser);
      const user = await userModel.findById(mockUser._id.toString());

      expect(user).toBeTruthy();
      expect(user?._id).toBe(mockUser._id.toString());
      expect(user?.email).toBe(mockUser.email);
      expect(user?.name).toBe(mockUser.name);
    });

    test('should handle invalid ObjectId format', async () => {
      const user = await userModel.findById('invalid-id');
      expect(user).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const users = [
        {
          _id: new ObjectId(),
          email: 'john.doe@example.com',
          name: 'John Doe',
          role: 'account_manager',
          department: 'Sales',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'jane.smith@example.com',
          name: 'Jane Smith',
          role: 'media_trader',
          department: 'Operations',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId(),
          email: 'bob.johnson@example.com',
          name: 'Bob Johnson',
          role: 'senior_account_manager',
          department: 'Sales',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const db = database.getDb();
      await db.collection('users').insertMany(users);
    });

    test('should search by name', async () => {
      const results = await userModel.search('John');
      expect(results).toHaveLength(2); // John Doe and Bob Johnson
    });

    test('should search by email', async () => {
      const results = await userModel.search('jane');
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('jane.smith@example.com');
    });

    test('should search by department', async () => {
      const results = await userModel.search('Sales');
      expect(results).toHaveLength(2);
      expect(results.every(u => u.department === 'Sales')).toBe(true);
    });

    test('should be case insensitive', async () => {
      const results = await userModel.search('JANE');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Jane Smith');
    });

    test('should return empty array for no matches', async () => {
      const results = await userModel.search('NonExistent');
      expect(results).toEqual([]);
    });
  });

  describe('create', () => {
    test('should create a new user', async () => {
      const newUser = {
        email: 'new@example.com',
        name: 'New User',
        role: 'media_trader',
        department: 'Operations'
      };

      const created = await userModel.create(newUser);

      expect(created._id).toBeDefined();
      expect(created.email).toBe(newUser.email);
      expect(created.name).toBe(newUser.name);
      expect(created.role).toBe(newUser.role);
      expect(created.isActive).toBe(true); // Default value
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();

      // Verify it was saved to database
      const saved = await db.collection('users').findOne({ _id: new ObjectId(created._id) });
      expect(saved).toBeTruthy();
    });

    test('should set default values', async () => {
      const newUser = {
        email: 'minimal@example.com',
        name: 'Minimal User',
        role: 'account_manager'
      };

      const created = await userModel.create(newUser);

      expect(created.isActive).toBe(true);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    test('should update an existing user', async () => {
      const mockUser = {
        _id: new ObjectId(),
        email: 'original@example.com',
        name: 'Original Name',
        role: 'media_trader',
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      };

      const db = database.getDb();
      await db.collection('users').insertOne(mockUser);

      const updates = {
        name: 'Updated Name',
        role: UserRole.SENIOR_MEDIA_TRADER,
        department: 'New Department'
      };

      const updated = await userModel.update(mockUser._id.toString(), updates);

      expect(updated).toBeTruthy();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.role).toBe(UserRole.SENIOR_MEDIA_TRADER);
      expect(updated?.department).toBe('New Department');
      expect(updated?.email).toBe(mockUser.email); // Unchanged
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(mockUser.updatedAt.getTime());
    });

    test('should return null for non-existent user', async () => {
      const updated = await userModel.update(new ObjectId().toString(), { name: 'New Name' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    test('should delete an existing user', async () => {
      const mockUser = {
        _id: new ObjectId(),
        email: 'todelete@example.com',
        name: 'To Delete',
        role: 'account_manager',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const db = database.getDb();
      await db.collection('users').insertOne(mockUser);
      
      const deleted = await userModel.delete(mockUser._id.toString());
      expect(deleted).toBe(true);

      const found = await db.collection('users').findOne({ _id: mockUser._id });
      expect(found).toBeNull();
    });

    test('should return false for non-existent user', async () => {
      const deleted = await userModel.delete(new ObjectId().toString());
      expect(deleted).toBe(false);
    });
  });

  describe('getHierarchy', () => {
    test('should return empty array when no users exist', async () => {
      const hierarchy = await userModel.getHierarchy();
      expect(hierarchy).toEqual([]);
    });

    test('should return hierarchical structure', async () => {
      const director = {
        _id: new ObjectId(),
        email: 'director@example.com',
        name: 'Director',
        role: 'account_director',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const manager1 = {
        _id: new ObjectId(),
        email: 'manager1@example.com',
        name: 'Manager 1',
        role: 'account_manager',
        managerId: director._id.toString(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const manager2 = {
        _id: new ObjectId(),
        email: 'manager2@example.com',
        name: 'Manager 2',
        role: 'account_manager',
        managerId: director._id.toString(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const trader = {
        _id: new ObjectId(),
        email: 'trader@example.com',
        name: 'Trader',
        role: 'media_trader',
        managerId: manager1._id.toString(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertMany([director, manager1, manager2, trader]);
      const hierarchy = await userModel.getHierarchy();

      expect(hierarchy).toHaveLength(1); // One top-level user (director)
      expect(hierarchy[0].name).toBe('Director');
      expect(hierarchy[0].subordinates).toHaveLength(2); // Two managers
      
      const managerWithTrader = hierarchy[0].subordinates?.find(s => s.name === 'Manager 1');
      expect(managerWithTrader?.subordinates).toHaveLength(1); // One trader
      expect(managerWithTrader?.subordinates?.[0].name).toBe('Trader');
    });

    test('should only include active users', async () => {
      const activeManager = {
        _id: new ObjectId(),
        email: 'active@example.com',
        name: 'Active Manager',
        role: 'account_manager',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const inactiveManager = {
        _id: new ObjectId(),
        email: 'inactive@example.com',
        name: 'Inactive Manager',
        role: 'account_manager',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertMany([activeManager, inactiveManager]);
      const hierarchy = await userModel.getHierarchy();

      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].name).toBe('Active Manager');
    });
  });
});