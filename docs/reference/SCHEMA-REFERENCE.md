# Bravo-1 Schema Reference Documentation

## Table of Contents

1. [Overview & Key Concepts](#overview--key-concepts)
2. [Business Context & Terminology](#business-context--terminology)
3. [Technical Architecture](#technical-architecture)
4. [Entity Schemas](#entity-schemas)
5. [Metrics & Calculations](#metrics--calculations)
6. [Implementation Guide](#implementation-guide)
7. [Validation & Business Rules](#validation--business-rules)
8. [Migration Strategy](#migration-strategy)
9. [Appendices](#appendices)

## Overview & Key Concepts

This document serves as the comprehensive schema reference for the Bravo-1 media planning application, using Zod as the single source of truth for type safety, validation, and documentation consistency across the entire stack.

### Key Principles

1. **Zod as Single Source of Truth**: All data validation and type generation flows from Zod schemas
2. **MongoDB Decimal128**: Financial precision compliance (ADR 0019)
3. **Discriminated Unions**: Type-safe line item variants
4. **Audit Trail**: Git-like versioning system for all entities
5. **Separation of Concerns**: Campaign (Zoho-owned) vs MediaStrategy (Bravo-owned) data

### Architecture Overview

```
Zod Schemas (Single Source of Truth)
    ├── TypeScript Types (via z.infer)
    ├── MongoDB Validation (via zod-to-json-schema)
    ├── API Validation (middleware)
    ├── OpenAPI Documentation (via zod-openapi)
    └── Business Rule Calculations (versioned)
```

## Business Context & Terminology

### Campaign/MediaStrategy Separation

**Important**: Campaign and MediaStrategy have a 1:1 relationship but are logically separated:

- **Campaign**: Contains Zoho-owned data (what the client purchased)
- **MediaStrategy**: Contains Bravo-owned data (how we execute the campaign)

In API responses, MediaStrategy is nested within Campaign for convenience:

```json
{
  "campaign": {
    "id": "...",
    "name": "Campaign Name",
    "mediaStrategy": {
      "id": "...",
      "objectives": "..."
    }
  }
}
```

### Terminology Alignment

| Business Term   | Database Field | API Field      | UI Display      |
| --------------- | -------------- | -------------- | --------------- |
| Campaign        | campaign       | campaign       | Campaign        |
| Media Strategy  | mediaStrategy  | mediaStrategy  | Media Strategy  |
| Line Item       | lineItem       | lineItem       | Line Item       |
| Pacing Schedule | pacingSchedule | pacingSchedule | Pacing Schedule |
| Budget Block    | budgetBlock    | budgetBlock    | Budget Block    |

## Technical Architecture

### Directory Structure

```
shared/src/schemas/
├── core/                       # Primitive types and utilities
│   ├── financial.schema.ts     # Financial amounts with precision (ADR 0019)
│   ├── dates.schema.ts         # Date handling with timezones
│   ├── identifiers.schema.ts   # ID types (ObjectId, external IDs)
│   ├── validation.schema.ts    # Shared validation utilities
│   └── units.schema.ts         # Unit type enumerations
├── entities/                   # Business entities
│   ├── account.schema.ts       # Account and team structures
│   ├── campaign.schema.ts      # Campaign (Zoho data)
│   ├── media-strategy.schema.ts # Media strategy (Bravo data)
│   ├── line-items/             # Line item types
│   │   ├── base.schema.ts      # Shared line item fields
│   │   ├── standard.schema.ts  # Standard line items
│   │   ├── management-fee.schema.ts
│   │   ├── zero-dollar.schema.ts
│   │   └── zero-margin.schema.ts
│   ├── pacing-schedule.schema.ts # Time-based allocations
│   └── media-buy.schema.ts     # Platform-specific buys
├── api/                        # API-specific schemas
│   ├── requests/               # Request validation
│   ├── responses/              # Response shaping
│   └── serialization.ts        # Decimal128 to string conversion
├── versioning/                 # Audit and versioning
│   ├── version-history.schema.ts
│   └── change-event.schema.ts
└── index.ts                    # Public exports
```

### MongoDB Decimal128 Implementation

All financial values use MongoDB's Decimal128 for precision:

```typescript
// Core financial schema
const FinancialAmountSchema = z.object({
  amount: DecimalSchema, // Custom Zod type for Decimal128
  currency: CurrencySchema.default('USD'),
});

// In MongoDB
{ price: Decimal128("12500.00") }

// In API (serialized as string)
{ "price": "12500.00" }

// TypeScript type
type FinancialAmount = {
  amount: Decimal128;
  currency: Currency;
}
```

## Entity Schemas

### Account Schema

| Field        | Type       | Description                       | Example                    | Notes                   |
| ------------ | ---------- | --------------------------------- | -------------------------- | ----------------------- |
| id           | ObjectId   | Unique account identifier         | "507f1f77bcf86cd799439011" | Primary key             |
| name         | string     | Account display name              | "Nike - North America"     | Required                |
| referralRate | Decimal128 | Account-level referral percentage | 0.03                       | Snapshots to line items |
| markupRate   | Decimal128 | Account-level markup percentage   | 0.15                       | Snapshots to line items |
| settings     | object     | Account preferences               | {}                         | Extensible              |
| createdAt    | ISODate    | Creation timestamp                | "2024-01-15T10:30:00Z"     | Auto-generated          |
| updatedAt    | ISODate    | Last update timestamp             | "2024-01-20T14:45:00Z"     | Auto-updated            |

### Campaign Schema (Zoho-Owned Fields)

| Field          | Type       | Description         | Example                      | Notes                  |
| -------------- | ---------- | ------------------- | ---------------------------- | ---------------------- |
| id             | ObjectId   | Campaign identifier | "507f1f77bcf86cd799439011"   | Primary key            |
| zohoId         | string     | Zoho CRM ID         | "ZOHO-12345"                 | External reference     |
| campaignNumber | string     | Display number      | "CN-2024-0125"               | Unique, human-readable |
| name           | string     | Campaign name       | "Summer 2024 Brand Campaign" | From Zoho              |
| accountId      | ObjectId   | Parent account      | "507f1f77bcf86cd799439011"   | Foreign key            |
| startDateZoho  | ISODate    | Zoho start date     | "2024-06-01T00:00:00Z"       | Zoho timeline          |
| endDateZoho    | ISODate    | Zoho end date       | "2024-08-31T23:59:59Z"       | Zoho timeline          |
| budgetZoho     | Decimal128 | Zoho budget         | 250000.00                    | What client purchased  |
| status         | enum       | Campaign status     | "active"                     | Workflow state         |

### MediaStrategy Schema (Bravo-Owned Fields)

| Field          | Type       | Description         | Example                        | Notes                |
| -------------- | ---------- | ------------------- | ------------------------------ | -------------------- |
| id             | ObjectId   | Strategy identifier | "507f1f77bcf86cd799439011"     | Primary key          |
| campaignId     | ObjectId   | Parent campaign     | "507f1f77bcf86cd799439011"     | 1:1 relationship     |
| objectives     | string     | Campaign objectives | "Increase brand awareness..."  | Strategy details     |
| targetAudience | object     | Audience definition | { age: "25-54", ... }          | Targeting params     |
| startDate      | ISODate    | Execution start     | "2024-06-01T00:00:00Z"         | Can differ from Zoho |
| endDate        | ISODate    | Execution end       | "2024-08-31T23:59:59Z"         | Can differ from Zoho |
| totalBudget    | Decimal128 | Allocated budget    | 245000.00                      | May differ from Zoho |
| channels       | array      | Media channels      | ["display", "video", "social"] | Execution channels   |

### Line Item Schemas

#### Base Line Item Fields (Shared)

| Field      | Type     | Description          | Example                    | Notes          |
| ---------- | -------- | -------------------- | -------------------------- | -------------- |
| id         | ObjectId | Line item identifier | "507f1f77bcf86cd799439011" | Primary key    |
| campaignId | ObjectId | Parent campaign      | "507f1f77bcf86cd799439011" | Denormalized   |
| strategyId | ObjectId | Parent strategy      | "507f1f77bcf86cd799439011" | Direct parent  |
| name       | string   | Line item name       | "Google Ads - Search"      | Display name   |
| type       | enum     | Line item type       | "standard"                 | Discriminator  |
| platform   | string   | Media platform       | "Google Ads"               | Platform name  |
| status     | enum     | Item status          | "active"                   | Workflow state |

#### Standard Line Item (type: "standard")

| Field        | Type       | Description         | Example  | Notes                 |
| ------------ | ---------- | ------------------- | -------- | --------------------- |
| totalPrice   | Decimal128 | Total cost          | 50000.00 | Contract value        |
| netPrice     | Decimal128 | Net after fees      | 42500.00 | Calculated            |
| unitType     | enum       | Pricing unit        | "CPM"    | See unit types        |
| unitCount    | integer    | Number of units     | 5000000  | Impressions           |
| unitPrice    | Decimal128 | Price per unit      | 10.00    | CPM rate              |
| markupRate   | Decimal128 | Markup percentage   | 0.15     | Snapshot from account |
| referralRate | Decimal128 | Referral percentage | 0.03     | Snapshot from account |

#### Management Fee Line Item (type: "managementFee")

| Field                 | Type        | Description         | Example | Notes                  |
| --------------------- | ----------- | ------------------- | ------- | ---------------------- |
| totalPrice            | Decimal128  | Fee amount          | 5000.00 | Fixed fee              |
| feeType               | enum        | Fee structure       | "fixed" | fixed/percentage       |
| feePercentage         | Decimal128? | If percentage-based | 0.10    | Optional               |
| associatedLineItemIds | ObjectId[]  | Related line items  | [...]   | Links to managed items |

#### Zero Dollar Line Item (type: "zeroDollar")

| Field         | Type        | Description     | Example                           | Notes            |
| ------------- | ----------- | --------------- | --------------------------------- | ---------------- |
| totalPrice    | Decimal128  | Always 0        | 0.00                              | Required to be 0 |
| reason        | string      | Why zero dollar | "Make good for Q1 under-delivery" | Explanation      |
| originalValue | Decimal128? | Value if priced | 10000.00                          | For reference    |

#### Zero Margin Line Item (type: "zeroMargin")

| Field      | Type       | Description     | Example                    | Notes                |
| ---------- | ---------- | --------------- | -------------------------- | -------------------- |
| totalPrice | Decimal128 | Total cost      | 25000.00                   | Pass-through pricing |
| costPrice  | Decimal128 | Actual cost     | 25000.00                   | Same as totalPrice   |
| reason     | string     | Why zero margin | "Publisher direct billing" | Explanation          |

### PacingSchedule Schema

| Field          | Type       | Description         | Example                    | Notes                   |
| -------------- | ---------- | ------------------- | -------------------------- | ----------------------- |
| id             | ObjectId   | Schedule identifier | "507f1f77bcf86cd799439011" | Primary key             |
| lineItemId     | ObjectId   | Parent line item    | "507f1f77bcf86cd799439011" | Foreign key             |
| budgetBlocks   | array      | Time allocations    | See BudgetBlock            | Time-based splits       |
| strategy       | enum       | Pacing strategy     | "even"                     | even/frontloaded/custom |
| totalAllocated | Decimal128 | Sum of blocks       | 50000.00                   | Must equal line item    |

### BudgetBlock Schema

| Field           | Type       | Description        | Example                | Notes            |
| --------------- | ---------- | ------------------ | ---------------------- | ---------------- |
| startDate       | ISODate    | Block start        | "2024-06-01T00:00:00Z" | Inclusive        |
| endDate         | ISODate    | Block end          | "2024-06-30T23:59:59Z" | Inclusive        |
| allocatedBudget | Decimal128 | Block budget       | 15000.00               | Portion of total |
| allocatedUnits  | integer    | Block units        | 1500000                | Impressions      |
| dailyBudget     | Decimal128 | Daily target       | 500.00                 | For pacing       |
| dailyUnits      | integer    | Daily target units | 50000                  | For pacing       |

## Metrics & Calculations

### Forward-Looking Metrics (Stored)

These are contractual values that must be persisted:

```typescript
// Stored on LineItem
{
  totalPrice: Decimal128("50000.00"),
  netPrice: Decimal128("42500.00"),    // totalPrice - fees
  unitCount: 5000000,                   // contracted impressions
  unitPrice: Decimal128("10.00"),      // CPM rate
}

// Calculations:
netPrice = totalPrice × (1 - markupRate - referralRate)
// Example: 50000 × (1 - 0.15 - 0.03) = 50000 × 0.82 = 41000
```

### Backward-Looking Metrics (Calculated)

Performance metrics calculated at runtime, with pacing always indexed at 100%:

```typescript
// Not stored - calculated from actual data
{
  deliveredUnits: 2500000,             // from platform data
  deliveredPercentage: 50,             // (delivered/contracted) × 100
  pacingIndex: 95,                     // vs expected at this time
  remainingBudget: 25000,              // totalBudget - spent
  projectedUnits: 4750000,             // based on current pace
}

// Pacing Calculation (always indexed at 100%):
expectedProgress = daysPassed / totalDays × 100
actualProgress = unitsDelivered / unitsContracted × 100
pacingIndex = (actualProgress / expectedProgress) × 100

// Example:
// Day 15 of 30, delivered 40% of units
// Expected: 50%, Actual: 40%
// Pacing: (40 / 50) × 100 = 80% (under-pacing)
```

## Implementation Guide

### Zod Schema Patterns

```typescript
// Financial amount with precision
const FinancialAmountSchema = z.object({
  amount: DecimalSchema,
  currency: CurrencySchema.default('USD'),
});

// Discriminated union for line items
const LineItemSchema = z.discriminatedUnion('type', [
  StandardLineItemSchema,
  ManagementFeeLineItemSchema,
  ZeroDollarLineItemSchema,
  ZeroMarginLineItemSchema,
]);

// Nested validation with refinements
const PacingScheduleSchema = z
  .object({
    lineItemId: ObjectIdSchema,
    budgetBlocks: z.array(BudgetBlockSchema),
    totalAllocated: DecimalSchema,
  })
  .refine(
    (data) => {
      const sum = data.budgetBlocks.reduce(
        (acc, block) => acc.add(block.allocatedBudget),
        new Decimal128(0)
      );
      return sum.equals(data.totalAllocated);
    },
    { message: 'Budget blocks must sum to total allocated' }
  );
```

### MongoDB Integration

```typescript
// Generate JSON Schema from Zod
import { zodToJsonSchema } from 'zod-to-json-schema';

const campaignJsonSchema = zodToJsonSchema(CampaignSchema);

// Apply to MongoDB collection
await db.command({
  collMod: 'campaigns',
  validator: { $jsonSchema: campaignJsonSchema },
  validationLevel: 'moderate',
  validationAction: 'warn',
});
```

### API Serialization

```typescript
// Middleware to handle Decimal128 serialization
const serializeDecimal = (obj: any): any => {
  if (obj instanceof Decimal128) {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimal);
  }
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serializeDecimal(v)]));
  }
  return obj;
};

// In API response
res.json(serializeDecimal(campaignData));
```

## Validation & Business Rules

### Required Field Validation

```typescript
// Campaign requires either Zoho dates OR execution dates
const CampaignValidation = CampaignSchema.refine(
  (data) => {
    return (
      (data.startDateZoho && data.endDateZoho) ||
      (data.mediaStrategy?.startDate && data.mediaStrategy?.endDate)
    );
  },
  { message: 'Campaign must have either Zoho dates or execution dates' }
);
```

### Business Rule Examples

1. **Budget Allocation**: Sum of line item budgets ≤ strategy total budget
2. **Date Constraints**: Line items cannot extend beyond strategy dates
3. **Pacing Schedule**: Budget blocks must cover entire line item period
4. **Zero Dollar Validation**: totalPrice must be exactly 0
5. **Zero Margin Validation**: totalPrice must equal costPrice

### Warning vs Error Validation

```typescript
// MongoDB validation levels
{
  validationLevel: 'moderate',  // Only validate new/modified docs
  validationAction: 'warn'      // Log warnings, don't reject
}

// Application-level warnings
const ValidationResult = z.object({
  valid: z.boolean(),
  errors: z.array(ValidationError),
  warnings: z.array(ValidationWarning)
});
```

## Migration Strategy

### Phase 1: Schema Implementation

1. Create Zod schemas in shared package
2. Generate TypeScript types
3. Update existing code to use new types

### Phase 2: Database Validation

1. Generate JSON schemas from Zod
2. Apply to MongoDB collections with 'warn' level
3. Monitor validation warnings
4. Fix data issues

### Phase 3: API Integration

1. Add validation middleware
2. Implement serialization layer
3. Generate OpenAPI documentation

### Phase 4: Full Enforcement

1. Switch validation to 'error' level
2. Require all data to pass validation
3. Remove legacy validation code

## Appendices

### Unit Types

```typescript
enum UnitType {
  CPM = 'CPM', // Cost per thousand impressions
  CPC = 'CPC', // Cost per click
  CPA = 'CPA', // Cost per action/acquisition
  CPV = 'CPV', // Cost per view
  CPCV = 'CPCV', // Cost per completed view
  CPE = 'CPE', // Cost per engagement
  CPD = 'CPD', // Cost per day
  FLAT = 'FLAT', // Flat fee
  IMPRESSIONS = 'IMPRESSIONS', // Direct impressions
  CLICKS = 'CLICKS', // Direct clicks
  CONVERSIONS = 'CONVERSIONS', // Direct conversions
  PERCENTAGE = 'PERCENTAGE', // Percentage of spend
}
```

### Field Naming Conventions

1. **Consistency**: API field names match database field names exactly
2. **Zoho Fields**: Suffixed with "Zoho" (e.g., `startDateZoho`)
3. **Calculated Fields**: Not stored, computed at runtime
4. **Financial Fields**: Always use Decimal128 type
5. **Dates**: Always store in UTC

### Display Names Reference

| API Field       | UI Display       | Context             |
| --------------- | ---------------- | ------------------- |
| campaignNumber  | Campaign #       | Tables, headers     |
| totalPrice      | Total Investment | Financial summaries |
| netPrice        | Net Cost         | After fees          |
| unitType        | Pricing Model    | Line item details   |
| pacingIndex     | Pacing %         | Performance metrics |
| allocatedBudget | Scheduled Spend  | Budget blocks       |

### Important Implementation Notes

1. **Decimal128 Handling**: All financial values must use Decimal128 for precision (ADR 0019)
2. **Snapshot vs Reference**: Account rates are snapshotted to line items at creation
3. **Validation Flexibility**: Use warnings for business logic that might need flexibility
4. **API Serialization**: Decimal128 values serialize to strings in JSON
5. **Schema Evolution**: Design schemas to be extensible without breaking changes
