# Schema Testing Plan

## Overview

This document outlines the testing approach for the schema changes implemented on 2025-06-27.

## Testing Priority

Test the high-impact changes first before proceeding with remaining todos.

## 1. ETL Pipeline Testing

### Setup

```bash
cd bravo-1
docker-compose up -d mongodb
```

### Test Steps

1. **Backup current data**

   ```bash
   docker exec bravo1_mongodb mongodump --db mediatool_v2 --out /tmp/backup
   ```

2. **Run updated ETL transform**

   ```bash
   cd scripts/etl
   cp transform-postgres-data.ts transform-postgres-data.backup.ts
   cp transform-postgres-data-updated.ts transform-postgres-data.ts
   bun run transform-postgres-data.ts
   ```

3. **Verify output**
   - Check `data-transformed/campaigns.json` has both `budget` and `price` fields
   - Verify `metrics.units` replaces `metrics.impressions`
   - Confirm `marginAmount` and `marginPercentage` are present

4. **Load and test**
   ```bash
   bun run load-data.ts
   ```

## 2. API Testing

### Campaign Service Tests

1. **Update service file**

   ```bash
   cd backend/src/services
   cp CampaignService.ts CampaignService.backup.ts
   cp CampaignService-updated.ts CampaignService.ts
   ```

2. **Run unit tests**

   ```bash
   cd backend
   npm test CampaignService
   ```

3. **Test API endpoints**

   ```bash
   # Start backend
   npm run dev:backend

   # Test campaign creation with budget field
   curl -X POST http://localhost:3001/api/campaigns \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Campaign",
       "budget": { "total": 10000 }
     }'

   # Test campaign creation with price field
   curl -X POST http://localhost:3001/api/campaigns \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Campaign 2",
       "price": { "targetAmount": 20000 }
     }'
   ```

## 3. Schema Validation Testing

### Update schema files

```bash
cd shared/src/schemas/entities
cp campaign.schema.ts campaign.schema.backup.ts
cp campaign-updated.schema.ts campaign.schema.ts
cp line-item.schema.ts line-item.schema.backup.ts
cp line-item-updated.schema.ts line-item.schema.ts
```

### Run schema tests

```bash
cd shared
npm test
```

## 4. Frontend Testing

### Start frontend

```bash
cd frontend
npm run dev:frontend
```

### Manual tests

1. Navigate to campaigns list - should display correctly
2. Check campaign details - verify price/budget fields show
3. Verify metrics show units instead of impressions
4. Check margin displays (both amount and percentage)

## 5. E2E Testing

### Run Playwright tests

```bash
npx playwright test
```

### Expected failures

- Tests looking for `budget` field may fail
- Tests checking `impressions` will need updates
- Update test expectations as needed

## 6. Rollback Plan

If tests fail:

```bash
# Restore backup files
cd backend/src/services
cp CampaignService.backup.ts CampaignService.ts

cd shared/src/schemas/entities
cp campaign.schema.backup.ts campaign.schema.ts
cp line-item.schema.backup.ts line-item.schema.ts

cd scripts/etl
cp transform-postgres-data.backup.ts transform-postgres-data.ts

# Restore MongoDB
docker exec bravo1_mongodb mongorestore --db mediatool_v2 /tmp/backup/mediatool_v2
```

## Success Criteria

✅ ETL pipeline successfully transforms data with both fields
✅ API accepts both budget and price fields
✅ Calculations work correctly with new field names
✅ Frontend displays data without errors
✅ No data loss during transformation
✅ E2E tests pass (after updates)

## Next Steps

After successful testing:

1. Update all TypeScript types
2. Create data migration scripts
3. Update API documentation
4. Complete remaining todos
5. Plan production deployment
