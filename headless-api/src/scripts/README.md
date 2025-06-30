# Scripts Directory

## ⚠️ IMPORTANT: Data Loading Policy

**NEVER use seed data with only 5 test campaigns!**

The `seed.ts` script has been intentionally removed to prevent accidental use of test data.

Always load the full production dataset (13,417 campaigns) using the ETL process:

```bash
# From bravo-1 directory:
bun run scripts/etl/run-etl.ts
```

## Available Scripts

### migrate-postgres-to-mongo.ts

Migrates data from PostgreSQL media-tool to MongoDB bravo-1.

## Why No Seed Script?

1. **E2E Tests**: Expect specific campaigns like "Foodbank of Southeastern Virginia"
2. **Realistic Testing**: Need full dataset for pagination, search, and performance testing
3. **Consistency**: All environments should use the same data loading process
4. **Data Integrity**: Prevents mixing test data with production data

## Loading Test Data

The full test dataset is located at:

```
data/mongodb-backups/20250618-005330/
```

This contains 13,417 campaigns extracted from the PostgreSQL media-tool database.
