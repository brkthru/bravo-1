import * as z from 'zod/v4';
import { StandardLineItemSchema, StandardLineItemInputSchema } from './line-item/standard.schema';
import {
  ManagementFeeLineItemSchema,
  ManagementFeeLineItemInputSchema,
} from './line-item/management-fee.schema';
import {
  ZeroDollarLineItemSchema,
  ZeroDollarLineItemInputSchema,
} from './line-item/zero-dollar.schema';
import {
  ZeroMarginLineItemSchema,
  ZeroMarginLineItemInputSchema,
} from './line-item/zero-margin.schema';
import { ObjectIdSchema } from '../core/validation.schema';
import { FinancialAmountSchema } from '../core/financial.schema';
import { DateSchema } from '../core/dates.schema';
import { LineItemStatusSchema } from './line-item/base.schema';

// Performance metrics schema (updated with units instead of impressions)
export const LineItemPerformanceSchema = z.object({
  // Changed from impressions to units
  units: z.number().int().default(0),
  unitType: z.enum(['impressions', 'clicks', 'views', 'conversions']).default('impressions'),

  // Keep clicks for now (commonly used)
  clicks: z.number().int().default(0),

  // Remove conversions as per feedback
  // conversions: z.number().int().default(0), // REMOVED

  // Calculated metrics
  cpm: FinancialAmountSchema.optional(),
  cpc: FinancialAmountSchema.optional(),
  cpa: FinancialAmountSchema.optional(),

  // Engagement metrics (for future use)
  videoViews: z.number().int().optional(),
  videoCompletes: z.number().int().optional(),
  engagements: z.number().int().optional(),
});

// Discriminated union for all line item types
export const LineItemEntitySchema = z.discriminatedUnion('type', [
  StandardLineItemSchema,
  ManagementFeeLineItemSchema,
  ZeroDollarLineItemSchema,
  ZeroMarginLineItemSchema,
]);

// Input discriminated union
export const LineItemInputSchema = z.discriminatedUnion('type', [
  StandardLineItemInputSchema,
  ManagementFeeLineItemInputSchema,
  ZeroDollarLineItemInputSchema,
  ZeroMarginLineItemInputSchema,
]);

// Update schema (partial of input)
export const LineItemUpdateSchema = z.union([
  StandardLineItemInputSchema.partial(),
  ManagementFeeLineItemInputSchema.partial(),
  ZeroDollarLineItemInputSchema.partial(),
  ZeroMarginLineItemInputSchema.partial(),
]);

// Line item list view (for grids/tables) - UPDATED
export const LineItemListItemSchema = z.object({
  _id: ObjectIdSchema,
  name: z.string(),
  type: z.enum(['standard', 'management_fee', 'zero_dollar', 'zero_margin']),
  campaignId: ObjectIdSchema,
  campaignName: z.string(), // Joined
  status: LineItemStatusSchema,
  platform: z.string().optional(),

  // Financial summary
  price: FinancialAmountSchema.optional(), // Only for standard and zero_margin
  mediaBudget: FinancialAmountSchema,
  netRevenue: FinancialAmountSchema.optional(),

  // Performance - UPDATED
  estimatedUnits: z.number(),
  actualUnitsDelivered: z.number().optional(),
  unitType: z.enum(['impressions', 'clicks', 'views', 'conversions']).default('impressions'),
  pacingPercentage: z.number().optional(),

  // Margin fields - SPLIT as per feedback
  marginAmount: FinancialAmountSchema.optional(),
  marginPercentage: z.number().optional(),

  // Dates
  startDate: DateSchema,
  endDate: DateSchema,
  updatedAt: DateSchema,

  // Performance summary
  performance: LineItemPerformanceSchema.optional(),
});

// Line item metrics (runtime calculations) - UPDATED
export const LineItemMetricsSchema = z.object({
  lineItemId: ObjectIdSchema,

  // Forward-looking (from entity)
  estimatedUnits: z.number(),
  mediaBudget: FinancialAmountSchema,

  // Backward-looking (runtime) - UPDATED
  actualUnitsDelivered: z.number(),
  unitType: z.enum(['impressions', 'clicks', 'views', 'conversions']).default('impressions'),
  actualSpend: FinancialAmountSchema,

  // Pacing (indexed at 100%)
  pacingPercentage: z.number(),
  pacingStatus: z.enum(['on_pace', 'ahead', 'behind', 'at_risk']),

  // Progress
  progressPercentage: z.number(),
  daysRemaining: z.number(),

  // Margin tracking - SPLIT
  marginAmount: FinancialAmountSchema.optional(),
  marginPercentage: z.number().optional(),

  // Performance details
  performance: LineItemPerformanceSchema,

  // Calculated at
  calculatedAt: DateSchema,
  calculationVersion: z.string().default('1.0'),
});

// Platform-specific line item schema (for platform buys)
export const PlatformLineItemSchema = z.object({
  _id: ObjectIdSchema,
  lineItemId: ObjectIdSchema,
  platformBuyId: ObjectIdSchema, // Changed from mediaBuyId
  platformName: z.string(),

  // Budget allocation
  budget: FinancialAmountSchema,
  spend: FinancialAmountSchema.optional(),

  // Performance metrics - UPDATED
  performance: LineItemPerformanceSchema,

  // Platform-specific IDs
  platformEntityId: z.string().optional(),
  platformCampaignId: z.string().optional(),
  platformAdSetId: z.string().optional(),

  // Status
  isActive: z.boolean().default(true),
  lastSyncDate: DateSchema.optional(),
});

// Types
export type LineItemEntity = z.infer<typeof LineItemEntitySchema>;
export type LineItemInput = z.infer<typeof LineItemInputSchema>;
export type LineItemUpdate = z.infer<typeof LineItemUpdateSchema>;
export type LineItemListItem = z.infer<typeof LineItemListItemSchema>;
export type LineItemMetrics = z.infer<typeof LineItemMetricsSchema>;
export type LineItemPerformance = z.infer<typeof LineItemPerformanceSchema>;
export type PlatformLineItem = z.infer<typeof PlatformLineItemSchema>;

// Type guards
export const isStandardLineItem = (
  item: LineItemEntity
): item is z.infer<typeof StandardLineItemSchema> => item.type === 'standard';

export const isManagementFeeLineItem = (
  item: LineItemEntity
): item is z.infer<typeof ManagementFeeLineItemSchema> => item.type === 'management_fee';

export const isZeroDollarLineItem = (
  item: LineItemEntity
): item is z.infer<typeof ZeroDollarLineItemSchema> => item.type === 'zero_dollar';

export const isZeroMarginLineItem = (
  item: LineItemEntity
): item is z.infer<typeof ZeroMarginLineItemSchema> => item.type === 'zero_margin';
