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
  roundingMode?: string;
  isStored?: boolean;
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
   * CLEAN VERSION: Only uses new field names
   */
  private async applyCalculations(data: any): Promise<any> {
    const calculated = { ...data };
    const calculatedFields: CalculatedFields = {};

    // Calculate fields based on price
    if (data.price) {
      const targetAmount = data.price.targetAmount;
      const actualAmount = data.price.actualAmount || 0;

      if (targetAmount !== undefined && actualAmount !== undefined) {
        const targetBN = new BigNumber(targetAmount);
        const actualBN = new BigNumber(actualAmount);

        // Calculate spend percentage
        if (targetBN.isGreaterThan(0)) {
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
            roundingMode: spendForStorage.roundingMode,
            isStored: true,
          };

          // Calculate remaining amount if not provided
          if (data.price.remainingAmount === undefined) {
            calculated.price.remainingAmount = targetBN.minus(actualBN).toNumber();
          }

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
            roundingMode: remainingForStorage.roundingMode,
            isStored: true,
          };
        }
      }
    }

    // Calculate media budget fields
    if (data.mediaBudget) {
      const targetAmount = data.mediaBudget.targetAmount;
      const actualSpend = data.mediaBudget.actualSpend || 0;

      if (targetAmount !== undefined && actualSpend !== undefined) {
        const targetBN = new BigNumber(targetAmount);
        const spendBN = new BigNumber(actualSpend);

        // Calculate remaining if not provided
        if (data.mediaBudget.remainingAmount === undefined) {
          calculated.mediaBudget.remainingAmount = targetBN.minus(spendBN).toNumber();
        }

        // Calculate spend percentage
        if (targetBN.isGreaterThan(0)) {
          const percentSpent = spendBN.dividedBy(targetBN).multipliedBy(100);
          calculated.mediaBudget.percentSpent = percentSpent.toNumber();
          calculated.mediaBudget.percentRemaining = targetBN
            .minus(spendBN)
            .dividedBy(targetBN)
            .multipliedBy(100)
            .toNumber();
        }
      }
    }

    // Handle metrics calculations
    if (data.metrics) {
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

      // Calculate CPM if units and spend are available
      if (data.metrics.units && data.mediaBudget?.actualSpend) {
        const units = new BigNumber(data.metrics.units);
        const spend = new BigNumber(data.mediaBudget.actualSpend);

        if (units.isGreaterThan(0)) {
          const cpm = spend.dividedBy(units).multipliedBy(1000);
          calculated.metrics.cpm = Decimal128.fromString(cpm.toString());
        }
      }

      // Calculate CPC if clicks and spend are available
      if (data.metrics.clicks && data.mediaBudget?.actualSpend) {
        const clicks = new BigNumber(data.metrics.clicks);
        const spend = new BigNumber(data.mediaBudget.actualSpend);

        if (clicks.isGreaterThan(0)) {
          const cpc = spend.dividedBy(clicks);
          calculated.metrics.cpc = Decimal128.fromString(cpc.toString());
        }
      }
    }

    // Calculate date-based fields
    if (data.dates?.start && data.dates?.end) {
      const start = new Date(data.dates.start);
      const end = new Date(data.dates.end);
      const now = new Date();

      // Total days
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      calculated.dates.totalDays = totalDays;

      // Elapsed days
      if (now >= start) {
        const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        calculated.dates.elapsedDays = Math.min(elapsedDays, totalDays);
        calculated.dates.remainingDays = Math.max(0, totalDays - elapsedDays);

        // Percentages
        calculated.dates.percentComplete = (calculated.dates.elapsedDays / totalDays) * 100;
        calculated.dates.percentRemaining = (calculated.dates.remainingDays / totalDays) * 100;
      } else {
        calculated.dates.elapsedDays = 0;
        calculated.dates.remainingDays = totalDays;
        calculated.dates.percentComplete = 0;
        calculated.dates.percentRemaining = 100;
      }
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

        if (!campaign.campaignNumber) {
          errors.push({
            index: startIndex + i,
            error: 'Campaign number is required',
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
            error: 'Campaign price target amount is required',
            data: campaign,
          });
        }

        // Date logic validation
        if (campaign.dates?.start && campaign.dates?.end) {
          const start = new Date(campaign.dates.start);
          const end = new Date(campaign.dates.end);

          if (end <= start) {
            errors.push({
              index: startIndex + i,
              error: 'Campaign end date must be after start date',
              data: campaign,
            });
          }
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
