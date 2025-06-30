import * as z from 'zod/v4';

// Convert Zod schema to JSON Schema for MongoDB validation
export function toMongoDBJsonSchema(schema: z.ZodType<any, any>) {
  return z.toJSONSchema(schema, {
    target: 'draft-7', // MongoDB supports draft-7
    unrepresentable: 'any', // Convert unrepresentable types to {}
    cycles: 'ref', // Handle circular references
  });
}

// Convert Zod schema to JSON Schema for OpenAPI 3.1
export function toOpenAPIJsonSchema(schema: z.ZodType<any, any>) {
  return z.toJSONSchema(schema, {
    target: 'draft-2020-12', // OpenAPI 3.1 uses draft 2020-12
    unrepresentable: 'any', // Allow dates to be represented as strings
    cycles: 'ref',
  });
}

// Example: Create MongoDB collection validator from Zod schema
export function createMongoDBValidator(schema: z.ZodType<any, any>) {
  const jsonSchema = toMongoDBJsonSchema(schema);

  return {
    $jsonSchema: {
      ...jsonSchema,
      // MongoDB specific additions
      additionalProperties: false, // Strict by default
    },
  };
}

// Example: Generate OpenAPI component schema
export function createOpenAPIComponent(
  name: string,
  schema: z.ZodType<any, any>,
  description?: string
) {
  const jsonSchema = toOpenAPIJsonSchema(schema);

  return {
    [name]: {
      ...jsonSchema,
      description,
      // OpenAPI specific metadata can be added here
    },
  };
}

// Helper to handle Decimal128 fields for MongoDB
export function enhanceMongoDBSchemaWithDecimal128(jsonSchema: any, decimalFields: string[]): any {
  const enhanced = { ...jsonSchema };

  if (enhanced.properties) {
    decimalFields.forEach((field) => {
      if (enhanced.properties[field]) {
        enhanced.properties[field] = {
          ...enhanced.properties[field],
          bsonType: 'decimal',
        };
      }
    });
  }

  return enhanced;
}

// Example usage for Campaign schema with Decimal128 fields
export function createCampaignMongoDBValidator(campaignSchema: z.ZodType<any, any>) {
  const baseValidator = createMongoDBValidator(campaignSchema);

  // Enhance with MongoDB Decimal128 types for financial fields
  const decimalFields = [
    'price',
    'netRevenue',
    'mediaBudget',
    'referralRate',
    'agencyMarkupRate',
    'referralRateZoho',
    'agencyMarkupRateZoho',
    'priceZoho',
  ];

  return {
    $jsonSchema: enhanceMongoDBSchemaWithDecimal128(baseValidator.$jsonSchema, decimalFields),
  };
}
