import * as z from 'zod/v4';
import { LineItemBaseSchema, LineItemBaseInputSchema } from './base.schema';
import { EstimatedUnitsSchema } from '../../core/units.schema';
import { NonEmptyStringSchema } from '../../core/validation.schema';

// Zero dollar line item type
export const ZeroDollarLineItemSchema = LineItemBaseSchema.extend({
  type: z.literal('zero_dollar'),

  // Zero dollar specific fields
  justification: NonEmptyStringSchema,

  // For zero dollar, mediaBudget and estimatedUnits are user inputs
  // No price fields, as this is zero dollar
});

// Input schema for zero dollar line item
export const ZeroDollarLineItemInputSchema = LineItemBaseInputSchema.extend({
  type: z.literal('zero_dollar'),
  justification: NonEmptyStringSchema,

  // Both are required user inputs for this type
  mediaBudget: z.number().min(0).max(0).default(0), // Must be 0
  estimatedUnits: EstimatedUnitsSchema,
});

// Update schema
export const ZeroDollarLineItemUpdateSchema = ZeroDollarLineItemInputSchema.partial();

// Types
export type ZeroDollarLineItem = z.infer<typeof ZeroDollarLineItemSchema>;
export type ZeroDollarLineItemInput = z.infer<typeof ZeroDollarLineItemInputSchema>;
export type ZeroDollarLineItemUpdate = z.infer<typeof ZeroDollarLineItemUpdateSchema>;
