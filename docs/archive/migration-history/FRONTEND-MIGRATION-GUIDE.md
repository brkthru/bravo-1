# Frontend Migration Guide - MongoDB Structure

## Overview

This guide explains the new MongoDB data structure and how to query/update data for the frontend application.

## Key Changes from PostgreSQL

### 1. Naming Changes

- `media_buys` → `mediaPlans`
- `media_platform_entities` → `platformEntities`
- `line_item_media_buys` → Merged into `mediaPlans` collection

### 2. Structure Changes

- **Campaigns** now embed strategies and line items
- **Media Plans** are a separate collection (junction between line items and platform entities)
- **Platform Metrics** use a unified `units` + `unitType` approach

## Collections Overview

### 1. campaigns

The main collection containing campaigns with embedded strategies and line items.

```javascript
// Get a campaign with full hierarchy
const campaign = await db.collection('campaigns').findOne({
  _id: campaignId,
});

// Access nested data
const strategy = campaign.strategy; // Can be null
const lineItems = campaign.strategy?.lineItems || [];
```

### 2. mediaPlans

Junction collection linking line items to platform entities with planning data.

```javascript
// Get all media plans for a line item
const mediaPlans = await db
  .collection('mediaPlans')
  .find({
    lineItemId: lineItemId,
  })
  .toArray();

// Get all media plans for a campaign
const mediaPlans = await db
  .collection('mediaPlans')
  .find({
    campaignId: campaignId,
  })
  .toArray();
```

### 3. platformEntities

External platform entities synced from Facebook, Google, TikTok, etc.

```javascript
// Get all platform entities
const entities = await db
  .collection('platformEntities')
  .find({
    isActive: true,
  })
  .toArray();
```

### 4. platformMetrics

Time-series metrics data with daily granularity.

```javascript
// Get metrics for a date range
const metrics = await db
  .collection('platformMetrics')
  .find({
    platformEntityId: entityId,
    date: { $gte: startDate, $lte: endDate },
  })
  .sort({ date: 1 })
  .toArray();

// Access metric values
metrics.forEach((day) => {
  const impressions = day.metrics.find((m) => m.unitType === 'impressions')?.units || 0;
  const clicks = day.metrics.find((m) => m.unitType === 'clicks')?.units || 0;
  const spend = day.spend;
});
```

### 5. users

Enhanced user collection with roles and hierarchy.

```javascript
// Get users by role
const mediaTraders = await db
  .collection('users')
  .find({
    role: 'media_trader',
    isActive: true,
  })
  .toArray();

// Get a user's direct reports
const reports = await db
  .collection('users')
  .find({
    managerId: userId,
  })
  .toArray();
```

## Common Query Patterns

### 1. Get Campaign Detail Page Data

```javascript
// Single query gets campaign with strategy and line items
const campaign = await db.collection('campaigns').findOne({ _id: campaignId });

// Get media plans for all line items (if needed)
const lineItemIds = campaign.strategy?.lineItems.map((li) => li._id) || [];
const mediaPlans = await db
  .collection('mediaPlans')
  .find({
    lineItemId: { $in: lineItemIds },
  })
  .toArray();

// Group media plans by line item
const mediaPlansByLineItem = mediaPlans.reduce((acc, mp) => {
  if (!acc[mp.lineItemId]) acc[mp.lineItemId] = [];
  acc[mp.lineItemId].push(mp);
  return acc;
}, {});
```

### 2. Campaign List/Search

```javascript
// Search campaigns by name or number
const campaigns = await db
  .collection('campaigns')
  .find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { campaignNumber: { $regex: searchTerm, $options: 'i' } },
    ],
    isActive: true,
  })
  .limit(20)
  .toArray();

// Filter by account
const campaigns = await db
  .collection('campaigns')
  .find({
    accountId: accountId,
    isActive: true,
  })
  .sort({ createdAt: -1 })
  .toArray();
```

### 3. Performance Metrics Dashboard

```javascript
// Get aggregated metrics by campaign
const metrics = await db
  .collection('platformMetrics')
  .aggregate([
    {
      $match: {
        campaignId: campaignId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    { $unwind: '$metrics' },
    {
      $group: {
        _id: '$metrics.unitType',
        totalUnits: { $sum: '$metrics.units' },
        totalSpend: { $sum: '$spend' },
      },
    },
  ])
  .toArray();

// Result format:
// [
//   { _id: 'impressions', totalUnits: 5000000, totalSpend: 25000 },
//   { _id: 'clicks', totalUnits: 25000, totalSpend: 25000 },
//   { _id: 'conversions', totalUnits: 500, totalSpend: 25000 }
// ]
```

### 4. Update Operations

#### Update Line Item

```javascript
// Update a line item within a campaign
await db.collection('campaigns').updateOne(
  {
    _id: campaignId,
    'strategy.lineItems._id': lineItemId,
  },
  {
    $set: {
      'strategy.lineItems.$.name': 'New Name',
      'strategy.lineItems.$.budget': 75000,
      'strategy.lineItems.$.updatedAt': new Date(),
    },
  }
);
```

#### Create Media Plan

```javascript
// First check for overlaps
const overlap = await db.collection('mediaPlans').findOne({
  platformEntityId: platformEntityId,
  isActive: true,
  $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
});

if (overlap) {
  throw new Error('Date range overlaps with existing media plan');
}

// Create new media plan
const mediaPlan = {
  _id: generateId(),
  lineItemId: lineItemId,
  strategyId: strategyId,
  campaignId: campaignId,
  platformEntityId: platformEntityId,
  plannedSpend: 50000,
  plannedUnits: 10000000,
  unitType: 'impressions',
  startDate: startDate,
  endDate: endDate,
  status: 'planned',
  // ... other fields
};

await db.collection('mediaPlans').insertOne(mediaPlan);

// Update line item with new media plan ID
await db
  .collection('campaigns')
  .updateOne(
    { 'strategy.lineItems._id': lineItemId },
    { $push: { 'strategy.lineItems.$.mediaPlanIds': mediaPlan._id } }
  );
```

## API Endpoint Suggestions

### Campaigns

- `GET /api/campaigns` - List campaigns with filtering
- `GET /api/campaigns/:id` - Get campaign with full hierarchy
- `PUT /api/campaigns/:id/strategy` - Update strategy
- `PUT /api/campaigns/:id/strategy/line-items/:lineItemId` - Update line item

### Media Plans

- `GET /api/media-plans?lineItemId=X` - Get media plans for line item
- `POST /api/media-plans` - Create media plan (with overlap check)
- `PUT /api/media-plans/:id` - Update media plan
- `DELETE /api/media-plans/:id` - Delete media plan

### Platform Entities

- `GET /api/platform-entities` - List available platform entities
- `GET /api/platform-entities/:id/availability` - Check date availability

### Metrics

- `GET /api/metrics/platform/:entityId?start=X&end=Y` - Get platform metrics
- `GET /api/metrics/campaign/:campaignId?start=X&end=Y` - Get campaign metrics
- `GET /api/metrics/line-item/:lineItemId?start=X&end=Y` - Get line item metrics

### Users

- `GET /api/users` - List users with role filtering
- `GET /api/users/:id/reports` - Get user's direct reports
- `GET /api/users/:id/hierarchy` - Get full reporting hierarchy

## Search Implementation

For server-side search across collections:

```javascript
// Multi-collection search
async function searchAll(searchTerm) {
  const results = await Promise.all([
    // Search campaigns
    db
      .collection('campaigns')
      .find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { campaignNumber: { $regex: searchTerm, $options: 'i' } },
        ],
      })
      .limit(10)
      .toArray(),

    // Search line items (nested search)
    db
      .collection('campaigns')
      .find({
        'strategy.lineItems.name': { $regex: searchTerm, $options: 'i' },
      })
      .limit(10)
      .toArray(),

    // Search platform entities
    db
      .collection('platformEntities')
      .find({
        name: { $regex: searchTerm, $options: 'i' },
      })
      .limit(10)
      .toArray(),
  ]);

  return {
    campaigns: results[0],
    lineItems: results[1],
    platformEntities: results[2],
  };
}
```

## Performance Tips

1. **Use Projections**: Only fetch fields you need

   ```javascript
   db.collection('campaigns').find(
     {},
     {
       projection: { name: 1, campaignNumber: 1, budget: 1 },
     }
   );
   ```

2. **Pagination**: Use skip/limit for large lists

   ```javascript
   const page = 1;
   const pageSize = 20;
   db.collection('campaigns')
     .find({})
     .skip((page - 1) * pageSize)
     .limit(pageSize);
   ```

3. **Indexes**: The migration script creates indexes for common queries
   - campaigns: accountId, campaignNumber, dates
   - mediaPlans: lineItemId, platformEntityId, dates
   - platformMetrics: platformEntityId + date, campaignId + date

4. **Aggregation Pipeline**: Use for complex analytics
   ```javascript
   // Example: Top spending campaigns
   db.collection('platformMetrics').aggregate([
     { $match: { date: { $gte: startDate, $lte: endDate } } },
     {
       $group: {
         _id: '$campaignId',
         totalSpend: { $sum: '$spend' },
       },
     },
     { $sort: { totalSpend: -1 } },
     { $limit: 10 },
   ]);
   ```

## Migration Checklist

- [ ] Update API endpoints to use new collection names
- [ ] Update queries to work with embedded structure
- [ ] Update search functionality to query across collections
- [ ] Update metric queries to use units/unitType pattern
- [ ] Add user role checks based on permissions
- [ ] Update date range validation for media plans
- [ ] Test performance with production-scale data
