# Production Pipeline - Raw Data Export Strategy

This directory contains scripts for exporting raw PostgreSQL data from production to S3, allowing developers to download and transform data locally with the latest code.

## Philosophy

We store **only raw PostgreSQL exports** in S3. This approach provides:

- **Flexibility**: Transformation logic lives in Git, not S3
- **Simplicity**: One source of truth for data (raw exports)
- **Efficiency**: No need to upload new transformed versions when schemas change
- **Version Control**: All transformation logic is properly versioned in Git

## Workflow

### 1. Export Raw Data from Production (Admin Only)

```bash
# First, configure your production database credentials
cp config/pipeline.env.example config/pipeline.env
# Edit config/pipeline.env with your production database details

# Export from production and upload to S3
./export-raw-to-s3.sh
```

This script will:

- Create a PostgreSQL dump from production
- Export to JSON format (raw table data)
- Upload to S3 with timestamp
- Keep only the 3 most recent exports

### 2. Download and Transform Locally (All Developers)

```bash
# Download raw data and transform with latest code
./download-raw-from-s3.sh

# Or run automatically without prompts
./download-raw-from-s3.sh --auto
```

This script will:

- Download the latest raw export from S3
- Run transformation using current code from Git
- Optionally load into MongoDB

## Scripts

### export-raw-to-s3.sh

- **Purpose**: Export production data to S3 (admin use)
- **Requirements**: Production database access, AWS credentials
- **Output**: Raw PostgreSQL data in S3

### download-raw-from-s3.sh

- **Purpose**: Download and transform data locally
- **Requirements**: AWS credentials, local MongoDB
- **Options**:
  - `--auto-transform`: Transform without prompting
  - `--auto-load`: Load to MongoDB without prompting
  - `--auto`: Do both automatically

### Legacy Scripts (Deprecated)

- `download-from-s3.sh`: Old script that expected transformed data in S3
- `production-export-pipeline.sh`: Old script that uploaded both raw and transformed

## Configuration

### AWS Setup

1. Login to AWS SSO:

```bash
aws sso login --sso-session brkthru-sso
```

2. Verify access:

```bash
aws sts get-caller-identity --profile brkthru-mediatool-dev
```

### Production Database Access

Create `config/pipeline.env` with your production credentials:

```bash
PROD_PG_HOST=your-production-rds-instance.amazonaws.com
PROD_PG_USER=your_username
PROD_PG_PASSWORD=your_password
```

## S3 Structure

```
s3://media-tool-backups-1750593763/
└── postgres-exports/
    ├── metadata/
    │   └── 2025-06-28/
    │       └── 20250628-123456.json
    └── raw/
        └── 2025-06-28/
            └── 20250628-123456-raw.tar.gz
```

## Local Directory Structure

```
bravo-1/exports/
├── raw/
│   └── 20250628-123456/     # Downloaded raw data
├── transformed/
│   └── 20250628-123456/     # Locally transformed data
└── temp/                    # Temporary download files
```

## Best Practices

1. **Regular Exports**: Run production exports weekly or when significant data changes occur
2. **Local Testing**: Always test transformations locally before committing code changes
3. **Git Pull**: Always pull latest code before running transformations
4. **Clean Up**: The scripts automatically clean old exports from S3 (keeps last 3)

## Troubleshooting

### AWS Authentication Issues

```bash
# Refresh SSO login
aws sso login --sso-session brkthru-sso
```

### Production Database Connection

- Ensure VPN/bastion access if required
- Check firewall rules for your IP
- Verify credentials in `config/pipeline.env`

### Transformation Errors

- Pull latest code: `git pull`
- Check MongoDB is running: `docker ps`
- Review transformation logs in `exports/logs/`

## Migration from Old Process

If you have old transformed data in S3:

1. It will be ignored by the new download script
2. Old exports will be cleaned up automatically when new exports are created
3. Focus on using only raw exports going forward
   EOF < /dev/null
