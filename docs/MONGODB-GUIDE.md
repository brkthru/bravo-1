# MongoDB Guide for Bravo-1

## Current Database Structure

Bravo-1 uses **separate collections** with foreign key relationships (similar to SQL):

```javascript
// Actual structure - SEPARATE COLLECTIONS
campaigns: { _id: ObjectId(), name: "Campaign Name", accountId: "...", ... }
strategies: { _id: ObjectId(), campaignId: ObjectId(), name: "Strategy Name", ... }
lineItems: { _id: ObjectId(), strategyId: ObjectId(), campaignId: ObjectId(), ... }
```

## Common Query Patterns

### Finding Documents

```javascript
// Find all campaigns
db.campaigns.find().toArray()

// Find campaigns with pagination
db.campaigns.find().skip(0).limit(50).toArray()

// Find strategies for a campaign
db.strategies.find({ campaignId: ObjectId("...") }).toArray()

// Find line items for a strategy
db.lineItems.find({ strategyId: ObjectId("...") }).toArray()

// Search campaigns by name
db.campaigns.find({ 
  name: { $regex: "Virginia", $options: "i" } 
}).toArray()
```

### Aggregation Examples

```javascript
// Get campaign with all its strategies and line items
db.campaigns.aggregate([
  { $match: { _id: ObjectId("...") } },
  { $lookup: {
      from: "strategies",
      localField: "_id",
      foreignField: "campaignId",
      as: "strategies"
  }},
  { $lookup: {
      from: "lineItems",
      localField: "_id",
      foreignField: "campaignId",
      as: "lineItems"
  }}
])

// Count line items per campaign
db.lineItems.aggregate([
  { $group: {
      _id: "$campaignId",
      lineItemCount: { $sum: 1 },
      totalBudget: { $sum: "$budget" }
  }},
  { $lookup: {
      from: "campaigns",
      localField: "_id",
      foreignField: "_id",
      as: "campaign"
  }}
])
```

### Updating Documents

```javascript
// Update a campaign
db.campaigns.updateOne(
  { _id: ObjectId("...") },
  { $set: { budget: 100000, updatedAt: new Date() } }
)

// Update multiple strategies
db.strategies.updateMany(
  { campaignId: ObjectId("...") },
  { $set: { status: "active" } }
)
```

## Indexes

Current indexes for performance:

```javascript
// Campaign indexes
db.campaigns.createIndex({ name: 1 })
db.campaigns.createIndex({ accountId: 1 })
db.campaigns.createIndex({ createdAt: -1 })

// Strategy indexes
db.strategies.createIndex({ campaignId: 1 })
db.strategies.createIndex({ name: 1 })

// Line item indexes
db.lineItems.createIndex({ strategyId: 1 })
db.lineItems.createIndex({ campaignId: 1 })
db.lineItems.createIndex({ name: 1 })
```

## Performance Tips

1. **Use projections** to limit returned fields:
   ```javascript
   db.campaigns.find({}, { name: 1, budget: 1, status: 1 })
   ```

2. **Create compound indexes** for common query patterns:
   ```javascript
   db.campaigns.createIndex({ accountId: 1, status: 1, createdAt: -1 })
   ```

3. **Use `explain()` to analyze queries**:
   ```javascript
   db.campaigns.find({ status: "active" }).explain("executionStats")
   ```

## Shell Commands

```bash
# Connect to MongoDB
docker exec -it bravo1_mongodb mongosh mediatool_v2

# Export collection
docker exec bravo1_mongodb mongoexport \
  --db=mediatool_v2 \
  --collection=campaigns \
  --out=/data/campaigns-backup.json

# Import collection
docker exec bravo1_mongodb mongoimport \
  --db=mediatool_v2 \
  --collection=campaigns \
  --file=/data/campaigns-backup.json

# Create backup
docker exec bravo1_mongodb mongodump \
  --db=mediatool_v2 \
  --out=/data/backup-$(date +%Y%m%d)

# Restore from backup
docker exec bravo1_mongodb mongorestore \
  --db=mediatool_v2 \
  /data/backup-20250622
```

## MongoDB Best Practices for Bravo-1

1. **Separate Collections**: We use separate collections (not embedded documents) for easier querying and to avoid document size limits

2. **ObjectId Usage**: Always use ObjectId for references between collections

3. **Timestamps**: Include `createdAt` and `updatedAt` fields on all documents

4. **Soft Deletes**: Use `deletedAt` field instead of hard deletes when appropriate

5. **Validation**: Use Zod schemas in the application layer for validation (MongoDB schema validation not currently implemented)

## Useful MongoDB Tools

- **MongoDB Compass**: GUI for exploring and querying data
- **Studio 3T**: Advanced MongoDB IDE with SQL query support
- **Robo 3T**: Lightweight MongoDB GUI
- **mongosh**: MongoDB Shell for command-line operations

## Common Issues and Solutions

### Large Result Sets
Use pagination with `skip()` and `limit()`:
```javascript
const page = 1;
const pageSize = 50;
db.campaigns.find()
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .toArray()
```

### Slow Queries
Check indexes with:
```javascript
db.campaigns.getIndexes()
```

### Memory Issues
Use cursor iteration for large datasets:
```javascript
const cursor = db.campaigns.find();
while (cursor.hasNext()) {
  const doc = cursor.next();
  // Process document
}
```