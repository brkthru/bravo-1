import * as z from 'zod/v4';
import { LineItemBaseSchema, LineItemBaseInputSchema } from './base.schema';
import { FinancialAmountSchema } from '../../core/financial.schema';
import { EstimatedUnitsSchema } from '../../core/units.schema';
import { NonEmptyStringSchema } from '../../core/validation.schema';

// Zero margin line item type
export const ZeroMarginLineItemSchema = LineItemBaseSchema.extend({
  type: z.literal('zero_margin'),

  // Zero margin specific fields
  price: FinancialAmountSchema,
  justification: NonEmptyStringSchema,

  // For zero margin:
  // - price equals mediaBudget (no margin)
  // - estimatedUnits is user input
  // - no unitPrice or margin fields
});

// Input schema for zero margin line item
export const ZeroMarginLineItemInputSchema = LineItemBaseInputSchema.extend({
  type: z.literal('zero_margin'),
  price: FinancialAmountSchema,
  justification: NonEmptyStringSchema,

  // Required user input
  estimatedUnits: EstimatedUnitsSchema,

  // mediaBudget should equal price for zero margin
});

// Update schema
export const ZeroMarginLineItemUpdateSchema = ZeroMarginLineItemInputSchema.partial();

// Types
export type ZeroMarginLineItem = z.infer<typeof ZeroMarginLineItemSchema>;
export type ZeroMarginLineItemInput = z.infer<typeof ZeroMarginLineItemInputSchema>;
export type ZeroMarginLineItemUpdate = z.infer<typeof ZeroMarginLineItemUpdateSchema>;
