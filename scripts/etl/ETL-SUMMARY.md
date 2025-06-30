# ETL Process Summary - June 30, 2025

## What We Fixed

### 1. Data Source Update

- **Previous**: Using hardcoded June 27th data from `data/postgres-backups/2025-06-27`
- **Fixed**: Now using latest export from `exports/raw/20250628-154322`
- **Result**: All 13,498 campaigns from June 28th export properly loaded

### 2. Media Trader Assignments

- **Issue**: Team objects showed empty `mediaTraders` arrays
- **Discovery**: Media traders are assigned at the line item level, not campaign level
- **Solution**: Created enhanced transformation that aggregates media traders from line items up to campaigns
- **Result**: 925 campaigns (6.9%) now show their media trader assignments

## Current Data Status

### Campaign Data (13,498 total)

- ✅ All campaigns loaded with correct schema
- ✅ Account managers: 100% populated (from `lead_account_owner_user_id`)
- ✅ Media traders: 925 campaigns have traders (aggregated from line items)
- ⚠️ Senior media traders: Empty (no data source identified)
- ⚠️ CSD: Empty (no data source identified)

### Team Structure Example

```json
{
  "accountManager": {
    "id": "2461504000342740001",
    "name": "Shannon Finn",
    "email": "finn@brkthru.com",
    "role": "account_manager"
  },
  "seniorMediaTraders": [],
  "mediaTraders": [
    {
      "id": "2461504000322410001",
      "name": "Jennifer Porter",
      "email": "porter@brkthru.com",
      "role": "media_trader"
    },
    {
      "id": "2461504000043382128",
      "name": "Kelsey Martinolich",
      "email": "kelsey@brkthru.com",
      "role": "media_trader"
    }
  ]
}
```

## Scripts Created

### Data Verification

- `verify-data-integrity.ts` - Compares PostgreSQL export to MongoDB data
- `analyze-user-mappings.ts` - Analyzes user ID relationships
- `analyze-media-traders.ts` - Discovers media trader assignments in line items

### Enhanced Transformation

- `transform-postgres-with-traders.ts` - Transforms data with media trader aggregation
- `load-campaigns-with-traders.ts` - Loads enhanced data into MongoDB
- `drop-databases.sh` - Cleans databases for fresh start

## How to Use

### Full Fresh Import with Media Traders

```bash
cd scripts/etl

# 1. Drop existing databases
./drop-databases.sh

# 2. Transform with media traders
bun transform-postgres-with-traders.ts

# 3. Load into MongoDB
bun load-campaigns-with-traders.ts
```

### Quick Verification

```bash
# Check data integrity
bun verify-data-integrity.ts

# Analyze media trader distribution
bun analyze-media-traders.ts
```

## Key Insights

1. **Media Trader Assignment**: Happens at line item level in Bravo, not campaign level
2. **Data Completeness**:
   - 66.1% of line items have media trader assignments
   - These aggregate to 6.9% of campaigns having traders
3. **Missing Data Sources**:
   - Senior media traders (might need separate query or come from Zoho)
   - CSD assignments (not found in current export)
   - Sales reps (referenced but not in users table)

## Next Steps

1. **Senior Media Traders**: Identify data source (Zoho field or separate table)
2. **Performance**: Current load process takes ~30 seconds for 13,498 campaigns
3. **Incremental Updates**: Consider ETL process for updating existing data vs full reload
