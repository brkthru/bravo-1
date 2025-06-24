import * as z from 'zod/v4';
import { 
  ObjectIdSchema,
  NonEmptyStringSchema,
  AuditFieldsSchema,
} from '../core/validation.schema';
import { DateSchema } from '../core/dates.schema';

// Entity type enum
export const VersionedEntityTypeSchema = z.enum([
  'campaign',
  'media_strategy',
  'line_item',
  'pacing_schedule',
  'media_buy',
  'account',
]);

// Version history entry
export const VersionHistorySchema = z.object({
  _id: ObjectIdSchema,
  entityId: ObjectIdSchema,
  entityType: VersionedEntityTypeSchema,
  version: z.number().int().min(1),
  
  // Snapshot of entity at this version
  entitySnapshot: z.record(z.string(), z.any()),
  
  // Change metadata
  changeType: z.enum(['create', 'update', 'delete', 'restore']),
  changesetId: ObjectIdSchema.optional(), // Groups related changes
  changeDescription: z.string().optional(),
  
  // User who made the change
  userId: ObjectIdSchema,
  userName: NonEmptyStringSchema,
  userRole: z.string(),
  
  // Timestamps
  effectiveDate: DateSchema,
  expiryDate: DateSchema.optional(), // When this version was superseded
  
  // Calculation version used
  calculationVersion: z.string(),
  
  // Tags for this version
  tags: z.array(z.string()).default([]),
}).extend(AuditFieldsSchema.shape);

// Types
export type VersionedEntityType = z.infer<typeof VersionedEntityTypeSchema>;
export type VersionHistory = z.infer<typeof VersionHistorySchema>;