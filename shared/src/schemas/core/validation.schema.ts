import * as z from 'zod/v4';

// MongoDB ObjectId validation
export const ObjectIdSchema = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

// Optional ObjectId
export const OptionalObjectIdSchema = ObjectIdSchema.optional();

// Nullable ObjectId
export const NullableObjectIdSchema = ObjectIdSchema.nullable();

// Email validation
export const EmailSchema = z.string().email('Invalid email format');

// URL validation
export const UrlSchema = z.string().url('Invalid URL format');

// Non-empty string
export const NonEmptyStringSchema = z.string().min(1, 'String cannot be empty');

// Trimmed string
export const TrimmedStringSchema = z.string().transform((val) => val.trim());

// Safe name (alphanumeric, spaces, hyphens, underscores)
export const SafeNameSchema = z.string()
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores')
  .transform((val) => val.trim());

// Sort direction
export const SortDirectionSchema = z.enum(['asc', 'desc']);

// Pagination
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortDirection: SortDirectionSchema.default('asc'),
});

// Status enum
export const StatusSchema = z.enum(['active', 'inactive', 'draft', 'archived']);

// Audit fields
export const AuditFieldsSchema = z.object({
  createdBy: ObjectIdSchema,
  createdAt: z.date(),
  updatedBy: ObjectIdSchema.optional(),
  updatedAt: z.date(),
});