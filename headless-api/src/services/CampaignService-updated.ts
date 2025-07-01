import { BigNumber } from 'bignumber.js';
import { Decimal128 } from 'mongodb';
import { CampaignModel } from '../models/Campaign';
import { CalculationEngine } from '../calculations/calculation-engine';
import { Campaign, CreateCampaignRequest, UpdateCampaignRequest } from '@bravo-1/shared';

export interface BulkResult {
  inserted: number;
  updated: number;
  failed: Array<{
    index: number;
    error: string;
    data?: any;
  }>;
  calculationVersion: string;
}

export interface BulkOptions {
  validateAll?: boolean;
  stopOnError?: boolean;
  applyCalculations?: boolean;
  returnFailedRecords?: boolean;
}

export interface CalculatedField {
  value: Decimal128 | number;
  calculationVersion: string;
  calculatedAt: Date;
  context: string;
  formula?: string;
  precision?: number;
  isStored?: boolean; // vs dynamic
}

export interface CalculatedFields {
  [key: string]: CalculatedField;
}

export class CampaignService {
  private campaignModel: CampaignModel;
  private calculationEngine: CalculationEngine;

  constructor() {
    this.campaignModel = new CampaignModel();
    this.calculationEngine = new CalculationEngine();
  }

  /**
   * Create a single campaign with calculations applied
   */
  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    const calculatedData = await this.applyCalculations(data);
    return await this.campaignModel.create(calculatedData);
  }

  /**
   * Update a campaign with calculations applied
   */
  async updateCampaign(id: string, data: UpdateCampaignRequest): Promise<Campaign | null> {
    const calculatedData = await this.applyCalculations(data);
    return await this.campaignModel.update(id, calculatedData);
  }

  /**
   * Bulk create campaigns
   */
  async bulkCreate(
    campaigns: CreateCampaignRequest[],
    options: BulkOptions = {}
  ): Promise<BulkResult> {
    const {
      validateAll = true,
      stopOnError = false,
      applyCalculations = true,
      returnFailedRecords = true,
    } = options;

    const result: BulkResult = {
      inserted: 0,
      updated: 0,
      failed: [],
      calculationVersion: this.calculationEngine.getVersion().version,
    };

    // Process in batches for better performance
    const BATCH_SIZE = 100;
    const batches = this.createBatches(campaigns, BATCH_SIZE);

    for (const [batchIndex, batch] of batches.entries()) {
      try {
        // Validate batch if required
        if (validateAll) {
          const validationErrors = await this.validateBatch(batch, batchIndex * BATCH_SIZE);
          if (validationErrors.length > 0) {
            result.failed.push(...validationErrors);
            if (stopOnError) {
              break;
            }
            continue;
          }
        }

        // Apply calculations if required
        const processedBatch = applyCalculations
          ? await Promise.all(batch.map((campaign) => this.applyCalculations(campaign)))
          : batch;

        // Perform bulk insert
        const insertResult = await this.campaignModel.bulkInsert(processedBatch);
        result.inserted += insertResult.insertedCount;
      } catch (error) {
        const batchError = {
          index: batchIndex * BATCH_SIZE,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: returnFailedRecords ? batch : undefined,
        };
        result.failed.push(batchError);

        if (stopOnError) {
          break;
        }
      }
    }

    return result;
  }

  /**
   * Bulk update campaigns
   */
  async bulkUpdate(
    updates: Array<{ id: string; data: UpdateCampaignRequest }>,
    options: BulkOptions = {}
  ): Promise<BulkResult> {
    const {
      validateAll = true,
      stopOnError = false,
      applyCalculations = true,
      returnFailedRecords = true,
    } = options;

    const result: BulkResult = {
      inserted: 0,
      updated: 0,
      failed: [],
      calculationVersion: this.calculationEngine.getVersion().version,
    };

    for (const [index, update] of updates.entries()) {
      try {
        // Apply calculations if required
        const processedData = applyCalculations
          ? await this.applyCalculations(update.data)
          : update.data;

        const updated = await this.campaignModel.update(update.id, processedData);
        if (updated) {
          result.updated++;
        } else {
          result.failed.push({
            index,
            error: 'Campaign not found',
            data: returnFailedRecords ? update : undefined,
          });
        }
      } catch (error) {
        result.failed.push({
          index,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: returnFailedRecords ? update : undefined,
        });

        if (stopOnError) {
          break;
        }
      }
    }

    return result;
  }

  /**
   * Bulk upsert campaigns
   */
  async bulkUpsert(
    campaigns: Array<CreateCampaignRequest & { _id?: string }>,
    options: BulkOptions = {}
  ): Promise<BulkResult> {
    const toCreate: CreateCampaignRequest[] = [];
    const toUpdate: Array<{ id: string; data: UpdateCampaignRequest }> = [];

    // Separate creates and updates
    for (const campaign of campaigns) {
      if (campaign._id) {
        const { _id, ...data } = campaign;
        toUpdate.push({ id: _id, data });
      } else {
        toCreate.push(campaign);
      }
    }

    // Perform operations
    const createResult =
      toCreate.length > 0
        ? await this.bulkCreate(toCreate, options)
        : {
            inserted: 0,
            updated: 0,
            failed: [],
            calculationVersion: this.calculationEngine.getVersion().version,
          };

    const updateResult =
      toUpdate.length > 0
        ? await this.bulkUpdate(toUpdate, options)
        : {
            inserted: 0,
            updated: 0,
            failed: [],
            calculationVersion: this.calculationEngine.getVersion().version,
          };

    // Combine results
    return {
      inserted: createResult.inserted,
      updated: updateResult.updated,
      failed: [...createResult.failed, ...updateResult.failed],
      calculationVersion: this.calculationEngine.getVersion().version,
    };
  }

  /**
   * Apply calculations to campaign data
   * UPDATED: Now handles both budget (legacy) and price (new) fields
   */
  private async applyCalculations(data: any): Promise<any> {
    const calculated = { ...data };
    const calculatedFields: CalculatedFields = {};

    // TRANSITION LOGIC: Support both budget and price fields
    // Check for budget field (legacy from ETL) and map to price if needed
    if (data.budget && !data.price) {
      // Map budget to price structure
      calculated.price = {
        targetAmount: data.budget.total || data.budget.targetAmount,
        actualAmount: data.budget.spent || data.budget.actualAmount || 0,
        remainingAmount: data.budget.remaining || data.budget.remainingAmount,
        currency: data.budget.currency || 'USD',
        unitType: 'dollars',
      };
    }

    // If price exists, also maintain budget for backward compatibility
    if (data.price) {
      calculated.budget = {
        total: data.price.targetAmount,
        allocated: data.price.targetAmount, // Assume fully allocated for now
        spent: data.price.actualAmount || 0,
        remaining: data.price.remainingAmount || data.price.targetAmount,
        currency: data.price.currency || 'USD',
      };
    }

    // Calculate fields based on price (preferred) or budget (fallback)
    const priceData = calculated.price || calculated.budget;

    if (priceData) {
      const targetAmount = priceData.targetAmount || priceData.total;
      const actualAmount = priceData.actualAmount || priceData.spent || 0;

      if (targetAmount !== undefined && actualAmount !== undefined) {
        const targetBN = new BigNumber(targetAmount);
        const actualBN = new BigNumber(actualAmount);

        // Calculate spend percentage
        const spendResult = this.calculationEngine.calculate(
          'marginPercentage',
          actualBN,
          targetBN
        );

        const spendForStorage = this.calculationEngine.withPrecision(spendResult, 'storage');

        calculatedFields.spendPercentage = {
          value: Decimal128.fromString(spendForStorage.formattedValue.toString()),
          calculationVersion: spendResult.calculationVersion,
          calculatedAt: spendResult.calculatedAt,
          context: 'campaign_price',
          formula: spendResult.formula,
          precision: spendForStorage.precision,
          isStored: true,
        };

        // Calculate remaining percentage
        const remainingBN = targetBN.minus(actualBN);
        const remainingResult = this.calculationEngine.calculate(
          'marginPercentage',
          remainingBN,
          targetBN
        );

        const remainingForStorage = this.calculationEngine.withPrecision(
          remainingResult,
          'storage'
        );

        calculatedFields.remainingPercentage = {
          value: Decimal128.fromString(remainingForStorage.formattedValue.toString()),
          calculationVersion: remainingResult.calculationVersion,
          calculatedAt: remainingResult.calculatedAt,
          context: 'campaign_price',
          formula: remainingResult.formula,
          precision: remainingForStorage.precision,
          isStored: true,
        };
      }
    }

    // Handle metrics calculations with units instead of impressions
    if (data.metrics) {
      // Map impressions to units if needed (backward compatibility)
      if (data.metrics.impressions !== undefined && data.metrics.units === undefined) {
        calculated.metrics.units = data.metrics.impressions;
        calculated.metrics.unitType = 'impressions';
        delete calculated.metrics.impressions;
      }

      // Calculate margin fields if revenue and cost are available
      if (data.revenue && data.cost) {
        const revenueBN = new BigNumber(data.revenue);
        const costBN = new BigNumber(data.cost);

        // Calculate margin amount
        const marginAmountResult = this.calculationEngine.calculate(
          'marginAmount',
          revenueBN,
          costBN
        );

        const marginAmountForStorage = this.calculationEngine.withPrecision(
          marginAmountResult,
          'storage'
        );

        calculated.metrics.marginAmount = Decimal128.fromString(
          marginAmountForStorage.formattedValue.toString()
        );

        // Calculate margin percentage
        const marginPercentResult = this.calculationEngine.calculate(
          'marginPercentage',
          revenueBN,
          costBN
        );

        const marginPercentForStorage = this.calculationEngine.withPrecision(
          marginPercentResult,
          'storage'
        );

        calculated.metrics.marginPercentage = parseFloat(
          marginPercentForStorage.formattedValue.toString()
        );

        // Store in calculated fields with metadata
        calculatedFields.marginAmount = {
          value: calculated.metrics.marginAmount,
          calculationVersion: marginAmountResult.calculationVersion,
          calculatedAt: marginAmountResult.calculatedAt,
          context: 'campaign_metrics',
          formula: marginAmountResult.formula,
          isStored: true,
        };

        calculatedFields.marginPercentage = {
          value: calculated.metrics.marginPercentage,
          calculationVersion: marginPercentResult.calculationVersion,
          calculatedAt: marginPercentResult.calculatedAt,
          context: 'campaign_metrics',
          formula: marginPercentResult.formula,
          isStored: true,
        };
      }

      // Remove deprecated fields
      delete calculated.metrics.ctr;
      delete calculated.metrics.cvr;
      delete calculated.metrics.conversions;
    }

    // Add calculated fields metadata
    calculated.calculatedFields = calculatedFields;
    calculated.calculatedAt = new Date();
    calculated.calculationVersion = this.calculationEngine.getVersion().version;

    return calculated;
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Validate a batch of campaigns
   */
  private async validateBatch(
    campaigns: CreateCampaignRequest[],
    startIndex: number
  ): Promise<Array<{ index: number; error: string; data?: any }>> {
    const errors: Array<{ index: number; error: string; data?: any }> = [];

    for (const [i, campaign] of campaigns.entries()) {
      try {
        // Basic validation
        if (!campaign.name) {
          errors.push({
            index: startIndex + i,
            error: 'Campaign name is required',
            data: campaign,
          });
        }

        // Date validation
        if (!campaign.dates?.start || !campaign.dates?.end) {
          errors.push({
            index: startIndex + i,
            error: 'Campaign start and end dates are required',
            data: campaign,
          });
        }

        // Price validation
        if (!campaign.price?.targetAmount) {
          errors.push({
            index: startIndex + i,
            error: 'Campaign price or budget is required',
            data: campaign,
          });
        }

        // Add more validation as needed
      } catch (error) {
        errors.push({
          index: startIndex + i,
          error: error instanceof Error ? error.message : 'Validation error',
          data: campaign,
        });
      }
    }

    return errors;
  }

  /**
   * Get all campaigns
   */
  async getAllCampaigns(): Promise<Campaign[]> {
    return await this.campaignModel.getAll();
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(id: string): Promise<Campaign | null> {
    return await this.campaignModel.getById(id);
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(id: string): Promise<boolean> {
    return await this.campaignModel.delete(id);
  }
}
