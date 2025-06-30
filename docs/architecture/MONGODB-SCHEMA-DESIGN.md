# MongoDB Schema Design for Media Tool Migration

## Overview

This document outlines the MongoDB schema design to replicate PostgreSQL view functionality while optimizing for MongoDB's strengths.

## Design Principles

1. **Optimize for Read Performance**: Most queries are reads (campaign lists, metrics)
2. **Balance Denormalization**: Strategic embedding vs references
3. **Calculate on Write**: Pre-compute metrics during updates
4. **Maintain Data Integrity**: Preserve all relationships and audit trails
5. **Support Real-time Updates**: Enable efficient metric recalculation

## Proposed Schema Design: Hybrid Approach

### Core Collections

#### 1. campaigns Collection

```javascript
{
  _id: ObjectId(),
  campaignNumber: "CN-46",
  campaignName: "Communications Match Agency Promotion",

  // Account relationship
  accountId: "2461504000000873654",
  accountName: "Example Corp", // Denormalized for performance

  // User relationships (embedded for fast access)
  team: {
    owner: {
      userId: "2461504000000183001",
      name: "Shannon Walion",
      email: "shannon@brkthru.com"
    },
    leadAccountManager: {
      userId: "2461504000000183001",
      name: "Shannon Walion",
      email: "shannon@brkthru.com"
    },
    mediaTraders: []
  },

  // Core data
  status: "active",
  dates: {
    created: ISODate("2017-01-01"),
    modified: ISODate("2023-06-15"),
    flight: ISODate("2025-01-01"),
    end: ISODate("2025-12-31")
  },

  // Pre-calculated metrics (updated via aggregation)
  metrics: {
    // Financial
    budget: {
      total: 100000,
      allocated: 95000,
      spent: 45000,
      remaining: 55000
    },

    // Performance
    delivery: {
      pacing: 0.92,
      unitsDelivered: 1234567,
      percentComplete: 0.45
    },

    // Margins
    margins: {
      target: 0.25,
      actual: 0.23,
      variance: -0.08
    },

    // Counts
    counts: {
      strategies: 3,
      lineItems: 15,
      activeLineItems: 12,
      mediaBuys: 45,
      activeMediaBuys: 30
    },

    // Last calculated
    lastCalculated: ISODate("2025-06-21T23:00:00Z")
  },

  // Timestamps
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

#### 2. strategies Collection

```javascript
{
  _id: ObjectId(),
  campaignId: ObjectId(), // Reference to campaign

  name: "Q1 Digital Strategy",
  description: "Focus on SEM and display",

  // Pre-calculated rollups
  metrics: {
    budget: {
      allocated: 35000,
      spent: 15000
    },
    lineItemCount: 5,
    activeLineItemCount: 4
  },

  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

#### 3. lineItems Collection

```javascript
{
  _id: ObjectId(),
  strategyId: ObjectId(),
  campaignId: ObjectId(), // Denormalized for efficient queries

  name: "Google SEM - Brand",
  status: "active",

  // Channel/Tactic
  channel: "search",
  tactic: "sem_brand",

  // Pricing
  pricing: {
    price: 10000,
    targetMargin: 0.25,
    unitPrice: 5.00,
    unitType: "cpc"
  },

  // Dates
  dates: {
    start: ISODate("2025-01-01"),
    end: ISODate("2025-03-31")
  },

  // Media traders
  mediaTraderIds: ["user_id_1", "user_id_2"],

  // Pre-calculated metrics
  metrics: {
    // Delivery
    unitsDelivered: 123456,
    targetUnits: 200000,
    deliveryPacing: 0.95,

    // Financial
    mediaSpend: 7500,
    mediaBudget: 7500,
    revenueEarned: 9500,

    // Performance
    percentUnitsDelivered: 0.62,
    percentBudgetSpent: 0.75,
    marginActual: 0.21,

    // Media plans
    mediaPlanCount: 3,
    activeMediaPlanCount: 2
  },

  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

#### 4. mediaBuys Collection

```javascript
{
  _id: ObjectId(),
  lineItemId: ObjectId(),

  name: "Google Ads - Campaign 123",
  platform: "google_ads",
  status: "active",

  // Budget allocation
  budget: 2500,
  targetUnitCost: 5.00,

  // Platform reference
  platformEntityId: ObjectId(),

  // Activity tracking
  lastActivityDate: ISODate("2025-06-20"),
  isActive: true, // Updated daily based on spend

  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

#### 5. users Collection

```javascript
{
  _id: "2461504000000183001", // Using zoho_user_id as _id
  name: "Shannon Walion",
  email: "shannon@brkthru.com",

  role: "account_manager",
  teams: ["team_id_1", "team_id_2"],

  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

#### 6. platformMetrics Collection (Time-Series)

```javascript
{
  _id: ObjectId(),
  mediaBuyId: ObjectId(),
  date: ISODate("2025-06-20"),

  metrics: {
    impressions: 50000,
    clicks: 500,
    conversions: 10,
    spend: 250.00
  },

  // For efficient aggregation
  campaignId: ObjectId(),
  lineItemId: ObjectId(),

  createdAt: ISODate()
}
```

### Aggregation Strategies

#### 1. Real-time Campaign Metrics

```javascript
// Aggregation pipeline to calculate campaign metrics
db.lineItems.aggregate([
  { $match: { campaignId: campaignId } },
  {
    $group: {
      _id: '$campaignId',
      totalAllocated: { $sum: '$pricing.price' },
      totalSpent: { $sum: '$metrics.mediaSpend' },
      totalUnitsDelivered: { $sum: '$metrics.unitsDelivered' },
      lineItemCount: { $sum: 1 },
      activeLineItemCount: {
        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
      },
    },
  },
]);
```

#### 2. Materialized View Pattern

Create a background job that updates campaign metrics periodically:

```javascript
// campaigns_metrics collection (materialized view)
{
  _id: ObjectId(), // campaignId
  lastUpdated: ISODate(),

  // All calculated metrics
  financials: { /* ... */ },
  delivery: { /* ... */ },
  pacing: { /* ... */ },

  // Refresh every hour
  refreshInterval: "1h"
}
```

### Update Strategies

#### Option 1: Event-Driven Updates

- Use MongoDB Change Streams
- Update parent metrics when children change
- Maintain consistency automatically

#### Option 2: Scheduled Aggregation

- Run aggregation jobs hourly/daily
- Batch process all campaigns
- More efficient for large datasets

#### Option 3: Hybrid Approach (Recommended)

- Real-time updates for critical metrics
- Batch updates for complex calculations
- Cache results with TTL

### Indexing Strategy

```javascript
// campaigns
db.campaigns.createIndex({ campaignNumber: 1 });
db.campaigns.createIndex({ 'team.owner.userId': 1 });
db.campaigns.createIndex({ status: 1, 'dates.flight': 1 });

// lineItems
db.lineItems.createIndex({ campaignId: 1, status: 1 });
db.lineItems.createIndex({ strategyId: 1 });
db.lineItems.createIndex({ 'dates.start': 1, 'dates.end': 1 });

// platformMetrics (time-series optimized)
db.platformMetrics.createIndex({ mediaBuyId: 1, date: -1 });
db.platformMetrics.createIndex({ campaignId: 1, date: -1 });
```

## Migration Approach

### Phase 1: Import Raw Data

1. Import all PostgreSQL tables as-is
2. Create mapping collections for relationships
3. Validate data integrity

### Phase 2: Transform Schema

1. Build user embeddings from users table
2. Create denormalized campaign documents
3. Pre-calculate initial metrics

### Phase 3: Implement Calculations

1. Port PostgreSQL functions to MongoDB aggregations
2. Create metric update pipelines
3. Implement change stream handlers

### Phase 4: Performance Optimization

1. Add strategic indexes
2. Implement caching layer
3. Optimize aggregation pipelines

## Benefits of This Design

1. **Fast Reads**: Pre-calculated metrics avoid complex joins
2. **Flexible Queries**: Supports both simple and complex aggregations
3. **Scalable**: Sharding-friendly with campaignId
4. **Maintainable**: Clear separation of concerns
5. **Real-time Ready**: Supports live metric updates

## Considerations

### Data Consistency

- Use transactions for multi-document updates
- Implement retry logic for metric calculations
- Monitor metric staleness

### Storage Optimization

- Archive old platformMetrics data
- Compress historical data
- Use time-series collections for metrics

### Query Performance

- Limit aggregation pipeline stages
- Use covered queries where possible
- Implement query result caching
