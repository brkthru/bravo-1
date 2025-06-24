import * as z from 'zod/v4';
import { 
  ObjectIdSchema,
} from '../core/validation.schema';
import { DateSchema } from '../core/dates.schema';
import { VersionedEntityTypeSchema } from './version-history.schema';

// Field change type
export const FieldChangeTypeSchema = z.enum([
  'add',      // Field added
  'update',   // Field value changed
  'delete',   // Field removed
  'rename',   // Field renamed
]);

// Field data type for tracking
export const FieldDataTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'object',
  'array',
  'null',
  'undefined',
]);

// Individual field change
export const FieldChangeSchema = z.object({
  _id: ObjectIdSchema,
  
  // Entity reference
  entityId: ObjectIdSchema,
  entityType: VersionedEntityTypeSchema,
  entityVersion: z.number().int().min(1),
  
  // Change details
  changesetId: ObjectIdSchema,
  fieldPath: z.string(), // Dot notation path, e.g., "budget.allocated"
  changeType: FieldChangeTypeSchema,
  
  // Values
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  
  // Type information
  oldType: FieldDataTypeSchema.optional(),
  newType: FieldDataTypeSchema.optional(),
  
  // Metadata
  changedAt: DateSchema,
  changedBy: ObjectIdSchema,
  
  // Validation
  isValid: z.boolean().default(true),
  validationErrors: z.array(z.string()).default([]),
  
  // Business impact
  impactLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  requiresRecalculation: z.boolean().default(false),
  triggeredCalculations: z.array(z.string()).default([]),
});

// Field change summary (for UI display)
export const FieldChangeSummarySchema = z.object({
  fieldPath: z.string(),
  fieldLabel: z.string(), // Human-readable name
  changeType: FieldChangeTypeSchema,
  oldValue: z.string().optional(), // Formatted for display
  newValue: z.string().optional(), // Formatted for display
  changedAt: DateSchema,
  changedBy: z.string(), // User name
  impactLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

// Bulk field changes query result
export const FieldChangeQueryResultSchema = z.object({
  changes: z.array(FieldChangeSchema),
  summary: z.object({
    totalChanges: z.number().int(),
    byType: z.record(FieldChangeTypeSchema, z.number().int()),
    byEntity: z.record(VersionedEntityTypeSchema, z.number().int()),
    byUser: z.array(z.object({
      userId: ObjectIdSchema,
      userName: z.string(),
      changeCount: z.number().int(),
    })),
    dateRange: z.object({
      start: DateSchema,
      end: DateSchema,
    }),
  }),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    hasMore: z.boolean(),
  }),
});

// Types
export type FieldChangeType = z.infer<typeof FieldChangeTypeSchema>;
export type FieldDataType = z.infer<typeof FieldDataTypeSchema>;
export type FieldChange = z.infer<typeof FieldChangeSchema>;
export type FieldChangeSummary = z.infer<typeof FieldChangeSummarySchema>;
export type FieldChangeQueryResult = z.infer<typeof FieldChangeQueryResultSchema>;