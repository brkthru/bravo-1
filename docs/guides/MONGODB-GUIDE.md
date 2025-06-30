# MongoDB Guide for Bravo-1

## Table of Contents

1. [MongoDB vs SQL Mindset](#mongodb-vs-sql-mindset)
2. [Current Database Structure](#current-database-structure)
3. [Common Query Patterns](#common-query-patterns)
4. [Aggregation Pipeline](#aggregation-pipeline)
5. [Indexes and Performance](#indexes-and-performance)
6. [Advanced Patterns](#advanced-patterns)
7. [MongoDB Tools](#mongodb-tools)
8. [Troubleshooting & Maintenance](#troubleshooting--maintenance)

## MongoDB vs SQL Mindset

When transitioning from PostgreSQL to MongoDB, it's important to understand the fundamental differences:

### Document-Oriented vs Relational

**PostgreSQL (Relational)**

```sql
-- Data split across normalized tables
SELECT c.*, s.*, l.*
FROM campaigns c
JOIN strategies s ON s.campaign_id = c.id
JOIN line_items l ON l.strategy_id = s.id
WHERE c.id = 123;
```

**MongoDB (Document-Oriented)**

```javascript
// Option 1: Embedded documents (not used in Bravo-1)
db.campaigns.findOne({ _id: ObjectId('...') });
// Returns entire campaign with embedded strategies and line items

// Option 2: Separate collections with references (current approach)
db.campaigns.aggregate([
  { $match: { _id: ObjectId('...') } },
  {
    $lookup: {
      from: 'strategies',
      localField: '_id',
      foreignField: 'campaignId',
      as: 'strategies',
    },
  },
  {
    $lookup: { from: 'lineItems', localField: '_id', foreignField: 'campaignId', as: 'lineItems' },
  },
]);
```

### Key Differences

- **Schema Flexibility**: MongoDB allows different documents to have different fields
- **Joins**: MongoDB uses `$lookup` in aggregation pipeline instead of SQL JOINs
- **Transactions**: MongoDB supports multi-document ACID transactions (since v4.0)
- **Scaling**: MongoDB scales horizontally with sharding; PostgreSQL typically scales vertically

## Current Database Structure

Bravo-1 uses **separate collections** with foreign key relationships (similar to SQL):

```javascript
// Collections structure
campaigns: {
  _id: ObjectId(),
  campaignNumber: "CN-13999",
  name: "Campaign Name",
  accountId: "...",
  status: "active",
  budget: { total: 100000, allocated: 75000 },
  dates: { start: ISODate(), end: ISODate() },
  createdAt: ISODate(),
  updatedAt: ISODate()
}

strategies: {
  _id: ObjectId(),
  campaignId: ObjectId(), // Foreign key to campaigns
  name: "Strategy Name",
  objectives: "...",
  createdAt: ISODate(),
  updatedAt: ISODate()
}

lineItems: {
  _id: ObjectId(),
  strategyId: ObjectId(), // Foreign key to strategies
  campaignId: ObjectId(), // Foreign key to campaigns (denormalized)
  name: "Line Item Name",
  budget: 50000,
  platform: "Google Ads",
  type: "standard", // standard, managementFee, zeroDollar, zeroMargin
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

## Common Query Patterns

### Finding Documents

```javascript
// Find all campaigns
db.campaigns.find().toArray();

// Find campaigns with pagination
db.campaigns.find().sort({ createdAt: -1 }).skip(0).limit(50).toArray();

// Find strategies for a campaign
db.strategies.find({ campaignId: ObjectId('...') }).toArray();

// Find line items for a strategy
db.lineItems.find({ strategyId: ObjectId('...') }).toArray();

// Search campaigns by name (case-insensitive)
db.campaigns
  .find({
    name: { $regex: 'Virginia', $options: 'i' },
  })
  .toArray();

// Find campaigns within budget range
db.campaigns
  .find({
    'budget.total': { $gte: 50000, $lte: 100000 },
  })
  .toArray();

// Find active campaigns
db.campaigns
  .find({
    status: 'active',
    'dates.start': { $lte: new Date() },
    'dates.end': { $gte: new Date() },
  })
  .toArray();
```

### Updating Documents

```javascript
// Update a campaign
db.campaigns.updateOne(
  { _id: ObjectId('...') },
  {
    $set: {
      'budget.allocated': 80000,
      updatedAt: new Date(),
    },
  }
);

// Update multiple strategies
db.strategies.updateMany({ campaignId: ObjectId('...') }, { $set: { status: 'active' } });

// Increment a counter
db.campaigns.updateOne({ _id: ObjectId('...') }, { $inc: { 'metrics.impressions': 1000 } });
```

### Bulk Operations

```javascript
// Bulk insert line items
db.lineItems.insertMany([
  { campaignId: ObjectId('...'), name: 'Line Item 1', budget: 10000 },
  { campaignId: ObjectId('...'), name: 'Line Item 2', budget: 20000 },
  { campaignId: ObjectId('...'), name: 'Line Item 3', budget: 30000 },
]);

// Bulk update with different values
const bulkOps = campaigns.map((campaign) => ({
  updateOne: {
    filter: { _id: campaign._id },
    update: { $set: { status: campaign.newStatus } },
  },
}));
db.campaigns.bulkWrite(bulkOps);
```

## Aggregation Pipeline

### Basic Aggregation Examples

```javascript
// Get campaign with all its strategies and line items
db.campaigns.aggregate([
  { $match: { _id: ObjectId('...') } },
  {
    $lookup: {
      from: 'strategies',
      localField: '_id',
      foreignField: 'campaignId',
      as: 'strategies',
    },
  },
  {
    $lookup: {
      from: 'lineItems',
      localField: '_id',
      foreignField: 'campaignId',
      as: 'lineItems',
    },
  },
]);

// Count line items per campaign with budget totals
db.lineItems.aggregate([
  {
    $group: {
      _id: '$campaignId',
      lineItemCount: { $sum: 1 },
      totalBudget: { $sum: '$budget' },
      avgBudget: { $avg: '$budget' },
    },
  },
  {
    $lookup: {
      from: 'campaigns',
      localField: '_id',
      foreignField: '_id',
      as: 'campaign',
    },
  },
  { $unwind: '$campaign' },
  {
    $project: {
      campaignName: '$campaign.name',
      lineItemCount: 1,
      totalBudget: 1,
      avgBudget: 1,
    },
  },
]);
```

### Advanced Aggregation Patterns

```javascript
// Multiple join conditions with let/pipeline
db.campaigns.aggregate([
  {
    $lookup: {
      from: 'lineItems',
      let: { campaignId: '$_id', minBudget: 10000 },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$campaignId', '$$campaignId'] },
                { $gte: ['$budget', '$$minBudget'] },
              ],
            },
          },
        },
        { $project: { name: 1, budget: 1, platform: 1 } },
      ],
      as: 'highValueLineItems',
    },
  },
]);

// Self-join to find similar campaigns
db.campaigns.aggregate([
  { $match: { _id: ObjectId('...') } },
  {
    $lookup: {
      from: 'campaigns',
      let: { budget: '$budget.total', accountId: '$accountId' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$accountId', '$$accountId'] },
                { $gte: ['$budget.total', { $multiply: ['$$budget', 0.8] }] },
                { $lte: ['$budget.total', { $multiply: ['$$budget', 1.2] }] },
              ],
            },
          },
        },
        { $limit: 5 },
      ],
      as: 'similarCampaigns',
    },
  },
]);

// Faceted search (multiple aggregations in parallel)
db.campaigns.aggregate([
  {
    $facet: {
      byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      byBudgetRange: [
        {
          $bucket: {
            groupBy: '$budget.total',
            boundaries: [0, 10000, 50000, 100000, 500000, 1000000],
            default: '1M+',
            output: { count: { $sum: 1 }, avgBudget: { $avg: '$budget.total' } },
          },
        },
      ],
      topAccounts: [
        { $group: { _id: '$accountId', campaignCount: { $sum: 1 } } },
        { $sort: { campaignCount: -1 } },
        { $limit: 10 },
      ],
    },
  },
]);
```

## Indexes and Performance

### Current Indexes

```javascript
// Campaign indexes
db.campaigns.createIndex({ name: 1 });
db.campaigns.createIndex({ campaignNumber: 1 }, { unique: true });
db.campaigns.createIndex({ accountId: 1 });
db.campaigns.createIndex({ status: 1 });
db.campaigns.createIndex({ createdAt: -1 });
db.campaigns.createIndex({ 'dates.start': 1, 'dates.end': 1 });

// Strategy indexes
db.strategies.createIndex({ campaignId: 1 });
db.strategies.createIndex({ name: 1 });

// Line item indexes
db.lineItems.createIndex({ campaignId: 1 });
db.lineItems.createIndex({ strategyId: 1 });
db.lineItems.createIndex({ platform: 1 });
db.lineItems.createIndex({ type: 1 });

// Compound indexes for common queries
db.campaigns.createIndex({ accountId: 1, status: 1, createdAt: -1 });
db.lineItems.createIndex({ campaignId: 1, type: 1, budget: -1 });
```

### Advanced Index Types

```javascript
// Text index for full-text search
db.campaigns.createIndex(
  {
    name: 'text',
    description: 'text',
  },
  {
    weights: { name: 10, description: 5 },
    name: 'campaign_text_search',
  }
);

// Partial index (only index documents matching filter)
db.campaigns.createIndex({ accountId: 1 }, { partialFilterExpression: { status: 'active' } });

// TTL index for automatic document expiration
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 } // Expire after 1 hour
);

// Wildcard index for dynamic fields
db.campaigns.createIndex({ 'metadata.$**': 1 });
```

### Performance Optimization Tips

1. **Use explain() to analyze queries**

```javascript
db.campaigns.find({ status: 'active' }).explain('executionStats');
```

2. **Optimize $lookup performance**

- Create indexes on foreign key fields
- Use `let` and `pipeline` for complex conditions
- Consider denormalizing frequently joined data

3. **Batch operations for better performance**

```javascript
// Instead of multiple individual updates
campaigns.forEach((c) => db.campaigns.updateOne({ _id: c._id }, { $set: { status: 'active' } }));

// Use bulkWrite
const operations = campaigns.map((c) => ({
  updateOne: { filter: { _id: c._id }, update: { $set: { status: 'active' } } },
}));
db.campaigns.bulkWrite(operations);
```

## Advanced Patterns

### Materialized Views for Embedded Data

When you need to query embedded data independently:

```javascript
// Create a materialized view that flattens nested data
db.createView('campaign_line_items_view', 'campaigns', [
  {
    $lookup: {
      from: 'lineItems',
      localField: '_id',
      foreignField: 'campaignId',
      as: 'lineItems',
    },
  },
  { $unwind: '$lineItems' },
  {
    $project: {
      campaignId: '$_id',
      campaignName: '$name',
      lineItemId: '$lineItems._id',
      lineItemName: '$lineItems.name',
      platform: '$lineItems.platform',
      budget: '$lineItems.budget',
    },
  },
]);

// Query the view like a regular collection
db.campaign_line_items_view.find({ platform: 'Google Ads' });
```

### Change Streams for Real-time Updates

```javascript
// Watch for changes to campaigns
const changeStream = db.campaigns.watch([
  { $match: { operationType: { $in: ['insert', 'update', 'delete'] } } },
]);

changeStream.on('change', (change) => {
  console.log('Change detected:', change);
  // Update cache, notify clients, etc.
});

// Watch specific fields only
const budgetChangeStream = db.campaigns.watch([
  {
    $match: {
      operationType: 'update',
      'updateDescription.updatedFields.budget': { $exists: true },
    },
  },
]);
```

### Transactions for Data Consistency

```javascript
// Multi-document transaction
const session = db.getMongo().startSession();
session.startTransaction();

try {
  // Create campaign
  const campaign = db.campaigns.insertOne(
    {
      name: 'New Campaign',
      budget: { total: 100000, allocated: 0 },
    },
    { session }
  );

  // Create strategy
  db.strategies.insertOne(
    {
      campaignId: campaign.insertedId,
      name: 'Default Strategy',
    },
    { session }
  );

  // Commit transaction
  session.commitTransaction();
} catch (error) {
  session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

## MongoDB Tools

### GUI Tools for Development

1. **MongoDB Compass** (Official)
   - Download: https://www.mongodb.com/products/compass
   - Features: Visual query builder, performance insights, schema analysis

2. **Studio 3T**
   - Download: https://studio3t.com/
   - Features: SQL query support, data comparison, migration tools

3. **NoSQLBooster**
   - Download: https://nosqlbooster.com/
   - Features: IntelliSense, query profiler, ES6 support

4. **Robo 3T** (formerly Robomongo)
   - Download: https://robomongo.org/
   - Features: Lightweight, embedded shell, simple interface

### Command-Line Tools

```bash
# Import data from JSON
mongoimport --db mediatool_v2 --collection campaigns --file campaigns.json

# Export collection to JSON
mongoexport --db mediatool_v2 --collection campaigns --out campaigns_backup.json

# Dump entire database (BSON format)
mongodump --db mediatool_v2 --out ./backup

# Restore from dump
mongorestore --db mediatool_v2 ./backup/mediatool_v2

# Copy collection to another database
mongodump --db mediatool_v2 --collection campaigns --archive | mongorestore --archive --nsFrom='mediatool_v2.campaigns' --nsTo='mediatool_backup.campaigns'
```

## Troubleshooting & Maintenance

### Common Issues and Solutions

1. **Slow Queries**

```javascript
// Find slow queries
db.currentOp({ active: true, secs_running: { $gt: 3 } });

// Kill a long-running operation
db.killOp(opid);

// Enable profiling
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().limit(5).sort({ ts: -1 }).pretty();
```

2. **Database Maintenance**

```javascript
// Check collection stats
db.campaigns.stats();

// Rebuild indexes
db.campaigns.reIndex();

// Compact collection (requires downtime)
db.runCommand({ compact: 'campaigns' });

// Validate collection integrity
db.campaigns.validate({ full: true });
```

3. **Connection Issues**

```javascript
// Check connection status
db.serverStatus().connections;

// View current operations
db.currentOp();

// Check replica set status (if applicable)
rs.status();
```

### Performance Monitoring

```javascript
// Get query execution stats
db.campaigns.find({ status: 'active' }).explain('executionStats');

// Monitor index usage
db.campaigns.aggregate([{ $indexStats: {} }]);

// Collection-level statistics
db.campaigns.stats();

// Database-level statistics
db.stats();
```

## Best Practices

1. **Always use ObjectIds for references** - Don't store as strings
2. **Add indexes before going to production** - Analyze query patterns
3. **Use aggregation pipeline for complex queries** - More efficient than client-side processing
4. **Implement proper error handling** - MongoDB operations can fail
5. **Use transactions for critical operations** - Ensure data consistency
6. **Monitor performance regularly** - Use Atlas monitoring or Compass
7. **Plan for horizontal scaling** - Design with sharding in mind
8. **Keep documents reasonably sized** - MongoDB has a 16MB document limit
9. **Use appropriate write concerns** - Balance between performance and durability
10. **Regular backups** - Implement automated backup strategy
