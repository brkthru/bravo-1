import * as z from 'zod/v4';
import { 
  ObjectIdSchema,
  NonEmptyStringSchema,
  SafeNameSchema,
} from '../core/validation.schema';
import { DateSchema } from '../core/dates.schema';

// Campaign tag type (like git tags)
export const CampaignTagTypeSchema = z.enum([
  'release',      // Major version release
  'milestone',    // Significant checkpoint
  'checkpoint',   // Regular checkpoint
  'backup',       // Backup point
  'approval',     // Approval snapshot
]);

// Entity version mapping
export const EntityVersionMapSchema = z.object({
  mediaStrategy: z.number().int().min(1),
  lineItems: z.record(ObjectIdSchema, z.number().int().min(1)),
  pacingSchedules: z.record(ObjectIdSchema, z.number().int().min(1)),
  mediaBuys: z.record(ObjectIdSchema, z.number().int().min(1)).optional(),
});

// Campaign tag (git-like tag for campaign versions)
export const CampaignTagSchema = z.object({
  _id: ObjectIdSchema,
  campaignId: ObjectIdSchema,
  
  // Tag identification
  tagName: SafeNameSchema,
  tagType: CampaignTagTypeSchema,
  
  // Tag metadata
  description: z.string(),
  notes: z.string().optional(),
  
  // User who created the tag
  userId: ObjectIdSchema,
  userName: NonEmptyStringSchema,
  
  // Timestamp
  timestamp: DateSchema,
  
  // Entity versions at this tag
  entityVersions: EntityVersionMapSchema,
  
  // Campaign state summary at this tag
  stateSummary: z.object({
    status: z.string(),
    totalPrice: z.number(),
    netRevenue: z.number(),
    mediaBudget: z.number(),
    lineItemCount: z.number().int(),
    calculationVersion: z.string(),
  }),
  
  // Related tags
  parentTagId: ObjectIdSchema.optional(), // For branching scenarios
  previousTagId: ObjectIdSchema.optional(), // Previous tag in sequence
  
  // Metadata
  isProtected: z.boolean().default(false), // Cannot be deleted
  expiresAt: DateSchema.optional(), // Auto-delete after this date
});

// Tag creation input
export const CampaignTagInputSchema = z.object({
  campaignId: ObjectIdSchema,
  tagName: SafeNameSchema,
  tagType: CampaignTagTypeSchema,
  description: z.string(),
  notes: z.string().optional(),
  isProtected: z.boolean().optional(),
  expiresAt: DateSchema.optional(),
});

// Tag list item
export const CampaignTagListItemSchema = z.object({
  _id: ObjectIdSchema,
  campaignId: ObjectIdSchema,
  tagName: SafeNameSchema,
  tagType: CampaignTagTypeSchema,
  description: z.string(),
  userName: NonEmptyStringSchema,
  timestamp: DateSchema,
  isProtected: z.boolean(),
});

// Types
export type CampaignTagType = z.infer<typeof CampaignTagTypeSchema>;
export type EntityVersionMap = z.infer<typeof EntityVersionMapSchema>;
export type CampaignTag = z.infer<typeof CampaignTagSchema>;
export type CampaignTagInput = z.infer<typeof CampaignTagInputSchema>;
export type CampaignTagListItem = z.infer<typeof CampaignTagListItemSchema>;