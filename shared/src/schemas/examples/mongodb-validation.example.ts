import * as z from 'zod/v4';
import {
  CampaignEntitySchema,
  createCampaignMongoDBValidator,
  createMongoDBValidator,
  AccountSchema,
  LineItemEntitySchema,
} from '../index';

// Example 1: Using built-in JSON Schema conversion for MongoDB validation
export function setupMongoDBValidation() {
  // Convert Campaign schema to MongoDB validator
  const campaignValidator = createCampaignMongoDBValidator(CampaignEntitySchema);

  // This generates a MongoDB-compatible JSON Schema with:
  // - Decimal128 fields properly marked
  // - Draft-7 compatibility
  // - Additional properties set to false

  console.log('Campaign Validator:', JSON.stringify(campaignValidator, null, 2));

  // Use in MongoDB:
  // db.createCollection('campaigns', {
  //   validator: campaignValidator,
  //   validationLevel: 'strict',
  //   validationAction: 'error'
  // });
}

// Example 2: Direct JSON Schema conversion
export function directConversion() {
  // Convert Account schema to JSON Schema
  const accountJsonSchema = z.toJSONSchema(AccountSchema, {
    target: 'draft-7', // MongoDB uses draft-7
    unrepresentable: 'any', // Handle dates, etc.
  });

  console.log('Account JSON Schema:', JSON.stringify(accountJsonSchema, null, 2));
}

// Example 3: Creating custom validators with Zod 4
export function customValidation() {
  // Line item validation that ensures budget blocks sum correctly
  const lineItemWithValidation = LineItemEntitySchema.refine(
    (data) => {
      // Add custom validation logic here
      if (data.type === 'standard' && data.price <= data.mediaBudget) {
        return false;
      }
      return true;
    },
    {
      message: 'Standard line items must have price greater than media budget',
    }
  );

  // Convert to JSON Schema
  const validatorSchema = createMongoDBValidator(lineItemWithValidation);

  return validatorSchema;
}

// Example 4: Using Zod 4's new file validation
export function fileUploadValidation() {
  const uploadSchema = z.object({
    campaign: z
      .file()
      .min(100) // 100 bytes minimum
      .max(10_000_000) // 10MB maximum
      .mime(['text/csv', 'application/vnd.ms-excel']),
    creatives: z
      .array(
        z
          .file()
          .max(50_000_000) // 50MB per file
          .mime(['image/jpeg', 'image/png', 'video/mp4'])
      )
      .min(1)
      .max(10),
  });

  // This can be used in API endpoints to validate file uploads
  return uploadSchema;
}

// Example 5: Schema registry for metadata (Zod 4 feature)
export function schemaRegistryExample() {
  // Create a registry with typed metadata
  const schemaRegistry = z.registry<{
    displayName: string;
    description: string;
    version: string;
    deprecated?: boolean;
  }>();

  // Register schemas with metadata
  schemaRegistry.add(CampaignEntitySchema, {
    displayName: 'Campaign',
    description: 'Main campaign entity with Zoho field suffixes',
    version: '1.0.0',
  });

  schemaRegistry.add(AccountSchema, {
    displayName: 'Account',
    description: 'Client account with financial settings',
    version: '1.0.0',
  });

  // Retrieve metadata
  const campaignMeta = schemaRegistry.get(CampaignEntitySchema);
  console.log('Campaign metadata:', campaignMeta);

  return schemaRegistry;
}
