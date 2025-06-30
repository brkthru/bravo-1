import * as z from 'zod/v4';
import { ObjectIdSchema, NonEmptyStringSchema } from '../core/validation.schema';
import { DateSchema } from '../core/dates.schema';
import {
  DecimalStringSchema,
  FinancialAmountSchema,
  PercentageSchema,
} from '../core/financial.schema';

/**
 * Financial metadata for tracking precision settings
 * Based on ADR 0019 requirements
 */
export const FinancialMetadataSchema = z.object({
  value: DecimalStringSchema,
  precision: z.number().int().min(0).max(10).default(6),
  roundingMode: z.enum(['ROUND_HALF_UP', 'ROUND_DOWN', 'ROUND_UP']).default('ROUND_HALF_UP'),
  calculationVersion: z.string().default('1.0.0'),
});

/**
 * Campaign snapshot schema with financial precision preserved
 */
export const CampaignSnapshotSchema = z.object({
  _id: ObjectIdSchema,
  campaignNumber: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  accountId: ObjectIdSchema.optional(),
  accountName: z.string().optional(),
  status: z.string(),

  // Financial fields with metadata
  budget: z.object({
    total: FinancialMetadataSchema,
    allocated: FinancialMetadataSchema,
    spent: FinancialMetadataSchema,
    remaining: FinancialMetadataSchema,
  }),

  // Team information
  team: z
    .object({
      owner: z
        .object({
          id: z.string(),
          name: z.string(),
          email: z.string().email(),
        })
        .nullable(),
      leadAccountManager: z
        .object({
          id: z.string(),
          name: z.string(),
          email: z.string().email(),
        })
        .nullable(),
      mediaTrader: z
        .object({
          id: z.string(),
          name: z.string(),
          email: z.string().email(),
        })
        .nullable(),
    })
    .optional(),

  // Dates
  dates: z.object({
    start: DateSchema.optional(),
    end: DateSchema.optional(),
    created: DateSchema,
    updated: DateSchema,
  }),

  // Metrics snapshot
  metrics: z
    .object({
      lineItemCount: z.number().int(),
      strategyCount: z.number().int(),
      deliveryPacing: PercentageSchema.optional(),
      spendPacing: PercentageSchema.optional(),
      marginPercentage: PercentageSchema.optional(),
      marginAmount: FinancialMetadataSchema.optional(),
    })
    .optional(),
});

/**
 * Line item snapshot schema with financial precision
 */
export const LineItemSnapshotSchema = z.object({
  _id: ObjectIdSchema,
  campaignId: ObjectIdSchema,
  strategyId: ObjectIdSchema,
  name: NonEmptyStringSchema,

  // Financial fields
  price: FinancialMetadataSchema,
  unitPrice: FinancialMetadataSchema,
  mediaBudget: FinancialMetadataSchema.optional(),
  targetUnitCost: FinancialMetadataSchema.optional(),
  targetMargin: PercentageSchema,

  // Line item details
  unitType: z.string(),
  channel: z.string().optional(),
  tactic: z.string().optional(),
  estimatedUnits: z.number().optional(),

  // Dates
  dates: z.object({
    start: DateSchema.optional(),
    end: DateSchema.optional(),
  }),

  // Calculated metrics at time of snapshot
  actualUnitCost: FinancialMetadataSchema.optional(),
  actualMarginPercentage: PercentageSchema.optional(),
  actualMarginAmount: FinancialMetadataSchema.optional(),
});

/**
 * Media plan snapshot schema
 */
export const MediaPlanSnapshotSchema = z.object({
  _id: ObjectIdSchema,
  lineItemId: ObjectIdSchema,
  name: NonEmptyStringSchema,
  platform: z.string(),

  // Financial fields
  budget: FinancialMetadataSchema,
  plannedUnitCost: FinancialMetadataSchema,
  actualSpend: FinancialMetadataSchema.optional(),

  // Units
  plannedUnits: z.number(),
  deliveredUnits: z.number().optional(),

  // Status
  status: z.string(),
  platformBuyId: z.string().optional(),
});

/**
 * Media strategy snapshot schema
 */
export const MediaStrategySnapshotSchema = z.object({
  _id: ObjectIdSchema,
  campaignId: ObjectIdSchema,
  name: NonEmptyStringSchema,
  status: z.string(),

  // Aggregated financials
  totalBudget: FinancialMetadataSchema,
  totalAllocated: FinancialMetadataSchema,
  totalSpent: FinancialMetadataSchema,

  // Counts
  lineItemCount: z.number().int(),
  mediaPlanCount: z.number().int(),
});

/**
 * Platform buy snapshot schema
 */
export const PlatformBuySnapshotSchema = z.object({
  _id: ObjectIdSchema,
  mediaPlanId: ObjectIdSchema,
  platformBuyId: z.string(),
  platform: z.string(),

  // Financial fields
  budget: FinancialMetadataSchema,
  spend: FinancialMetadataSchema,

  // Performance
  impressions: z.number().optional(),
  clicks: z.number().optional(),
  conversions: z.number().optional(),

  // Calculated metrics
  cpm: FinancialMetadataSchema.optional(),
  cpc: FinancialMetadataSchema.optional(),
  cpa: FinancialMetadataSchema.optional(),
});

/**
 * Pacing schedule snapshot schema
 */
export const PacingScheduleSnapshotSchema = z.object({
  _id: ObjectIdSchema,
  entityId: ObjectIdSchema,
  entityType: z.enum(['campaign', 'line_item']),

  // Pacing details
  pacingType: z.enum(['even', 'front_loaded', 'back_loaded', 'custom']),
  dailyBudget: FinancialMetadataSchema,

  // Progress
  totalDays: z.number().int(),
  daysElapsed: z.number().int(),
  expectedSpend: FinancialMetadataSchema,
  actualSpend: FinancialMetadataSchema,

  // Pacing metrics
  spendPacing: PercentageSchema,
  deliveryPacing: PercentageSchema,
});

/**
 * Account snapshot schema
 */
export const AccountSnapshotSchema = z.object({
  _id: ObjectIdSchema,
  accountName: NonEmptyStringSchema,
  accountNumber: z.string().optional(),

  // Financial summary
  totalCampaignBudget: FinancialMetadataSchema,
  totalSpend: FinancialMetadataSchema,
  totalMargin: FinancialMetadataSchema,

  // Counts
  activeCampaigns: z.number().int(),
  totalCampaigns: z.number().int(),
});

/**
 * Discriminated union for all entity snapshots
 * Ensures type safety when storing version history
 */
export const EntitySnapshotSchema = z.discriminatedUnion('_type', [
  z.object({ _type: z.literal('campaign'), data: CampaignSnapshotSchema }),
  z.object({ _type: z.literal('media_strategy'), data: MediaStrategySnapshotSchema }),
  z.object({ _type: z.literal('line_item'), data: LineItemSnapshotSchema }),
  z.object({ _type: z.literal('media_plan'), data: MediaPlanSnapshotSchema }),
  z.object({ _type: z.literal('platform_buy'), data: PlatformBuySnapshotSchema }),
  z.object({ _type: z.literal('pacing_schedule'), data: PacingScheduleSnapshotSchema }),
  z.object({ _type: z.literal('account'), data: AccountSnapshotSchema }),
]);

// Export types
export type CampaignSnapshot = z.infer<typeof CampaignSnapshotSchema>;
export type LineItemSnapshot = z.infer<typeof LineItemSnapshotSchema>;
export type MediaPlanSnapshot = z.infer<typeof MediaPlanSnapshotSchema>;
export type MediaStrategySnapshot = z.infer<typeof MediaStrategySnapshotSchema>;
export type PlatformBuySnapshot = z.infer<typeof PlatformBuySnapshotSchema>;
export type PacingScheduleSnapshot = z.infer<typeof PacingScheduleSnapshotSchema>;
export type AccountSnapshot = z.infer<typeof AccountSnapshotSchema>;
export type EntitySnapshot = z.infer<typeof EntitySnapshotSchema>;
