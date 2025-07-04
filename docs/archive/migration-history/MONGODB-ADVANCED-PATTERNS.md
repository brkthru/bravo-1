# MongoDB Advanced Patterns - Media Tool

## Table of Contents

1. [Querying Nested Data Independently](#querying-nested-data-independently)
2. [Version Control System Design](#version-control-system-design)
3. [Change Tracking Implementation](#change-tracking-implementation)
4. [Performance Optimization Strategies](#performance-optimization-strategies)

## Querying Nested Data Independently

### The Challenge

With line items embedded in campaigns, how do we:

- Create a line items listing page
- Search across all line items
- Show media plans independently
- Generate metrics across campaigns

### Solution 1: Materialized Views Pattern

Create separate collections that mirror embedded data for independent queries:

```javascript
// Collection: lineItemsView (materialized from campaigns)
{
  _id: "line-item-uuid",
  campaignId: "campaign-uuid",
  campaignName: "Q1 Campaign",
  strategyId: "strategy-uuid",

  // All line item fields
  name: "Display - Prospecting",
  description: "Top funnel display",
  budget: 50000,
  startDate: ISODate("2024-01-01"),
  endDate: ISODate("2024-01-31"),

  // Denormalized for filtering
  accountId: "account-uuid",
  accountName: "Acme Corp",
  channelName: "Display",
  tacticName: "Prospecting",

  // Search text
  searchText: "Display Prospecting top funnel campaign Q1",

  // Last sync
  lastSyncedAt: ISODate("2024-01-15T10:00:00Z"),
  version: 1
}
```

#### Sync Strategy

```javascript
// Real-time sync using Change Streams
const pipeline = [
  {
    $match: {
      operationType: { $in: ['insert', 'update', 'replace'] },
      'fullDocument.strategy.lineItems': { $exists: true },
    },
  },
];

const changeStream = db.campaigns.watch(pipeline);

changeStream.on('change', async (change) => {
  const campaign = change.fullDocument;
  if (!campaign.strategy?.lineItems) return;

  // Update materialized view
  for (const lineItem of campaign.strategy.lineItems) {
    await db.lineItemsView.replaceOne(
      { _id: lineItem._id },
      {
        ...lineItem,
        campaignId: campaign._id,
        campaignName: campaign.name,
        strategyId: campaign.strategy._id,
        accountId: campaign.accountId,
        accountName: campaign.accountName,
        searchText: `${lineItem.name} ${lineItem.description} ${campaign.name}`,
        lastSyncedAt: new Date(),
        version: campaign.version,
      },
      { upsert: true }
    );
  }
});
```

### Solution 2: Aggregation Pipeline Views

MongoDB supports database views that are computed on-the-fly:

```javascript
// Create a view for line items
db.createView('lineItemsView', 'campaigns', [
  { $match: { 'strategy.lineItems': { $exists: true } } },
  { $unwind: '$strategy.lineItems' },
  {
    $project: {
      _id: '$strategy.lineItems._id',
      campaignId: '$_id',
      campaignName: '$name',
      strategyId: '$strategy._id',
      accountId: '$accountId',

      // Line item fields
      name: '$strategy.lineItems.name',
      description: '$strategy.lineItems.description',
      budget: '$strategy.lineItems.budget',
      startDate: '$strategy.lineItems.startDate',
      endDate: '$strategy.lineItems.endDate',
      channelName: '$strategy.lineItems.channelName',
      tacticName: '$strategy.lineItems.tacticName',
      mediaPlanIds: '$strategy.lineItems.mediaPlanIds',
    },
  },
]);

// Query the view like a normal collection
db.lineItemsView.find({ channelName: 'Display' });
db.lineItemsView.find({ budget: { $gte: 50000 } });
```

### Solution 3: Hybrid Approach (Recommended)

Keep frequently queried data in separate collections while maintaining relationships:

```javascript
// Collection: lineItems (standalone)
{
  _id: "line-item-uuid",

  // Parent references
  campaignId: "campaign-uuid",
  strategyId: "strategy-uuid",
  accountId: "account-uuid",

  // Core data
  name: "Display - Prospecting",
  description: "Top funnel display",
  budget: 50000,
  startDate: ISODate("2024-01-01"),
  endDate: ISODate("2024-01-31"),

  // References
  channelId: 1,
  channelName: "Display",
  tacticId: 5,
  tacticName: "Prospecting",

  // Metrics snapshot
  metrics: {
    plannedSpend: 50000,
    actualSpend: 25000,
    plannedUnits: 10000000,
    actualUnits: 5000000,
    lastUpdated: ISODate("2024-01-15")
  },

  // Version tracking
  version: "v1.2.3",
  lastModified: {
    by: "user-uuid",
    at: ISODate("2024-01-15"),
    changeId: "change-uuid"
  }
}

// Keep campaign as source of truth
{
  _id: "campaign-uuid",
  name: "Q1 Campaign",
  strategy: {
    _id: "strategy-uuid",
    lineItemIds: ["line-item-uuid"] // Just references
  }
}
```

### Query Examples

```javascript
// 1. Line Items Listing Page
async function getLineItemsListing(filters = {}) {
  const query = {
    ...(filters.accountId && { accountId: filters.accountId }),
    ...(filters.channelId && { channelId: filters.channelId }),
    ...(filters.dateRange && {
      startDate: { $lte: filters.dateRange.end },
      endDate: { $gte: filters.dateRange.start },
    }),
  };

  return await db.lineItems.find(query).sort({ updatedAt: -1 }).limit(50).toArray();
}

// 2. Search Across Line Items
async function searchLineItems(searchTerm) {
  return await db.lineItems
    .find({
      $text: { $search: searchTerm },
    })
    .limit(20)
    .toArray();
}

// 3. Metrics Aggregation Across Campaigns
async function getAccountMetrics(accountId) {
  return await db.lineItems
    .aggregate([
      { $match: { accountId } },
      {
        $group: {
          _id: null,
          totalBudget: { $sum: '$budget' },
          totalPlannedSpend: { $sum: '$metrics.plannedSpend' },
          totalActualSpend: { $sum: '$metrics.actualSpend' },
          lineItemCount: { $sum: 1 },
        },
      },
    ])
    .toArray();
}

// 4. Media Plans by Platform
async function getMediaPlansByPlatform(mediaPlatformId) {
  return await db.mediaPlans
    .aggregate([
      { $match: { mediaPlatformId } },
      {
        $lookup: {
          from: 'lineItems',
          localField: 'lineItemId',
          foreignField: '_id',
          as: 'lineItem',
        },
      },
      { $unwind: '$lineItem' },
      {
        $project: {
          _id: 1,
          lineItemName: '$lineItem.name',
          campaignId: '$lineItem.campaignId',
          plannedSpend: 1,
          actualSpend: 1,
          startDate: 1,
          endDate: 1,
        },
      },
    ])
    .toArray();
}
```

## Version Control System Design

### Requirements

1. Track all changes with who, when, what
2. Ability to add change reasons/notes
3. Point-in-time recovery
4. Version tagging for exports
5. Unique version identifiers

### Solution: Event Sourcing + Snapshots

#### 1. Change Events Collection

```javascript
// Collection: changeEvents
{
  _id: ObjectId(),
  changeId: "chg_1a2b3c4d5e6f", // Unique identifier

  // What changed
  entityType: "campaign", // campaign, lineItem, mediaPlan
  entityId: "campaign-uuid",
  operation: "update", // create, update, delete

  // Change details
  changes: [
    {
      path: "strategy.lineItems.0.budget",
      oldValue: 50000,
      newValue: 75000
    },
    {
      path: "strategy.lineItems.0.endDate",
      oldValue: ISODate("2024-01-31"),
      newValue: ISODate("2024-02-29")
    }
  ],

  // Metadata
  userId: "user-uuid",
  userName: "John Doe",
  userRole: "media_trader",

  reason: "Client approved budget increase",
  tags: ["budget_change", "client_approved"],

  timestamp: ISODate("2024-01-15T10:30:00Z"),

  // Version info
  previousVersion: "v1.2.3",
  newVersion: "v1.2.4",

  // Optional: Full document snapshot
  snapshot: {
    before: { /* entire document before change */ },
    after: { /* entire document after change */ }
  }
}
```

#### 2. Version Snapshots Collection

```javascript
// Collection: versionSnapshots
{
  _id: "v1.2.4", // Version ID

  entityType: "campaign",
  entityId: "campaign-uuid",

  // Full document state at this version
  document: {
    _id: "campaign-uuid",
    name: "Q1 Campaign",
    budget: 150000,
    strategy: {
      /* complete strategy with line items */
    }
  },

  // Version metadata
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  createdBy: "user-uuid",

  // Change summary
  changeCount: 2,
  changeIds: ["chg_1a2b3c4d5e6f"],

  // Tagging
  tags: ["exported", "client_approved"],
  exportedTo: ["system_xyz"],

  // Version chain
  previousVersion: "v1.2.3",
  nextVersion: null, // Latest version

  // Hash for integrity
  documentHash: "sha256:abcdef123456..."
}
```

#### 3. Implementation Functions

```javascript
// Track changes with automatic versioning
async function trackChange(entityType, entityId, changes, userId, reason = null) {
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      // Get current document
      const collection = db.collection(entityType + 's');
      const currentDoc = await collection.findOne({ _id: entityId });

      if (!currentDoc) throw new Error('Entity not found');

      // Generate new version
      const currentVersion = currentDoc.version || 'v1.0.0';
      const newVersion = incrementVersion(currentVersion);

      // Create change event
      const changeEvent = {
        _id: new ObjectId(),
        changeId: `chg_${new ObjectId().toString()}`,
        entityType,
        entityId,
        operation: 'update',
        changes: changes.map((change) => ({
          path: change.path,
          oldValue: getValueByPath(currentDoc, change.path),
          newValue: change.value,
        })),
        userId,
        userName: await getUserName(userId),
        userRole: await getUserRole(userId),
        reason,
        timestamp: new Date(),
        previousVersion: currentVersion,
        newVersion,
      };

      await db.changeEvents.insertOne(changeEvent, { session });

      // Apply changes to document
      const updateDoc = { $set: { version: newVersion } };
      changes.forEach((change) => {
        updateDoc.$set[change.path] = change.value;
      });

      await collection.updateOne({ _id: entityId }, updateDoc, { session });

      // Create version snapshot
      const updatedDoc = await collection.findOne({ _id: entityId }, { session });

      await db.versionSnapshots.insertOne(
        {
          _id: newVersion,
          entityType,
          entityId,
          document: updatedDoc,
          createdAt: new Date(),
          createdBy: userId,
          changeCount: changes.length,
          changeIds: [changeEvent.changeId],
          previousVersion: currentVersion,
          documentHash: hashDocument(updatedDoc),
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}

// Get document at specific version
async function getDocumentAtVersion(entityType, entityId, version) {
  const snapshot = await db.versionSnapshots.findOne({
    entityType,
    entityId,
    _id: version,
  });

  if (!snapshot) throw new Error('Version not found');

  return snapshot.document;
}

// Get change history
async function getChangeHistory(entityType, entityId, options = {}) {
  const query = {
    entityType,
    entityId,
    ...(options.startDate && { timestamp: { $gte: options.startDate } }),
    ...(options.endDate && { timestamp: { $lte: options.endDate } }),
    ...(options.userId && { userId: options.userId }),
  };

  return await db.changeEvents
    .find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 50)
    .toArray();
}

// Tag a version for export
async function tagVersion(version, tag, exportedTo = null) {
  await db.versionSnapshots.updateOne(
    { _id: version },
    {
      $addToSet: {
        tags: tag,
        ...(exportedTo && { exportedTo }),
      },
    }
  );
}

// Helper functions
function incrementVersion(version) {
  const parts = version.replace('v', '').split('.');
  parts[2] = (parseInt(parts[2]) + 1).toString();
  return 'v' + parts.join('.');
}

function hashDocument(doc) {
  const crypto = require('crypto');
  const str = JSON.stringify(doc, Object.keys(doc).sort());
  return crypto.createHash('sha256').update(str).digest('hex');
}

function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}
```

### Change Tracking UI Components

```javascript
// React component for change history
function ChangeHistory({ entityType, entityId }) {
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    fetchChangeHistory(entityType, entityId).then(setChanges);
  }, [entityType, entityId]);

  return (
    <div className="change-history">
      {changes.map((change) => (
        <div key={change._id} className="change-item">
          <div className="change-header">
            <span className="user">{change.userName}</span>
            <span className="timestamp">{formatDate(change.timestamp)}</span>
            <span className="version">{change.newVersion}</span>
          </div>

          <div className="change-details">
            {change.changes.map((detail, i) => (
              <div key={i} className="change-detail">
                <span className="field">{formatPath(detail.path)}</span>
                <span className="old-value">{formatValue(detail.oldValue)}</span>
                <span className="arrow">→</span>
                <span className="new-value">{formatValue(detail.newValue)}</span>
              </div>
            ))}
          </div>

          {change.reason && (
            <div className="change-reason">
              <strong>Reason:</strong> {change.reason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Add change reason dialog
function ChangeReasonDialog({ onSave }) {
  const [reason, setReason] = useState('');
  const [tags, setTags] = useState([]);

  return (
    <Dialog>
      <h3>Document Your Changes</h3>

      <TextField
        label="Reason for changes"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        multiline
        rows={3}
      />

      <TagSelector
        value={tags}
        onChange={setTags}
        suggestions={['budget_change', 'client_request', 'optimization']}
      />

      <Button onClick={() => onSave({ reason, tags })}>Save Changes</Button>
    </Dialog>
  );
}
```

## Performance Optimization Strategies

### 1. Indexing for Independent Queries

```javascript
// Line items view indexes
db.lineItemsView.createIndex({ campaignId: 1, startDate: 1 });
db.lineItemsView.createIndex({ accountId: 1, channelId: 1 });
db.lineItemsView.createIndex({ 'metrics.actualSpend': -1 });

// Change events indexes
db.changeEvents.createIndex({ entityType: 1, entityId: 1, timestamp: -1 });
db.changeEvents.createIndex({ userId: 1, timestamp: -1 });
db.changeEvents.createIndex({ changeId: 1 }, { unique: true });

// Version snapshots indexes
db.versionSnapshots.createIndex({ entityType: 1, entityId: 1, _id: 1 });
db.versionSnapshots.createIndex({ tags: 1 });
db.versionSnapshots.createIndex({ createdAt: -1 });
```

### 2. Caching Strategy

```javascript
// Redis cache for frequently accessed versions
const versionCache = {
  async get(version) {
    const cached = await redis.get(`version:${version}`);
    if (cached) return JSON.parse(cached);

    const snapshot = await db.versionSnapshots.findOne({ _id: version });
    if (snapshot) {
      await redis.setex(`version:${version}`, 3600, JSON.stringify(snapshot));
    }
    return snapshot;
  },

  async invalidate(entityId) {
    const keys = await redis.keys(`version:*:${entityId}`);
    if (keys.length) await redis.del(...keys);
  },
};

// Cache materialized views
const lineItemCache = {
  async get(lineItemId) {
    const cached = await redis.get(`lineitem:${lineItemId}`);
    if (cached) return JSON.parse(cached);

    const lineItem = await db.lineItems.findOne({ _id: lineItemId });
    if (lineItem) {
      await redis.setex(`lineitem:${lineItemId}`, 300, JSON.stringify(lineItem));
    }
    return lineItem;
  },
};
```

### 3. Batch Operations

```javascript
// Batch sync line items
async function batchSyncLineItems(campaignIds) {
  const campaigns = await db.campaigns
    .find({
      _id: { $in: campaignIds },
    })
    .toArray();

  const bulkOps = [];

  for (const campaign of campaigns) {
    if (!campaign.strategy?.lineItems) continue;

    for (const lineItem of campaign.strategy.lineItems) {
      bulkOps.push({
        replaceOne: {
          filter: { _id: lineItem._id },
          replacement: {
            ...lineItem,
            campaignId: campaign._id,
            campaignName: campaign.name,
            accountId: campaign.accountId,
            lastSyncedAt: new Date(),
          },
          upsert: true,
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await db.lineItems.bulkWrite(bulkOps);
  }
}
```

## Summary

This advanced pattern provides:

1. **Independent Querying**: Three approaches to query embedded data
   - Materialized views for best performance
   - Aggregation views for real-time accuracy
   - Hybrid approach for balance

2. **Version Control**: Complete change tracking system
   - Every change recorded with user, timestamp, reason
   - Point-in-time recovery with snapshots
   - Version tagging for exports
   - Unique identifiers for each version

3. **Performance**: Optimized for both patterns
   - Strategic indexing
   - Caching for frequently accessed data
   - Batch operations for efficiency

The key is to choose the right approach based on your specific needs:

- Use materialized views for frequently accessed data
- Use aggregation pipelines for real-time accuracy
- Use the hybrid approach for complex scenarios
