import * as z from 'zod/v4';
import { ObjectIdSchema, NonEmptyStringSchema, AuditFieldsSchema } from '../core/validation.schema';
import { DateSchema } from '../core/dates.schema';
import { EntitySnapshotSchema } from './entity-snapshots.schema';

// Entity type enum - matches the discriminated union types
export const VersionedEntityTypeSchema = z.enum([
  'campaign',
  'media_strategy',
  'line_item',
  'media_plan',
  'pacing_schedule',
  'platform_buy',
  'account',
]);

// Financial precision metadata for version history
export const FinancialPrecisionMetadataSchema = z.object({
  storageDecimals: z.number().int().default(6),
  roundingMode: z.enum(['ROUND_HALF_UP', 'ROUND_DOWN', 'ROUND_UP']).default('ROUND_HALF_UP'),
  calculationLibrary: z.string().default('bignumber.js@9.1.2'),
  decimalImplementation: z.enum(['Decimal128', 'string', 'number']).default('Decimal128'),
});

// Version history entry with type-safe snapshots
export const VersionHistorySchema = z
  .object({
    _id: ObjectIdSchema,
    entityId: ObjectIdSchema,
    entityType: VersionedEntityTypeSchema,
    version: z.number().int().min(1),

    // Type-safe snapshot of entity at this version
    // Uses discriminated union to ensure data matches entity type
    entitySnapshot: EntitySnapshotSchema,

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

    // Calculation version used (ADR 0019 compliance)
    calculationVersion: z.string().default('1.0.0'),

    // Financial precision metadata
    financialPrecisionMetadata: FinancialPrecisionMetadataSchema.optional(),

    // Tags for this version
    tags: z.array(z.string()).default([]),
  })
  .extend(AuditFieldsSchema.shape);

// Types
export type VersionedEntityType = z.infer<typeof VersionedEntityTypeSchema>;
export type VersionHistory = z.infer<typeof VersionHistorySchema>;
export type FinancialPrecisionMetadata = z.infer<typeof FinancialPrecisionMetadataSchema>;
