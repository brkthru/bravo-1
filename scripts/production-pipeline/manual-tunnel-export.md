# Manual Tunnel Export Instructions

## Step 1: Start the tunnel manually in media-tool

```bash
cd ~/code/media-tool/terraform  # Or your media-tool location
just ssm-db-tunnel prod 5437
```

Keep this terminal open!

## Step 2: In a new terminal, run the simplified export

```bash
cd ~/code/bravo-1/scripts/production-pipeline  # Or your bravo-1 location

# Get the RDS password
AWS_PROFILE=brkthru-mediatool-prod
RDS_SECRET=$(aws secretsmanager list-secrets --profile $AWS_PROFILE | jq -r '.SecretList[].Name' | grep '^rds' | head -1)
PGPASSWORD=$(aws secretsmanager get-secret-value --secret-id $RDS_SECRET --profile $AWS_PROFILE | jq -r '.SecretString' | jq -r '.password')

# Create dump directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DUMP_DIR="/tmp/complete_dump_$TIMESTAMP"
mkdir -p $DUMP_DIR

# Dump COMPLETE database (no exclusions)
PGPASSWORD=$PGPASSWORD pg_dump \
  -h localhost \
  -p 5437 \
  -U root \
  -d media_tool \
  -F d \
  -j 10 \
  -v \
  -f $DUMP_DIR \
  --no-owner \
  --no-privileges

# Create local database
PGPASSWORD=postgres createdb -U postgres media_tool_complete_$TIMESTAMP

# Restore
PGPASSWORD=postgres pg_restore \
  -U postgres \
  -d media_tool_complete_$TIMESTAMP \
  -F d \
  -j 10 \
  -v \
  $DUMP_DIR

# Export to JSON
cd ../postgres-export
PG_DATABASE=media_tool_complete_$TIMESTAMP bun export-postgres-complete.ts

# The export will be in ../../exports/raw/[timestamp]
```

## Step 3: Upload to S3

```bash
cd ../../exports/raw
LATEST=$(ls -t | head -1)
tar -czf ${LATEST}-complete.tar.gz $LATEST
aws s3 cp ${LATEST}-complete.tar.gz s3://media-tool-backups-1750593763/postgres-complete-exports/ --profile brkthru-mediatool-prod
```
