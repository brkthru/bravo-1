import * as z from 'zod/v4';
import { 
  ObjectIdSchema,
  NonEmptyStringSchema,
  AuditFieldsSchema,
} from '../core/validation.schema';
import { DateSchema } from '../core/dates.schema';
import { VersionedEntityTypeSchema } from './version-history.schema';

// Changeset status
export const ChangesetStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'rolled_back',
]);

// Changeset type
export const ChangesetTypeSchema = z.enum([
  'manual',         // User-initiated changes
  'import',         // Bulk import
  'sync',           // Zoho sync
  'calculation',    // Recalculation
  'migration',      // System migration
  'rollback',       // Rollback operation
]);

// Changeset schema (groups related changes)
export const ChangesetSchema = z.object({
  _id: ObjectIdSchema,
  
  // Changeset identification
  name: NonEmptyStringSchema,
  description: z.string(),
  type: ChangesetTypeSchema,
  status: ChangesetStatusSchema,
  
  // Scope
  campaignId: ObjectIdSchema.optional(), // If campaign-specific
  accountId: ObjectIdSchema.optional(), // If account-specific
  
  // User who initiated
  userId: ObjectIdSchema,
  userName: NonEmptyStringSchema,
  
  // Timing
  startedAt: DateSchema,
  completedAt: DateSchema.optional(),
  
  // Changes in this set
  changes: z.array(z.object({
    entityId: ObjectIdSchema,
    entityType: VersionedEntityTypeSchema,
    changeType: z.enum(['create', 'update', 'delete']),
    oldVersion: z.number().int().optional(),
    newVersion: z.number().int(),
  })),
  
  // Results
  summary: z.object({
    totalChanges: z.number().int(),
    successfulChanges: z.number().int(),
    failedChanges: z.number().int(),
    entitiesAffected: z.record(z.string(), z.number().int()),
  }).optional(),
  
  // Error tracking
  errors: z.array(z.object({
    entityId: ObjectIdSchema,
    entityType: VersionedEntityTypeSchema,
    error: z.string(),
    details: z.any().optional(),
  })).default([]),
  
  // Rollback information
  canRollback: z.boolean().default(true),
  rollbackChangesetId: ObjectIdSchema.optional(),
  rolledBackAt: DateSchema.optional(),
  
  // Metadata
  source: z.string().optional(), // e.g., "zoho_api", "user_interface"
  metadata: z.record(z.string(), z.any()).default({}),
}).extend(AuditFieldsSchema.shape);

// Changeset input
export const ChangesetInputSchema = z.object({
  name: NonEmptyStringSchema,
  description: z.string(),
  type: ChangesetTypeSchema,
  campaignId: ObjectIdSchema.optional(),
  accountId: ObjectIdSchema.optional(),
  source: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Types
export type ChangesetStatus = z.infer<typeof ChangesetStatusSchema>;
export type ChangesetType = z.infer<typeof ChangesetTypeSchema>;
export type Changeset = z.infer<typeof ChangesetSchema>;
export type ChangesetInput = z.infer<typeof ChangesetInputSchema>;