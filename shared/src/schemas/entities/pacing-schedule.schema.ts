import * as z from 'zod/v4';
import { ObjectIdSchema, AuditFieldsSchema } from '../core/validation.schema';
import { FinancialAmountSchema, UnitPriceSchema } from '../core/financial.schema';
import { DateSchema, DateRangeSchema } from '../core/dates.schema';
import { EstimatedUnitsSchema } from '../core/units.schema';

// Budget block - time-based budget allocation
export const BudgetBlockSchema = z
  .object({
    startDate: DateSchema,
    endDate: DateSchema,
    price: FinancialAmountSchema,
    units: EstimatedUnitsSchema, // Calculated from price / unitPrice

    // Optional overrides for this block
    unitPrice: UnitPriceSchema.optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => data.startDate <= data.endDate,
    'Start date must be before or equal to end date'
  );

// Pacing schedule - contains budget blocks for a line item
export const PacingScheduleSchema = z
  .object({
    _id: ObjectIdSchema,
    lineItemId: ObjectIdSchema,

    // Must have at least one budget block
    budgetBlocks: z.array(BudgetBlockSchema).min(1, 'At least one budget block is required'),

    // Calculated totals (must match line item totals)
    totalPrice: FinancialAmountSchema,
    totalUnits: EstimatedUnitsSchema,

    // Version tracking
    version: z.number().int().min(1).default(1),
    isActive: z.boolean().default(true),

    // Notes
    notes: z.string().optional(),
  })
  .extend(AuditFieldsSchema.shape);

// Validation to ensure budget blocks don't overlap
export const validateBudgetBlocks = (blocks: z.infer<typeof BudgetBlockSchema>[]) => {
  const sorted = [...blocks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endDate >= sorted[i + 1].startDate) {
      throw new Error(`Budget blocks overlap: Block ${i + 1} ends after block ${i + 2} starts`);
    }
  }

  return true;
};

// Validation to ensure budget block sum matches total
export const validateBudgetBlockTotals = (
  blocks: z.infer<typeof BudgetBlockSchema>[],
  expectedTotalPrice: number,
  tolerance: number = 0.01 // Allow 1 cent difference for rounding
) => {
  const totalPrice = blocks.reduce((sum, block) => sum + parseFloat(block.price), 0);
  const difference = Math.abs(totalPrice - expectedTotalPrice);

  if (difference > tolerance) {
    throw new Error(
      `Budget block total (${totalPrice}) does not match expected total (${expectedTotalPrice})`
    );
  }

  return true;
};

// Input schema for creating pacing schedule
export const PacingScheduleInputSchema = z
  .object({
    lineItemId: ObjectIdSchema,
    budgetBlocks: z.array(BudgetBlockSchema).min(1),
    notes: z.string().optional(),
  })
  .refine((data) => validateBudgetBlocks(data.budgetBlocks), 'Budget blocks must not overlap');

// Update schema
export const PacingScheduleUpdateSchema = PacingScheduleInputSchema.partial();

// Default pacing schedule creator (single block)
export const createDefaultPacingSchedule = (
  lineItemId: string,
  flightDates: { start: Date; end: Date },
  price: number,
  units: number
): z.infer<typeof PacingScheduleInputSchema> => ({
  lineItemId,
  budgetBlocks: [
    {
      startDate: flightDates.start,
      endDate: flightDates.end,
      price: price.toString(),
      units,
    },
  ],
});

// Pacing metrics (runtime calculations)
export const PacingMetricsSchema = z.object({
  scheduleId: ObjectIdSchema,
  lineItemId: ObjectIdSchema,

  // Current block info
  currentBlockIndex: z.number().int().min(0).optional(),
  currentBlockProgress: z.number().min(0).max(100).optional(),

  // Overall pacing
  expectedSpendToDate: FinancialAmountSchema,
  expectedUnitsToDate: EstimatedUnitsSchema,

  // Pacing status
  pacingPercentage: z.number(), // Indexed at 100%
  pacingStatus: z.enum(['on_pace', 'ahead', 'behind', 'at_risk', 'not_started', 'completed']),

  // Time progress
  timeProgressPercentage: z.number(),
  daysIntoSchedule: z.number().int(),
  totalDays: z.number().int(),

  calculatedAt: DateSchema,
});

// Types
export type BudgetBlock = z.infer<typeof BudgetBlockSchema>;
export type PacingSchedule = z.infer<typeof PacingScheduleSchema>;
export type PacingScheduleInput = z.infer<typeof PacingScheduleInputSchema>;
export type PacingScheduleUpdate = z.infer<typeof PacingScheduleUpdateSchema>;
export type PacingMetrics = z.infer<typeof PacingMetricsSchema>;
