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
import { DateSchema, FlightDatesSchema } from '../core/dates.schema';

// Campaign status enum
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

// Field source indicator
export const FieldSourceSchema = z.enum(['zoho', 'bravo', 'calculated', 'system']);

// Team member schema (reusable)
export const TeamMemberSchema = z.object({
  id: TrimmedStringSchema,
  name: NonEmptyStringSchema,
  email: TrimmedStringSchema,
  role: z
    .enum([
      'csd',
      'account_manager',
      'senior_media_trader',
      'media_trader',
      'lead',
      'member',
      'viewer',
    ])
    .optional(),
  assignedAt: DateSchema.optional(),
});

// Duration schema with calculated fields
export const DurationSchema = z.object({
  start: DateSchema,
  end: DateSchema,
  // Calculated fields
  totalDays: z.number().int().optional(),
  elapsedDays: z.number().int().optional(),
  remainingDays: z.number().int().optional(),
  percentComplete: z.number().optional(),
  percentRemaining: z.number().optional(),
});

// Price tracking schema (replacing budget)
export const PriceTrackingSchema = z.object({
  targetAmount: FinancialAmountSchema,
  actualAmount: FinancialAmountSchema.optional(),
  remainingAmount: FinancialAmountSchema.optional(),
  currency: z.string().default('USD'),
  // Calculated fields
  percentComplete: z.number().optional(),
  percentRemaining: z.number().optional(),
  pacingStatus: z.enum(['on_track', 'ahead', 'behind', 'at_risk']).optional(),
  pacingPercentage: z.number().optional(),
});

// Media budget tracking schema
export const MediaBudgetSchema = z.object({
  targetAmount: FinancialAmountSchema,
  actualSpend: FinancialAmountSchema.optional(),
  remainingAmount: FinancialAmountSchema.optional(),
  currency: z.string().default('USD'),
  unitType: z.enum(['dollars', 'impressions', 'clicks', 'views', 'conversions']).default('dollars'),
  // Calculated fields
  percentSpent: z.number().optional(),
  percentRemaining: z.number().optional(),
  pacingStatus: z.enum(['on_track', 'ahead', 'behind', 'at_risk']).optional(),
  pacingPercentage: z.number().optional(),
});

// Calculated field with metadata
export const CalculatedFieldSchema = z.object({
  value: z.union([DecimalSchema, z.number()]),
  calculationVersion: z.string(),
  calculatedAt: DateSchema,
  context: z.string(),
  formula: z.string().optional(),
  precision: z.number().optional(),
  roundingMode: z.string().optional(),
  isStored: z.boolean().default(true),
});

// Campaign metrics schema
export const CampaignMetricsSchema = z.object({
  // Units instead of impressions
  units: z.number().int().default(0),
  unitType: z.enum(['impressions', 'clicks', 'views', 'conversions']).default('impressions'),
  clicks: z.number().int().default(0),
  deliveryPacing: z.number().optional(),
  spendPacing: z.number().optional(),
  cpc: FinancialAmountSchema.optional(),
  cpm: FinancialAmountSchema.optional(),
  // Split margin fields
  marginAmount: FinancialAmountSchema.optional(),
  marginPercentage: z.number().optional(),
  // Media activity description
  mediaActivity: z.string().optional().describe('Summary of active line items and their status'),
  lineItemCount: z.number().int().default(0),
  activeLineItemCount: z.number().int().default(0),
});

// Main campaign schema
export const CampaignEntitySchema = z
  .object({
    _id: ObjectIdSchema,
    name: NonEmptyStringSchema,
    campaignNumber: TrimmedStringSchema,
    accountId: ObjectIdSchema,
    status: CampaignStatusEnumSchema,

    // Field source tracking
    fieldSources: z.record(z.string(), FieldSourceSchema).optional(),

    // Zoho-owned fields (with suffix and source indicator)
    startDateZoho: DateSchema.optional(),
    endDateZoho: DateSchema.optional(),
    referralRateZoho: DecimalSchema.optional(),
    agencyMarkupRateZoho: DecimalSchema.optional(),
    priceZoho: DecimalSchema.optional(),
    campaignOwnerZoho: TrimmedStringSchema.optional(),
    campaignManagerZoho: TrimmedStringSchema.optional(),

    // Bravo-owned fields
    dates: DurationSchema,

    // Price (not budget)
    price: PriceTrackingSchema,

    // Financial fields
    referralRate: ReferralRateSchema.optional(),
    agencyMarkupRate: MarkupRateSchema.optional(),

    // Calculated financial fields
    netRevenue: FinancialAmountSchema,
    mediaBudget: MediaBudgetSchema,

    // Calculation metadata
    calculatedAt: DateSchema,
    calculationVersion: z.string().default('1.0'),

    // Calculated fields with full metadata
    calculatedFields: z.record(z.string(), CalculatedFieldSchema).optional(),

    // Snapshots from account at creation
    initialReferralRate: ReferralRateSchema.optional(),
    initialAgencyMarkupRate: MarkupRateSchema.optional(),

    // Campaign details
    objective: TrimmedStringSchema.optional(),
    targetAudience: TrimmedStringSchema.optional(),
    notes: z.string().optional(),

    // Enhanced team structure
    team: z
      .object({
        csd: TeamMemberSchema.optional(),
        accountManager: TeamMemberSchema.optional(),
        seniorMediaTraders: z.array(TeamMemberSchema).default([]),
        mediaTraders: z.array(TeamMemberSchema).default([]),
      })
      .optional(),

    // Team assignments (alternative structure)
    teamMembers: z
      .array(
        z.object({
          userId: ObjectIdSchema,
          role: z.enum([
            'csd',
            'account_manager',
            'senior_media_trader',
            'media_trader',
            'lead',
            'member',
            'viewer',
          ]),
          assignedAt: DateSchema,
        })
      )
      .default([]),

    // Metrics
    metrics: CampaignMetricsSchema.optional(),

    // Media Strategy (integrated, not separate collection)
    mediaStrategy: z
      .object({
        name: TrimmedStringSchema.optional(),
        status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
        isActive: z.boolean().optional(),
        objective: TrimmedStringSchema.optional(),
        targetAudience: TrimmedStringSchema.optional(),
        lineItemIds: z.array(ObjectIdSchema).default([]),
        totalBudget: MediaBudgetSchema.optional(),
        changesetId: z.number().optional(),
      })
      .optional(),

    // Metadata
    tags: z.array(TrimmedStringSchema).default([]),
    customFields: z.record(z.string(), z.any()).default({}),

    // Zoho sync metadata
    zohoId: TrimmedStringSchema.optional(),
    zohoLastModified: DateSchema.optional(),
    zohoSyncStatus: z.enum(['synced', 'pending', 'error']).optional(),

    // Versioning
    version: z.number().default(1),
    changesetId: z.number().optional(),
  })
  .extend(AuditFieldsSchema.shape);

// Campaign input (for creation)
export const CampaignInputSchema = z.object({
  name: NonEmptyStringSchema,
  campaignNumber: TrimmedStringSchema.optional(),
  accountId: ObjectIdSchema,
  status: CampaignStatusEnumSchema.default('planning'),

  // Required dates using the duration schema
  dates: DurationSchema.pick({ start: true, end: true }),

  // Financial - using price only
  price: PriceTrackingSchema.pick({ targetAmount: true, currency: true }),
  referralRate: ReferralRateSchema.optional(),
  agencyMarkupRate: MarkupRateSchema.optional(),

  // Optional fields
  objective: TrimmedStringSchema.optional(),
  targetAudience: TrimmedStringSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(TrimmedStringSchema).optional(),

  // Team
  team: z
    .object({
      csd: TeamMemberSchema.optional(),
      accountManager: TeamMemberSchema.optional(),
      seniorMediaTraders: z.array(TeamMemberSchema).optional(),
      mediaTraders: z.array(TeamMemberSchema).optional(),
    })
    .optional(),

  // Media strategy
  mediaStrategy: z
    .object({
      name: TrimmedStringSchema.optional(),
      objective: TrimmedStringSchema.optional(),
      targetAudience: TrimmedStringSchema.optional(),
    })
    .optional(),
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
  dates: DurationSchema.pick({ start: true, end: true }),
  price: PriceTrackingSchema.pick({ targetAmount: true, currency: true }),
  netRevenue: FinancialAmountSchema,
  mediaBudget: MediaBudgetSchema.pick({ targetAmount: true }),
  metrics: z
    .object({
      lineItemCount: z.number().int().default(0),
      activeLineItemCount: z.number().int().default(0),
      units: z.number().int().default(0),
      unitType: z.string().optional(),
      marginAmount: FinancialAmountSchema.optional(),
      marginPercentage: z.number().optional(),
    })
    .optional(),
  updatedAt: DateSchema,
});

// Types
export type CampaignEntity = z.infer<typeof CampaignEntitySchema>;
export type CampaignInput = z.infer<typeof CampaignInputSchema>;
export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;
export type CampaignListItem = z.infer<typeof CampaignListItemSchema>;
export type CampaignStatusType = z.infer<typeof CampaignStatusEnumSchema>;
export type TeamMemberType = z.infer<typeof TeamMemberSchema>;
export type DurationType = z.infer<typeof DurationSchema>;
export type PriceTrackingType = z.infer<typeof PriceTrackingSchema>;
export type MediaBudgetType = z.infer<typeof MediaBudgetSchema>;
export type CalculatedFieldType = z.infer<typeof CalculatedFieldSchema>;
