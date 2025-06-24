import * as z from 'zod/v4';
import { StandardLineItemSchema, StandardLineItemInputSchema } from './line-item/standard.schema';
import { ManagementFeeLineItemSchema, ManagementFeeLineItemInputSchema } from './line-item/management-fee.schema';
import { ZeroDollarLineItemSchema, ZeroDollarLineItemInputSchema } from './line-item/zero-dollar.schema';
import { ZeroMarginLineItemSchema, ZeroMarginLineItemInputSchema } from './line-item/zero-margin.schema';
import { ObjectIdSchema } from '../core/validation.schema';
import { FinancialAmountSchema } from '../core/financial.schema';
import { DateSchema } from '../core/dates.schema';
import { LineItemStatusSchema } from './line-item/base.schema';

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

// Line item list view (for grids/tables)
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
  
  // Performance
  estimatedUnits: z.number(),
  actualUnitsDelivered: z.number().optional(),
  pacingPercentage: z.number().optional(),
  
  // Dates
  startDate: DateSchema,
  endDate: DateSchema,
  updatedAt: DateSchema,
});

// Line item metrics (runtime calculations)
export const LineItemMetricsSchema = z.object({
  lineItemId: ObjectIdSchema,
  
  // Forward-looking (from entity)
  estimatedUnits: z.number(),
  mediaBudget: FinancialAmountSchema,
  
  // Backward-looking (runtime)
  actualUnitsDelivered: z.number(),
  actualSpend: FinancialAmountSchema,
  
  // Pacing (indexed at 100%)
  pacingPercentage: z.number(),
  pacingStatus: z.enum(['on_pace', 'ahead', 'behind', 'at_risk']),
  
  // Progress
  progressPercentage: z.number(),
  daysRemaining: z.number(),
  
  // Calculated at
  calculatedAt: DateSchema,
});

// Types
export type LineItemEntity = z.infer<typeof LineItemEntitySchema>;
export type LineItemInput = z.infer<typeof LineItemInputSchema>;
export type LineItemUpdate = z.infer<typeof LineItemUpdateSchema>;
export type LineItemListItem = z.infer<typeof LineItemListItemSchema>;
export type LineItemMetrics = z.infer<typeof LineItemMetricsSchema>;

// Type guards
export const isStandardLineItem = (item: LineItemEntity): item is z.infer<typeof StandardLineItemSchema> => 
  item.type === 'standard';

export const isManagementFeeLineItem = (item: LineItemEntity): item is z.infer<typeof ManagementFeeLineItemSchema> => 
  item.type === 'management_fee';

export const isZeroDollarLineItem = (item: LineItemEntity): item is z.infer<typeof ZeroDollarLineItemSchema> => 
  item.type === 'zero_dollar';

export const isZeroMarginLineItem = (item: LineItemEntity): item is z.infer<typeof ZeroMarginLineItemSchema> => 
  item.type === 'zero_margin';