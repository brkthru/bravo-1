# Cloud Storage Structure for Versioned Backups

## S3 Bucket Organization

```
media-tool-backups/
├── postgres-exports/
│   ├── raw/                          # Raw PostgreSQL exports (JSON)
│   │   ├── 2025-06-21/
│   │   │   ├── 20250621-143000-raw.tar.gz
│   │   │   ├── 20250621-200000-raw.tar.gz
│   │   │   └── ...
│   │   ├── 2025-06-22/
│   │   │   └── 20250622-080000-raw.tar.gz
│   │   └── ...
│   │
│   ├── transformed/                  # Transformed data ready for MongoDB
│   │   ├── 2025-06-21/
│   │   │   ├── 20250621-143000-transformed.tar.gz
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── metadata/                     # Export metadata files
│   │   ├── 2025-06-21/
│   │   │   ├── 20250621-143000.json
│   │   │   └── ...
│   │   └── ...
│   │
│   └── rds-exports/                  # AWS RDS native exports
│       └── 2025-06-21/
│           └── export-20250621-143000/
│
├── mongodb-dumps/                    # MongoDB backups
│   ├── 2025-06-21/
│   │   ├── mediatool_20250621-143000.tar.gz
│   │   └── ...
│   └── ...
│
└── comparison-reports/               # Data comparison reports
    ├── 2025-06-21/
    │   ├── daily-metrics-comparison.json
    │   └── data-integrity-report.json
    └── ...
```

## Naming Conventions

### Timestamps
- Format: `YYYYMMDD-HHMMSS` (e.g., `20250621-143000`)
- Always in UTC
- Used in all filenames and database names

### File Names
- Raw exports: `{timestamp}-raw.tar.gz`
- Transformed exports: `{timestamp}-transformed.tar.gz`
- Metadata: `{timestamp}.json`
- MongoDB dumps: `mediatool_{timestamp}.tar.gz`

### Database Names
- PostgreSQL: `media_tool_{timestamp}`
- MongoDB: `mediatool_{timestamp}`

## Metadata File Structure

Each export creates a metadata file with:

```json
{
    "timestamp": "20250621-143000",
    "export_date": "2025-06-21",
    "source": {
        "type": "rds",
        "instance": "media-tool-production",
        "snapshot_id": "manual-export-20250621-143000"
    },
    "exports": {
        "raw": {
            "path": "s3://media-tool-backups/postgres-exports/raw/2025-06-21/20250621-143000-raw.tar.gz",
            "size_mb": 924,
            "record_count": 848937,
            "tables_exported": 24
        },
        "transformed": {
            "path": "s3://media-tool-backups/postgres-exports/transformed/2025-06-21/20250621-143000-transformed.tar.gz",
            "size_mb": 450,
            "collections": ["campaigns", "users", "lineItems"]
        }
    },
    "databases_created": {
        "postgres": "media_tool_20250621-143000",
        "mongodb": "mediatool_20250621-143000"
    },
    "export_duration_minutes": 45,
    "export_complete": "2025-06-21T14:45:00Z"
}
```

## S3 Lifecycle Policies

### Raw Exports
- Keep latest 30 days in STANDARD storage
- Move to STANDARD_IA after 30 days
- Move to GLACIER after 90 days
- Delete after 2 years

### Transformed Exports
- Keep latest 7 days in STANDARD storage
- Move to STANDARD_IA after 7 days
- Move to GLACIER after 30 days
- Delete after 1 year

### Metadata
- Keep in STANDARD storage indefinitely (small files)

## Access Patterns

### Latest Export
```bash
# Get latest export metadata
aws s3 ls s3://media-tool-backups/postgres-exports/metadata/ \
    --recursive | sort | tail -1

# Download latest raw export
LATEST_DATE=$(date +%Y-%m-%d)
aws s3 ls s3://media-tool-backups/postgres-exports/raw/${LATEST_DATE}/ \
    | sort | tail -1 | awk '{print $4}'
```

### Historical Comparison
```bash
# List all exports for a date range
aws s3 ls s3://media-tool-backups/postgres-exports/metadata/ \
    --recursive \
    | grep "2025-06" \
    | sort
```

### Restore Specific Version
```bash
# Download specific export
TIMESTAMP="20250621-143000"
aws s3 cp \
    s3://media-tool-backups/postgres-exports/raw/2025-06-21/${TIMESTAMP}-raw.tar.gz \
    ./
```

## Versioning Strategy

### Daily Exports
- Production exports run daily at 2 AM UTC
- Timestamp: `YYYYMMDD-020000`

### On-Demand Exports
- Triggered manually for testing
- Include full timestamp: `YYYYMMDD-HHMMSS`

### Version Tracking
Local file tracks all versions:
```json
// mongodb-versions.json
[
    {
        "version": "20250621-143000",
        "database_name": "mediatool_20250621-143000",
        "source_postgres_db": "media_tool_20250621-143000",
        "created_at": "2025-06-21T14:45:00Z",
        "purpose": "daily_backup",
        "notes": "Pre-release backup"
    },
    {
        "version": "20250622-080000",
        "database_name": "mediatool_20250622-080000",
        "source_postgres_db": "media_tool_20250622-080000",
        "created_at": "2025-06-22T08:30:00Z",
        "purpose": "testing",
        "notes": "Testing new schema design"
    }
]
```

## Comparison Tools

### Data Integrity Checker
Compare exports across versions:
```bash
./scripts/production-pipeline/compare-exports.sh \
    --version1 20250621-143000 \
    --version2 20250622-080000 \
    --output comparison-report.json
```

### Metrics Tracker
Track key metrics across versions:
- Total record counts
- Campaign counts
- User counts
- Data size growth
- Schema changes

## Security Considerations

### Encryption
- All S3 buckets use SSE-S3 encryption
- In-transit encryption via HTTPS
- Optional KMS encryption for sensitive data

### Access Control
- IAM roles for pipeline automation
- Read-only access for most users
- MFA required for deletion
- CloudTrail logging enabled

### Data Sanitization
For non-production environments:
```bash
./scripts/production-pipeline/sanitize-export.sh \
    --input 20250621-143000-raw.tar.gz \
    --output 20250621-143000-sanitized.tar.gz
```

## Cost Optimization

### Storage Tiers
- STANDARD: $0.023/GB (first 30 days)
- STANDARD_IA: $0.0125/GB (30-90 days)
- GLACIER: $0.004/GB (90+ days)

### Estimated Monthly Costs
- Daily raw exports (1GB each): ~$30/month
- Transformed exports (500MB each): ~$15/month
- Metadata and reports: ~$1/month

### Cost Reduction Strategies
1. Compress exports (60-70% reduction)
2. Use lifecycle policies aggressively
3. Delete test/development exports after 7 days
4. Use GLACIER for long-term compliance storage