import { Router, Request, Response } from 'express';
import { Collection, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { z } from 'zod';

const router = Router();

// Schemas matching OpenAPI spec
const ProposalStatusSchema = z.enum(['draft', 'ready']);
const LineItemPacingSchema = z.enum(['lifetime', 'monthly', 'custom']);

const ProposalCreateSchema = z.object({
  price: z.string().regex(/^\d+(\.\d{1,6})?$/),
  start_date: z.string(),
  end_date: z.string(),
  line_items: z.array(z.object({
    name: z.string(),
    description: z.string(),
    audience: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    price: z.string().regex(/^\d+(\.\d{1,6})?$/),
    target_margin: z.number().optional(),
    unit_price: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
    pacing_type: LineItemPacingSchema,
    pacing_details: z.any().nullable().optional(),
    media_trader_user_ids: z.array(z.string()),
    geo: z.string(),
    targeting: z.string(),
    media_platform_ids: z.array(z.number()).optional(),
    channel_id: z.number(),
    tactic_id: z.number(),
    unit_price_type_id: z.number(),
    ad_formats: z.string(),
  })).optional(),
});

// Get collection
function getProposalsCollection(): Collection {
  return database.getDb().collection('campaigns');
}

// GET /proposals
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    const collection = getProposalsCollection();
    
    const query: any = { 
      'strategy': { $exists: true },
      isActive: { $ne: false } 
    };
    
    if (status) {
      query['strategy.status'] = status;
    }

    const proposals = await collection
      .find(query)
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();

    // Transform to match OpenAPI spec
    const transformed = proposals.map(doc => ({
      id: doc.strategy?.id || doc._id.toString(),
      created_at: doc.createdAt || doc.strategy?.created_at,
      updated_at: doc.updatedAt || doc.strategy?.updated_at,
      revision_number: doc.strategy?.revision_number || 1,
      status: doc.strategy?.status || 'draft',
      price: doc.budget?.total?.toString() || '0',
      start_date: doc.dates?.start,
      end_date: doc.dates?.end,
      line_items: doc.strategy?.lineItems || [],
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// POST /proposals
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = ProposalCreateSchema.parse(req.body);
    const collection = getProposalsCollection();
    
    const now = new Date();
    const proposalId = new ObjectId();
    const strategyId = new ObjectId();

    const proposal = {
      _id: proposalId,
      campaignNumber: `PROP-${Date.now()}`,
      name: `Draft Proposal ${new Date().toISOString().split('T')[0]}`,
      status: 'L2' as const, // Proposal status
      strategy: {
        id: strategyId.toString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        revision_number: 1,
        status: 'draft' as const,
        price: body.price,
        start_date: body.start_date,
        end_date: body.end_date,
        lineItems: body.line_items?.map(item => ({
          _id: new ObjectId().toString(),
          ...item,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })) || [],
      },
      dates: {
        start: new Date(body.start_date),
        end: new Date(body.end_date),
      },
      budget: {
        total: parseFloat(body.price),
        allocated: parseFloat(body.price),
        spent: 0,
        remaining: parseFloat(body.price),
      },
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    const result = await collection.insertOne(proposal);
    
    if (!result.acknowledged) {
      throw new Error('Failed to create proposal');
    }

    res.status(201).json({
      id: strategyId.toString(),
      created_at: proposal.strategy.created_at,
      updated_at: proposal.strategy.updated_at,
      revision_number: proposal.strategy.revision_number,
      status: proposal.strategy.status,
      price: proposal.strategy.price,
      start_date: proposal.strategy.start_date,
      end_date: proposal.strategy.end_date,
      line_items: proposal.strategy.lineItems,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input provided',
        errors: error.errors 
      });
    }
    console.error('Error creating proposal:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// GET /proposals/:proposalId
router.get('/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    const proposal = await collection.findOne({
      $or: [
        { 'strategy.id': proposalId },
        { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
      ]
    });

    if (!proposal) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    res.json({
      id: proposal.strategy?.id || proposal._id.toString(),
      created_at: proposal.createdAt || proposal.strategy?.created_at,
      updated_at: proposal.updatedAt || proposal.strategy?.updated_at,
      revision_number: proposal.strategy?.revision_number || 1,
      status: proposal.strategy?.status || 'draft',
      price: proposal.budget?.total?.toString() || '0',
      start_date: proposal.dates?.start,
      end_date: proposal.dates?.end,
      line_items: proposal.strategy?.lineItems || [],
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// PATCH /proposals/:proposalId
router.patch('/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    const updates: any = {
      updatedAt: new Date(),
      'strategy.updated_at': new Date().toISOString(),
    };

    if (req.body.status) {
      updates['strategy.status'] = req.body.status;
    }
    if (req.body.price) {
      updates['strategy.price'] = req.body.price;
      updates['budget.total'] = parseFloat(req.body.price);
      updates['budget.allocated'] = parseFloat(req.body.price);
    }
    if (req.body.start_date) {
      updates['strategy.start_date'] = req.body.start_date;
      updates['dates.start'] = new Date(req.body.start_date);
    }
    if (req.body.end_date) {
      updates['strategy.end_date'] = req.body.end_date;
      updates['dates.end'] = new Date(req.body.end_date);
    }

    const result = await collection.findOneAndUpdate(
      {
        $or: [
          { 'strategy.id': proposalId },
          { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
        ]
      },
      { 
        $set: updates,
        $inc: { 'strategy.revision_number': 1 }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    res.json({
      id: result.strategy?.id || result._id.toString(),
      created_at: result.createdAt || result.strategy?.created_at,
      updated_at: result.updatedAt || result.strategy?.updated_at,
      revision_number: result.strategy?.revision_number || 1,
      status: result.strategy?.status || 'draft',
      price: result.budget?.total?.toString() || '0',
      start_date: result.dates?.start,
      end_date: result.dates?.end,
      line_items: result.strategy?.lineItems || [],
    });
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// DELETE /proposals/:proposalId
router.delete('/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    const result = await collection.deleteOne({
      $or: [
        { 'strategy.id': proposalId },
        { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
      ]
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// POST /proposals/:proposalId/commit
router.post('/:proposalId/commit', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    const result = await collection.findOneAndUpdate(
      {
        $or: [
          { 'strategy.id': proposalId },
          { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
        ],
        'strategy.status': 'draft'
      },
      { 
        $set: {
          'strategy.status': 'ready',
          'strategy.updated_at': new Date().toISOString(),
          updatedAt: new Date(),
        },
        $inc: { 'strategy.revision_number': 1 }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ 
        message: 'Resource not found or not in draft status' 
      });
    }

    res.json({
      id: result.strategy?.id || result._id.toString(),
      created_at: result.createdAt || result.strategy?.created_at,
      updated_at: result.updatedAt || result.strategy?.updated_at,
      revision_number: result.strategy?.revision_number || 1,
      status: result.strategy?.status,
      price: result.budget?.total?.toString() || '0',
      start_date: result.dates?.start,
      end_date: result.dates?.end,
      line_items: result.strategy?.lineItems || [],
    });
  } catch (error) {
    console.error('Error committing proposal:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// POST /proposals/:proposalId/revise
router.post('/:proposalId/revise', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    // Find the ready proposal
    const original = await collection.findOne({
      $or: [
        { 'strategy.id': proposalId },
        { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
      ],
      'strategy.status': 'ready'
    });

    if (!original) {
      return res.status(404).json({ 
        message: 'Resource not found or not in ready status' 
      });
    }

    // Create new draft revision
    const now = new Date();
    const newProposalId = new ObjectId();
    const newStrategyId = new ObjectId();

    const newProposal = {
      ...original,
      _id: newProposalId,
      campaignNumber: `${original.campaignNumber}-REV${Date.now()}`,
      name: `${original.name} (Revision)`,
      strategy: {
        ...original.strategy,
        id: newStrategyId.toString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        revision_number: (original.strategy?.revision_number || 1) + 1,
        status: 'draft' as const,
        parent_id: proposalId,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(newProposal);
    
    if (!result.acknowledged) {
      throw new Error('Failed to create revision');
    }

    res.status(201).json({
      id: newStrategyId.toString(),
      created_at: newProposal.strategy.created_at,
      updated_at: newProposal.strategy.updated_at,
      revision_number: newProposal.strategy.revision_number,
      status: newProposal.strategy.status,
      price: newProposal.strategy.price,
      start_date: newProposal.strategy.start_date,
      end_date: newProposal.strategy.end_date,
      line_items: newProposal.strategy.lineItems,
    });
  } catch (error) {
    console.error('Error revising proposal:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// POST /proposals/:proposalId/execute
router.post('/:proposalId/execute', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    // Find the ready proposal
    const proposal = await collection.findOne({
      $or: [
        { 'strategy.id': proposalId },
        { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
      ],
      'strategy.status': 'ready'
    });

    if (!proposal) {
      return res.status(404).json({ 
        message: 'Resource not found or not in ready status' 
      });
    }

    // Transform proposal to execution plan
    const executionPlan = {
      campaign_id: proposal._id.toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revision_number: 1,
      io_number: `IO-${Date.now()}`,
      price: proposal.strategy?.price || proposal.budget?.total?.toString(),
      start_date: proposal.strategy?.start_date || proposal.dates?.start,
      end_date: proposal.strategy?.end_date || proposal.dates?.end,
      line_items: proposal.strategy?.lineItems || [],
      media_plans: [],
    };

    // Update the campaign status to active
    await collection.updateOne(
      { _id: proposal._id },
      { 
        $set: {
          status: 'L1', // Active campaign
          'execution': executionPlan,
          updatedAt: new Date(),
        }
      }
    );

    res.status(201).json(executionPlan);
  } catch (error) {
    console.error('Error executing proposal:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// GET /proposals/:proposalId/line-items
router.get('/:proposalId/line-items', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    const proposal = await collection.findOne({
      $or: [
        { 'strategy.id': proposalId },
        { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
      ]
    });

    if (!proposal) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    const lineItems = proposal.strategy?.lineItems || [];
    res.json(lineItems);
  } catch (error) {
    console.error('Error fetching line items:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

// POST /proposals/:proposalId/line-items
router.post('/:proposalId/line-items', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const collection = getProposalsCollection();
    
    const lineItem = {
      line_item_id: new ObjectId().toString(),
      campaign_id: proposalId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...req.body,
    };

    const result = await collection.findOneAndUpdate(
      {
        $or: [
          { 'strategy.id': proposalId },
          { _id: ObjectId.isValid(proposalId) ? new ObjectId(proposalId) : null }
        ]
      },
      { 
        $push: { 'strategy.lineItems': lineItem },
        $set: {
          'strategy.updated_at': new Date().toISOString(),
          updatedAt: new Date(),
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ 
        message: 'Resource not found' 
      });
    }

    res.status(201).json(lineItem);
  } catch (error) {
    console.error('Error creating line item:', error);
    res.status(500).json({ 
      message: 'An unexpected error occurred' 
    });
  }
});

export default router;