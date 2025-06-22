# Production Pipeline - Timestamped Export System

This directory contains scripts for managing timestamped exports from production PostgreSQL to versioned MongoDB databases.

**For new users**: See [SETUP-NEW-USER.md](SETUP-NEW-USER.md) for detailed setup instructions and the [download-from-s3.sh](download-from-s3.sh) script to get started quickly.

## Overview

The pipeline enables:
- Timestamped exports from production PostgreSQL
- Versioned storage in S3
- Multiple MongoDB databases with different data versions
- Comparison between different export versions
- Automated testing against different data versions

## Directory Structure

```
production-pipeline/
├── production-export-pipeline.sh         # Main export pipeline (with S3)
├── production-export-pipeline-local.sh   # Local testing version (no S3)
├── download-from-s3.sh                  # Download exports from S3
├── restore-from-backup.sh               # Restore specific version
├── compare-exports.sh                   # Compare different versions
├── test-transform-load.sh               # Test transformation only
├── config/
│   └── pipeline.env.example             # Configuration template
├── cloud-storage-structure.md           # S3 organization docs
├── SETUP-NEW-USER.md                    # Setup guide for new developers
└── README.md                            # This file
```

## Setup

1. **Configure Environment**
   ```bash
   cd scripts/production-pipeline
   cp config/pipeline.env.example config/pipeline.env
   # Edit pipeline.env with your values
   ```

2. **Make Scripts Executable**
   ```bash
   chmod +x *.sh
   ```

3. **Install Dependencies**
   - AWS CLI configured with appropriate credentials
   - PostgreSQL client tools (pg_dump, psql)
   - MongoDB tools (mongoimport)
   - Bun runtime
   - jq (for JSON processing)

## Usage

### 1. Export from Production

**Option A: Direct pg_dump Method**
```bash
# Load configuration
source config/pipeline.env

# Run export with direct pg_dump
EXPORT_METHOD=direct ./production-export-pipeline.sh
```

**Option B: RDS Snapshot Method**
```bash
# Run export using RDS snapshot
EXPORT_METHOD=snapshot ./production-export-pipeline.sh
```

The pipeline will:
1. Create timestamped directories (e.g., `20250621-143000`)
2. Export PostgreSQL data to JSON
3. Transform data for MongoDB
4. Upload to S3
5. Create versioned MongoDB database

### 2. Restore a Specific Version

```bash
# Restore a specific timestamp
./restore-from-backup.sh --timestamp 20250621-143000

# Restore and load into MongoDB
./restore-from-backup.sh --timestamp 20250621-143000 --mongodb

# Restore from local files (skip S3 download)
./restore-from-backup.sh --timestamp 20250621-143000 --skip-download --mongodb
```

### 3. Compare Versions

```bash
# Compare two versions
./compare-exports.sh \
    --version1 20250621-143000 \
    --version2 20250622-080000 \
    --output comparison-report.json

# Generate HTML report
./compare-exports.sh \
    --version1 20250621-143000 \
    --version2 20250622-080000 \
    --format html \
    --output comparison.html
```

## Timestamp Format

All timestamps use: `YYYYMMDD-HHMMSS` (UTC)

Examples:
- `20250621-143000` = June 21, 2025, 2:30:00 PM UTC
- `20250622-020000` = June 22, 2025, 2:00:00 AM UTC

## Data Flow

```
Production PostgreSQL (RDS)
    ↓
pg_dump or RDS Snapshot
    ↓
Local PostgreSQL (timestamped: media_tool_20250621-143000)
    ↓
JSON Export (postgres-export script)
    ↓
Raw Export Directory (exports/raw/20250621-143000/)
    ↓
Transform (ETL scripts)
    ↓
Transformed Directory (exports/transformed/20250621-143000/)
    ↓
MongoDB (timestamped: mediatool_20250621-143000)
    ↓
S3 Backup (compressed archives)
```

## S3 Storage Structure

```
media-tool-backups/
├── postgres-exports/
│   ├── raw/
│   │   └── 2025-06-21/
│   │       └── 20250621-143000-raw.tar.gz
│   ├── transformed/
│   │   └── 2025-06-21/
│   │       └── 20250621-143000-transformed.tar.gz
│   └── metadata/
│       └── 2025-06-21/
│           └── 20250621-143000.json
```

## Versioned MongoDB Databases

Each export creates a new MongoDB database:
- Database name: `mediatool_{timestamp}`
- Example: `mediatool_20250621-143000`

List all versions:
```bash
# Show all MongoDB databases
mongo --eval "db.adminCommand('listDatabases')" | grep mediatool_

# View version tracking
cat exports/mongodb-versions.json | jq '.'
```

## Testing with Different Versions

### Run Tests Against Specific Version
```bash
# Set database for testing
export DATABASE_NAME=mediatool_20250621-143000

# Run your tests
npm test
```

### Automated Testing Script
```bash
# Test against multiple versions
for version in 20250621-143000 20250622-080000; do
    echo "Testing version: $version"
    export DATABASE_NAME="mediatool_${version}"
    npm test > "test-results-${version}.log"
done
```

## Production Export from AWS

### Prerequisites
1. VPN or bastion host access to production RDS
2. Read-only database user
3. AWS IAM permissions for S3

### Security Considerations
- Use read-only database users
- Encrypt data in transit (SSL/TLS)
- S3 bucket encryption enabled
- Restrict IAM permissions
- Audit trail via CloudTrail

### Example AWS IAM Policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::media-tool-backups/*",
                "arn:aws:s3:::media-tool-backups"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "rds:CreateDBSnapshot",
                "rds:DescribeDBSnapshots"
            ],
            "Resource": "*"
        }
    ]
}
```

## Scheduling Exports

### Daily Export Cron Job
```bash
# Add to crontab
0 2 * * * /path/to/production-export-pipeline.sh >> /var/log/media-tool-export.log 2>&1
```

### GitHub Actions Workflow
```yaml
name: Daily Production Export
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - name: Run Export
        run: ./scripts/production-pipeline/production-export-pipeline.sh
```

## Troubleshooting

### Common Issues

1. **pg_dump connection failed**
   - Check VPN/bastion connection
   - Verify database credentials
   - Check security group rules

2. **S3 upload failed**
   - Verify AWS credentials
   - Check IAM permissions
   - Ensure bucket exists

3. **MongoDB import failed**
   - Check MongoDB is running
   - Verify disk space
   - Check file permissions

### Debug Mode
```bash
# Run with debug output
bash -x ./production-export-pipeline.sh
```

### Logs
- Pipeline logs: `exports/logs/`
- Export summaries: `exports/metadata/`
- Comparison reports: `exports/comparison-reports/`

## Cost Optimization

- Use S3 lifecycle policies
- Compress exports before upload
- Delete old local copies
- Use S3 Intelligent-Tiering

## Future Enhancements

1. **Automated Data Validation**
   - Row count verification
   - Data integrity checks
   - Schema change detection

2. **Performance Metrics**
   - Export duration tracking
   - Size growth trends
   - Query performance comparison

3. **Notification System**
   - Slack/email on completion
   - Failure alerts
   - Size threshold warnings