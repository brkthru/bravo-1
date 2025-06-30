import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { CampaignService } from '../services/CampaignService';
import { UserService } from '../services/UserService';
import { AccountService } from '../services/AccountService';
import { ApiResponse } from '@bravo-1/shared';

const router = Router();

interface ETLImportRequest {
  entity:
    | 'campaigns'
    | 'users'
    | 'accounts'
    | 'strategies'
    | 'lineItems'
    | 'platformBuys'
    | 'mediaPlans';
  data: any[];
  options?: {
    validateAll?: boolean;
    stopOnError?: boolean;
    applyCalculations?: boolean;
    returnFailedRecords?: boolean;
    clearExisting?: boolean;
  };
}

interface ETLImportResponse {
  entity: string;
  inserted: number;
  updated: number;
  failed: number;
  duration: number;
  calculationVersion?: string;
  errors?: Array<{
    index: number;
    error: string;
    data?: any;
  }>;
}

// POST /api/etl/import - Import data through ETL process
router.post(
  '/import',
  async (req: Request<{}, {}, ETLImportRequest>, res: Response<ApiResponse<ETLImportResponse>>) => {
    const startTime = Date.now();

    try {
      const { entity, data, options } = req.body;

      // Validate request
      const validEntities = [
        'campaigns',
        'users',
        'accounts',
        'strategies',
        'lineItems',
        'platformBuys',
        'mediaPlans',
      ];
      if (!entity || !validEntities.includes(entity)) {
        return res.status(400).json({
          success: false,
          error: `Invalid entity. Must be one of: ${validEntities.join(', ')}`,
        });
      }

      if (!Array.isArray(data)) {
        return res.status(400).json({
          success: false,
          error: 'Data must be an array',
        });
      }

      if (data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Data array cannot be empty',
        });
      }

      // Log ETL operation
      console.log(`ETL Import: ${entity} - ${data.length} records`);

      let result;

      switch (entity) {
        case 'campaigns': {
          const campaignService = new CampaignService();
          result = await campaignService.bulkUpsert(data, {
            validateAll: options?.validateAll ?? true,
            stopOnError: options?.stopOnError ?? false,
            applyCalculations: options?.applyCalculations ?? true,
            returnFailedRecords: options?.returnFailedRecords ?? false,
          });
          break;
        }

        case 'users': {
          const userService = new UserService();
          result = await userService.bulkUpsert(data, {
            validateAll: options?.validateAll ?? true,
            stopOnError: options?.stopOnError ?? false,
            returnFailedRecords: options?.returnFailedRecords ?? false,
          });
          break;
        }

        case 'accounts': {
          const accountService = new AccountService();
          result = await accountService.bulkUpsert(data, {
            validateAll: options?.validateAll ?? true,
            stopOnError: options?.stopOnError ?? false,
            returnFailedRecords: options?.returnFailedRecords ?? false,
          });
          break;
        }

        case 'strategies':
        case 'lineItems':
        case 'platformBuys':
        case 'mediaPlans':
          // These entities require their own services or can be handled through generic collection operations
          // For now, we'll use a generic approach
          const { database } = require('../config/database');
          const db = database.getDb();
          const collectionName =
            entity === 'lineItems'
              ? 'lineItems'
              : entity === 'platformBuys'
                ? 'platformBuys'
                : entity === 'mediaPlans'
                  ? 'mediaPlans'
                  : entity;

          const collection = db.collection(collectionName);
          result = { inserted: 0, updated: 0, failed: [] };

          for (let i = 0; i < data.length; i++) {
            try {
              // Handle ObjectId - could be string or {$oid: string} format
              let id;
              if (data[i]._id) {
                if (typeof data[i]._id === 'string') {
                  id = new ObjectId(data[i]._id);
                } else if (data[i]._id.$oid) {
                  id = new ObjectId(data[i]._id.$oid);
                } else {
                  id = data[i]._id;
                }
              } else {
                id = new ObjectId();
              }

              const doc = {
                ...data[i],
                _id: id,
                createdAt: data[i].createdAt ? new Date(data[i].createdAt) : new Date(),
                updatedAt: data[i].updatedAt ? new Date(data[i].updatedAt) : new Date(),
              };

              await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });

              result.inserted++;
            } catch (error) {
              result.failed.push({
                index: i,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: options?.returnFailedRecords ? data[i] : undefined,
              });

              if (options?.stopOnError) {
                throw error;
              }
            }
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid entity',
          });
      }

      const duration = Date.now() - startTime;

      const response: ETLImportResponse = {
        entity,
        inserted: result.inserted,
        updated: result.updated || 0,
        failed: result.failed.length,
        duration,
        calculationVersion: result.calculationVersion,
        errors: options?.returnFailedRecords ? result.failed : undefined,
      };

      console.log(
        `ETL Import completed: ${entity} - Inserted: ${response.inserted}, Updated: ${response.updated}, Failed: ${response.failed}, Duration: ${duration}ms`
      );

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('ETL Import error:', error);

      res.status(500).json({
        success: false,
        error: 'ETL import failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        data: {
          entity: req.body.entity,
          inserted: 0,
          updated: 0,
          failed: req.body.data?.length || 0,
          duration,
        },
      });
    }
  }
);

// GET /api/etl/status - Get ETL system status
router.get('/status', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const campaignService = new CampaignService();
    const calculationVersion = campaignService['calculationEngine'].getVersion().version;

    res.json({
      success: true,
      data: {
        status: 'operational',
        calculationVersion,
        supportedEntities: [
          'campaigns',
          'users',
          'accounts',
          'strategies',
          'lineItems',
          'platformBuys',
          'mediaPlans',
        ],
        maxBatchSize: 1000,
        features: {
          calculations: true,
          validation: true,
          bulkOperations: true,
          upsert: true,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get ETL status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
