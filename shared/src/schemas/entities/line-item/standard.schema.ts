import * as z from 'zod/v4';
import { LineItemBaseSchema, LineItemBaseInputSchema } from './base.schema';
import { 
  FinancialAmountSchema,
  UnitPriceSchema,
  MarginSchema,
} from '../../core/financial.schema';

// Standard line item type
export const StandardLineItemSchema = LineItemBaseSchema.extend({
  type: z.literal('standard'),
  
  // Standard line items have price and unit price
  price: FinancialAmountSchema,
  unitPrice: UnitPriceSchema,
  targetMargin: MarginSchema,
  
  // Calculated fields
  grossRevenue: FinancialAmountSchema,
  netRevenue: FinancialAmountSchema,
  marginAmount: FinancialAmountSchema,
  marginPercentage: MarginSchema,
});

// Input schema for standard line item
export const StandardLineItemInputSchema = LineItemBaseInputSchema.extend({
  type: z.literal('standard'),
  price: FinancialAmountSchema,
  unitPrice: UnitPriceSchema,
  targetMargin: MarginSchema.default('20'), // Default 20% margin
  
  // estimatedUnits can be calculated from price / unitPrice
  estimatedUnits: z.number().optional(),
});

// Update schema
export const StandardLineItemUpdateSchema = StandardLineItemInputSchema.partial();

// Types
export type StandardLineItem = z.infer<typeof StandardLineItemSchema>;
export type StandardLineItemInput = z.infer<typeof StandardLineItemInputSchema>;
export type StandardLineItemUpdate = z.infer<typeof StandardLineItemUpdateSchema>;