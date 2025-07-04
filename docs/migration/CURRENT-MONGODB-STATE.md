# Current MongoDB State - IMPORTANT README

## Database Location

- **Database Name**: `mediatool_v2`
- **Connection String**: `mongodb://localhost:27017/mediatool_v2`
- **Total Documents**: 238,463

## Current Structure

The MongoDB database currently uses the **ORIGINAL** PostgreSQL structure where collections are SEPARATE (not embedded). This is actually **GOOD** for your requirement of querying line items independently!

### Collections and Document Counts

| Collection        | Documents | Description                       |
| ----------------- | --------- | --------------------------------- |
| campaigns         | 13,417    | Campaign records from Zoho        |
| strategies        | 13,417    | One strategy per campaign         |
| lineItems         | 3,343     | **Can be queried independently!** |
| mediaBuys         | 56,020    | Media buy records                 |
| lineItemMediaBuys | 5,548     | Junction table data               |
| mediaPlans        | 5,244     | Renamed from media_buys           |
| platformEntities  | 142,333   | Platform sync data                |
| users             | 326       | User records with roles           |
| accounts          | 9,796     | Account records                   |

## How Data is Structured

### 1. Campaigns Collection

```javascript
{
  _id: "2461504000000873654",
  name: "Campaign Name",
  campaignNumber: "CAMP-001",
  accountId: "account-id",
  budget: 150000,
  // ... other fields
}
```

### 2. Strategies Collection

```javascript
{
  _id: "d1f227c0-3e5d-4c4c-904c-e61f55e76fe7",
  campaignId: "2461504000000873654",  // Links to campaign
  name: "Strategy Name",
  // ... other fields
}
```

### 3. Line Items Collection (Independently Queryable!)

```javascript
{
  _id: "f272f840-c1db-4815-b92a-7895a679661b",
  strategyId: "d1f227c0-3e5d-4c4c-904c-e61f55e76fe7",  // Links to strategy
  name: "Display Campaign",
  description: "Top funnel display",
  budget: 50000,
  startDate: ISODate("2024-01-01"),
  endDate: ISODate("2024-01-31"),
  channelId: 1,
  channelName: "Display",
  // ... other fields
}
```

## Querying Examples

### Independent Line Item Queries

```javascript
// Find all Display line items
db.lineItems.find({ channelName: 'Display' });

// Find line items by budget
db.lineItems.find({ budget: { $gte: 50000 } });

// Search line items by name
db.lineItems.find({ name: /prospecting/i });

// Get line items for a specific date range
db.lineItems.find({
  startDate: { $lte: new Date('2024-01-31') },
  endDate: { $gte: new Date('2024-01-01') },
});

// Aggregate line items by channel
db.lineItems.aggregate([
  {
    $group: {
      _id: '$channelName',
      count: { $sum: 1 },
      totalBudget: { $sum: '$budget' },
    },
  },
]);
```

### Media Plans Queries

```javascript
// Get all media plans
db.mediaPlans.find({});

// Get media plans for a line item
db.mediaPlans.find({ lineItemId: 'line-item-id' });

// Get media plans for a date range
db.mediaPlans.find({
  startDate: { $lte: new Date('2024-01-31') },
  endDate: { $gte: new Date('2024-01-01') },
});
```

### Join Queries (When Needed)

```javascript
// Get line items with their campaign info
db.lineItems.aggregate([
  {
    $lookup: {
      from: 'strategies',
      localField: 'strategyId',
      foreignField: '_id',
      as: 'strategy',
    },
  },
  { $unwind: '$strategy' },
  {
    $lookup: {
      from: 'campaigns',
      localField: 'strategy.campaignId',
      foreignField: '_id',
      as: 'campaign',
    },
  },
  { $unwind: '$campaign' },
  {
    $project: {
      name: 1,
      budget: 1,
      campaignName: '$campaign.name',
      accountId: '$campaign.accountId',
    },
  },
]);
```

## MongoDB Admin Tools

To browse this data visually:

### 1. MongoDB Compass (Recommended)

- Download: https://www.mongodb.com/products/compass
- Connect to: `mongodb://localhost:27017/mediatool_v2`
- You can browse all collections and run queries

### 2. Web-Based Admin

```bash
# Install and run AdminMongo
npm install -g admin-mongo
admin-mongo

# Open http://localhost:1234
# Add connection to mongodb://localhost:27017/mediatool_v2
```

## Version Control & Change Tracking

The version control system is set up with these collections:

- `changeEvents` - Tracks all changes
- `versionSnapshots` - Point-in-time snapshots

## Important Notes

1. **Line Items ARE Queryable Independently** - They're in their own collection!
2. **This is the Active Database** - All 238,463 documents are here
3. **Relationships via IDs** - Collections are linked by foreign keys (like PostgreSQL)
4. **No Embedded Documents** - Everything is in separate collections

## Next Steps

1. **Frontend Integration**
   - Update API endpoints to query MongoDB collections
   - Use the separate collections structure (not embedded)

2. **Search Implementation**
   - Create text indexes on collections:

   ```javascript
   db.lineItems.createIndex({ name: 'text', description: 'text' });
   db.campaigns.createIndex({ name: 'text', campaignNumber: 'text' });
   ```

3. **Performance Optimization**
   - Add indexes for common queries:
   ```javascript
   db.lineItems.createIndex({ strategyId: 1 });
   db.lineItems.createIndex({ channelId: 1 });
   db.lineItems.createIndex({ startDate: 1, endDate: 1 });
   ```

The migration is complete and the data is ready to use!
