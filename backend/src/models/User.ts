import { Collection, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { z } from 'zod';

// User Schema
export const UserRoleSchema = z.enum(['admin', 'account_director', 'account_manager', 'senior_account_manager', 'media_trader', 'senior_media_trader', 'viewer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  _id: z.string(),
  employeeId: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  managerId: z.string().optional(),
  department: z.string(),
  avatar: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
export type CreateUserRequest = Omit<User, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateUserRequest = Partial<Omit<User, '_id' | 'createdAt' | 'updatedAt'>>;

export class UserModel {
  private get collection(): Collection {
    return database.getDb().collection('users');
  }

  async findAll(filters?: {
    role?: UserRole;
    department?: string;
    managerId?: string;
    isActive?: boolean;
  }): Promise<User[]> {
    const query: any = {};
    
    if (filters?.role) query.role = filters.role;
    if (filters?.department) query.department = filters.department;
    if (filters?.managerId) query.managerId = filters.managerId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;

    const users = await this.collection.find(query).toArray();
    return users.map(this.transformFromMongo);
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.collection.findOne({ _id: new ObjectId(id) });
      return user ? this.transformFromMongo(user) : null;
    } catch (error) {
      // Invalid ObjectId format
      return null;
    }
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    const user = await this.collection.findOne({ employeeId });
    return user ? this.transformFromMongo(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.collection.findOne({ email });
    return user ? this.transformFromMongo(user) : null;
  }

  async create(userData: CreateUserRequest): Promise<User> {
    const now = new Date();
    const user = {
      ...userData,
      _id: new ObjectId(),
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(user);
    
    if (!result.acknowledged) {
      throw new Error('Failed to create user');
    }

    return this.transformFromMongo(user);
  }

  async update(id: string, updates: UpdateUserRequest): Promise<User | null> {
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

  async search(query: string): Promise<User[]> {
    const users = await this.collection.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { employeeId: { $regex: query, $options: 'i' } },
      ]
    }).toArray();

    return users.map(this.transformFromMongo);
  }

  async getHierarchy(): Promise<any> {
    const users = await this.findAll({ isActive: true });
    
    // Build hierarchy tree
    const userMap = new Map(users.map(u => [u.employeeId, u]));
    const hierarchy: any[] = [];

    users.forEach(user => {
      const userNode = {
        ...user,
        subordinates: [] as any[],
      };

      if (!user.managerId) {
        // Top-level user
        hierarchy.push(userNode);
      } else {
        // Find manager and add as subordinate
        const manager = users.find(u => u.employeeId === user.managerId);
        if (manager) {
          const managerNode = hierarchy.find(h => h._id === manager._id);
          if (managerNode) {
            managerNode.subordinates.push(userNode);
          }
        }
      }
    });

    return hierarchy;
  }

  // Transform MongoDB document to User type
  private transformFromMongo(doc: any): User {
    return {
      ...doc,
      _id: doc._id.toString(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // Create indexes for better performance
  async createIndexes(): Promise<void> {
    const indexes = [
      { index: { employeeId: 1 }, options: { unique: true, sparse: true } },
      { index: { email: 1 }, options: { unique: true } },
      { index: { managerId: 1 }, options: {} },
      { index: { role: 1 }, options: {} },
      { index: { department: 1 }, options: {} },
      { index: { name: 'text', email: 'text' }, options: {} },
      { index: { isActive: 1 }, options: {} },
      { index: { createdAt: -1 }, options: {} },
    ];

    for (const { index, options } of indexes) {
      try {
        await this.collection.createIndex(index, options);
      } catch (error: any) {
        if (error.code !== 86 && error.code !== 11000) { // Ignore IndexKeySpecsConflict and DuplicateKey
          throw error;
        }
      }
    }
  }
}