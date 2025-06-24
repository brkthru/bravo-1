import * as z from 'zod/v4';

// Validation error detail
export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
  path: z.array(z.union([z.string(), z.number()])).optional(),
  expected: z.string().optional(),
  received: z.string().optional(),
});

// Validation warning detail
export const ValidationWarningSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  suggestion: z.string().optional(),
});

// Validation response schema
export const ValidationResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(ValidationErrorSchema),
  warnings: z.array(ValidationWarningSchema),
  data: z.any().optional(),
  metadata: z.object({
    validatedAt: z.date(),
    validationVersion: z.string(),
    processingTimeMs: z.number().optional(),
  }).optional(),
});

// Business rule validation result
export const BusinessRuleValidationSchema = z.object({
  ruleName: z.string(),
  ruleVersion: z.string(),
  passed: z.boolean(),
  errors: z.array(ValidationErrorSchema),
  warnings: z.array(ValidationWarningSchema),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Batch validation response
export const BatchValidationResponseSchema = z.object({
  totalItems: z.number().int(),
  validItems: z.number().int(),
  invalidItems: z.number().int(),
  itemsWithWarnings: z.number().int(),
  results: z.array(z.object({
    index: z.number().int(),
    itemId: z.string().optional(),
    validation: ValidationResponseSchema,
  })),
  summary: z.object({
    commonErrors: z.array(z.object({
      code: z.string(),
      count: z.number().int(),
      message: z.string(),
    })),
    commonWarnings: z.array(z.object({
      code: z.string(),
      count: z.number().int(),
      message: z.string(),
    })),
  }).optional(),
});

// Helper function to create validation response
export function createValidationResponse(
  success: boolean,
  errors: z.infer<typeof ValidationErrorSchema>[] = [],
  warnings: z.infer<typeof ValidationWarningSchema>[] = [],
  data?: any
): z.infer<typeof ValidationResponseSchema> {
  return {
    success,
    errors,
    warnings,
    data,
    metadata: {
      validatedAt: new Date(),
      validationVersion: '1.0',
    },
  };
}

// Helper to convert Zod errors to validation errors
export function zodErrorToValidationErrors(
  error: z.ZodError
): z.infer<typeof ValidationErrorSchema>[] {
  return error.issues.map(issue => ({
    field: issue.path.map(p => String(p)).join('.'),
    message: issue.message,
    code: issue.code,
    path: issue.path.map(p => typeof p === 'symbol' ? String(p) : p),
    expected: 'expected' in issue ? String(issue.expected) : undefined,
    received: 'received' in issue ? String(issue.received) : undefined,
  }));
}

// Types
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type ValidationWarning = z.infer<typeof ValidationWarningSchema>;
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;
export type BusinessRuleValidation = z.infer<typeof BusinessRuleValidationSchema>;
export type BatchValidationResponse = z.infer<typeof BatchValidationResponseSchema>;