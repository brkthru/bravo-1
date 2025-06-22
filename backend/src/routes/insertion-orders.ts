import { Router, Request, Response } from 'express';
import { Collection, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { z } from 'zod';

const router = Router();

const InsertionOrderStatusSchema = z.enum(['draft', 'pending', 'approved', 'rejected', 'active', 'closed']);

const InsertionOrderCreateSchema = z.object({
  campaign_id: z.string(),
  insertion_order_number: z.string(),
  status: InsertionOrderStatusSchema.optional(),
  artifact_uris: z.array(z.string()).optional(),
});

// Get collection
function getInsertionOrdersCollection(): Collection {
  return database.getDb().collection('insertionOrders');
}

// GET /insertion-orders
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, campaignId } = req.query;
    const collection = getInsertionOrdersCollection();
    
    const query: any = {};
    
    if (campaignId) {
      query.campaign_id = campaignId;
    }

    const insertionOrders = await collection
      .find(query)
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();

    const transformed = insertionOrders.map(doc => ({
      campaign_id: doc.campaign_id,
      request_id: doc.request_id || doc._id.toString(),
      created_at: doc.created_at || doc.createdAt,
      updated_at: doc.updated_at || doc.updatedAt,
      insertion_order_number: doc.insertion_order_number,
      status: doc.status || 'draft',
      artifact_uris: doc.artifact_uris || [],
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Error fetching insertion orders:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// POST /insertion-orders
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = InsertionOrderCreateSchema.parse(req.body);
    const collection = getInsertionOrdersCollection();
    
    const now = new Date();
    const requestId = new ObjectId();

    const insertionOrder = {
      _id: new ObjectId(),
      campaign_id: body.campaign_id,
      request_id: requestId.toString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      insertion_order_number: body.insertion_order_number,
      status: body.status || 'draft',
      artifact_uris: body.artifact_uris || [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(insertionOrder);
    
    if (!result.acknowledged) {
      throw new Error('Failed to create insertion order');
    }

    res.status(201).json({
      campaign_id: insertionOrder.campaign_id,
      request_id: insertionOrder.request_id,
      created_at: insertionOrder.created_at,
      updated_at: insertionOrder.updated_at,
      insertion_order_number: insertionOrder.insertion_order_number,
      status: insertionOrder.status,
      artifact_uris: insertionOrder.artifact_uris,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input provided',
        errors: error.errors 
      });
    }
    console.error('Error creating insertion order:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// GET /insertion-orders/:insertionOrderNumber
router.get('/:insertionOrderNumber', async (req: Request, res: Response) => {
  try {
    const { insertionOrderNumber } = req.params;
    const collection = getInsertionOrdersCollection();
    
    const insertionOrder = await collection.findOne({
      insertion_order_number: insertionOrderNumber
    });

    if (!insertionOrder) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    res.json({
      campaign_id: insertionOrder.campaign_id,
      request_id: insertionOrder.request_id || insertionOrder._id.toString(),
      created_at: insertionOrder.created_at || insertionOrder.createdAt,
      updated_at: insertionOrder.updated_at || insertionOrder.updatedAt,
      insertion_order_number: insertionOrder.insertion_order_number,
      status: insertionOrder.status || 'draft',
      artifact_uris: insertionOrder.artifact_uris || [],
    });
  } catch (error) {
    console.error('Error fetching insertion order:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// PATCH /insertion-orders/:insertionOrderNumber
router.patch('/:insertionOrderNumber', async (req: Request, res: Response) => {
  try {
    const { insertionOrderNumber } = req.params;
    const collection = getInsertionOrdersCollection();
    
    const updates: any = {
      updated_at: new Date().toISOString(),
      updatedAt: new Date(),
    };

    if (req.body.status) {
      updates.status = req.body.status;
    }
    if (req.body.artifact_uris) {
      updates.artifact_uris = req.body.artifact_uris;
    }

    const result = await collection.findOneAndUpdate(
      { insertion_order_number: insertionOrderNumber },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    res.json({
      campaign_id: result.campaign_id,
      request_id: result.request_id || result._id.toString(),
      created_at: result.created_at || result.createdAt,
      updated_at: result.updated_at || result.updatedAt,
      insertion_order_number: result.insertion_order_number,
      status: result.status || 'draft',
      artifact_uris: result.artifact_uris || [],
    });
  } catch (error) {
    console.error('Error updating insertion order:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// DELETE /insertion-orders/:insertionOrderNumber
router.delete('/:insertionOrderNumber', async (req: Request, res: Response) => {
  try {
    const { insertionOrderNumber } = req.params;
    const collection = getInsertionOrdersCollection();
    
    const result = await collection.deleteOne({
      insertion_order_number: insertionOrderNumber
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting insertion order:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

export default router;