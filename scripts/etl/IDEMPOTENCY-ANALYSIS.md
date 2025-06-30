# ETL Pipeline Idempotency Analysis

## Current Behavior When Running Multiple Times

### ❌ NOT Idempotent - Creates Duplicates

- **Strategies**: Creates duplicates on each run
- **Line Items**: Creates duplicates on each run
- **Platform Buys**: Creates duplicates on each run
- **Media Plans**: Creates duplicates on each run

### ✅ Idempotent - Updates Existing

- **Users**: Updates existing records (likely matches on email)
- **Accounts**: Updates existing records (likely matches on accountId)

### ⚠️ Partially Working

- **Campaigns**: Consistently fails for same 135 records, doesn't create duplicates

## Root Cause

The ETL route has different behavior for different entity types:

1. **Users/Accounts/Campaigns**: Use dedicated services with `bulkUpsert` that match on unique fields
2. **Others**: Use generic MongoDB operations that:
   - Create a new ObjectId if none exists
   - Use `replaceOne` with `{ _id: doc._id }`
   - Since each run creates new ObjectIds, it always inserts new documents

## Code Analysis

```typescript
// Problem code in etl.ts for generic entities:
if (data[i]._id) {
  // Uses existing _id
} else {
  id = new ObjectId(); // Creates NEW id each time!
}

await collection.replaceOne(
  { _id: doc._id }, // Will never match on subsequent runs
  doc,
  { upsert: true }
);
```

## Impact

Running the pipeline multiple times will:

1. **Double, triple, etc.** the number of strategies, line items, platform buys, and media plans
2. **Update** users and accounts (no duplicates)
3. **Fail** on the same 135 campaigns

## Example After 2 Runs

- Strategies: 26,834 (should be 13,417)
- Line Items: 8,236 (should be 4,118)
- Platform Buys: 112,040 (should be 56,020)
- Media Plans: 26,834 (should be 13,417)

## Solutions

### Option 1: Add Unique Identifiers

Match on business keys instead of \_id:

- Strategies: `strategyId`
- Line Items: `lineItemId`
- Platform Buys: `platformBuyId`
- Media Plans: `campaignId + name`

### Option 2: Clear Collections Before Import

Add a `--clear-existing` flag to delete data before importing

### Option 3: Check for Existing Data

Query for existing records by unique fields before inserting

### Option 4: Include \_id in Transformed Data

Ensure transformed data includes consistent \_id values

## Recommended Fix

Modify the ETL route to use unique business identifiers:

```typescript
// For strategies
await collection.replaceOne({ strategyId: doc.strategyId }, doc, { upsert: true });

// For line items
await collection.replaceOne({ lineItemId: doc.lineItemId }, doc, { upsert: true });
```

## Warning

**DO NOT run the pipeline multiple times in production** until this is fixed, as it will create duplicate data that's difficult to clean up.
