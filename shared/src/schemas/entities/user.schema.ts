import * as z from 'zod/v4';
import {
  ObjectIdSchema,
  NonEmptyStringSchema,
  TrimmedStringSchema,
  AuditFieldsSchema,
} from '../core/validation.schema';
import { DateSchema } from '../core/dates.schema';

// Job family enum
export const JobFamilyEnumSchema = z.enum([
  'sales',
  'account_management',
  'media_trading',
  'operations',
  'finance',
  'leadership',
  'technology',
  'creative',
  'strategy',
  'other',
]);

// User role enum
export const UserRoleEnumSchema = z.enum([
  'csd', // Client Services Director (sales)
  'account_manager',
  'senior_account_manager',
  'media_trader',
  'senior_media_trader',
  'media_director',
  'operations_manager',
  'finance_manager',
  'admin',
  'viewer',
]);

// Out of office period
export const OutOfOfficePeriodSchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
  reason: z.enum(['vacation', 'sick_leave', 'business_travel', 'personal', 'other']).optional(),
  backupUserId: ObjectIdSchema.optional(),
  backupUserName: TrimmedStringSchema.optional(),
  autoReplyMessage: z.string().optional(),
});

// User preferences schema
export const UserPreferencesSchema = z.object({
  // Display preferences
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().default('en'),
  timezone: z.string().default('UTC'),
  dateFormat: z.string().default('MM/DD/YYYY'),
  numberFormat: z.enum(['comma', 'period']).default('comma'), // 1,000.00 vs 1.000,00

  // Notification preferences
  emailNotifications: z
    .object({
      campaignUpdates: z.boolean().default(true),
      performanceAlerts: z.boolean().default(true),
      systemAnnouncements: z.boolean().default(true),
      dailyDigest: z.boolean().default(false),
    })
    .default({
      campaignUpdates: true,
      performanceAlerts: true,
      systemAnnouncements: true,
      dailyDigest: false
    }),

  // Dashboard preferences
  defaultDashboard: z
    .enum(['campaigns', 'performance', 'financial', 'custom'])
    .default('campaigns'),
  favoriteMetrics: z.array(z.string()).default([]),

  // AI/LLM preferences
  aiAssistant: z
    .object({
      enabled: z.boolean().default(true),
      personalizedPrompts: z
        .array(
          z.object({
            name: NonEmptyStringSchema,
            prompt: NonEmptyStringSchema,
            category: z.enum(['summary', 'analysis', 'reporting', 'other']),
          })
        )
        .default([]),
      summaryPreferences: z
        .object({
          includeFinancials: z.boolean().default(true),
          includePerformance: z.boolean().default(true),
          includeRisks: z.boolean().default(true),
          customPriorities: z.array(z.string()).default([]),
        })
        .default({
          includeFinancials: true,
          includePerformance: true,
          includeRisks: true,
          customPriorities: []
        }),
    })
    .default({
      enabled: true,
      personalizedPrompts: [],
      summaryPreferences: {
        includeFinancials: true,
        includePerformance: true,
        includeRisks: true,
        customPriorities: []
      }
    }),
});

// Main user entity schema
export const UserEntitySchema = z
  .object({
    _id: ObjectIdSchema,

    // Basic info
    email: TrimmedStringSchema,
    firstName: NonEmptyStringSchema,
    lastName: NonEmptyStringSchema,
    displayName: NonEmptyStringSchema,
    avatar: z.string().url().optional(),

    // Professional info
    jobTitle: TrimmedStringSchema,
    jobFamily: JobFamilyEnumSchema,
    role: UserRoleEnumSchema,
    department: TrimmedStringSchema.optional(),

    // Manager relationship
    managerId: ObjectIdSchema.optional(),
    managerName: TrimmedStringSchema.optional(),
    directReports: z.array(ObjectIdSchema).default([]),

    // Team memberships
    teams: z
      .array(
        z.object({
          teamId: ObjectIdSchema,
          teamName: NonEmptyStringSchema,
          role: z.enum(['lead', 'member']),
          joinedAt: DateSchema,
        })
      )
      .default([]),

    // Account assignments
    assignedAccounts: z
      .array(
        z.object({
          accountId: ObjectIdSchema,
          accountName: NonEmptyStringSchema,
          role: z.enum(['primary', 'secondary', 'backup']),
          assignedAt: DateSchema,
        })
      )
      .default([]),

    // Campaign assignments
    assignedCampaigns: z
      .array(
        z.object({
          campaignId: ObjectIdSchema,
          campaignName: NonEmptyStringSchema,
          role: z.enum(['csd', 'account_manager', 'media_trader', 'viewer']),
          assignedAt: DateSchema,
        })
      )
      .default([]),

    // Out of office
    outOfOffice: z
      .object({
        isOutOfOffice: z.boolean().default(false),
        currentPeriod: OutOfOfficePeriodSchema.optional(),
        upcomingPeriods: z.array(OutOfOfficePeriodSchema).default([]),
        historicalPeriods: z.array(OutOfOfficePeriodSchema).default([]),
      })
      .default({
        isOutOfOffice: false,
        upcomingPeriods: [],
        historicalPeriods: []
      }),

    // Backup relationships
    primaryBackup: z
      .object({
        userId: ObjectIdSchema,
        userName: NonEmptyStringSchema,
      })
      .optional(),
    secondaryBackup: z
      .object({
        userId: ObjectIdSchema,
        userName: NonEmptyStringSchema,
      })
      .optional(),

    // Preferences
    preferences: UserPreferencesSchema.default({
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      numberFormat: 'comma',
      emailNotifications: {
        campaignUpdates: true,
        performanceAlerts: true,
        systemAnnouncements: true,
        dailyDigest: false
      },
      defaultDashboard: 'campaigns',
      favoriteMetrics: [],
      aiAssistant: {
        enabled: true,
        personalizedPrompts: [],
        summaryPreferences: {
          includeFinancials: true,
          includePerformance: true,
          includeRisks: true,
          customPriorities: []
        }
      }
    }),

    // External system IDs
    zohoUserId: TrimmedStringSchema.optional(),
    slackUserId: TrimmedStringSchema.optional(),
    googleWorkspaceId: TrimmedStringSchema.optional(),

    // Permissions (simplified, could be expanded)
    permissions: z.array(z.string()).default([]),
    isAdmin: z.boolean().default(false),

    // Status
    isActive: z.boolean().default(true),
    lastLoginAt: DateSchema.optional(),
    lastActivityAt: DateSchema.optional(),

    // Metadata
    tags: z.array(TrimmedStringSchema).default([]),
    customFields: z.record(z.string(), z.any()).default({}),
  })
  .extend(AuditFieldsSchema.shape);

// User input schema (for creation)
export const UserInputSchema = z.object({
  email: TrimmedStringSchema,
  firstName: NonEmptyStringSchema,
  lastName: NonEmptyStringSchema,
  displayName: NonEmptyStringSchema.optional(), // Can be auto-generated
  avatar: z.string().url().optional(),

  jobTitle: TrimmedStringSchema,
  jobFamily: JobFamilyEnumSchema,
  role: UserRoleEnumSchema,
  department: TrimmedStringSchema.optional(),

  managerId: ObjectIdSchema.optional(),

  zohoUserId: TrimmedStringSchema.optional(),
  preferences: UserPreferencesSchema.optional(),
});

// User update schema
export const UserUpdateSchema = UserInputSchema.partial().extend({
  outOfOffice: z
    .object({
      isOutOfOffice: z.boolean(),
      currentPeriod: OutOfOfficePeriodSchema.optional(),
    })
    .optional(),
  primaryBackup: z
    .object({
      userId: ObjectIdSchema,
    })
    .optional(),
  secondaryBackup: z
    .object({
      userId: ObjectIdSchema,
    })
    .optional(),
});

// User list item (for grids/dropdowns)
export const UserListItemSchema = z.object({
  _id: ObjectIdSchema,
  email: TrimmedStringSchema,
  displayName: NonEmptyStringSchema,
  avatar: z.string().url().optional(),
  jobTitle: TrimmedStringSchema,
  role: UserRoleEnumSchema,
  isActive: z.boolean(),
  isOutOfOffice: z.boolean(),
  managerName: TrimmedStringSchema.optional(),
});

// User profile (for detailed views)
export const UserProfileSchema = UserEntitySchema.pick({
  _id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatar: true,
  jobTitle: true,
  jobFamily: true,
  role: true,
  department: true,
  managerId: true,
  managerName: true,
  teams: true,
  assignedAccounts: true,
  outOfOffice: true,
  preferences: true,
  lastLoginAt: true,
});

// Types
export type UserEntity = z.infer<typeof UserEntitySchema>;
export type UserInput = z.infer<typeof UserInputSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserListItem = z.infer<typeof UserListItemSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type OutOfOfficePeriod = z.infer<typeof OutOfOfficePeriodSchema>;
export type JobFamilyType = z.infer<typeof JobFamilyEnumSchema>;
export type UserRoleType = z.infer<typeof UserRoleEnumSchema>;
