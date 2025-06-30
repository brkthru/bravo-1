# Data Sources Overview

This directory contains exports from different databases at different points in time. It's important to understand which export to use for which purpose.

## Directory Structure

### 📁 postgres-raw-backup-20250627/

**✅ CANONICAL SOURCE - Use this for all new transformations**

- **Source**: PostgreSQL database (media_tool schema)
- **Date**: June 27, 2025
- **Contents**: Raw PostgreSQL data with ALL fields preserved
- **Key files**: campaigns.json (with 20 fields), accounts.json, users.json, etc.
- **Purpose**: Faithful backup of PostgreSQL data
- **When to use**: Creating new MongoDB imports, analyzing complete data model

### 📁 mongodb-export-20250618/

**⚠️ INTERMEDIATE DATA - Already transformed, missing fields**

- **Source**: MongoDB database (mediatool_v2)
- **Date**: June 18, 2025
- **Contents**: MongoDB collections after transformation from PostgreSQL
- **Key files**: campaigns_backup.json (missing many PostgreSQL fields)
- **Purpose**: Backup of MongoDB state
- **When to use**: Understanding existing MongoDB schema only

### 📁 data-transformed/

**📤 OUTPUT - Transformation results**

- **Source**: Output from ETL scripts
- **Contents**: Transformed data ready for MongoDB import
- **Key files**:
  - campaigns-new-schema.json (from MongoDB data)
  - campaigns-from-postgres.json (from PostgreSQL data)

## Important Notes

1. **Always use postgres-raw-backup-20250627/** as the source for new transformations
2. The mongodb-export-20250618/ is missing these PostgreSQL fields:
   - campaign_id (Zoho ID)
   - proposed_budget, expected_revenue
   - agency details
   - goals_kpis, new_business
   - Detailed user relationships

3. Transformation scripts:
   - `transform-postgres-to-mongodb.ts` - Transforms from PostgreSQL (recommended)
   - `convert-to-new-schema.ts` - Converts MongoDB export to new schema (limited by missing fields)

## Quick Reference

```bash
# Transform from PostgreSQL (recommended)
bun etl/transform-postgres-to-mongodb.ts

# Load into MongoDB
bun etl/load-new-schema-data.ts
```
