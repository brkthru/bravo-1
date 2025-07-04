# MongoDB Quick Reference - Media Tool

## Common Operations

### 1. Finding Documents

```javascript
// Find one campaign by ID
db.campaigns.findOne({ _id: 'campaign-123' });

// Find campaigns by account
db.campaigns.find({ accountId: 'account-456' }).toArray();

// Find with nested field
db.campaigns.find({ 'strategy.lineItems.name': 'Display Campaign' });

// Find with array contains
db.campaigns.find({ 'strategy.lineItems.mediaPlanIds': 'mp-123' });

// Find with date range
db.campaigns.find({
  flightDate: { $gte: ISODate('2024-01-01') },
  endDate: { $lte: ISODate('2024-12-31') },
});
```

### 2. Updating Documents

```javascript
// Update top-level field
db.campaigns.updateOne({ _id: 'campaign-123' }, { $set: { budget: 100000 } });

// Update nested field
db.campaigns.updateOne(
  { _id: 'campaign-123' },
  { $set: { 'strategy.objectives': 'New objectives' } }
);

// Update array element by ID
db.campaigns.updateOne(
  { 'strategy.lineItems._id': 'li-123' },
  { $set: { 'strategy.lineItems.$.budget': 50000 } }
);

// Add to array
db.campaigns.updateOne(
  { 'strategy.lineItems._id': 'li-123' },
  { $push: { 'strategy.lineItems.$.mediaPlanIds': 'mp-new' } }
);

// Remove from array
db.campaigns.updateOne(
  { 'strategy.lineItems._id': 'li-123' },
  { $pull: { 'strategy.lineItems.$.mediaPlanIds': 'mp-old' } }
);
```

### 3. Aggregation Basics

```javascript
// Count by field
db.campaigns.aggregate([
  {
    $group: {
      _id: '$accountId',
      count: { $sum: 1 },
    },
  },
]);

// Sum nested array
db.campaigns.aggregate([
  { $unwind: '$strategy.lineItems' },
  {
    $group: {
      _id: '$_id',
      totalBudget: { $sum: '$strategy.lineItems.budget' },
    },
  },
]);

// Join collections
db.campaigns.aggregate([
  {
    $lookup: {
      from: 'mediaPlans',
      localField: 'strategy.lineItems._id',
      foreignField: 'lineItemId',
      as: 'allMediaPlans',
    },
  },
]);
```

### 4. Working with Metrics

```javascript
// Get metrics for date range
db.platformMetrics.find({
  date: {
    $gte: ISODate('2024-01-01'),
    $lte: ISODate('2024-01-31'),
  },
  campaignId: 'campaign-123',
});

// Sum metrics by type
db.platformMetrics.aggregate([
  { $match: { campaignId: 'campaign-123' } },
  { $unwind: '$metrics' },
  {
    $group: {
      _id: '$metrics.unitType',
      total: { $sum: '$metrics.units' },
    },
  },
]);

// Calculate daily average
db.platformMetrics.aggregate([
  {
    $match: {
      campaignId: 'campaign-123',
      date: { $gte: ISODate('2024-01-01') },
    },
  },
  {
    $group: {
      _id: null,
      avgSpend: { $avg: '$spend' },
      totalDays: { $sum: 1 },
    },
  },
]);
```

### 5. Text Search

```javascript
// Simple text search
db.campaigns.find({
  $text: { $search: 'digital marketing' },
});

// With score
db.campaigns
  .find({ $text: { $search: 'digital marketing' } }, { score: { $meta: 'textScore' } })
  .sort({ score: { $meta: 'textScore' } });

// Regex search (case-insensitive)
db.campaigns.find({
  name: { $regex: 'digital', $options: 'i' },
});
```

### 6. Performance Queries

```javascript
// Explain query plan
db.campaigns.find({ accountId: '123' }).explain('executionStats');

// Check index usage
db.campaigns.getIndexes();

// Profile slow queries
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().limit(5).sort({ ts: -1 });
```

## Shell Commands

### Database Operations

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/mediatool_v2

# Switch database
use mediatool_v2

# Show collections
show collections

# Count documents
db.campaigns.countDocuments()

# Get collection stats
db.campaigns.stats()
```

### Import/Export

```bash
# Export collection
mongoexport --db=mediatool_v2 --collection=campaigns --out=campaigns.json

# Import collection
mongoimport --db=mediatool_v2 --collection=campaigns --file=campaigns.json

# Export with query
mongoexport --db=mediatool_v2 --collection=campaigns \
  --query='{"accountId":"123"}' --out=account123.json
```

### Backup/Restore

```bash
# Backup database
mongodump --db=mediatool_v2 --out=/backup/

# Restore database
mongorestore --db=mediatool_v2 /backup/mediatool_v2/

# Backup specific collection
mongodump --db=mediatool_v2 --collection=campaigns
```

## Common Patterns

### 1. Pagination

```javascript
const pageSize = 20;
const page = 1;

db.campaigns
  .find()
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .toArray();
```

### 2. Bulk Operations

```javascript
const bulk = db.campaigns.initializeUnorderedBulkOp();

bulk.find({ accountId: '123' }).update({ $set: { status: 'active' } });
bulk.find({ accountId: '456' }).update({ $set: { status: 'paused' } });

bulk.execute();
```

### 3. Transactions

```javascript
const session = db.getMongo().startSession();
session.startTransaction();

try {
  db.campaigns.updateOne({ _id: '123' }, { $set: { budget: 50000 } }, { session });

  db.mediaPlans.insertOne({ lineItemId: '456', budget: 25000 }, { session });

  session.commitTransaction();
} catch (error) {
  session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 4. Change Streams

```javascript
// Watch for changes
const changeStream = db.campaigns.watch();

changeStream.on('change', (change) => {
  console.log('Change detected:', change);
});

// Watch specific operations
const pipeline = [{ $match: { operationType: { $in: ['insert', 'update'] } } }];
const changeStream = db.campaigns.watch(pipeline);
```

## Indexing Best Practices

### 1. Create Indexes

```javascript
// Single field
db.campaigns.createIndex({ accountId: 1 });

// Compound index (order matters!)
db.campaigns.createIndex({ accountId: 1, createdAt: -1 });

// Text index
db.campaigns.createIndex({ name: 'text', 'strategy.lineItems.name': 'text' });

// Partial index
db.campaigns.createIndex({ accountId: 1 }, { partialFilterExpression: { isActive: true } });

// TTL index (auto-delete old docs)
db.platformMetrics.createIndex(
  { date: 1 },
  { expireAfterSeconds: 7776000 } // 90 days
);
```

### 2. Index Management

```javascript
// List indexes
db.campaigns.getIndexes();

// Drop index
db.campaigns.dropIndex('accountId_1');

// Rebuild indexes
db.campaigns.reIndex();

// Get index stats
db.campaigns.aggregate([{ $indexStats: {} }]);
```

## Useful Aggregation Stages

### $project - Reshape documents

```javascript
{ $project: {
  name: 1,
  budget: 1,
  lineItemCount: { $size: "$strategy.lineItems" }
}}
```

### $match - Filter documents

```javascript
{ $match: {
  budget: { $gte: 100000 },
  isActive: true
}}
```

### $group - Group and calculate

```javascript
{ $group: {
  _id: "$accountId",
  totalBudget: { $sum: "$budget" },
  avgBudget: { $avg: "$budget" },
  campaignCount: { $sum: 1 }
}}
```

### $lookup - Join collections

```javascript
{ $lookup: {
  from: "accounts",
  localField: "accountId",
  foreignField: "_id",
  as: "account"
}}
```

### $unwind - Deconstruct arrays

```javascript
{
  $unwind: '$strategy.lineItems';
}
```

### $sort and $limit

```javascript
{ $sort: { budget: -1 } },
{ $limit: 10 }
```

### $facet - Multiple aggregations

```javascript
{ $facet: {
  byAccount: [
    { $group: { _id: "$accountId", count: { $sum: 1 } } }
  ],
  byStatus: [
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ],
  total: [
    { $count: "count" }
  ]
}}
```

## Performance Tips

1. **Always use indexes** for queries in production
2. **Project only needed fields** to reduce data transfer
3. \*\*Use `explain()` to analyze query performance
4. **Avoid $where** - use native operators instead
5. **Limit array sizes** - consider separate collections for large arrays
6. **Use aggregation pipelines** for complex queries instead of multiple queries
7. **Enable connection pooling** in your application
8. **Monitor slow queries** with profiling

## Troubleshooting

### Check current operations

```javascript
db.currentOp();

// Kill long-running operation
db.killOp(opid);
```

### Check database stats

```javascript
db.stats();
db.serverStatus();
```

### Repair database

```javascript
db.repairDatabase();
```

### Validate collection

```javascript
db.campaigns.validate();
```
