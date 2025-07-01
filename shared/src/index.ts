// Export from types first
export * from './types';
export * from './utils';

// Export from schemas but exclude duplicates that are already in types
export * from './schemas/core/financial.schema';
export * from './schemas/core/units.schema';
export * from './schemas/core/dates.schema';
export * from './schemas/core/validation.schema';
export * from './schemas/core/file.schema';
export * from './schemas/core/json-schema.utils';

// Entity schemas - export main campaign schema only
export * from './schemas/entities/account.schema';
export { 
  CampaignEntitySchema,
  CampaignInputSchema,
  CampaignUpdateSchema,
  CampaignListItemSchema,
  // Export types but not the duplicate schemas
  type CampaignEntity,
  type CampaignInput,
  type CampaignUpdate,
  type CampaignListItem
} from './schemas/entities/campaign.schema';

// Export other entity schemas
export * from './schemas/entities/line-item.schema';
export * from './schemas/entities/pacing-schedule.schema';
export * from './schemas/entities/media-buy.schema';
export * from './schemas/entities/user.schema';

// Line item type schemas
export * from './schemas/entities/line-item/base.schema';
export * from './schemas/entities/line-item/standard.schema';
export * from './schemas/entities/line-item/management-fee.schema';
export * from './schemas/entities/line-item/zero-dollar.schema';
export * from './schemas/entities/line-item/zero-margin.schema';

// Validation schemas
export * from './schemas/validation/response.schema';

// Versioning schemas
export * from './schemas/versioning/version-history.schema';
export * from './schemas/versioning/campaign-tag.schema';
export * from './schemas/versioning/changeset.schema';
export * from './schemas/versioning/field-change.schema';

// Re-export helper functions from schemas
export { safeParse, parseOrThrow } from './schemas';