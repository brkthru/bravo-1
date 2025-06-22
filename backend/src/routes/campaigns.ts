import { Router, Request, Response } from 'express';
import { CampaignModel } from '../models/Campaign';
import { ApiResponse, CreateCampaignRequest, UpdateCampaignRequest } from '@mediatool/shared';

const router = Router();

// GET /api/campaigns - List all campaigns with pagination
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
        error: 'Invalid pagination parameters'
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
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/campaigns/:id - Get single campaign
router.get('/:id', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignModel = new CampaignModel();
    const { id } = req.params;
    const campaign = await campaignModel.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/campaigns - Create new campaign
router.post('/', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignModel = new CampaignModel();
    const campaignData: CreateCampaignRequest = req.body;
    
    // Basic validation
    if (!campaignData.name || !campaignData.campaignNumber) {
      return res.status(400).json({
        success: false,
        error: 'Name and campaign number are required'
      });
    }

    const campaign = await campaignModel.create(campaignData);
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/campaigns/:id - Update campaign
router.put('/:id', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignModel = new CampaignModel();
    const { id } = req.params;
    const updates: UpdateCampaignRequest = req.body;

    const campaign = await campaignModel.update(id, updates);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
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
        error: 'Campaign not found'
      });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;