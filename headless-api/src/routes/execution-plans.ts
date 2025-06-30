import { Router, Request, Response } from 'express';
import { Collection, ObjectId } from 'mongodb';
import { database } from '../config/database';
import { z } from 'zod';

const router = Router();

// Get collection
function getCampaignsCollection(): Collection {
  return database.getDb().collection('campaigns');
}

function getMediaPlansCollection(): Collection {
  return database.getDb().collection('mediaPlans');
}

// GET /execution-plans
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, campaignId } = req.query;
    const collection = getCampaignsCollection();

    const query: any = {
      execution: { $exists: true },
      status: 'L1', // Active campaigns with execution plans
    };

    if (campaignId) {
      query._id = new ObjectId(campaignId as string);
    }

    const campaigns = await collection
      .find(query)
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();

    const executionPlans = campaigns.map((campaign) => ({
      campaign_id: campaign._id.toString(),
      created_at: campaign.execution?.created_at || campaign.createdAt,
      updated_at: campaign.execution?.updated_at || campaign.updatedAt,
      revision_number: campaign.execution?.revision_number || 1,
      io_number: campaign.execution?.io_number || '',
      price: campaign.budget?.total?.toString() || '0',
      start_date: campaign.dates?.start,
      end_date: campaign.dates?.end,
      line_items: campaign.strategy?.lineItems || [],
      media_plans: [],
    }));

    res.json(executionPlans);
  } catch (error) {
    console.error('Error fetching execution plans:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
    });
  }
});

// GET /execution-plans/:campaignId
router.get('/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const campaignsCollection = getCampaignsCollection();
    const mediaPlansCollection = getMediaPlansCollection();

    const campaign = await campaignsCollection.findOne({
      _id: new ObjectId(campaignId),
      execution: { $exists: true },
    });

    if (!campaign) {
      return res.status(404).json({
        message: 'Resource not found',
      });
    }

    // Get associated media plans
    const mediaPlans = await mediaPlansCollection.find({ campaignId: campaignId }).toArray();

    const executionPlan = {
      campaign_id: campaign._id.toString(),
      created_at: campaign.execution?.created_at || campaign.createdAt,
      updated_at: campaign.execution?.updated_at || campaign.updatedAt,
      revision_number: campaign.execution?.revision_number || 1,
      io_number: campaign.execution?.io_number || '',
      price: campaign.budget?.total?.toString() || '0',
      start_date: campaign.dates?.start,
      end_date: campaign.dates?.end,
      line_items: campaign.strategy?.lineItems || [],
      media_plans: mediaPlans.map((mp) => ({
        campaign_id: mp.campaignId,
        line_item_id: mp.lineItemId,
        media_plan_id: mp._id.toString(),
        created_at: mp.createdAt,
        updated_at: mp.updatedAt,
        name: mp.name,
        target_unit_cost: mp.targetUnitCost?.toString(),
        budget: mp.plannedSpend?.toString() || mp.budget?.toString(),
        platform_buy_id: mp.platformEntityId,
      })),
    };

    res.json(executionPlan);
  } catch (error) {
    console.error('Error fetching execution plan:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
    });
  }
});

// PATCH /execution-plans/:campaignId
router.patch('/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const collection = getCampaignsCollection();

    const updates: any = {
      updatedAt: new Date(),
      'execution.updated_at': new Date().toISOString(),
    };

    if (req.body.io_number) {
      updates['execution.io_number'] = req.body.io_number;
    }
    if (req.body.price) {
      updates['execution.price'] = req.body.price;
      updates['budget.total'] = parseFloat(req.body.price);
    }
    if (req.body.start_date) {
      updates['execution.start_date'] = req.body.start_date;
      updates['dates.start'] = new Date(req.body.start_date);
    }
    if (req.body.end_date) {
      updates['execution.end_date'] = req.body.end_date;
      updates['dates.end'] = new Date(req.body.end_date);
    }

    const result = await collection.findOneAndUpdate(
      {
        _id: new ObjectId(campaignId),
        execution: { $exists: true },
      },
      {
        $set: updates,
        $inc: { 'execution.revision_number': 1 },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        message: 'Resource not found',
      });
    }

    const mediaPlansCollection = getMediaPlansCollection();
    const mediaPlans = await mediaPlansCollection.find({ campaignId: campaignId }).toArray();

    const executionPlan = {
      campaign_id: result._id.toString(),
      created_at: result.execution?.created_at || result.createdAt,
      updated_at: result.execution?.updated_at || result.updatedAt,
      revision_number: result.execution?.revision_number || 1,
      io_number: result.execution?.io_number || '',
      price: result.budget?.total?.toString() || '0',
      start_date: result.dates?.start,
      end_date: result.dates?.end,
      line_items: result.strategy?.lineItems || [],
      media_plans: mediaPlans.map((mp) => ({
        campaign_id: mp.campaignId,
        line_item_id: mp.lineItemId,
        media_plan_id: mp._id.toString(),
        created_at: mp.createdAt,
        updated_at: mp.updatedAt,
        name: mp.name,
        target_unit_cost: mp.targetUnitCost?.toString(),
        budget: mp.plannedSpend?.toString() || mp.budget?.toString(),
        platform_buy_id: mp.platformEntityId,
      })),
    };

    res.json(executionPlan);
  } catch (error) {
    console.error('Error updating execution plan:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
    });
  }
});

// DELETE /execution-plans/:campaignId
router.delete('/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const collection = getCampaignsCollection();

    // Remove execution plan by updating campaign
    const result = await collection.findOneAndUpdate(
      {
        _id: new ObjectId(campaignId),
        execution: { $exists: true },
      },
      {
        $unset: { execution: '' },
        $set: {
          status: 'L2', // Set back to pending
          updatedAt: new Date(),
        },
      }
    );

    if (!result) {
      return res.status(404).json({
        message: 'Resource not found',
      });
    }

    // Also delete associated media plans
    const mediaPlansCollection = getMediaPlansCollection();
    await mediaPlansCollection.deleteMany({ campaignId: campaignId });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting execution plan:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
    });
  }
});

// POST /execution-plans/:campaignId/media-plans
router.post('/:campaignId/media-plans', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { line_item_id, budget, name, target_unit_cost, platform_buy_id } = req.body;

    if (!line_item_id || !budget) {
      return res.status(400).json({
        message: 'line_item_id and budget are required',
      });
    }

    const campaignsCollection = getCampaignsCollection();
    const mediaPlansCollection = getMediaPlansCollection();

    // Verify campaign exists with execution plan
    const campaign = await campaignsCollection.findOne({
      _id: new ObjectId(campaignId),
      execution: { $exists: true },
    });

    if (!campaign) {
      return res.status(404).json({
        message: 'Execution plan not found',
      });
    }

    // Create media plan
    const now = new Date();
    const mediaPlan = {
      _id: new ObjectId(),
      campaignId: campaignId,
      lineItemId: line_item_id,
      strategyId: campaign.strategy?.id,
      platformEntityId: platform_buy_id,
      name: name || `Media Plan ${now.toISOString().split('T')[0]}`,
      plannedSpend: parseFloat(budget),
      targetUnitCost: target_unit_cost ? parseFloat(target_unit_cost) : undefined,
      status: 'planned',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await mediaPlansCollection.insertOne(mediaPlan);

    if (!result.acknowledged) {
      throw new Error('Failed to create media plan');
    }

    res.status(201).json({
      campaign_id: campaignId,
      line_item_id: line_item_id,
      media_plan_id: mediaPlan._id.toString(),
      created_at: mediaPlan.createdAt.toISOString(),
      updated_at: mediaPlan.updatedAt.toISOString(),
      name: mediaPlan.name,
      target_unit_cost: mediaPlan.targetUnitCost?.toString(),
      budget: mediaPlan.plannedSpend.toString(),
      platform_buy_id: mediaPlan.platformEntityId,
    });
  } catch (error) {
    console.error('Error creating media plan:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
    });
  }
});

// PATCH /execution-plans/:campaignId/media-plans/:mediaPlanId
router.patch('/:campaignId/media-plans/:mediaPlanId', async (req: Request, res: Response) => {
  try {
    const { campaignId, mediaPlanId } = req.params;
    const mediaPlansCollection = getMediaPlansCollection();

    const updates: any = {
      updatedAt: new Date(),
    };

    if (req.body.name) updates.name = req.body.name;
    if (req.body.budget) updates.plannedSpend = parseFloat(req.body.budget);
    if (req.body.target_unit_cost) updates.targetUnitCost = parseFloat(req.body.target_unit_cost);
    if (req.body.platform_buy_id) updates.platformEntityId = req.body.platform_buy_id;

    const result = await mediaPlansCollection.findOneAndUpdate(
      {
        _id: new ObjectId(mediaPlanId),
        campaignId: campaignId,
      },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        message: 'Resource not found',
      });
    }

    res.json({
      campaign_id: result.campaignId,
      line_item_id: result.lineItemId,
      media_plan_id: result._id.toString(),
      created_at: result.createdAt.toISOString(),
      updated_at: result.updatedAt.toISOString(),
      name: result.name,
      target_unit_cost: result.targetUnitCost?.toString(),
      budget: result.plannedSpend.toString(),
      platform_buy_id: result.platformEntityId,
    });
  } catch (error) {
    console.error('Error updating media plan:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
    });
  }
});

// DELETE /execution-plans/:campaignId/media-plans/:mediaPlanId
router.delete('/:campaignId/media-plans/:mediaPlanId', async (req: Request, res: Response) => {
  try {
    const { campaignId, mediaPlanId } = req.params;
    const mediaPlansCollection = getMediaPlansCollection();

    const result = await mediaPlansCollection.deleteOne({
      _id: new ObjectId(mediaPlanId),
      campaignId: campaignId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: 'Resource not found',
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting media plan:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
    });
  }
});

export default router;
