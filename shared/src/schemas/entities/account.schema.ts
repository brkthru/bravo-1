import * as z from 'zod/v4';
import { 
  ObjectIdSchema, 
  NonEmptyStringSchema, 
  StatusSchema,
  AuditFieldsSchema,
  TrimmedStringSchema,
} from '../core/validation.schema';
import { 
  ReferralRateSchema, 
  MarkupRateSchema,
  FinancialAmountSchema,
} from '../core/financial.schema';

// Account base schema
export const AccountBaseSchema = z.object({
  _id: ObjectIdSchema,
  name: NonEmptyStringSchema,
  accountNumber: TrimmedStringSchema.optional(),
  status: StatusSchema,
  
  // Financial settings (snapshots for campaigns)
  referralRate: ReferralRateSchema.optional(),
  agencyMarkupRate: MarkupRateSchema.optional(),
  
  // Contact information
  primaryContactName: TrimmedStringSchema.optional(),
  primaryContactEmail: z.string().email().optional(),
  primaryContactPhone: TrimmedStringSchema.optional(),
  
  // Billing information
  billingAddress: z.object({
    street1: TrimmedStringSchema.optional(),
    street2: TrimmedStringSchema.optional(),
    city: TrimmedStringSchema.optional(),
    state: TrimmedStringSchema.optional(),
    postalCode: TrimmedStringSchema.optional(),
    country: TrimmedStringSchema.default('US'),
  }).optional(),
  
  // Credit information
  creditLimit: FinancialAmountSchema.optional(),
  paymentTerms: z.enum(['net15', 'net30', 'net45', 'net60', 'prepay']).optional(),
  
  // Metadata
  tags: z.array(TrimmedStringSchema).default([]),
  notes: z.string().optional(),
});

// Account with audit fields
export const AccountSchema = AccountBaseSchema.extend(AuditFieldsSchema.shape);

// Account input (for creation)
export const AccountInputSchema = AccountBaseSchema.omit({ 
  _id: true,
});

// Account update
export const AccountUpdateSchema = AccountInputSchema.partial();

// Account list item (for grid/table display)
export const AccountListItemSchema = z.object({
  _id: ObjectIdSchema,
  name: NonEmptyStringSchema,
  accountNumber: TrimmedStringSchema.optional(),
  status: StatusSchema,
  referralRate: ReferralRateSchema.optional(),
  agencyMarkupRate: MarkupRateSchema.optional(),
  creditLimit: FinancialAmountSchema.optional(),
  campaignCount: z.number().int().min(0).default(0),
  totalRevenue: FinancialAmountSchema.default('0'),
  updatedAt: z.date(),
});

// Types
export type Account = z.infer<typeof AccountSchema>;
export type AccountInput = z.infer<typeof AccountInputSchema>;
export type AccountUpdate = z.infer<typeof AccountUpdateSchema>;
export type AccountListItem = z.infer<typeof AccountListItemSchema>;