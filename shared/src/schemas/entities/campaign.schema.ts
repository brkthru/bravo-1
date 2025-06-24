import * as z from 'zod/v4';
import { 
  ObjectIdSchema,
  NonEmptyStringSchema,
  StatusSchema,
  AuditFieldsSchema,
  TrimmedStringSchema,
} from '../core/validation.schema';
import { 
  FinancialAmountSchema,
  ReferralRateSchema,
  MarkupRateSchema,
  DecimalSchema,
} from '../core/financial.schema';
import { 
  DateSchema,
  FlightDatesSchema,
} from '../core/dates.schema';

// Campaign status
export const CampaignStatusEnumSchema = z.enum([
  'planning',
  'pending_approval',
  'approved',
  'active',
  'paused',
  'completed',
  'cancelled',
  'archived',
]);

// Campaign with mixed Zoho and Bravo fields
export const CampaignEntitySchema = z.object({
  _id: ObjectIdSchema,
  name: NonEmptyStringSchema,
  campaignNumber: TrimmedStringSchema,
  accountId: ObjectIdSchema,
  status: CampaignStatusEnumSchema,
  
  // Zoho-owned fields (with suffix)
  startDateZoho: DateSchema.optional(),
  endDateZoho: DateSchema.optional(),
  referralRateZoho: DecimalSchema.optional(), // Decimal128 in MongoDB
  agencyMarkupRateZoho: DecimalSchema.optional(),
  priceZoho: DecimalSchema.optional(),
  campaignOwnerZoho: TrimmedStringSchema.optional(),
  campaignManagerZoho: TrimmedStringSchema.optional(),
  
  // Bravo-owned fields (MediaStrategy fields flat on campaign)
  startDate: DateSchema,
  endDate: DateSchema,
  price: FinancialAmountSchema,
  referralRate: ReferralRateSchema.optional(), // Overrides Zoho
  agencyMarkupRate: MarkupRateSchema.optional(), // Overrides Zoho
  
  // Calculated fields
  netRevenue: FinancialAmountSchema,
  mediaBudget: FinancialAmountSchema,
  calculatedAt: DateSchema,
  calculationVersion: z.string().default('1.0'),
  
  // Snapshots from account at creation
  initialReferralRate: ReferralRateSchema.optional(),
  initialAgencyMarkupRate: MarkupRateSchema.optional(),
  
  // Campaign details
  objective: TrimmedStringSchema.optional(),
  targetAudience: TrimmedStringSchema.optional(),
  notes: z.string().optional(),
  
  // Team assignments
  teamMembers: z.array(z.object({
    userId: ObjectIdSchema,
    role: z.enum(['lead', 'member', 'viewer']),
    assignedAt: DateSchema,
  })).default([]),
  
  // Metadata
  tags: z.array(TrimmedStringSchema).default([]),
  customFields: z.record(z.string(), z.any()).default({}),
  
  // Zoho sync metadata
  zohoId: TrimmedStringSchema.optional(),
  zohoLastModified: DateSchema.optional(),
  zohoSyncStatus: z.enum(['synced', 'pending', 'error']).optional(),
}).extend(AuditFieldsSchema.shape);

// Campaign input (for creation)
export const CampaignInputSchema = z.object({
  name: NonEmptyStringSchema,
  campaignNumber: TrimmedStringSchema.optional(),
  accountId: ObjectIdSchema,
  status: CampaignStatusEnumSchema.default('planning'),
  
  // Required dates
  startDate: DateSchema,
  endDate: DateSchema,
  
  // Financial
  price: FinancialAmountSchema,
  referralRate: ReferralRateSchema.optional(),
  agencyMarkupRate: MarkupRateSchema.optional(),
  
  // Optional fields
  objective: TrimmedStringSchema.optional(),
  targetAudience: TrimmedStringSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(TrimmedStringSchema).optional(),
});

// Campaign update
export const CampaignUpdateSchema = CampaignInputSchema.partial();

// Campaign list item (for grid display)
export const CampaignListItemSchema = z.object({
  _id: ObjectIdSchema,
  name: NonEmptyStringSchema,
  campaignNumber: TrimmedStringSchema,
  accountId: ObjectIdSchema,
  accountName: NonEmptyStringSchema, // Joined from account
  status: CampaignStatusEnumSchema,
  startDate: DateSchema,
  endDate: DateSchema,
  price: FinancialAmountSchema,
  netRevenue: FinancialAmountSchema,
  mediaBudget: FinancialAmountSchema,
  lineItemCount: z.number().int().min(0).default(0),
  updatedAt: DateSchema,
});

// Campaign metrics
export const CampaignMetricsEntitySchema = z.object({
  campaignId: ObjectIdSchema,
  
  // Forward-looking (persisted)
  totalPrice: FinancialAmountSchema,
  totalNetRevenue: FinancialAmountSchema,
  totalMediaBudget: FinancialAmountSchema,
  
  // Backward-looking (runtime)
  actualSpend: FinancialAmountSchema,
  actualUnitsDelivered: z.number(),
  pacingPercentage: z.number(), // Indexed at 100%
  progressPercentage: z.number(),
  
  // Counts
  lineItemCount: z.number().int(),
  activeLineItemCount: z.number().int(),
  
  // Dates
  calculatedAt: DateSchema,
});

// Types
export type CampaignEntity = z.infer<typeof CampaignEntitySchema>;
export type CampaignInput = z.infer<typeof CampaignInputSchema>;
export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;
export type CampaignListItem = z.infer<typeof CampaignListItemSchema>;
export type CampaignMetricsType = z.infer<typeof CampaignMetricsEntitySchema>;
export type CampaignStatusType = z.infer<typeof CampaignStatusEnumSchema>;