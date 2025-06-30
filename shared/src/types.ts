import * as z from 'zod/v4';

// Campaign Status Schema
export const CampaignStatusSchema = z.enum(['L1', 'L2', 'L3']);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

// Team Member Schema
export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatar: z.string().optional(),
  role: z.enum(['csd', 'account_manager', 'senior_media_trader', 'media_trader']).optional(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

// Media Activity Schema
export const MediaActivitySchema = z.enum(['None active', 'Some active', 'All active', 'Pending']);
export type MediaActivity = z.infer<typeof MediaActivitySchema>;

// Campaign Metrics Schema (UPDATED with new field names)
export const CampaignMetricsSchema = z.object({
  deliveryPacing: z.number(),
  spendPacing: z.number(),
  marginAmount: z.number(), // NEW: Split margin field
  marginPercentage: z.number(), // NEW: Split margin field
  units: z.number(), // NEW: Changed from impressions
  unitType: z.enum(['impressions', 'clicks', 'views', 'conversions']).default('impressions'),
  revenueDelivered: z.number(),
  budgetSpent: z.number(),
  marginActual: z.number(),
});
export type CampaignMetrics = z.infer<typeof CampaignMetricsSchema>;

// User Role Schema
export const UserRoleSchema = z.enum([
  'admin',
  'account_director',
  'account_manager',
  'media_trader',
  'viewer',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

// User Schema
export const UserSchema = z.object({
  _id: z.string(),
  employeeId: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  managerId: z.string().optional(),
  department: z.string(),
  avatar: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

// Media Plan Schema
export const MediaPlanSchema = z.object({
  _id: z.string(),
  name: z.string(),
  platform: z.string(),
  budget: z.number(), // This is media budget, not campaign price
  cpcCost: z.number(),
  margin: z.number(),
  clicks: z.number(),
  platformBuyName: z.string(),
  deliveryPacing: z.number(),
  status: z.enum(['Pending', 'Active', 'Ended']),
});
export type MediaPlan = z.infer<typeof MediaPlanSchema>;

// Unit Type Schema
export const UnitTypeSchema = z.enum([
  'impressions',
  'clicks',
  'conversions',
  'video_views',
  'completed_video_views',
  'engagements',
  'leads',
]);
export type UnitType = z.infer<typeof UnitTypeSchema>;

// Line Item Schema (UPDATED)
export const LineItemSchema = z.object({
  _id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'paused', 'ended']),
  deliveryPacing: z.number(),
  spendPacing: z.number(),
  marginAmount: z.number(), // NEW: Split margin
  marginPercentage: z.number(), // NEW: Split margin
  price: z.number(),
  channel: z.string(),
  tactic: z.string(),
  unitType: UnitTypeSchema,
  unitPrice: z.number(),
  targetMargin: z.number(),
  estimatedUnits: z.number(),
  actualUnits: z.number().optional(),
  mediaPlan: z.array(MediaPlanSchema),
  dates: z.object({
    start: z.date(),
    end: z.date(),
  }),
});
export type LineItem = z.infer<typeof LineItemSchema>;

// Price Schema (NEW - replacing budget)
export const PriceSchema = z.object({
  targetAmount: z.number(),
  actualAmount: z.number(),
  remainingAmount: z.number(),
  currency: z.string().default('USD'),
});

// Team Schema (UPDATED)
export const TeamSchema = z.object({
  accountManager: TeamMemberSchema.nullable().optional(),
  csd: TeamMemberSchema.nullable().optional(),
  seniorMediaTraders: z.array(TeamMemberSchema).default([]),
  mediaTraders: z.array(TeamMemberSchema).default([]),
});

// Campaign Schema (UPDATED with new field names)
export const CampaignSchema = z.object({
  _id: z.string(),
  campaignNumber: z.string(),
  name: z.string(),
  status: CampaignStatusSchema,
  displayStatus: z.string().optional(),
  accountName: z.string().optional(),
  team: TeamSchema,
  dates: z.object({
    start: z.date(),
    end: z.date(),
    daysElapsed: z.number(),
    totalDuration: z.number(),
  }),
  price: PriceSchema, // NEW: Changed from budget
  metrics: CampaignMetricsSchema,
  mediaActivity: MediaActivitySchema,
  lineItems: z.array(LineItemSchema),
  lineItemCount: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

// Campaign List Row (for AG-Grid) - UPDATED
export const CampaignListRowSchema = z.object({
  campaign_id: z.string(),
  campaignDetails: z.string(),
  campaignPlan: z.string(),
  team: z.string(),
  campaignPlanStatus: z.string(),
  mediaActivity: MediaActivitySchema,
  campaignDelivery: z.number(),
  campaignSpend: z.number(),
  campaignMargin: z.number(),
  deliveryPacing: z.number(),
  spendPacing: z.number(),
  revenueDelivered: z.number(),
  priceSpent: z.number(), // NEW: Changed from budgetSpent
  marginActual: z.number(),
});
export type CampaignListRow = z.infer<typeof CampaignListRowSchema>;

// API Response schemas
export const ApiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.string().optional(),
});

export const ApiResponseSchema = z.union([ApiSuccessSchema, ApiErrorSchema]);
export type ApiResponse<T = unknown> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      details?: string;
    };

// Utility types
export type CreateCampaignRequest = Omit<Campaign, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateCampaignRequest = Partial<Omit<Campaign, '_id' | 'createdAt' | 'updatedAt'>>;
