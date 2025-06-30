# Production ETL Workflow

## Overview

This document describes the end-to-end ETL workflow for synchronizing production PostgreSQL data to the local bravo-1 MongoDB instance, including schema change detection and automated updates.

For detailed setup instructions on replicating the production database locally, see:

- [`scripts/production-pipeline/README.md`](../scripts/production-pipeline/README.md) - Original media-tool pipeline docs
- [`scripts/production-pipeline/SETUP-NEW-USER.md`](../scripts/production-pipeline/SETUP-NEW-USER.md) - Quick setup for new developers

## Prerequisites

1. **AWS CLI** configured with credentials:

   ```bash
   aws configure sso
   # Profile: brkthru-mediatool-dev
   ```

2. **Production Access** (one of):
   - AWS SSO access to download from S3 (recommended)
   - VPN/Bastion access for direct PostgreSQL connection

3. **Local Environment**:
   - Docker running
   - PostgreSQL client tools
   - MongoDB running on localhost:27017
   - Bun runtime installed

## Database Naming Convention

- **PostgreSQL**: `media_tool` (unchanged)
- **MongoDB**: `bravo-1` (renamed from mediatool_v2)
  - Allows parallel versions: `bravo-1a`, `bravo-1-v2`, etc.
  - Enables A/B testing and breaking changes

## Database Refresh Strategy

Before starting the ETL process, decide on your refresh strategy:

### Option 1: Full Refresh (Recommended for Development)

```bash
# Drop and recreate the database
mongosh bravo-1 --eval "db.dropDatabase()"

# This ensures:
# - Clean slate with no legacy data
# - No schema conflicts
# - Predictable state for testing
```

### Option 2: Incremental Update

```bash
# Keep existing data and merge new records
# The ETL scripts will handle duplicates
# Useful for preserving local test data
```

### Option 3: Parallel Database

```bash
# Create a new database version
bun run-production-etl.ts --db bravo-1-$(date +%Y%m%d)

# Allows:
# - Side-by-side comparison
# - Safe testing of schema changes
# - Easy rollback
```

## End-to-End Workflow

### Step 1: Production Data Acquisition

Two methods available:

#### Method A: Download from S3 (Recommended)

```bash
cd scripts/production-pipeline
./download-from-s3.sh

# Or for automated execution:
bun run-production-etl.ts --source s3 --auto-latest
```

#### Method B: Direct PostgreSQL Export

```bash
# Requires VPN/Bastion access
cd scripts/production-pipeline
./export-from-production.sh

# Or:
bun run-production-etl.ts --source direct
```

### Step 2: Schema Change Detection

```bash
cd scripts/etl
bun detect-schema-changes.ts

# Outputs:
# - New fields detected
# - Type changes
# - Dropped fields
# - Relationship changes
```

### Step 3: Schema Update Cascade

When schema changes are detected:

1. **Update Zod Schemas**:

   ```bash
   bun update-zod-schemas.ts
   ```

2. **Generate Downstream Artifacts**:

   ```bash
   bun generate-artifacts.ts
   # Updates: OpenAPI, JSON Schema, TypeScript types
   ```

3. **Update MongoDB Schema**:

   ```bash
   bun update-mongo-schema.ts
   ```

4. **Update Business Logic**:
   - Calculation updates
   - Serialization changes
   - Rounding logic
   - Validation rules

### Step 4: Transform and Load

```bash
# Transform PostgreSQL to MongoDB format
bun transform-postgres-to-mongodb.ts --db bravo-1

# Load into MongoDB
bun load-transformed-data.ts --db bravo-1 --backup
```

### Step 5: Validation and Testing

```bash
# Validate data integrity
bun validate-etl-results.ts

# Update and run tests
bun update-tests-for-schema.ts
bun test
```

### Step 6: Push to S3

```bash
# Upload processed data to S3
bun push-to-s3.ts --db bravo-1
```

## Automated Workflow Script

### Master ETL Script

`scripts/etl/run-production-etl.ts`:

```typescript
#!/usr/bin/env bun

import { ETLWorkflow } from './lib/etl-workflow';
import { SchemaDetector } from './lib/schema-detector';
import { InteractiveMode } from './lib/interactive-mode';

const workflow = new ETLWorkflow({
  postgresDb: 'media_tool',
  mongoDb: 'bravo-1',
  interactive: process.argv.includes('--interactive'),
});

async function main() {
  // Step 1: Acquire production data
  await workflow.acquireProductionData();

  // Step 2: Detect schema changes
  const changes = await workflow.detectSchemaChanges();

  if (changes.hasChanges) {
    if (workflow.interactive) {
      // Claude Code execution mode
      const decision = await InteractiveMode.askSchemaChangeStrategy(changes);
      await workflow.applySchemaChanges(decision);
    } else {
      // Automated mode - apply safe changes only
      await workflow.applyAutomaticChanges(changes);
    }
  }

  // Step 3: Transform and load
  await workflow.transformAndLoad();

  // Step 4: Validate
  await workflow.validate();

  // Step 5: Push to S3
  await workflow.pushToS3();
}

main().catch(console.error);
```

## Interactive Mode (Claude Code Integration)

When running with `--interactive`, the system will:

1. **Present Schema Changes**:

   ```
   Detected Schema Changes:
   - New field: campaigns.performance_score (number)
   - Type change: line_items.rate (string → number)
   - Dropped: campaigns.legacy_field

   How should we handle these changes?
   [1] Apply all changes automatically
   [2] Review each change individually
   [3] Skip schema updates
   [4] Abort ETL process
   ```

2. **Request Decisions**:
   - How to map new fields
   - Default values for new required fields
   - Migration strategy for type changes
   - UI/API impact assessment

3. **Generate Update Plan**:
   - Zod schema updates
   - MongoDB migration scripts
   - API endpoint changes
   - Test updates

## Configuration

### Pipeline Configuration (`pipeline.env`)

```env
# MongoDB Configuration
MONGO_DB_NAME=bravo-1
MONGO_BACKUP_BEFORE_LOAD=true
MONGO_PARALLEL_DBS=bravo-1a,bravo-1-test

# PostgreSQL Configuration
LOCAL_PG_DB=media_tool
LOCAL_PG_HOST=localhost
LOCAL_PG_PORT=5432

# S3 Configuration
S3_BUCKET=brkthru-media-tool-exports
S3_PREFIX=postgres-exports/

# ETL Configuration
ETL_BATCH_SIZE=10000
ETL_VALIDATE_AFTER_LOAD=true
ETL_SCHEMA_STRICT_MODE=false
```

## Schema Change Strategies

### Automatic Handling

Safe changes that can be applied automatically:

- New optional fields
- New tables/collections
- Index additions
- Non-breaking constraint additions

### Interactive Handling

Changes requiring human decision:

- New required fields
- Type changes
- Field renames
- Relationship modifications
- Breaking constraints

### Change Impact Matrix

| Change Type        | Zod    | MongoDB   | API      | UI       | Tests  |
| ------------------ | ------ | --------- | -------- | -------- | ------ |
| New Optional Field | ✓ Auto | ✓ Auto    | ✓ Auto   | Review   | Update |
| New Required Field | Review | Review    | Breaking | Breaking | Update |
| Type Change        | Review | Migration | Review   | Review   | Update |
| Field Rename       | Review | Migration | Breaking | Breaking | Update |
| New Relationship   | ✓ Auto | Index     | Review   | Review   | Update |

## Rollback Strategy

Each ETL run creates versioned backups:

```bash
# Rollback to previous version
bun rollback-etl.ts --version 2025-06-28-001

# List available versions
bun list-etl-versions.ts
```

## Monitoring and Alerts

The ETL process logs to:

- Console (with progress indicators)
- `logs/etl/YYYY-MM-DD-HH-mm-ss.log`
- MongoDB audit collection
- CloudWatch (if configured)

## Next Steps

1. Create the master ETL script
2. Implement schema change detection
3. Build interactive mode for Claude Code
4. Set up automated testing
5. Configure S3 push automation
6. Create rollback mechanisms
