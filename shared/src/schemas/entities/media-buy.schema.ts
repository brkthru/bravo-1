import * as z from 'zod/v4';
import { 
  ObjectIdSchema,
  NonEmptyStringSchema,
  StatusSchema,
  AuditFieldsSchema,
  TrimmedStringSchema,
  UrlSchema,
} from '../core/validation.schema';
import { 
  FinancialAmountSchema,
} from '../core/financial.schema';
import { 
  DateSchema,
  DateRangeSchema,
} from '../core/dates.schema';
import { 
  UnitTypeEnumSchema,
  ActualUnitsSchema,
} from '../core/units.schema';

// Media buy status
export const MediaBuyStatusSchema = z.enum([
  'pending',
  'submitted',
  'approved',
  'live',
  'paused',
  'completed',
  'cancelled',
]);

// Platform entity reference
export const PlatformEntityReferenceSchema = z.object({
  platform: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  entityName: z.string().optional(),
});

// Media buy schema
export const MediaBuySchema = z.object({
  _id: ObjectIdSchema,
  name: NonEmptyStringSchema,
  lineItemId: ObjectIdSchema,
  campaignId: ObjectIdSchema,
  
  // Status and dates
  status: MediaBuyStatusSchema,
  flightDates: DateRangeSchema,
  
  // Platform information
  platform: z.enum([
    'google_ads',
    'facebook',
    'instagram',
    'linkedin',
    'twitter',
    'tiktok',
    'ttd',
    'dv360',
    'amazon',
    'direct',
  ]),
  platformEntityRef: PlatformEntityReferenceSchema.optional(),
  
  // Financial
  plannedSpend: FinancialAmountSchema,
  actualSpend: FinancialAmountSchema.default(0),
  
  // Performance
  unitType: UnitTypeEnumSchema,
  plannedUnits: z.number().min(0),
  actualUnits: ActualUnitsSchema.default(0),
  
  // Creative assets
  creativeAssets: z.array(z.object({
    id: z.string(),
    name: TrimmedStringSchema,
    type: z.enum(['image', 'video', 'carousel', 'text', 'html5']),
    url: UrlSchema.optional(),
    thumbnailUrl: UrlSchema.optional(),
    dimensions: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }).optional(),
    fileSize: z.number().int().positive().optional(),
  })).default([]),
  
  // Tracking
  trackingUrls: z.object({
    clickUrl: UrlSchema.optional(),
    impressionUrl: UrlSchema.optional(),
    conversionUrl: UrlSchema.optional(),
  }).optional(),
  
  // Placement details
  placement: z.object({
    type: z.enum(['feed', 'stories', 'search', 'display', 'video', 'native']),
    positions: z.array(z.string()).optional(),
    devices: z.array(z.enum(['desktop', 'mobile', 'tablet', 'ctv'])).optional(),
  }).optional(),
  
  // Metadata
  tags: z.array(TrimmedStringSchema).default([]),
  notes: z.string().optional(),
  
  // External references
  externalId: z.string().optional(),
  externalUrl: UrlSchema.optional(),
}).extend(AuditFieldsSchema.shape);

// Media buy input
export const MediaBuyInputSchema = z.object({
  name: NonEmptyStringSchema,
  lineItemId: ObjectIdSchema,
  status: MediaBuyStatusSchema.default('pending'),
  flightDates: DateRangeSchema,
  platform: MediaBuySchema.shape.platform,
  plannedSpend: FinancialAmountSchema,
  unitType: UnitTypeEnumSchema,
  plannedUnits: z.number().min(0),
  platformEntityRef: PlatformEntityReferenceSchema.optional(),
  creativeAssets: MediaBuySchema.shape.creativeAssets.optional(),
  trackingUrls: MediaBuySchema.shape.trackingUrls.optional(),
  placement: MediaBuySchema.shape.placement.optional(),
  tags: z.array(TrimmedStringSchema).optional(),
  notes: z.string().optional(),
  externalId: z.string().optional(),
  externalUrl: UrlSchema.optional(),
});

// Media buy update
export const MediaBuyUpdateSchema = MediaBuyInputSchema.partial();

// Media buy list item
export const MediaBuyListItemSchema = z.object({
  _id: ObjectIdSchema,
  name: NonEmptyStringSchema,
  lineItemId: ObjectIdSchema,
  lineItemName: NonEmptyStringSchema, // Joined
  campaignId: ObjectIdSchema,
  campaignName: NonEmptyStringSchema, // Joined
  status: MediaBuyStatusSchema,
  platform: MediaBuySchema.shape.platform,
  plannedSpend: FinancialAmountSchema,
  actualSpend: FinancialAmountSchema,
  spendPercentage: z.number(),
  plannedUnits: z.number(),
  actualUnits: z.number(),
  deliveryPercentage: z.number(),
  startDate: DateSchema,
  endDate: DateSchema,
  updatedAt: DateSchema,
});

// Media buy metrics
export const MediaBuyMetricsSchema = z.object({
  mediaBuyId: ObjectIdSchema,
  
  // Performance
  plannedSpend: FinancialAmountSchema,
  actualSpend: FinancialAmountSchema,
  spendPercentage: z.number(),
  
  plannedUnits: z.number(),
  actualUnits: z.number(),
  deliveryPercentage: z.number(),
  
  // Efficiency
  actualCPM: z.number().optional(),
  actualCPC: z.number().optional(),
  actualCPA: z.number().optional(),
  
  // Pacing
  pacingPercentage: z.number(),
  pacingStatus: z.enum(['on_pace', 'ahead', 'behind', 'at_risk']),
  
  // Time
  daysRemaining: z.number().int(),
  timeProgressPercentage: z.number(),
  
  calculatedAt: DateSchema,
});

// Types
export type MediaBuy = z.infer<typeof MediaBuySchema>;
export type MediaBuyInput = z.infer<typeof MediaBuyInputSchema>;
export type MediaBuyUpdate = z.infer<typeof MediaBuyUpdateSchema>;
export type MediaBuyListItem = z.infer<typeof MediaBuyListItemSchema>;
export type MediaBuyMetrics = z.infer<typeof MediaBuyMetricsSchema>;
export type MediaBuyStatus = z.infer<typeof MediaBuyStatusSchema>;