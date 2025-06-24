# Zod Single Source of Truth Implementation Plan for Bravo-1

## Executive Summary

This document outlines the implementation plan for creating a unified schema system using Zod as the single source of truth for the Bravo-1 media planning application. The goal is to ensure type safety, validation, and documentation consistency across the entire stack while properly handling the complex business rules for media campaign management.

## Key Requirements

Based on analysis of the Confluence documentation and codebase:

1. **Account-Level Settings**: Referral/markup rates are snapshots (copied at creation, not live references)
2. **Campaign/MediaStrategy Separation**: 1:1 relationship distinguishing Zoho-owned vs Bravo-owned data
3. **Forward-Looking Metrics**: Contractual values that must be persisted on their entities
4. **Backward-Looking Metrics**: Performance metrics calculated at runtime (pacing indexed at 100%)
5. **Special Line Item Types**: Standard, management fee, zero dollar, and zero margin
6. **PacingSchedule & BudgetBlocks**: Time-based budget allocation for each line item
7. **Headless API**: OpenAPI documentation with identical field names (no transformation)
8. **Business Rule Versioning**: Support for evolving calculation logic
9. **Financial Precision**: ADR 0019 compliance - NUMERIC in DB, strings in API

## Architecture Overview

```
Zod Schemas (Single Source of Truth)
    ├── TypeScript Types (via z.infer)
    ├── MongoDB Validation (via zod-to-json-schema)
    ├── API Validation (middleware)
    ├── OpenAPI Documentation (via zod-openapi)
    └── Business Rule Calculations (versioned)
```

## Implementation Phases

### Phase 1: Schema Architecture & Organization (Week 1)

#### Directory Structure
```
shared/src/schemas/
├── core/                       # Primitive types and utilities
│   ├── financial.schema.ts     # Financial amounts with precision (ADR 0019)
│   ├── units.schema.ts         # Unit types (impressions, clicks, etc.)
│   ├── dates.schema.ts         # Date ranges and periods
│   └── validation.schema.ts    # Common validations (ObjectId, etc.)
├── entities/                   # Domain entities
│   ├── account.schema.ts       # Account with referral/markup settings
│   ├── campaign.schema.ts      # Campaign with nested MediaStrategy
│   ├── line-item/              # Line items with discriminated unions
│   │   ├── base.schema.ts      # Common fields including mediaBudget
│   │   ├── standard.schema.ts  # Standard line item type
│   │   ├── management-fee.schema.ts
│   │   ├── zero-dollar.schema.ts
│   │   └── zero-margin.schema.ts
│   ├── pacing-schedule.schema.ts  # PacingSchedule with BudgetBlocks
│   └── media-buy.schema.ts     # Media buy entities
├── calculations/              # Business rules by version
│   ├── v1.0/
│   │   ├── forward-metrics.ts # Persisted calculations
│   │   ├── pacing-metrics.ts  # Runtime pacing (100% indexed)
│   │   └── line-item-rules.ts # Type-specific logic
│   └── registry.ts
├── versioning/                # Audit trail schemas
│   ├── version-history.schema.ts
│   ├── campaign-tag.schema.ts # Git-like tags
│   ├── changeset.schema.ts
│   ├── field-change.schema.ts
│   └── retrieval.service.ts  # Point-in-time retrieval
├── validation/
│   ├── rules/                 # Business validation rules
│   ├── response.schema.ts     # Errors + warnings
│   └── validators.ts
├── api/
│   ├── serialization.ts       # ADR 0019 string conversion
│   ├── requests/              # API input schemas
│   ├── responses/             # API output schemas
│   └── openapi.ts             # OpenAPI config
└── index.ts                   # Public exports
```

#### Key Design Decisions

1. **Separate Input/Storage/Output Schemas**: Clear boundaries between what users provide, what gets stored, and what APIs return
2. **Discriminated Unions for Line Items**: Type-safe handling of different line item types
3. **Version Tracking**: Every calculated value includes version metadata
4. **Precision Handling**: Financial amounts use string representation in APIs per ADR 0019

### Phase 2: Core Schema Implementation (Week 2)

#### Financial Primitives
- Implement base schemas for financial amounts with proper precision
- Create percentage types with validation (0-100% range)
- Add currency and rounding utilities

#### Account & Campaign Schemas
- Define account schema with referralRate and agencyMarkupRate
- Create campaign schema with Zoho fields suffixed with "(zoho)"
- MediaStrategy fields are flat on campaign (no nesting)
- Implement initialReferralRate and initialAgencyMarkupRate snapshots

#### Line Item Type System
- Create discriminated union for all line item types
- Define input requirements for each type
- Implement calculation rules specific to each type

### Phase 3: Metrics & Calculations (Week 2-3)

#### Forward-Looking Metrics (Persisted)
- Store metrics directly on their entities (estimatedUnits on line items)
- Different input vs calculated rules per line item type
- Implement validation for BudgetBlock sum matching line item totals
- Create default PacingSchedule (single block) for every line item

#### Backward-Looking Metrics (Runtime)
- Base metrics: actualUnitsDelivered, actualMediaSpend
- Pacing metrics indexed at 100% (per Confluence 387678209)
- Separate pacing (vs on-pace target) from progress (vs total)
- Use netRevenue for all revenue calculations

#### Business Rule Versioning & Validation
- Create versioned calculation modules
- Implement validation rules returning errors + warnings
- Add version registry for calculation rules
- Design changeset grouping for related changes

### Phase 4: Version Control System (Week 3)

#### Git-like Version Tags
- Implement campaign-wide version tags
- Store entity version mappings in each tag
- Create tag types: release, milestone, checkpoint
- Support tag naming and descriptions

#### Point-in-Time Retrieval
- Build service to reconstruct campaign state at any tag
- Support retrieval by tag name or timestamp
- Optimize with indexes on campaignId + timestamp
- Cache frequently accessed historical versions

### Phase 5: API Integration (Week 4)

#### Request/Response Validation
- Create validation middleware using Zod schemas
- Implement transform functions for API serialization
- Add error formatting for validation failures

#### OpenAPI Generation
- Configure zod-openapi for automatic documentation
- Define API endpoints with full schema metadata
- Generate Swagger UI for testing

#### External API Support
- Ensure all endpoints are documented
- Add authentication schemas
- Create client SDKs from OpenAPI spec

### Phase 6: MongoDB Integration (Week 4-5)

#### Schema Validation
- Convert Zod schemas to JSON Schema format
- Apply validation rules to MongoDB collections
- Create indexes based on query patterns

#### Migration Tools
- Build scripts to add calculated fields to existing data
- Create validation reports for data integrity
- Implement rollback procedures

### Phase 7: Testing & Documentation (Week 5)

#### Testing Strategy
- Unit tests for all calculation functions
- Integration tests for schema validation
- End-to-end tests for API workflows

#### Documentation
- Generate TypeScript documentation from schemas
- Create API documentation from OpenAPI
- Write migration guides for developers

## Technical Specifications

### MongoDB Decimal128 Type

MongoDB's Decimal128 provides exact decimal representation matching PostgreSQL's NUMERIC:

```javascript
// In MongoDB
{ price: Decimal128("100000.00") }

// In Node.js with MongoDB driver
import { Decimal128 } from 'mongodb';
const price = Decimal128.fromString("100000.00");

// API serialization per ADR 0019
const apiResponse = {
  price: price.toString() // "100000.00"
};
```

### Zod Schema Patterns

#### Input vs Storage Schemas
```typescript
// Campaign with mixed Zoho and Bravo fields
const CampaignSchema = z.object({
  _id: z.string(),
  name: z.string(),
  campaignNumber: z.string(),
  accountId: z.string(),
  status: z.enum(['active', 'inactive']),
  
  // Zoho-owned fields (with suffix)
  startDateZoho: z.date(),
  endDateZoho: z.date(),
  referralRateZoho: z.coerce.number().optional(), // Decimal128 in MongoDB
  agencyMarkupRateZoho: z.coerce.number().optional(),
  
  // Bravo-owned fields (MediaStrategy)
  startDate: z.date(),
  endDate: z.date(),
  price: z.number(),
  referralRate: z.number().optional(), // Overrides Zoho
  agencyMarkupRate: z.number().optional(), // Overrides Zoho
  
  // Calculated fields
  netRevenue: z.number(),
  mediaBudget: z.number(),
  calculatedAt: z.date(),
  calculationVersion: z.string(),
  
  // Snapshots
  initialReferralRate: z.number().optional(),
  initialAgencyMarkupRate: z.number().optional(),
});
```

#### Discriminated Unions
```typescript
// Base schema with common fields
const LineItemBaseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  campaignId: z.string(),
  strategyId: z.string(),
  unitType: z.enum(['impressions', 'clicks', 'conversions']),
  flightDates: z.object({ start: z.date(), end: z.date() }),
  mediaBudget: z.number(), // All types have this
  estimatedUnits: z.number(), // Persisted forward metric
});

// Discriminated union for types
const LineItemSchema = z.discriminatedUnion('type', [
  LineItemBaseSchema.extend({
    type: z.literal('standard'),
    price: z.number(),
    unitPrice: z.number(),
    targetMargin: z.number(),
  }),
  LineItemBaseSchema.extend({
    type: z.literal('management_fee'),
    managementFee: z.number(),
    // mediaBudget and estimatedUnits are user inputs
  }),
  LineItemBaseSchema.extend({
    type: z.literal('zero_dollar'),
    // mediaBudget and estimatedUnits are user inputs
    justification: z.string(),
  }),
  LineItemBaseSchema.extend({
    type: z.literal('zero_margin'),
    price: z.number(),
    // estimatedUnits is user input
    justification: z.string(),
  }),
]);
```

### OpenAPI Integration

```typescript
import { extendZodWithOpenApi } from '@anatine/zod-openapi';

extendZodWithOpenApi(z);

// ADR 0019 compliant financial schema with MongoDB Decimal128
const PriceSchema = z
  .number()
  .transform((val) => val.toString()) // API serialization
  .openapi({
    description: 'Amount Brkthru charges the client',
    example: '100000.00',
    type: 'string',
    format: 'decimal'
  });

// Validation response schema
const ValidationResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string(),
  })),
  warnings: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  data: z.any().optional(),
});

// PacingSchedule schema
const BudgetBlockSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  price: z.number(),
  units: z.number(), // Calculated from price / unitPrice
});

const PacingScheduleSchema = z.object({
  _id: z.string(),
  lineItemId: z.string(),
  budgetBlocks: z.array(BudgetBlockSchema).min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Campaign Version Tag (like git commit/tag)
const CampaignTagSchema = z.object({
  _id: z.string(),
  campaignId: z.string(),
  tagName: z.string(),
  tagType: z.enum(['release', 'milestone', 'checkpoint']),
  description: z.string(),
  userId: z.string(),
  timestamp: z.date(),
  entityVersions: z.object({
    mediaStrategy: z.number(),
    lineItems: z.record(z.string(), z.number()),
    pacingSchedules: z.record(z.string(), z.number()),
  }),
});
```

### MongoDB Validation

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

// MongoDB with Decimal128 support
const campaignValidator = {
  $jsonSchema: {
    ...zodToJsonSchema(CampaignStorageSchema),
    properties: {
      price: { bsonType: 'decimal' },
      netRevenue: { bsonType: 'decimal' },
      mediaBudget: { bsonType: 'decimal' },
      referralRate: { bsonType: 'decimal' },
      agencyMarkupRate: { bsonType: 'decimal' },
    }
  }
};

db.createCollection('campaigns', {
  validator: campaignValidator,
  validationLevel: 'strict'
});

// Version history collection
db.createCollection('version_history', {
  validator: versionHistoryValidator
});

// Campaign version tags (like git tags)
db.createCollection('campaign_tags', {
  validator: campaignTagValidator,
  indexes: [
    { campaignId: 1, tagName: 1 }, // Unique per campaign
    { campaignId: 1, timestamp: -1 }
  ]
});
```

## Migration Strategy

### Phase 1: Add Accounts Collection
1. Create accounts collection with referralRate/agencyMarkupRate
2. Link existing campaigns to accounts
3. Migrate referralCommissionRate → referralRate
4. Migrate agencyMarkupRate fields

### Phase 2: Calculate Forward Metrics
1. Add forward metrics directly to line items (estimatedUnits, etc.)
2. Create PacingSchedule for each line item with default BudgetBlock
3. Run calculation service respecting line item type rules
4. Verify BudgetBlock sums match line item totals
5. Create initial version history entries for all entities

### Phase 3: Enable Validation
1. Apply schema validation to new records
2. Fix any validation errors in existing data
3. Enable strict validation mode

## Success Metrics

1. **Type Safety**: 100% of API endpoints have schema validation
2. **Field Alignment**: API and DB field names are identical
3. **Documentation**: OpenAPI spec with display names for all fields
4. **Data Integrity**: BudgetBlock validation, forward metric immutability
5. **Pacing Accuracy**: Runtime metrics match Confluence specifications
6. **Version Control**: Complete point-in-time retrieval like git
7. **Performance**: Calculation overhead < 50ms, version retrieval < 100ms
8. **Developer Experience**: Single source of truth, automatic propagation

## Risk Mitigation

1. **Backward Compatibility**: Maintain version support for 6 months
2. **Data Migration**: Test on staging with full production data
3. **Performance**: Index all fields used in calculations and version queries
4. **Validation Errors**: Return warnings without blocking updates
5. **Decimal Precision**: Use MongoDB Decimal128 to match PostgreSQL NUMERIC
6. **Audit Trail**: Ensure version history doesn't grow unbounded

## Next Steps

1. Review and approve schema field names (see SCHEMA-FIELD-REFERENCE.md)
2. Set up development environment with test data
3. Implement Phase 1 schemas
4. Create proof-of-concept API endpoint
5. Gather feedback and iterate