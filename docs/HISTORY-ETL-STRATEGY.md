# History Tables ETL Strategy

## Overview

The PostgreSQL database contains audit/history tables that track changes over time. These are valuable for:

- Audit trails
- Change tracking
- Data recovery
- Analytics on data evolution

## History Tables in PostgreSQL

### Small History Tables (Successfully Exported)

- `campaigns_history` - 50KB
- `strategies_history` - 512KB
- `line_items_history` - 974KB
- `line_item_media_buys_history` - 386KB
- `media_buys_history` - 33MB
- `accounts_history` - 1.5KB
- `users_history` - 1KB
- `teams_history` - 25 bytes
- `reps_history` - 100 bytes

### Large History Table

- `media_platform_entities_history` - ~1GB compressed (millions of rows)

## MongoDB Schema Design for History

### Option 1: Embedded History (for small entities)

```javascript
{
  _id: ObjectId("..."),
  campaignId: "CN-12345",
  name: "Campaign Name",
  // ... current fields ...

  _history: [
    {
      version: 1,
      changedAt: ISODate("2024-01-15T10:30:00Z"),
      changedBy: "user123",
      changesetId: "cs-789",
      changes: {
        name: { from: "Old Name", to: "New Name" },
        budget: { from: 50000, to: 75000 }
      }
    }
  ]
}
```

### Option 2: Separate History Collections (for large entities)

```javascript
// Main collection: mediaPlatformEntities
{
  _id: ObjectId("..."),
  entityId: "ent-123",
  currentVersion: 5,
  // ... current fields ...
}

// History collection: mediaPlatformEntitiesHistory
{
  _id: ObjectId("..."),
  entityId: "ent-123",
  version: 4,
  changedAt: ISODate("2024-01-15T10:30:00Z"),
  changesetId: "cs-789",
  snapshot: { /* full object state at this version */ }
}
```

### Option 3: Change Events Collection (unified audit log)

```javascript
// Collection: changeEvents
{
  _id: ObjectId("..."),
  entityType: "mediaPlatformEntity",
  entityId: "ent-123",
  changesetId: "cs-789",
  timestamp: ISODate("2024-01-15T10:30:00Z"),
  userId: "user123",
  operation: "update",
  changes: { /* field-level changes */ },
  metadata: { /* additional context */ }
}
```

## ETL Implementation Strategy

### Phase 1: Core Data + Recent History

1. Export all current data
2. Export history for last 90 days
3. Use embedded history for small entities
4. Use separate collections for large entities

### Phase 2: Historical Data Migration (if needed)

1. Run separate job for older history
2. Consider data retention policies
3. Archive very old data to S3

### Phase 3: Ongoing Sync

1. Capture changes in real-time
2. Build change events as they happen
3. Maintain history automatically

## Scripts Available

1. **export-with-history-chunked.sh** - Exports with 90 days of history
2. **analyze-history-tables.sh** - Analyzes history table sizes and patterns
3. **export-complete-smart.sh** - Excludes problematic history table

## Recommendations

1. **Start with recent history** (90 days) to prove the concept
2. **Use separate collections** for media platform entities history
3. **Implement change tracking** in the new MongoDB system
4. **Consider retention policies** - do we need all history forever?
5. **Archive old history** to S3 for compliance if needed
