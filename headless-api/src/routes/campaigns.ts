import { Router, Request, Response } from 'express';
import { CampaignModel } from '../models/Campaign';
import { CampaignService, BulkOptions } from '../services/CampaignService';
import { ApiResponse, CreateCampaignRequest, UpdateCampaignRequest } from '@bravo-1/shared';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Campaign:
 *       type: object
 *       required:
 *         - name
 *         - campaignNumber
 *         - startDate
 *         - endDate
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB ObjectId
 *         name:
 *           type: string
 *           description: Campaign name
 *         campaignNumber:
 *           type: string
 *           description: Unique campaign identifier (e.g., CN-12345)
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         budget:
 *           type: object
 *           properties:
 *             total:
 *               type: string
 *               description: Total budget (Decimal128 stored as string)
 *             allocated:
 *               type: string
 *               description: Allocated budget
 *             spent:
 *               type: string
 *               description: Spent budget
 *             remaining:
 *               $ref: '#/components/schemas/CalculatedField'
 *         status:
 *           type: string
 *           enum: [draft, active, paused, completed, cancelled]
 *         team:
 *           type: object
 *           properties:
 *             owner:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *         metadata:
 *           type: object
 *           properties:
 *             createdAt:
 *               type: string
 *               format: date-time
 *             updatedAt:
 *               type: string
 *               format: date-time
 *             version:
 *               type: number
 *
 *     PaginatedCampaigns:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Campaign'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: number
 *             totalPages:
 *               type: number
 *             total:
 *               type: number
 *             limit:
 *               type: number
 */

/**
 * @swagger
 * /api/campaigns:
 *   get:
 *     summary: List all campaigns with pagination
 *     description: Retrieve a paginated list of campaigns with optional search filtering
 *     tags: [Campaigns]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter campaigns by name or campaign number
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedCampaigns'
 *       400:
 *         description: Invalid pagination parameters
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignModel = new CampaignModel();
    const { search, page, limit } = req.query;

    // Parse pagination parameters
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;

    // Validate pagination parameters
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
      });
    }

    const result = await campaignModel.findWithPagination(
      pageNum,
      limitNum,
      search as string | undefined
    );

    res.json({
      success: true,
      data: result.campaigns,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/campaigns/{id}:
 *   get:
 *     summary: Get a single campaign by ID
 *     description: Retrieve detailed information about a specific campaign
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the campaign
 *     responses:
 *       200:
 *         description: Campaign found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Campaign'
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignModel = new CampaignModel();
    const { id } = req.params;
    const campaign = await campaignModel.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /api/campaigns:
 *   post:
 *     summary: Create a new campaign
 *     description: Create a new campaign with calculated fields and validation
 *     tags: [Campaigns]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - campaignNumber
 *               - startDate
 *               - endDate
 *             properties:
 *               name:
 *                 type: string
 *               campaignNumber:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               budget:
 *                 type: object
 *                 properties:
 *                   total:
 *                     type: string
 *                   allocated:
 *                     type: string
 *                   spent:
 *                     type: string
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Campaign'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignService = new CampaignService();
    const campaignData: CreateCampaignRequest = req.body;

    // Basic validation
    if (!campaignData.name || !campaignData.campaignNumber) {
      return res.status(400).json({
        success: false,
        error: 'Name and campaign number are required',
      });
    }

    const campaign = await campaignService.createCampaign(campaignData);
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/campaigns/:id - Update campaign
router.put('/:id', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignService = new CampaignService();
    const { id } = req.params;
    const updates: UpdateCampaignRequest = req.body;

    const campaign = await campaignService.updateCampaign(id, updates);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete('/:id', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignModel = new CampaignModel();
    const { id } = req.params;
    const deleted = await campaignModel.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/campaigns/bulk - Bulk create campaigns
router.post('/bulk', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignService = new CampaignService();
    const { campaigns, options } = req.body;

    // Validate request
    if (!Array.isArray(campaigns)) {
      return res.status(400).json({
        success: false,
        error: 'Campaigns must be an array',
      });
    }

    if (campaigns.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campaigns array cannot be empty',
      });
    }

    if (campaigns.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Bulk operations limited to 1000 records',
      });
    }

    const result = await campaignService.bulkCreate(campaigns, options as BulkOptions);

    res.json({
      success: true,
      data: {
        inserted: result.inserted,
        failed: result.failed,
        calculationVersion: result.calculationVersion,
      },
    });
  } catch (error) {
    console.error('Error in bulk create:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk create campaigns',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/campaigns/bulk - Bulk update campaigns
router.put('/bulk', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignService = new CampaignService();
    const { updates, options } = req.body;

    // Validate request
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Updates must be an array',
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates array cannot be empty',
      });
    }

    if (updates.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Bulk operations limited to 1000 records',
      });
    }

    // Validate each update has id and data
    const invalidUpdates = updates.filter((u) => !u.id || !u.data);
    if (invalidUpdates.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Each update must have id and data properties',
      });
    }

    const result = await campaignService.bulkUpdate(updates, options as BulkOptions);

    res.json({
      success: true,
      data: {
        updated: result.updated,
        failed: result.failed,
        calculationVersion: result.calculationVersion,
      },
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update campaigns',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/campaigns/bulk/upsert - Bulk upsert campaigns
router.post('/bulk/upsert', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignService = new CampaignService();
    const { campaigns, options } = req.body;

    // Validate request
    if (!Array.isArray(campaigns)) {
      return res.status(400).json({
        success: false,
        error: 'Campaigns must be an array',
      });
    }

    if (campaigns.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campaigns array cannot be empty',
      });
    }

    if (campaigns.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Bulk operations limited to 1000 records',
      });
    }

    const result = await campaignService.bulkUpsert(campaigns, options as BulkOptions);

    res.json({
      success: true,
      data: {
        inserted: result.inserted,
        updated: result.updated,
        failed: result.failed,
        calculationVersion: result.calculationVersion,
      },
    });
  } catch (error) {
    console.error('Error in bulk upsert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk upsert campaigns',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
