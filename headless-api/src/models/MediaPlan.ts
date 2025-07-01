import { Collection, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { z } from 'zod';
import { UnitTypeSchema } from '@bravo-1/shared';

// Media Plan Schema
export const MediaPlanStatusSchema = z.enum(['planned', 'active', 'paused', 'completed']);
export type MediaPlanStatus = z.infer<typeof MediaPlanStatusSchema>;

export const MediaPlanSchema = z.object({
  _id: z.string(),
  lineItemId: z.string(),
  strategyId: z.string().optional(),
  campaignId: z.string(),
  platformEntityId: z.string(),
  name: z.string(),
  plannedSpend: z.number(),
  actualSpend: z.number().optional(),
  plannedUnits: z.number(),
  actualUnits: z.number().optional(),
  unitType: z.enum(['impressions', 'clicks', 'conversions', 'video_views', 'completed_video_views', 'engagements', 'leads']),
  targetUnitCost: z.number().optional(),
  startDate: z.date(),
  endDate: z.date(),
  status: MediaPlanStatusSchema,
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MediaPlan = z.infer<typeof MediaPlanSchema>;
export type CreateMediaPlanRequest = Omit<MediaPlan, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateMediaPlanRequest = Partial<Omit<MediaPlan, '_id' | 'createdAt' | 'updatedAt'>>;

export class MediaPlanModel {
  private get collection(): Collection {
    return database.getDb().collection('mediaPlans');
  }

  async findAll(filters?: {
    campaignId?: string;
    lineItemId?: string;
    platformEntityId?: string;
    status?: MediaPlanStatus;
    isActive?: boolean;
  }): Promise<MediaPlan[]> {
    const query: any = {};

    if (filters?.campaignId) query.campaignId = filters.campaignId;
    if (filters?.lineItemId) query.lineItemId = filters.lineItemId;
    if (filters?.platformEntityId) query.platformEntityId = filters.platformEntityId;
    if (filters?.status) query.status = filters.status;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;

    const mediaPlans = await this.collection.find(query).toArray();
    return mediaPlans.map(this.transformFromMongo);
  }

  async findById(id: string): Promise<MediaPlan | null> {
    const mediaPlan = await this.collection.findOne({ _id: new ObjectId(id) });
    return mediaPlan ? this.transformFromMongo(mediaPlan) : null;
  }

  async create(mediaPlanData: CreateMediaPlanRequest): Promise<MediaPlan> {
    const now = new Date();
    const mediaPlan = {
      ...mediaPlanData,
      _id: new ObjectId(),
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(mediaPlan);

    if (!result.acknowledged) {
      throw new Error('Failed to create media plan');
    }

    return this.transformFromMongo(mediaPlan);
  }

  async update(id: string, updates: UpdateMediaPlanRequest): Promise<MediaPlan | null> {
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
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  async checkOverlap(
    platformEntityId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string
  ): Promise<boolean> {
    const query: any = {
      platformEntityId,
      isActive: true,
      $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
    };

    if (excludeId) {
      query._id = { $ne: new ObjectId(excludeId) };
    }

    const overlap = await this.collection.findOne(query);
    return !!overlap;
  }

  // Transform MongoDB document to MediaPlan type
  private transformFromMongo(doc: any): MediaPlan {
    return {
      ...doc,
      _id: doc._id.toString(),
      startDate: doc.startDate,
      endDate: doc.endDate,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // Create indexes for better performance
  async createIndexes(): Promise<void> {
    const indexes = [
      { index: { campaignId: 1 }, options: {} },
      { index: { lineItemId: 1 }, options: {} },
      { index: { platformEntityId: 1 }, options: {} },
      { index: { status: 1 }, options: {} },
      { index: { startDate: 1, endDate: 1 }, options: {} },
      { index: { platformEntityId: 1, startDate: 1, endDate: 1 }, options: {} },
      { index: { createdAt: -1 }, options: {} },
    ] as const;

    for (const { index, options } of indexes) {
      try {
        await this.collection.createIndex(index, options);
      } catch (error: any) {
        if (error.code !== 86) {
          // Ignore IndexKeySpecsConflict
          throw error;
        }
      }
    }
  }
}
