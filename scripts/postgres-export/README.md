# PostgreSQL Raw Data Export

This directory contains scripts to export raw data from the PostgreSQL media-tool database without any transformations or business logic applied.

## Purpose

Create a faithful backup of all PostgreSQL data that can be:

- Stored in version control or cloud storage
- Used to experiment with different MongoDB schema designs
- Restored to create test environments
- Analyzed for data migration planning

## Prerequisites

1. PostgreSQL media-tool database running on localhost:5432
2. Bun or Node.js installed
3. Database credentials (default: media_tool/pass)

## Installation

```bash
cd scripts/postgres-export
npm install
# or
bun install
```

## Usage

### Using Bun (recommended for performance):

```bash
bun run export
```

### Using Node.js:

```bash
npm run export:node
```

### With custom database connection:

```bash
PG_HOST=localhost \
PG_PORT=5432 \
PG_DATABASE=media_tool \
PG_USER=media_tool \
PG_PASSWORD=pass \
bun run export
```

## Output

The script exports all data to `./postgres-raw-export/` directory:

```
postgres-raw-export/
├── export-summary.json      # Export metadata and statistics
├── accounts.json           # Account data
├── campaigns.json          # Campaign data (13,417 records)
├── users.json             # User data with names and emails
├── teams.json             # Team structures
├── line_items.json        # Line item data
├── strategies.json        # Strategy data
├── media_buys.json        # Media buy records
├── ... (other tables)
```

## Exported Tables

The export includes all application tables:

- Core entities: campaigns, accounts, users, teams
- Media planning: line_items, strategies, media_buys
- Platform data: media_platforms, platform_entities
- Configuration: channels, tactics, unit_price_types
- History tables: \*\_history tables for audit trails

## Data Characteristics

### Raw Export Features:

- No transformations applied
- Preserves all PostgreSQL data types as JSON
- Maintains all relationships via IDs
- Includes all columns, even internal ones
- Preserves null values and empty arrays

### Key Data Points:

- ~13,417 campaigns with real names (CN- prefixed)
- Real user data with emails and zoho_user_ids
- Proper team assignments and relationships
- Original timestamps and audit fields
- Currency values in PostgreSQL money format

## Schema Notes

### User Relationships:

- Campaigns reference users via `owner_user_id` and `lead_account_owner_user_id`
- These map to `users.zoho_user_id` (not users.id)
- Teams are linked through reps and reps_x_teams tables

### Hierarchical Structure:

```
accounts
  └── campaigns
      └── strategies
          └── line_items
              └── line_item_media_buys
                  └── media_buys
                      └── platform_entities
```

## Next Steps

After export completes:

1. **Verify Data Integrity**

   ```bash
   # Check export summary
   cat postgres-raw-export/export-summary.json

   # Verify campaign data
   cat postgres-raw-export/campaigns.json | jq 'length'
   ```

2. **Backup to Cloud Storage**

   ```bash
   # Compress for storage
   tar -czf postgres-backup-$(date +%Y%m%d).tar.gz postgres-raw-export/

   # Upload to S3, GCS, etc.
   aws s3 cp postgres-backup-*.tar.gz s3://your-bucket/backups/
   ```

3. **Use for MongoDB Migration**
   - Import raw data into MongoDB staging collections
   - Experiment with different schema designs
   - Test denormalization strategies
   - Validate calculations match PostgreSQL views

## Restoration

To use this data for MongoDB migration:

1. Import into MongoDB staging collections
2. Run transformation scripts to create desired schema
3. Validate against PostgreSQL views
4. Test application functionality

## Security Notes

⚠️ **This export contains real user data including emails**

- Store exports securely
- Don't commit to public repositories
- Sanitize data if needed for development
- Follow data protection regulations
