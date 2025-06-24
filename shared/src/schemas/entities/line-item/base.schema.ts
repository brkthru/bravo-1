import * as z from 'zod/v4';
import { 
  ObjectIdSchema,
  NonEmptyStringSchema,
  StatusSchema,
  AuditFieldsSchema,
  TrimmedStringSchema,
} from '../../core/validation.schema';
import { 
  FinancialAmountSchema,
  MarginSchema,
} from '../../core/financial.schema';
import { 
  UnitTypeEnumSchema,
  EstimatedUnitsSchema,
} from '../../core/units.schema';
import { 
  FlightDatesSchema,
  DateSchema,
} from '../../core/dates.schema';

// Line item status
export const LineItemStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'active',
  'paused',
  'completed',
  'cancelled',
]);

// Base schema with common fields for all line item types
export const LineItemBaseSchema = z.object({
  _id: ObjectIdSchema,
  name: NonEmptyStringSchema,
  campaignId: ObjectIdSchema,
  strategyId: ObjectIdSchema.optional(), // For MediaStrategy relationship
  
  // Type discriminator
  type: z.enum(['standard', 'management_fee', 'zero_dollar', 'zero_margin']),
  
  // Common fields
  status: LineItemStatusSchema,
  unitType: UnitTypeEnumSchema,
  flightDates: FlightDatesSchema,
  
  // All line item types have mediaBudget
  mediaBudget: FinancialAmountSchema,
  
  // Forward-looking metric (persisted)
  estimatedUnits: EstimatedUnitsSchema,
  
  // Platform targeting
  platform: z.enum([
    'google_ads',
    'facebook',
    'instagram',
    'linkedin',
    'twitter',
    'tiktok',
    'programmatic',
    'direct',
    'other',
  ]).optional(),
  
  // Targeting details
  targeting: z.object({
    geography: z.array(TrimmedStringSchema).optional(),
    demographics: z.object({
      ageMin: z.number().int().min(13).optional(),
      ageMax: z.number().int().max(120).optional(),
      gender: z.enum(['all', 'male', 'female', 'other']).optional(),
    }).optional(),
    interests: z.array(TrimmedStringSchema).optional(),
    customAudiences: z.array(TrimmedStringSchema).optional(),
  }).optional(),
  
  // Creative details
  creativeSpecs: z.object({
    formats: z.array(TrimmedStringSchema).optional(),
    sizes: z.array(TrimmedStringSchema).optional(),
    urls: z.array(z.string().url()).optional(),
  }).optional(),
  
  // Metadata
  tags: z.array(TrimmedStringSchema).default([]),
  notes: z.string().optional(),
  
  // Calculation metadata
  calculatedAt: DateSchema,
  calculationVersion: z.string().default('1.0'),
}).extend(AuditFieldsSchema.shape);

// Base input schema (common fields for creation)
export const LineItemBaseInputSchema = z.object({
  name: NonEmptyStringSchema,
  campaignId: ObjectIdSchema,
  strategyId: ObjectIdSchema.optional(),
  status: LineItemStatusSchema.default('draft'),
  unitType: UnitTypeEnumSchema,
  flightDates: FlightDatesSchema,
  mediaBudget: FinancialAmountSchema,
  platform: LineItemBaseSchema.shape.platform.optional(),
  targeting: LineItemBaseSchema.shape.targeting.optional(),
  creativeSpecs: LineItemBaseSchema.shape.creativeSpecs.optional(),
  tags: z.array(TrimmedStringSchema).optional(),
  notes: z.string().optional(),
});

// Types
export type LineItemBase = z.infer<typeof LineItemBaseSchema>;
export type LineItemStatus = z.infer<typeof LineItemStatusSchema>;