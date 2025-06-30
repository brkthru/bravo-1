# Bravo-1 Architecture

## Table of Contents

1. [Overview](#overview)
2. [Key Differences from Media-Tool](#key-differences-from-media-tool)
3. [Headless API Architecture](#headless-api-architecture)
4. [Technology Stack](#technology-stack)
5. [System Architecture](#system-architecture)
6. [Data Architecture](#data-architecture)
7. [Business Logic Centralization](#business-logic-centralization)
8. [Schema-First Development](#schema-first-development)
9. [Financial Precision Implementation](#financial-precision-implementation-adr-0019)
10. [Application Layers](#application-layers)
11. [Security Architecture](#security-architecture)
12. [Development & Deployment](#development--deployment)
13. [Frontend Architecture](#frontend-architecture)
14. [UI Component Architecture](#ui-component-architecture)
15. [Decision Records](#decision-records)
16. [Future Considerations](#future-considerations)

## Overview

Bravo-1 is a ground-up rewrite of the media-tool system, designed with modern architecture principles:

- **Headless API**: True API-first design supporting multiple consumers
- **Document Store**: MongoDB for flexible, scalable data modeling
- **Centralized Business Logic**: Single source of truth for calculations and rules
- **Versioned Everything**: Audit trails for all business logic changes
- **Test-Driven Development**: Mandatory TDD with comprehensive coverage

### Core Design Principles

1. **API-First**: The headless API is the only way to interact with data
2. **Schema-First**: Zod schemas drive all type definitions and validations
3. **Version-First**: All business logic changes are versioned and tracked
4. **Test-First**: TDD is mandatory, not optional

## Key Differences from Media-Tool

### 1. Database Architecture

| Aspect            | Media-Tool                    | Bravo-1                        |
| ----------------- | ----------------------------- | ------------------------------ |
| Database          | PostgreSQL with 30+ views     | MongoDB document store         |
| Schema Management | SQL migrations & triggers     | Zod schemas with versioning    |
| Relationships     | Complex JOINs across tables   | Separate collections with refs |
| Calculated Fields | SQL views & stored procedures | Versioned calculation engine   |

### 2. Business Logic

| Aspect      | Media-Tool                         | Bravo-1                           |
| ----------- | ---------------------------------- | --------------------------------- |
| Location    | Scattered (SQL, frontend, backend) | Centralized calculation engine    |
| Versioning  | Database triggers                  | Explicit version tracking         |
| Validation  | Multiple layers, inconsistent      | Multi-level with clear separation |
| Audit Trail | Database-level                     | Application-level with context    |

### 3. API Design

| Aspect        | Media-Tool           | Bravo-1                         |
| ------------- | -------------------- | ------------------------------- |
| Architecture  | Backend for Frontend | True Headless API               |
| Documentation | Minimal              | OpenAPI/Swagger auto-generated  |
| Versioning    | None                 | URL-based (v0, v1)              |
| Consumers     | Single frontend      | Multiple (web, MCP, automation) |

## Headless API Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Consumers                        │
│  Web Frontend │ MCP Servers │ Automation │ Future Clients  │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS/REST
                               │
┌─────────────────────────────────────────────────────────────┐
│                    Headless API (v0)                         │
│                   api.domain.com/v0/*                        │
│  Express 4 + TypeScript + OpenAPI + Versioned Logic         │
│                    Node.js Server (3001)                     │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ MongoDB Protocol
                               │
┌─────────────────────────────────────────────────────────────┐
│                         MongoDB                              │
│                    Docker Container (27017)                  │
│     Separate Collections: campaigns, strategies, etc.        │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

- **Framework**: React 18.2.0
- **Language**: TypeScript 5.2.2
- **Styling**: Tailwind CSS 3.3.6 + @tailwindcss/forms
- **UI Components**:
  - HeadlessUI 1.7.17 (actively used for accessible components)
  - Heroicons 2.0.18
  - Custom components with Tailwind
- **Data Grid**: AG-Grid 33.3.2 (Community + Enterprise)
- **Charts**: Recharts 2.8.0
- **State Management**: React Context + TanStack Query 5.15.0
- **Routing**: React Router DOM 6.20.1
- **Build Tool**: Vite 5.0.8

### Backend

- **Runtime**: Node.js
- **Framework**: Express 4.19.2
- **Language**: TypeScript 5.3.3
- **Database Driver**: MongoDB Native 6.3.0
- **Validation**: Zod 3.25.0 (v4 features)
- **Authentication**: bcryptjs 2.4.3 + jsonwebtoken 9.0.2
- **HTTP Client**: Axios 1.6.2
- **Utilities**: Lodash 4.17.21

### Shared

- **Validation**: Zod 3.25.0 as single source of truth
- **Types**: Shared TypeScript interfaces
- **Business Logic**: Common utilities and helpers

### Database

- **Primary**: MongoDB 7.0
- **Deployment**: Docker container (bravo1_mongodb)
- **Collections**:
  - campaigns (13,417 documents)
  - strategies (13,417 documents)
  - lineItems (3,343 documents)
  - mediaBuys (56,020 documents)
  - platformEntities (142,333 documents)
  - users
  - teams

### Development Tools

- **Package Manager**: npm/bun
- **Testing**:
  - Jest (unit/integration)
  - Playwright (E2E)
  - React Testing Library
- **Linting**: ESLint with TypeScript plugins
- **Code Formatting**: Prettier (implied)
- **Version Control**: Git

## System Architecture

### Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser       │────▶│   Vite Server   │────▶│  Express API    │
│   (Client)      │     │   (Dev: 5174)   │     │   (Port: 3001)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   MongoDB       │
                                                 │ (Docker: 27017) │
                                                 └─────────────────┘
```

### Directory Structure

```
bravo-1/
├── headless-api/     # Express REST API
├── frontend/         # React application
├── shared/           # Shared types and schemas
├── bff-backend/      # (Future) Backend for Frontend
├── tests/            # E2E Playwright tests
├── scripts/          # ETL and utility scripts
└── docs/             # Architecture documentation
```

## Data Architecture

### Schema Design Philosophy

- **Zod as Single Source of Truth**: All data validation and type generation flows from Zod schemas
- **MongoDB Decimal128**: Financial precision compliance (ADR 0019)
- **Discriminated Unions**: Type-safe line item variants
- **Audit Trail**: Git-like versioning system for all entities

### Core Schema Structure

```typescript
// Financial primitives with MongoDB Decimal128
const FinancialAmountSchema = z.object({
  amount: DecimalSchema,
  currency: CurrencySchema.default('USD'),
});

// Campaign with Zoho field suffixes
const CampaignEntitySchema = z.object({
  // Zoho-owned fields
  startDateZoho: DateSchema.optional(),
  endDateZoho: DateSchema.optional(),

  // Bravo-owned fields (MediaStrategy)
  startDate: DateSchema,
  endDate: DateSchema,
  price: FinancialAmountSchema,
});

// Discriminated union for line items
const LineItemEntitySchema = z.discriminatedUnion('type', [
  StandardLineItemSchema,
  ManagementFeeLineItemSchema,
  ZeroDollarLineItemSchema,
  ZeroMarginLineItemSchema,
]);
```

### Database Collections

1. **campaigns**: Core campaign entities with embedded strategy data
2. **lineItems**: Separate collection with campaign references
3. **mediaBuys**: Time-based budget allocations
4. **users/teams**: Authentication and authorization
5. **platformEntities**: External platform integrations

## Business Logic Centralization

### The Problem

In media-tool, business logic is scattered across multiple layers:

- SQL views contain calculation logic
- Frontend duplicates validation rules
- Backend has its own implementation
- No single source of truth for business rules

This leads to:

- Inconsistent calculations across the system
- Difficult maintenance and updates
- No audit trail for rule changes
- Complex testing requirements

### The Solution

Bravo-1 centralizes all business logic into three versioned components:

#### 1. Calculation Engine (`headless-api/src/calculations/`)

```typescript
// Versioned calculation methods
const calculationEngine = {
  version: '1.0.0',
  calculations: {
    marginPercentage: (revenue, cost) => {
      /* ... */
    },
    unitCost: (spend, units, unitType) => {
      /* ... */
    },
    pacingIndex: (spent, elapsed, total, duration) => {
      /* ... */
    },
  },
};
```

Features:

- All calculations in one place
- Version tracking for every change
- Backward compatibility support
- Comprehensive unit testing
- Audit trail with metadata

#### 2. Validation Rules (`shared/src/schemas/`)

```typescript
// Multi-level validation
const CampaignSchema = z.object({
  budget: z
    .number()
    .min(0, 'Budget cannot be negative')
    .refine((val) => val <= 10000000, {
      message: 'Budget exceeds maximum of $10M',
    }),
});
```

Validation levels:

- **Schema**: Basic type and constraint validation (Zod)
- **Business**: Complex cross-field rules
- **Warnings**: Non-blocking issues for user awareness

#### 3. Rounding Rules (`headless-api/src/calculations/rounding.ts`)

```typescript
// Context-aware rounding
const roundingRules = {
  storage: { decimals: 6 }, // MongoDB precision
  display: { decimals: 2 }, // UI presentation
  contextual: {
    'YouTube:CPV': { decimals: 3 }, // Platform-specific
    'Facebook:reach': { decimals: 0 },
  },
};
```

### Benefits

1. **Single Source of Truth**: One place to update business rules
2. **Versioning**: Track changes and maintain compatibility
3. **Testability**: Isolated logic is easier to test
4. **Consistency**: Same rules everywhere in the system
5. **Governance**: Clear ownership and change process

## Schema-First Development

### Philosophy

Zod schemas are the single source of truth for:

- TypeScript types (generated)
- MongoDB validation
- API request/response validation
- OpenAPI documentation
- Frontend form validation

### Implementation

```typescript
// 1. Define schema once
const CampaignEntitySchema = z.object({
  campaignNumber: z.string(),
  name: z.string(),
  budget: FinancialAmountSchema,
  // ...
});

// 2. Generate TypeScript type
export type CampaignEntity = z.infer<typeof CampaignEntitySchema>;

// 3. Use everywhere
// API validation
router.post('/campaigns', validate(CampaignEntitySchema), ...);

// MongoDB validation
await collection.insertOne(CampaignEntitySchema.parse(data));

// OpenAPI generation
const openApiSchema = zodToJsonSchema(CampaignEntitySchema);
```

### Benefits

1. **Type Safety**: End-to-end type checking
2. **Consistency**: Same validation everywhere
3. **Documentation**: Auto-generated from schemas
4. **Maintenance**: Update once, propagate everywhere
5. **Developer Experience**: IntelliSense and autocomplete

## Financial Precision Implementation (ADR 0019)

### Overview

Bravo-1 implements [ADR 0019](https://brkthru.atlassian.net/wiki/spaces/BR/pages/338198545/0019+How+should+financial+calculation+be+handled+in+the+Bravo+backend) for precise financial calculations, addressing the critical need for accurate monetary computations in media planning. This implementation ensures that financial values maintain precision throughout the system, from database storage to API responses.

### Problem Statement

JavaScript's native `number` type uses floating-point arithmetic, which can lead to precision errors in financial calculations:

- Sum of line items not matching campaign totals
- Expected vs actual comparisons failing due to rounding errors
- Cumulative errors in daily spend aggregations
- Loss of precision in unit cost calculations (e.g., CPM)

### Solution Architecture

#### 1. **BigNumber.js for Calculations**

```typescript
// All financial calculations use BigNumber.js
import BigNumber from 'bignumber.js';

BigNumber.config({
  DECIMAL_PLACES: 6,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-15, 20],
});
```

#### 2. **MongoDB Decimal128 for Storage**

```typescript
// Financial fields stored as Decimal128
{
  budget: {
    total: Decimal128("10000.000000"),
    allocated: Decimal128("9500.500000"),
    spent: Decimal128("3250.123456"),
    remaining: Decimal128("6749.876544")
  }
}
```

#### 3. **String Representation in APIs**

```typescript
// API responses use string to preserve precision
{
  "budget": {
    "total": "10000.000000",
    "allocated": "9500.500000",
    "spent": "3250.123456",
    "remaining": "6749.876544"
  }
}
```

### Implementation Components

#### Decimal Utility (`backend/src/utils/decimal.ts`)

- Conversion between BigNumber, Decimal128, and strings
- Field-level conversion helpers for ETL
- Nested object traversal for financial fields

#### Calculation Engine (`backend/src/calculations/calculation-engine.ts`)

- Versioned calculation methods
- Unit price formatting (CPM, CPC, CPV, etc.)
- Margin and profit calculations
- Amount comparison with tolerance
- Aggregate calculations across plans

#### Enhanced Schemas

- `financial.schema.ts`: Base decimal schemas with validation
- `entity-snapshots.schema.ts`: Type-safe version history snapshots
- `version-history.schema.ts`: Financial metadata tracking

### Calculation Engine Architecture

The calculation engine is a critical component that centralizes all financial calculations, ensuring consistency and accuracy across the application. It implements a versioning system to support evolving business rules while maintaining backward compatibility.

#### Why the Calculation Engine Exists

1. **Centralized Business Logic**: All financial calculations are in one place, preventing inconsistencies
2. **Version Control**: Business rules can evolve without breaking existing data
3. **Testability**: Isolated calculation logic is easier to test comprehensively
4. **Audit Trail**: Every calculation can be traced to a specific version
5. **Performance**: Calculations can be optimized without touching business logic

#### Architecture & Design

```typescript
// Singleton instance with versioned calculations
export class CalculationEngine {
  private versions: Map<string, CalculationVersion> = new Map();
  private currentVersion = '1.0.0';

  // Register calculation versions
  registerVersion(version: CalculationVersion): void;

  // Get specific version or current
  getVersion(version?: string): CalculationVersion;

  // Access current calculations
  get calculations(): CalculationMethods;
}

// Export singleton
export const calculationEngine = new CalculationEngine();
```

#### Registering New Versions

Currently, versions are registered via code in the constructor:

```typescript
// Current implementation (code-based)
private registerV1(): void {
  this.versions.set('1.0.0', {
    version: '1.0.0',
    effectiveDate: new Date('2025-01-01'),
    description: 'Initial calculation engine implementation',
    calculations: { /* methods */ }
  });
}
```

**Future Enhancement Options:**

1. **Database-Driven Versions** (for simple formulas):

   ```typescript
   // Store calculation rules in MongoDB
   {
     version: "1.1.0",
     rules: {
       marginPercentage: "((revenue - cost) / revenue) * 100",
       unitCost: "spend / units"
     }
   }
   ```

2. **Plugin System** (for complex logic):

   ```typescript
   // Load calculation modules dynamically
   const v2Module = await import('./calculations/v2.0.0');
   calculationEngine.registerVersion(v2Module.default);
   ```

3. **Configuration-Based** (hybrid approach):
   ```typescript
   // JSON configuration with code references
   {
     "version": "1.1.0",
     "module": "@calculations/v1.1.0",
     "overrides": {
       "marginPercentage": { "precision": 3 }
     }
   }
   ```

#### Usage Throughout the System

1. **API Layer** - Campaign calculations:

   ```typescript
   // routes/campaigns.ts
   const calc = calculationEngine.calculations;
   const margin = calc.marginPercentage(revenue, cost);
   ```

2. **ETL Pipeline** - Data transformation:

   ```typescript
   // transform-postgres-data-decimal.ts
   const unitCost = calc.actualUnitCost(spend, units);
   ```

3. **Report Generation** - Metrics calculation:

   ```typescript
   // services/reporting.ts
   const aggregateCost = calc.aggregatePlanCost(mediaPlan);
   ```

4. **Version History** - Storing calculation version:
   ```typescript
   // When creating version history
   {
     calculationVersion: calculationEngine.currentVersion,
     entitySnapshot: { /* data */ }
   }
   ```

#### Version Migration Strategy

When introducing a new calculation version:

1. **Add New Version** without removing old:

   ```typescript
   // v1.1.0 - Updated margin calculation
   registerV1_1(): void {
     // New business rules
   }
   ```

2. **Gradual Migration**:
   - New calculations use new version
   - Historical data maintains original version
   - Reports can specify version for consistency

3. **Version Compatibility Matrix**:
   ```typescript
   // Track which entity versions use which calc versions
   {
     entityVersion: "2.0",
     compatibleCalcVersions: ["1.0.0", "1.1.0"],
     defaultCalcVersion: "1.1.0"
   }
   ```

### Rounding Policies

ADR 0019 didn't specify which rounding method to use, so we chose **ROUND_HALF_UP** as our standard. Given that there are different scenarios for rounding in financial calculations, we centralized all rounding logic in a single place to ensure consistency across the application.

```typescript
const RoundingPolicies = {
  STORAGE: { places: 6, mode: ROUND_HALF_UP }, // Database storage
  DISPLAY_DOLLARS: { places: 2, mode: ROUND_HALF_UP }, // $XX.XX
  DISPLAY_SUBCENT: { places: 3, mode: ROUND_HALF_UP }, // $XX.XXX
  UNIT_COST: { places: 4, mode: ROUND_HALF_UP }, // Unit prices
  PERCENTAGE: { places: 2, mode: ROUND_HALF_UP }, // XX.XX%
  CPM: { places: 2, mode: ROUND_HALF_UP }, // CPM display
};
```

#### How Rounding Policies Are Applied

The Calculation Engine separates calculation logic from rounding policies:

1. **Pure Calculations**: All calculation methods now return full-precision BigNumber values
2. **Context-Aware Rounding**: Rounding is applied separately based on usage context
3. **Version Tracking**: Every calculation result includes the version used

```typescript
// Calculation Engine API - Separation of Concerns
const engine = calculationEngine;

// Step 1: Pure calculation (no rounding)
const result = engine.calculate('marginPercentage', revenue, cost);
// result.value = BigNumber with full precision
// result.calculationVersion = '1.0.0'

// Step 2: Apply precision based on context
const forStorage = engine.withPrecision(result, 'storage'); // 6 decimals
const forDisplay = engine.withPrecision(result, 'display'); // 2 decimals
const forAPI = engine.withPrecision(result, 'api'); // 2 decimals

// Contextual rules (e.g., YouTube CPV)
result.context = { platform: 'youtube', unitType: 'views' };
const youtubeCPV = engine.withPrecision(result, 'display'); // 3 decimals
```

**Benefits of this Design**:

- Same calculation can be used for different precision needs
- Contextual rules (YouTube CPV uses sub-cent precision)
- Version tracking for audit trails
- Override capability for special cases
- Clean separation of business logic from formatting concerns

#### What ROUND_HALF_UP Means

**ROUND_HALF_UP** is the rounding method most people learned in school:

- Values exactly halfway between two numbers round **up**
- 2.5 → 3
- 2.4 → 2
- -2.5 → -3 (away from zero)

We chose this because it's the industry standard for financial calculations and matches user expectations.

### ETL Pipeline Integration

The PostgreSQL to MongoDB migration includes automatic Decimal128 conversion:

1. **Transform Phase** (`transform-postgres-data-decimal.ts`):
   - Converts string/number values to proper decimal format
   - Validates financial values
   - Maintains 6 decimal places precision

2. **Load Phase** (`load-data-decimal.ts`):
   - Stores as MongoDB Decimal128
   - Creates indexes for performance
   - Validates precision after storage

### Financial Fields Affected

- **Campaign**: `budget.total`, `budget.allocated`, `budget.spent`, `budget.remaining`
- **Line Item**: `price`, `unitPrice`, `mediaBudget`, `targetUnitCost`
- **Media Plan**: `budget`, `plannedUnitCost`, `actualSpend`
- **Platform Buy**: `budget`, `spend`, calculated metrics (CPM, CPC, CPA)

### Testing Strategy

Comprehensive test suite covering:

- Precision maintenance in calculations
- Expected vs actual comparisons
- Aggregation without drift
- Edge cases (very small/large numbers)
- MongoDB Decimal128 conversions
- Calculation version management

**Test Files:**

- [`calculation-engine.test.ts`](../backend/src/calculations/calculation-engine.test.ts) - 55 tests for financial calculations
- [`decimal.test.ts`](../backend/src/utils/decimal.test.ts) - Tests for decimal conversion utilities

**Running the Tests:**

```bash
# Run only financial precision tests
cd backend
npm test -- --testPathPattern="(decimal|calculation-engine)"

# Run all backend tests
npm test
```

For detailed implementation guidance, see the [ADR 0019 Implementation Guide](../docs/adr-0019-implementation.md).

### Usage Examples

#### Creating Financial Values

```typescript
// From string (API input)
const budget = new BigNumber('10000.50');

// From database
const dbValue = await collection.findOne({ _id });
const budget = MongoDecimal.toBigNumber(dbValue.budget.total);
```

#### Performing Calculations

```typescript
const engine = calculationEngine.calculations;

// Calculate unit cost
const spend = new BigNumber('1000');
const units = new BigNumber('50000');
const unitCost = engine.actualUnitCost(spend, units); // 0.02

// Format for display
const formatted = engine.formatUnitPrice(unitCost, 'impressions');
// { displayFormat: "$20.00 CPM", displayUnit: "CPM" }
```

#### Comparing Amounts

```typescript
// Check if line items sum equals campaign total
const lineItemSum = lineItems.reduce((sum, item) => sum.plus(item.price), new BigNumber(0));
const campaignTotal = new BigNumber(campaign.budget.total);

if (engine.compareAmounts(campaignTotal, lineItemSum)) {
  // Amounts match within tolerance
}
```

### Migration Notes

- Existing data requires migration to Decimal128
- ETL process handles conversion automatically
- API clients should expect string representations
- Frontend should avoid JavaScript number operations

### Benefits

1. **Accuracy**: No floating-point precision errors
2. **Consistency**: Same precision across all layers
3. **Auditability**: Exact values visible in database
4. **Flexibility**: Configurable rounding policies
5. **Future-proof**: Versioned calculation logic

## Application Layers

### Frontend Architecture

```
frontend/src/
├── components/       # Reusable UI components
│   ├── ui/         # Base UI components
│   │   └── headless/  # HeadlessUI components
│   ├── CampaignDetail.tsx
│   ├── CampaignList.tsx
│   └── MediaStrategy.tsx
├── contexts/         # React contexts (Theme, User)
├── pages/           # Route-based page components
├── services/        # API client services
├── themes/          # AG-Grid theme configurations
├── hooks/           # Custom React hooks
└── utils/           # Helper functions
```

### Headless API Architecture

```
headless-api/src/
├── calculations/    # Centralized calculation engine
│   ├── calculation-engine.ts  # Versioned business logic
│   └── rounding.ts           # Rounding policies
├── aggregations/    # Business metrics & analytics
│   ├── metrics.service.ts     # Core metric calculations
│   ├── dimensions.ts          # Rollup dimensions
│   └── filters.ts            # Metric filtering logic
├── config/          # Database and app configuration
├── models/          # MongoDB models and schemas
├── routes/          # Express route handlers (/v0/*)
├── middleware/      # Express middleware
├── services/        # Business logic layer
│   ├── auth.service.ts
│   ├── campaign.service.ts
│   └── etl.service.ts
└── utils/           # Helper functions
    ├── decimal.ts   # BigNumber/Decimal128 utilities
    └── validators.ts # Zod validation helpers
```

### Shared Module Architecture

```
shared/src/
├── schemas/         # Zod schemas (single source of truth)
│   ├── core/       # Primitives (financial, dates, etc.)
│   ├── entities/   # Domain entities
│   ├── api/        # API request/response schemas
│   └── versioning/ # Audit trail schemas
├── types/          # Generated TypeScript types
└── utils/          # Shared utilities
```

### BFF Backend (Future)

```
bff-backend/         # Backend for Frontend (planned)
├── api/             # API layer (GraphQL, tRPC, or REST)
├── orchestration/   # Combine multiple API calls for UI
├── auth/            # Browser-specific auth (cookies, CSRF)
├── caching/         # Redis caching for UI performance
└── view-models/     # UI-specific data packaging
```

#### Why Separate BFF from Headless API?

The separation serves distinct architectural purposes:

**Headless API Responsibilities:**

- **Business Logic**: All calculations, validations, rules
- **Business Metrics**: Aggregations, rollups, analytics
- **Data Integrity**: Ensuring consistency across all consumers
- **Universal Access**: Same results for web, MCP, automation, etc.

**BFF Responsibilities:**

- **UI Orchestration**: Combine multiple API calls into single UI requests
- **Data Packaging**: Shape data specifically for UI components
- **Browser Security**: Handle cookies, CSRF, sessions
- **Performance**: Cache assembled views, reduce round trips
- **NO Business Logic**: Never calculate metrics or aggregations

Example distinction:

````typescript
// WRONG: BFF calculating metrics
// bff-backend/api/dashboard.ts
const getSpendByPlatform = () => {
  // ❌ BFF should NOT calculate business metrics
  const campaigns = await api.getCampaigns();
  return campaigns.reduce(...); // Business logic!
}

// RIGHT: BFF orchestrating API calls
// bff-backend/api/dashboard.ts
const getDashboardData = async () => {
  // ✅ BFF packages multiple API responses
  const [metrics, campaigns, alerts] = await Promise.all([
    headlessApi.getMetrics({ groupBy: 'platform' }), // Headless API does calculation
    headlessApi.getCampaigns({ limit: 10 }),
    headlessApi.getAlerts({ status: 'active' })
  ]);

  // Package for specific UI view
  return { metrics, recentCampaigns: campaigns, alerts };
}

## Security Architecture

### Authentication & Authorization

- **JWT-based authentication**: Stateless token system
- **bcrypt password hashing**: Industry-standard security
- **Role-based access control**: User/team permissions
- **API key support**: For service-to-service communication

### Security Best Practices

- Input validation via Zod schemas
- SQL injection prevention (N/A with MongoDB)
- XSS protection via React's built-in escaping
- CORS configuration for API access
- Environment-based secrets management

## Development & Deployment

### Development Workflow

1. **Local Development**:

   ```bash
   docker-compose up -d mongodb  # Start database
   npm run dev:backend          # Start API (3001)
   npm run dev:frontend         # Start UI (5174)
````

2. **Testing**:

   ```bash
   npm test                     # Unit/integration tests
   npm run test:e2e            # E2E tests
   npm run test:coverage       # Coverage report
   ```

3. **Data Management**:

   ```bash
   # Production data (13,417 campaigns)
   bun run scripts/etl/run-etl.ts

   # Note: The seed script has been removed to prevent accidental use
   ```

### Build & Deployment

- **Frontend**: Static build via Vite, deployable to CDN
- **Backend**: Node.js application, containerizable
- **Database**: MongoDB in Docker for consistency

## Frontend Architecture

### Philosophy: Separation of Behavior and Style

Bravo-1's frontend architecture is built on a fundamental principle: **complete separation of component behavior from visual styling**. This is achieved through the combination of HeadlessUI and Tailwind CSS.

### Why This Matters

In media-tool and many traditional React applications, components mix behavior and styling:

```jsx
// Traditional approach - behavior and style mixed
<CustomDropdown theme="dark" size="large" variant="primary" onSelect={handleSelect} />
```

This leads to:

- Limited customization options
- Inconsistent behavior across similar components
- Accessibility implemented differently in each component
- Difficulty maintaining design consistency

### The Bravo-1 Approach

```jsx
// Bravo-1 approach - behavior and style separated
import { Menu } from '@headlessui/react';

<Menu>
  <Menu.Button className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg">Options</Menu.Button>
  <Menu.Items className="absolute mt-2 w-56 bg-white shadow-lg rounded-md">
    <Menu.Item>
      {({ active }) => <button className={`${active ? 'bg-gray-100' : ''} px-4 py-2`}>Edit</button>}
    </Menu.Item>
  </Menu.Items>
</Menu>;
```

### Benefits

1. **Complete Design Freedom**: Any design system can be implemented
2. **Consistent Behavior**: All dropdowns work the same way
3. **Accessibility Built-in**: WCAG compliance by default
4. **Smaller Bundle Size**: No duplicate styling code
5. **Better Developer Experience**: Clear separation of concerns

### Component Layers

```
┌─────────────────────────────────────────────────┐
│               User Interface                     │
├─────────────────────────────────────────────────┤
│  Application Components                         │
│  (CampaignList, MediaStrategy, etc.)          │
├─────────────────────────────────────────────────┤
│  HeadlessUI Components                         │
│  (Behavior, State, Accessibility)              │
├─────────────────────────────────────────────────┤
│  Tailwind CSS Classes                          │
│  (Visual Design, Responsive, Dark Mode)        │
└─────────────────────────────────────────────────┘
```

## UI Component Architecture

We use a **HeadlessUI + Tailwind CSS** pattern for building UI components:

```
┌─────────────────────────────────────────┐
│           Component Layer               │
├─────────────────────────────────────────┤
│  HeadlessUI                             │
│  - Behavior & State                     │
│  - Accessibility (ARIA)                 │
│  - Keyboard Navigation                  │
│  - Focus Management                     │
├─────────────────────────────────────────┤
│  Tailwind CSS                           │
│  - Visual Styling                       │
│  - Responsive Design                    │
│  - Dark Mode                            │
│  - Animations                           │
└─────────────────────────────────────────┘
```

### Benefits

1. **Separation of Concerns** - Behavior is separate from styling
2. **Accessibility First** - All interactive components are WCAG compliant
3. **Full Customization** - Complete control over visual design
4. **Consistency** - Shared behavior patterns across components
5. **Type Safety** - Full TypeScript support

### Component Structure

```
components/
├── ui/
│   ├── headless/          # HeadlessUI components
│   │   ├── Dialog.tsx     # Modal component
│   │   ├── Menu.tsx       # Dropdown menu
│   │   ├── Combobox.tsx   # Searchable select
│   │   ├── Switch.tsx     # Toggle switch
│   │   ├── Disclosure.tsx # Collapsible sections
│   │   └── index.ts       # Exports
│   └── [other UI components]
```

### Current Implementation

- **HeadlessUI Components**:
  - Dialog (modals with backdrop and transitions)
  - Menu (dropdown menus with keyboard navigation)
  - Combobox (searchable select with filtering)
  - Switch (accessible toggle with label support)
  - Disclosure (collapsible sections)
  - ConfirmationDialog (specialized dialog for confirmations)
- **Updated Components**:
  - ThemeToggle now uses HeadlessUI RadioGroup
  - CampaignList includes confirmation dialogs for actions
- **AG-Grid**: Enterprise data grid for complex tables (v33.3.2)
- **Recharts**: For data visualization

### AG-Grid v33 Configuration

AG-Grid v33 uses a new Theming API with JavaScript-based themes instead of CSS imports. Our implementation:

```typescript
// main.tsx - Module registration (required in v33)
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
]);

// themes/agGridTheme.ts - Theme configuration
import { themeAlpine } from 'ag-grid-community';

export const lightTheme = themeAlpine.withParams({
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  headerHeight: 48,
  rowHeight: 48,
  // Custom colors and spacing
});

// Component usage
<AgGridReact
  theme={resolvedTheme === 'dark' ? darkTheme : lightTheme}
  // ... other props
/>
```

Key features:

- Module-based architecture for smaller bundle sizes
- JavaScript theme objects with type safety
- Dynamic theme switching for dark mode
- Custom parameter overrides for consistent design

### Example Implementation

```tsx
// Dialog Example
import { Dialog } from '../components/ui/headless';

function DeleteConfirmation({ isOpen, onClose, onConfirm }) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Campaign"
      description="This action cannot be undone."
      size="sm"
    >
      <p className="text-sm text-gray-500">Are you sure you want to delete this campaign?</p>
      <Dialog.Actions>
        <Dialog.Button variant="secondary" onClick={onClose}>
          Cancel
        </Dialog.Button>
        <Dialog.Button variant="danger" onClick={onConfirm}>
          Delete
        </Dialog.Button>
      </Dialog.Actions>
    </Dialog>
  );
}

// Menu Example
import { Menu } from '../components/ui/headless';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

function CampaignActions({ campaign }) {
  return (
    <Menu label="Actions" align="right">
      <Menu.Item icon={PencilIcon} onClick={() => editCampaign(campaign)}>
        Edit Campaign
      </Menu.Item>
      <Menu.Item icon={TrashIcon} onClick={() => deleteCampaign(campaign)}>
        Delete Campaign
      </Menu.Item>
    </Menu>
  );
}
```

### Tailwind UI Plus Compatibility

If you have Tailwind UI Plus, you can leverage:

- Pre-built HeadlessUI component patterns
- Marketing and application UI templates
- Catalyst UI kit (modern application UI kit)

## Decision Records

### Why HeadlessUI + Tailwind CSS?

- **Date**: 2025-06-25
- **Decision**: Use HeadlessUI for component behavior and Tailwind for styling
- **Rationale**:
  - Provides accessibility out of the box
  - Separates behavior from presentation
  - Maintains consistency with Tailwind design system
  - Reduces component complexity
  - Full TypeScript support

### Why MongoDB over PostgreSQL?

- **Date**: 2025-06
- **Decision**: Migrate from PostgreSQL to MongoDB
- **Rationale**:
  - Better fit for hierarchical campaign data
  - Flexible schema for evolving requirements
  - Improved query performance for nested data
  - Simplified data model

### Why Separate Collections?

- **Date**: 2025-06
- **Decision**: Use separate collections instead of embedding
- **Rationale**:
  - Documents can grow large over time
  - Easier to query individual entities
  - Better performance for updates
  - More flexible for future changes

### Why Zod for Validation?

- **Date**: 2025-06
- **Decision**: Use Zod as single source of truth for validation and types
- **Rationale**:
  - Runtime validation with TypeScript inference
  - Schema composition and transformation
  - Better error messages
  - JSON Schema generation

## Future Considerations

### Near-term Priorities

1. **Complete BFF Implementation**: Build the backend-for-frontend layer to optimize browser interactions
2. **Business Metrics API**: Implement aggregation endpoints in headless API for rollups and analytics
3. **API Documentation**: Complete OpenAPI/Swagger documentation (partially implemented)
4. **Performance Testing**: Load test with full 13,417 campaign dataset
5. **Error Tracking**: Implement Sentry or similar for production monitoring

### Technical Debt

1. **Test Coverage**: Current coverage needs improvement
   - Backend unit tests failing (need production data loaded)
   - E2E tests need updating for current UI
   - Add tests for calculation engine versions
2. **Migration Completion**:
   - Platform integrations not yet migrated
   - Background job system needs implementation
   - Full JWT authentication pending
3. **Code Organization**:
   - Complete HeadlessUI component migration
   - Standardize error handling patterns

### Architectural Evolution

1. **BFF Layer**:
   - Choose between GraphQL, tRPC, or REST
   - Implement browser-specific optimizations
   - Add view-model caching layer
2. **Event System**:
   - Audit trail enhancements
   - Real-time updates via WebSockets
   - Event sourcing for calculation changes
3. **Caching Strategy**:
   - Redis for frequently accessed data
   - CDN for static assets
   - API response caching in BFF

### Infrastructure & DevOps

1. **Already Implemented**:
   - ✅ GitHub Actions CI (via Trunk)
   - ✅ Code quality automation (Trunk.io)
   - ✅ Docker containerization (MongoDB)
2. **Needed**:
   - Production deployment pipeline
   - Kubernetes orchestration
   - Monitoring and alerting
   - Log aggregation

### Feature Roadmap

1. **Media Planning Features**:
   - Media buy management
   - Platform API integrations
   - Advanced reporting dashboard
   - Budget pacing visualization
2. **Platform Capabilities**:
   - Multi-tenant architecture
   - File upload system (S3)
   - Export/import workflows
   - Webhook notifications

## Conclusion

Bravo-1 represents a significant architectural evolution from media-tool, establishing a modern foundation for scalable media planning software. The headless API architecture ensures that business logic remains consistent across all consumers - whether web browsers, MCP servers, or future integrations.

### Key Architectural Achievements

1. **Centralized Business Logic**:
   - Calculation engine with versioning
   - Financial precision (ADR 0019) with BigNumber.js
   - Single source of truth for all metrics

2. **Modern Technology Stack**:
   - Full-stack TypeScript with Zod schemas
   - MongoDB for flexible data modeling
   - HeadlessUI + Tailwind for accessible UI
   - AG-Grid v33 for enterprise data handling

3. **Clear Separation of Concerns**:
   - Headless API: Universal business logic and metrics
   - BFF (planned): Browser-specific optimizations
   - Frontend: Pure presentation layer

4. **Developer Experience**:
   - Trunk.io for automated code quality
   - Hot reload development
   - Comprehensive type safety
   - Clear architectural boundaries

### Current State

The system successfully handles 13,417 campaigns with:

- ✅ Core CRUD operations
- ✅ Financial precision calculations
- ✅ Basic authentication
- ✅ CI/CD via GitHub Actions
- ✅ Automated code formatting

### Immediate Next Steps

1. **Load production data**: `cd scripts/etl && ./quick-start-etl.sh`
2. **Fix test failures**: Tests expect production data, not seed data
3. **Implement BFF layer**: For optimized browser experience
4. **Add business metrics API**: Aggregations and rollups in headless API
5. **Complete API documentation**: Finish OpenAPI specification

The architecture is positioned to scale with the business while maintaining clean boundaries between concerns. The strict separation between headless API and future BFF ensures that all consumers receive consistent business logic while allowing for client-specific optimizations.
