import * as z from 'zod/v4';

// Date transformation utilities
export const DateSchema = z.union([z.string(), z.date()]).transform((val) => new Date(val));

// Date or null
export const DateOrNullSchema = z
  .union([z.string(), z.date(), z.null()])
  .transform((val) => (val ? new Date(val) : null));

// Date range
export const DateRangeSchema = z
  .object({
    start: DateSchema,
    end: DateSchema,
  })
  .refine((data) => data.start <= data.end, 'Start date must be before or equal to end date');

// Flight dates (for campaigns and line items)
export const FlightDatesSchema = DateRangeSchema;

// Period for reporting
export const PeriodSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'all_time',
]);

export type Period = z.infer<typeof PeriodSchema>;

// Date with period
export const DatePeriodSchema = z.object({
  date: DateSchema,
  period: PeriodSchema,
});

// Timestamps
export const TimestampSchema = DateSchema;

export const TimestampsSchema = z.object({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
