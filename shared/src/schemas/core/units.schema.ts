import * as z from 'zod/v4';

// Unit types supported in the system
export const UnitTypeEnumSchema = z.enum([
  'impressions',
  'clicks',
  'conversions',
  'views',
  'engagements',
  'reach',
  'frequency',
]);

export type UnitTypeEnum = z.infer<typeof UnitTypeEnumSchema>;

// Unit count (always positive integer)
export const UnitCountSchema = z.number()
  .int('Unit count must be an integer')
  .min(0, 'Unit count must be non-negative');

// Estimated units (can be decimal for projections)
export const EstimatedUnitsSchema = z.number()
  .min(0, 'Estimated units must be non-negative');

// Actual delivered units
export const ActualUnitsSchema = UnitCountSchema;

// Unit metrics
export const UnitMetricsSchema = z.object({
  unitType: UnitTypeEnumSchema,
  estimatedUnits: EstimatedUnitsSchema,
  actualUnitsDelivered: ActualUnitsSchema.optional(),
});

// Rate types for different unit types
export const RateTypeSchema = z.enum([
  'CPM', // Cost per thousand impressions
  'CPC', // Cost per click
  'CPA', // Cost per acquisition/conversion
  'CPV', // Cost per view
  'CPE', // Cost per engagement
  'CPCV', // Cost per completed view
]);

export type RateType = z.infer<typeof RateTypeSchema>;