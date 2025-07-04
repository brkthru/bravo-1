import * as z from 'zod/v4';
import { LineItemBaseSchema, LineItemBaseInputSchema } from './base.schema';
import { FinancialAmountSchema } from '../../core/financial.schema';
import { EstimatedUnitsSchema } from '../../core/units.schema';

// Management fee line item type
export const ManagementFeeLineItemSchema = LineItemBaseSchema.extend({
  type: z.literal('management_fee'),

  // Management fee specific fields
  managementFee: FinancialAmountSchema,

  // For management fee, mediaBudget and estimatedUnits are user inputs
  // No price or unitPrice fields
});

// Input schema for management fee line item
export const ManagementFeeLineItemInputSchema = LineItemBaseInputSchema.extend({
  type: z.literal('management_fee'),
  managementFee: FinancialAmountSchema,

  // Both are required user inputs for this type
  mediaBudget: FinancialAmountSchema,
  estimatedUnits: EstimatedUnitsSchema,
});

// Update schema
export const ManagementFeeLineItemUpdateSchema = ManagementFeeLineItemInputSchema.partial();

// Types
export type ManagementFeeLineItem = z.infer<typeof ManagementFeeLineItemSchema>;
export type ManagementFeeLineItemInput = z.infer<typeof ManagementFeeLineItemInputSchema>;
export type ManagementFeeLineItemUpdate = z.infer<typeof ManagementFeeLineItemUpdateSchema>;
