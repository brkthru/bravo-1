#!/bin/bash

# Production Export Pipeline
# This script handles the complete pipeline from production RDS to versioned local exports

set -euo pipefail

# Configuration
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
EXPORT_DATE=$(date -u +%Y-%m-%d)
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"

# AWS Configuration
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"
RDS_INSTANCE="${RDS_INSTANCE:-media-tool-production}"

# Database Configuration
LOCAL_PG_HOST="${LOCAL_PG_HOST:-localhost}"
LOCAL_PG_PORT="${LOCAL_PG_PORT:-5432}"
LOCAL_PG_DB="media_tool_${TIMESTAMP}"
LOCAL_PG_USER="${LOCAL_PG_USER:-postgres}"
LOCAL_PG_PASSWORD="${LOCAL_PG_PASSWORD:-postgres}"

# S3 Configuration
S3_BUCKET="${S3_BUCKET:-media-tool-backups}"
S3_PREFIX="postgres-exports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${GREEN}[$(date -u +'%Y-%m-%d %H:%M:%S UTC')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create directory structure
create_directories() {
    log "Creating directory structure..."
    mkdir -p "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"
    mkdir -p "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}"
    mkdir -p "${EXPORT_BASE_DIR}/logs"
    mkdir -p "${EXPORT_BASE_DIR}/temp"
}

# Step 1: Create RDS snapshot
create_rds_snapshot() {
    log "Creating RDS snapshot..."
    local snapshot_id="manual-export-${TIMESTAMP}"
    
    aws rds create-db-snapshot \
        --db-instance-identifier "${RDS_INSTANCE}" \
        --db-snapshot-identifier "${snapshot_id}" \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}"
    
    log "Waiting for snapshot to complete..."
    aws rds wait db-snapshot-completed \
        --db-snapshot-identifier "${snapshot_id}" \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}"
    
    log "Snapshot ${snapshot_id} created successfully"
    echo "${snapshot_id}"
}

# Step 2: Export from RDS to S3 (using AWS RDS export)
export_rds_to_s3() {
    local snapshot_id=$1
    log "Exporting RDS snapshot to S3..."
    
    local export_task_id="export-${TIMESTAMP}"
    local s3_prefix="${S3_PREFIX}/rds-exports/${TIMESTAMP}"
    
    aws rds start-export-task \
        --export-task-identifier "${export_task_id}" \
        --source-arn "arn:aws:rds:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):snapshot:${snapshot_id}" \
        --s3-bucket-name "${S3_BUCKET}" \
        --s3-prefix "${s3_prefix}" \
        --iam-role-arn "${RDS_EXPORT_ROLE_ARN}" \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}"
    
    log "Export task ${export_task_id} started"
}

# Step 3: Alternative - Direct pg_dump from production (requires VPN/bastion)
direct_pg_dump() {
    log "Performing direct pg_dump from production..."
    local dump_file="${EXPORT_BASE_DIR}/temp/prod_dump_${TIMESTAMP}.sql"
    
    # Note: This requires proper network access to production RDS
    PGPASSWORD="${PROD_PG_PASSWORD}" pg_dump \
        -h "${PROD_PG_HOST}" \
        -p "${PROD_PG_PORT:-5432}" \
        -U "${PROD_PG_USER}" \
        -d "${PROD_PG_DB}" \
        -f "${dump_file}" \
        --verbose \
        --no-owner \
        --no-acl
    
    log "Database dumped to ${dump_file}"
    echo "${dump_file}"
}

# Step 4: Restore dump to local PostgreSQL
restore_to_local() {
    local dump_file=$1
    log "Creating local database ${LOCAL_PG_DB}..."
    
    PGPASSWORD="${LOCAL_PG_PASSWORD}" createdb \
        -h "${LOCAL_PG_HOST}" \
        -p "${LOCAL_PG_PORT}" \
        -U "${LOCAL_PG_USER}" \
        "${LOCAL_PG_DB}"
    
    log "Restoring dump to local database..."
    PGPASSWORD="${LOCAL_PG_PASSWORD}" psql \
        -h "${LOCAL_PG_HOST}" \
        -p "${LOCAL_PG_PORT}" \
        -U "${LOCAL_PG_USER}" \
        -d "${LOCAL_PG_DB}" \
        -f "${dump_file}"
    
    log "Database restored successfully"
}

# Step 5: Export to JSON using existing script
export_to_json() {
    log "Exporting database to JSON format..."
    
    cd "${SCRIPTS_DIR}/postgres-export"
    
    # Set environment variables for the export script
    export PG_HOST="${LOCAL_PG_HOST}"
    export PG_PORT="${LOCAL_PG_PORT}"
    export PG_DATABASE="${LOCAL_PG_DB}"
    export PG_USER="${LOCAL_PG_USER}"
    export PG_PASSWORD="${LOCAL_PG_PASSWORD}"
    
    # Run the export
    bun run export
    
    # Move the export to timestamped directory
    mv postgres-raw-export "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"
    
    log "JSON export completed"
}

# Step 6: Run transformation pipeline
transform_data() {
    log "Running data transformation..."
    
    cd "${SCRIPTS_DIR}/etl"
    
    # Copy raw export to ETL input directory
    cp -r "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/" ./data-export/
    
    # Run transformation
    bun run transform-data.ts
    
    # Move transformed data to versioned directory
    mv data-transformed "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
    
    log "Transformation completed"
}

# Step 7: Upload to S3
upload_to_s3() {
    log "Uploading exports to S3..."
    
    # Compress raw export
    cd "${EXPORT_BASE_DIR}/raw"
    tar -czf "${TIMESTAMP}-raw.tar.gz" "${TIMESTAMP}/"
    
    # Compress transformed export
    cd "${EXPORT_BASE_DIR}/transformed"
    tar -czf "${TIMESTAMP}-transformed.tar.gz" "${TIMESTAMP}/"
    
    # Upload to S3
    aws s3 cp \
        "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}-raw.tar.gz" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/raw/${EXPORT_DATE}/" \
        --profile "${AWS_PROFILE}"
    
    aws s3 cp \
        "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}-transformed.tar.gz" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/transformed/${EXPORT_DATE}/" \
        --profile "${AWS_PROFILE}"
    
    # Create metadata file
    cat > "${EXPORT_BASE_DIR}/temp/export-metadata.json" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "export_date": "${EXPORT_DATE}",
    "source_database": "${RDS_INSTANCE}",
    "local_database": "${LOCAL_PG_DB}",
    "raw_export_path": "s3://${S3_BUCKET}/${S3_PREFIX}/raw/${EXPORT_DATE}/${TIMESTAMP}-raw.tar.gz",
    "transformed_export_path": "s3://${S3_BUCKET}/${S3_PREFIX}/transformed/${EXPORT_DATE}/${TIMESTAMP}-transformed.tar.gz",
    "export_complete": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    aws s3 cp \
        "${EXPORT_BASE_DIR}/temp/export-metadata.json" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/metadata/${EXPORT_DATE}/${TIMESTAMP}.json" \
        --profile "${AWS_PROFILE}"
    
    log "Upload to S3 completed"
}

# Step 8: Create versioned MongoDB database
create_versioned_mongodb() {
    log "Creating versioned MongoDB database..."
    
    local mongo_db="mediatool_${TIMESTAMP}"
    
    cd "${SCRIPTS_DIR}/etl"
    
    # Modify the load script to use versioned database
    export DATABASE_NAME="${mongo_db}"
    
    # Load the transformed data
    bun run load-data.ts
    
    log "MongoDB database ${mongo_db} created"
    
    # Create index file for tracking versions
    cat >> "${EXPORT_BASE_DIR}/mongodb-versions.json" <<EOF
{
    "version": "${TIMESTAMP}",
    "database_name": "${mongo_db}",
    "source_postgres_db": "${LOCAL_PG_DB}",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "raw_export": "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/",
    "transformed_export": "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
}
EOF
}

# Step 9: Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove temporary dumps
    rm -f "${EXPORT_BASE_DIR}/temp/*.sql"
    
    # Optionally drop local PostgreSQL database
    if [[ "${DROP_LOCAL_DB:-false}" == "true" ]]; then
        PGPASSWORD="${LOCAL_PG_PASSWORD}" dropdb \
            -h "${LOCAL_PG_HOST}" \
            -p "${LOCAL_PG_PORT}" \
            -U "${LOCAL_PG_USER}" \
            "${LOCAL_PG_DB}"
    fi
    
    log "Cleanup completed"
}

# Main execution
main() {
    log "Starting production export pipeline..."
    log "Timestamp: ${TIMESTAMP}"
    
    # Create directories
    create_directories
    
    # Choose export method
    if [[ "${EXPORT_METHOD:-snapshot}" == "snapshot" ]]; then
        # Method 1: RDS Snapshot
        snapshot_id=$(create_rds_snapshot)
        export_rds_to_s3 "${snapshot_id}"
        warning "RDS export initiated. Download and restore manually when complete."
    else
        # Method 2: Direct pg_dump
        dump_file=$(direct_pg_dump)
        restore_to_local "${dump_file}"
        export_to_json
        transform_data
        upload_to_s3
        create_versioned_mongodb
        cleanup
    fi
    
    log "Pipeline completed successfully!"
    log "Exports available at:"
    log "  - Raw: ${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"
    log "  - Transformed: ${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
    log "  - S3: s3://${S3_BUCKET}/${S3_PREFIX}/"
}

# Run the pipeline
main "$@"