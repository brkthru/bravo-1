// Re-export Zod for convenience
export * as z from 'zod/v4';

// Core schemas
export * from './core/financial.schema';
export * from './core/units.schema';
export * from './core/dates.schema';
export * from './core/validation.schema';
export * from './core/file.schema';

// JSON Schema utilities
export * from './core/json-schema.utils';

// Entity schemas
export * from './entities/account.schema';
export * from './entities/campaign.schema';
export * from './entities/line-item.schema';
export * from './entities/pacing-schedule.schema';
export * from './entities/media-buy.schema';

// Line item type schemas
export * from './entities/line-item/base.schema';
export * from './entities/line-item/standard.schema';
export * from './entities/line-item/management-fee.schema';
export * from './entities/line-item/zero-dollar.schema';
export * from './entities/line-item/zero-margin.schema';

// Validation schemas
export * from './validation/response.schema';

// Versioning schemas
export * from './versioning/version-history.schema';
export * from './versioning/campaign-tag.schema';
export * from './versioning/changeset.schema';
export * from './versioning/field-change.schema';

// Re-export commonly used Zod types for convenience
import * as z from 'zod/v4';
export type { ZodError, ZodIssue, ZodSchema } from 'zod/v4';

// Helper to validate and parse with proper error handling
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  return schema.safeParse(data);
}

// Helper to validate and throw with formatted error
export function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown, errorMessage?: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(
      errorMessage
        ? `${errorMessage}: ${JSON.stringify(formatted, null, 2)}`
        : `Validation failed: ${JSON.stringify(formatted, null, 2)}`
    );
  }
  return result.data;
}
