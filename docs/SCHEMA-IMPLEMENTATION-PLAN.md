# Zod Single Source of Truth Implementation Plan for Bravo-1

## Executive Summary

This document outlines the implementation plan for creating a unified schema system using Zod as the single source of truth for the Bravo-1 media planning application. The goal is to ensure type safety, validation, and documentation consistency across the entire stack while properly handling the complex business rules for media campaign management.

## Key Requirements

Based on analysis of the Confluence documentation and codebase:

1. **Account-Level Settings**: Referral commissions and agency markup rates flow from accounts to campaigns
2. **Forward-Looking Metrics**: Contractual values that must be persisted and never recalculated
3. **Backward-Looking Metrics**: Performance metrics calculated at runtime
4. **Special Line Item Types**: Standard, management fee, zero dollar, and zero margin
5. **Headless API**: OpenAPI documentation for external consumers (AI agents, partners)
6. **Business Rule Versioning**: Support for evolving calculation logic

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
│   ├── financial.schema.ts     # Financial amounts with precision
│   ├── units.schema.ts         # Unit types (impressions, clicks, etc.)
│   ├── dates.schema.ts         # Date ranges and periods
│   └── validation.schema.ts    # Common validations (ObjectId, etc.)
├── entities/                   # Domain entities
│   ├── account.schema.ts       # Account with settings
│   ├── campaign.schema.ts      # Campaign with modifiers
│   ├── strategy.schema.ts      # Strategy level
│   ├── line-item.schema.ts     # Line items with types
│   └── media-buy.schema.ts     # Media buy entities
├── metrics/
│   ├── forward/               # Contractual (persisted)
│   │   ├── pricing.schema.ts
│   │   ├── commission.schema.ts
│   │   └── estimates.schema.ts
│   ├── backward/              # Performance (runtime)
│   │   ├── delivery.schema.ts
│   │   ├── spend.schema.ts
│   │   └── margin.schema.ts
│   └── calculations/          # Business rules
│       ├── v1.0/
│       └── registry.ts
├── api/
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
- Define account schema with referral commission and agency markup settings
- Create campaign schemas that inherit from account settings
- Implement snapshot mechanism for audit trails

#### Line Item Type System
- Create discriminated union for all line item types
- Define input requirements for each type
- Implement calculation rules specific to each type

### Phase 3: Metrics & Calculations (Week 2-3)

#### Forward-Looking Metrics (Persisted)
- Define schemas for contractual values
- Implement immutability constraints
- Create calculation functions that run at creation/update time

#### Backward-Looking Metrics (Runtime)
- Define schemas for performance metrics
- Create calculation functions that run on-demand
- Implement pacing algorithms

#### Business Rule Versioning
- Create versioned calculation modules
- Implement version registry
- Add migration support for rule changes

### Phase 4: API Integration (Week 3-4)

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

### Phase 5: MongoDB Integration (Week 4)

#### Schema Validation
- Convert Zod schemas to JSON Schema format
- Apply validation rules to MongoDB collections
- Create indexes based on query patterns

#### Migration Tools
- Build scripts to add calculated fields to existing data
- Create validation reports for data integrity
- Implement rollback procedures

### Phase 6: Testing & Documentation (Week 5)

#### Testing Strategy
- Unit tests for all calculation functions
- Integration tests for schema validation
- End-to-end tests for API workflows

#### Documentation
- Generate TypeScript documentation from schemas
- Create API documentation from OpenAPI
- Write migration guides for developers

## Technical Specifications

### Zod Schema Patterns

#### Input vs Storage Schemas
```typescript
// Input: What users provide
const CampaignInputSchema = z.object({
  name: z.string(),
  accountId: z.string(),
  price: z.number(),
  targetMargin: z.number(),
});

// Storage: Input + calculated fields
const CampaignStorageSchema = CampaignInputSchema.extend({
  _id: z.string(),
  netRevenue: z.number(),
  mediaBudget: z.number(),
  calculatedAt: z.date(),
  calculationVersion: z.string(),
});
```

#### Discriminated Unions
```typescript
const LineItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('standard'), price: z.number(), unitPrice: z.number() }),
  z.object({ type: z.literal('management_fee'), managementFee: z.number() }),
  z.object({ type: z.literal('zero_dollar'), mediaBudget: z.number() }),
  z.object({ type: z.literal('zero_margin'), price: z.number() }),
]);
```

### OpenAPI Integration

```typescript
import { extendZodWithOpenApi } from '@anatine/zod-openapi';

extendZodWithOpenApi(z);

const PriceSchema = z
  .number()
  .openapi({
    description: 'Amount Brkthru charges the client',
    example: 100000.00
  });
```

### MongoDB Validation

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

const campaignValidator = {
  $jsonSchema: zodToJsonSchema(CampaignStorageSchema)
};

db.createCollection('campaigns', {
  validator: campaignValidator,
  validationLevel: 'strict'
});
```

## Migration Strategy

### Phase 1: Add Accounts Collection
1. Create accounts collection with referral/markup data
2. Link existing campaigns to accounts
3. Backfill commission rates from historical data

### Phase 2: Calculate Forward Metrics
1. Add calculated fields to existing documents
2. Run calculation service on all records
3. Verify totals match current values

### Phase 3: Enable Validation
1. Apply schema validation to new records
2. Fix any validation errors in existing data
3. Enable strict validation mode

## Success Metrics

1. **Type Safety**: 100% of API endpoints have schema validation
2. **Documentation**: OpenAPI spec covers all endpoints
3. **Data Integrity**: Zero validation errors in production
4. **Performance**: Calculation overhead < 50ms per request
5. **Developer Experience**: Schema changes automatically propagate

## Risk Mitigation

1. **Backward Compatibility**: Maintain version support for 6 months
2. **Data Migration**: Test on staging with full production data
3. **Performance**: Index all fields used in calculations
4. **Validation Errors**: Implement graceful degradation

## Next Steps

1. Review and approve schema field names (see SCHEMA-FIELD-REFERENCE.md)
2. Set up development environment with test data
3. Implement Phase 1 schemas
4. Create proof-of-concept API endpoint
5. Gather feedback and iterate