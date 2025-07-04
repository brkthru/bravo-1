# MongoDB Joins & Complex Queries Guide

## Yes, MongoDB Supports Joins!

MongoDB uses the `$lookup` operator for joins, which is similar to SQL JOINs but with some MongoDB-specific features.

## Basic Join Syntax

```javascript
db.collection.aggregate([
  {
    $lookup: {
      from: 'otherCollection', // Collection to join
      localField: 'fieldName', // Field from input documents
      foreignField: 'fieldName', // Field from documents of the "from" collection
      as: 'outputArrayField', // Output array field name
    },
  },
]);
```

## Practical Examples for Media Tool

### 1. Get Line Items with Campaign and Strategy Info

```javascript
db.lineItems.aggregate([
  // First join with strategies
  {
    $lookup: {
      from: 'strategies',
      localField: 'strategyId',
      foreignField: '_id',
      as: 'strategy',
    },
  },
  { $unwind: '$strategy' }, // Convert array to object

  // Then join with campaigns
  {
    $lookup: {
      from: 'campaigns',
      localField: 'strategy.campaignId',
      foreignField: '_id',
      as: 'campaign',
    },
  },
  { $unwind: '$campaign' },

  // Project the fields we want
  {
    $project: {
      // Line item fields
      lineItemName: '$name',
      lineItemBudget: '$budget',
      startDate: 1,
      endDate: 1,

      // Strategy fields
      strategyName: '$strategy.name',

      // Campaign fields
      campaignName: '$campaign.name',
      campaignNumber: '$campaign.campaignNumber',
      accountId: '$campaign.accountId',
    },
  },
]);
```

### 2. Get Campaigns with All Their Line Items

```javascript
db.campaigns.aggregate([
  // Join with strategies
  {
    $lookup: {
      from: 'strategies',
      localField: '_id',
      foreignField: 'campaignId',
      as: 'strategy',
    },
  },
  { $unwind: { path: '$strategy', preserveNullAndEmptyArrays: true } },

  // Join with line items
  {
    $lookup: {
      from: 'lineItems',
      localField: 'strategy._id',
      foreignField: 'strategyId',
      as: 'lineItems',
    },
  },

  // Add computed fields
  {
    $addFields: {
      lineItemCount: { $size: '$lineItems' },
      totalLineItemBudget: { $sum: '$lineItems.budget' },
    },
  },

  // Optional: Filter campaigns with line items
  { $match: { lineItemCount: { $gt: 0 } } },
]);
```

### 3. Get Media Plans with Full Context

```javascript
db.mediaPlans.aggregate([
  // Join with line items
  {
    $lookup: {
      from: 'lineItems',
      localField: 'lineItemId',
      foreignField: '_id',
      as: 'lineItem',
    },
  },
  { $unwind: '$lineItem' },

  // Join with platform entities
  {
    $lookup: {
      from: 'platformEntities',
      localField: 'platformEntityId',
      foreignField: '_id',
      as: 'platformEntity',
    },
  },
  { $unwind: '$platformEntity' },

  // Join with strategies (through line item)
  {
    $lookup: {
      from: 'strategies',
      localField: 'lineItem.strategyId',
      foreignField: '_id',
      as: 'strategy',
    },
  },
  { $unwind: '$strategy' },

  // Join with campaigns (through strategy)
  {
    $lookup: {
      from: 'campaigns',
      localField: 'strategy.campaignId',
      foreignField: '_id',
      as: 'campaign',
    },
  },
  { $unwind: '$campaign' },

  // Shape the output
  {
    $project: {
      // Media plan fields
      plannedSpend: 1,
      actualSpend: 1,
      startDate: 1,
      endDate: 1,

      // Line item info
      lineItemName: '$lineItem.name',
      lineItemBudget: '$lineItem.budget',

      // Platform info
      platformName: '$platformEntity.mediaPlatformName',
      platformEntityName: '$platformEntity.name',

      // Campaign info
      campaignName: '$campaign.name',
      accountId: '$campaign.accountId',
    },
  },
]);
```

### 4. Complex Analytics Query - Spend by Channel Across Accounts

```javascript
db.lineItems.aggregate([
  // Join with strategies
  {
    $lookup: {
      from: 'strategies',
      localField: 'strategyId',
      foreignField: '_id',
      as: 'strategy',
    },
  },
  { $unwind: '$strategy' },

  // Join with campaigns
  {
    $lookup: {
      from: 'campaigns',
      localField: 'strategy.campaignId',
      foreignField: '_id',
      as: 'campaign',
    },
  },
  { $unwind: '$campaign' },

  // Join with accounts
  {
    $lookup: {
      from: 'accounts',
      localField: 'campaign.accountId',
      foreignField: '_id',
      as: 'account',
    },
  },
  { $unwind: '$account' },

  // Join with channels
  {
    $lookup: {
      from: 'channels',
      localField: 'channelId',
      foreignField: '_id',
      as: 'channel',
    },
  },
  { $unwind: '$channel' },

  // Group by account and channel
  {
    $group: {
      _id: {
        accountId: '$account._id',
        accountName: '$account.name',
        channelId: '$channel._id',
        channelName: '$channel.name',
      },
      totalBudget: { $sum: '$budget' },
      lineItemCount: { $sum: 1 },
      avgBudget: { $avg: '$budget' },
    },
  },

  // Reshape for readability
  {
    $project: {
      _id: 0,
      accountId: '$_id.accountId',
      accountName: '$_id.accountName',
      channelId: '$_id.channelId',
      channelName: '$_id.channelName',
      totalBudget: 1,
      lineItemCount: 1,
      avgBudget: { $round: ['$avgBudget', 2] },
    },
  },

  // Sort by total budget
  { $sort: { totalBudget: -1 } },
]);
```

### 5. Performance Metrics with Joins

```javascript
db.platformMetrics.aggregate([
  // Filter date range
  {
    $match: {
      date: {
        $gte: ISODate('2024-01-01'),
        $lte: ISODate('2024-01-31'),
      },
    },
  },

  // Join with platform entities
  {
    $lookup: {
      from: 'platformEntities',
      localField: 'platformEntityId',
      foreignField: '_id',
      as: 'platformEntity',
    },
  },
  { $unwind: '$platformEntity' },

  // Join with media plans to get line item context
  {
    $lookup: {
      from: 'mediaPlans',
      localField: 'platformEntityId',
      foreignField: 'platformEntityId',
      as: 'mediaPlans',
    },
  },

  // Group by platform and calculate metrics
  {
    $group: {
      _id: '$platformEntity.mediaPlatformName',
      totalSpend: { $sum: '$spend' },
      totalImpressions: {
        $sum: {
          $reduce: {
            input: '$metrics',
            initialValue: 0,
            in: {
              $cond: [
                { $eq: ['$$this.unitType', 'impressions'] },
                { $add: ['$$value', '$$this.units'] },
                '$$value',
              ],
            },
          },
        },
      },
      avgCPM: {
        $avg: {
          $divide: [
            { $multiply: ['$spend', 1000] },
            {
              $reduce: {
                input: '$metrics',
                initialValue: 1,
                in: {
                  $cond: [{ $eq: ['$$this.unitType', 'impressions'] }, '$$this.units', '$$value'],
                },
              },
            },
          ],
        },
      },
    },
  },
]);
```

## Advanced Join Features

### 1. Multiple Join Conditions

```javascript
{
  $lookup: {
    from: "mediaPlans",
    let: { lineItemId: "$_id", startDate: "$startDate" },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$lineItemId", "$$lineItemId"] },
              { $gte: ["$startDate", "$$startDate"] }
            ]
          }
        }
      }
    ],
    as: "activeMediaPlans"
  }
}
```

### 2. Left Outer Join (Preserve Documents Without Matches)

```javascript
{
  $lookup: {
    from: "lineItems",
    localField: "_id",
    foreignField: "strategyId",
    as: "lineItems"
  }
},
{
  $unwind: {
    path: "$lineItems",
    preserveNullAndEmptyArrays: true  // This makes it a LEFT JOIN
  }
}
```

### 3. Self-Joins

```javascript
// Find campaigns with similar budgets
db.campaigns.aggregate([
  {
    $lookup: {
      from: 'campaigns',
      let: { myBudget: '$budget', myId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $ne: ['$_id', '$$myId'] }, // Not the same campaign
                { $gte: ['$budget', { $multiply: ['$$myBudget', 0.9] }] },
                { $lte: ['$budget', { $multiply: ['$$myBudget', 1.1] }] },
              ],
            },
          },
        },
      ],
      as: 'similarCampaigns',
    },
  },
]);
```

## Performance Tips for Joins

### 1. Create Indexes on Join Fields

```javascript
// Essential indexes for joins
db.strategies.createIndex({ campaignId: 1 });
db.lineItems.createIndex({ strategyId: 1 });
db.mediaPlans.createIndex({ lineItemId: 1 });
db.mediaPlans.createIndex({ platformEntityId: 1 });
```

### 2. Use $match Early in Pipeline

```javascript
// Good: Filter before joining
db.lineItems.aggregate([
  { $match: { budget: { $gte: 50000 } } }, // Filter first
  {
    $lookup: {
      /* ... */
    },
  },
]);

// Bad: Filter after joining
db.lineItems.aggregate([
  {
    $lookup: {
      /* ... */
    },
  },
  { $match: { budget: { $gte: 50000 } } }, // Filter last
]);
```

### 3. Project Only Needed Fields

```javascript
db.campaigns.aggregate([
  // Get only fields needed for join
  { $project: { _id: 1, name: 1, accountId: 1 } },
  {
    $lookup: {
      /* ... */
    },
  },
]);
```

## Comparison with SQL

### SQL Version:

```sql
SELECT
  li.name as line_item_name,
  li.budget,
  c.name as campaign_name,
  a.name as account_name
FROM line_items li
JOIN strategies s ON li.strategy_id = s.id
JOIN campaigns c ON s.campaign_id = c.id
JOIN accounts a ON c.account_id = a.id
WHERE li.budget > 50000
ORDER BY li.budget DESC
```

### MongoDB Version:

```javascript
db.lineItems.aggregate([
  { $match: { budget: { $gt: 50000 } } },
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
    $lookup: {
      from: 'accounts',
      localField: 'campaign.accountId',
      foreignField: '_id',
      as: 'account',
    },
  },
  { $unwind: '$account' },
  {
    $project: {
      line_item_name: '$name',
      budget: 1,
      campaign_name: '$campaign.name',
      account_name: '$account.name',
    },
  },
  { $sort: { budget: -1 } },
]);
```

## Creating Views for Common Joins

You can create permanent views for frequently used joins:

```javascript
db.createView('lineItemsWithContext', 'lineItems', [
  // All the join pipeline stages
  {
    $lookup: {
      /* strategies */
    },
  },
  { $unwind: '$strategy' },
  {
    $lookup: {
      /* campaigns */
    },
  },
  { $unwind: '$campaign' },
  {
    $lookup: {
      /* accounts */
    },
  },
  { $unwind: '$account' },
  {
    $project: {
      /* final shape */
    },
  },
]);

// Then query it like a regular collection
db.lineItemsWithContext.find({ account_name: 'Acme Corp' });
```

## Yes, MongoDB Can Do Joins!

- ✅ Multiple joins in one query
- ✅ Left/right/inner join equivalents
- ✅ Complex conditions
- ✅ Self-joins
- ✅ Aggregations with joins
- ✅ Views for common join patterns

The syntax is different from SQL, but the capabilities are there!
