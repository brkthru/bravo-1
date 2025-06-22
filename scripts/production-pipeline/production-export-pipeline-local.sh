#!/bin/bash

# Production Export Pipeline - Local Testing Version
# This version skips S3 operations for local testing

set -euo pipefail

# Configuration
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
EXPORT_DATE=$(date -u +%Y-%m-%d)
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"

# Source configuration
if [[ -f "${SCRIPTS_DIR}/production-pipeline/config/pipeline.env" ]]; then
    source "${SCRIPTS_DIR}/production-pipeline/config/pipeline.env"
fi

# Database Configuration
LOCAL_PG_HOST="${LOCAL_PG_HOST:-localhost}"
LOCAL_PG_PORT="${LOCAL_PG_PORT:-5432}"
LOCAL_PG_DB="media_tool_${TIMESTAMP}"
LOCAL_PG_USER="${LOCAL_PG_USER:-postgres}"
LOCAL_PG_PASSWORD="${LOCAL_PG_PASSWORD:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# Direct pg_dump from local PostgreSQL
direct_pg_dump() {
    log "Performing pg_dump from local PostgreSQL..."
    local dump_file="${EXPORT_BASE_DIR}/temp/prod_dump_${TIMESTAMP}.sql"
    
    PGPASSWORD="${PROD_PG_PASSWORD}" pg_dump \
        -h "${PROD_PG_HOST}" \
        -p "${PROD_PG_PORT}" \
        -U "${PROD_PG_USER}" \
        -d "${PROD_PG_DB}" \
        -f "${dump_file}" \
        --verbose \
        --no-owner \
        --no-acl
    
    log "Database dumped to ${dump_file}"
    echo "${dump_file}"
}

# Restore dump to local PostgreSQL with new timestamp
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
        < "${dump_file}"
    
    log "Database restored successfully"
}

# Export to JSON using existing script
export_to_json() {
    log "Exporting database to JSON format..."
    
    cd "${SCRIPTS_DIR}/postgres-export"
    
    # Backup existing export if it exists
    if [[ -d "postgres-raw-export" ]]; then
        mv postgres-raw-export "postgres-raw-export-backup-$(date -u +%Y%m%d-%H%M%S)"
    fi
    
    # Set environment variables for the export script
    export PG_HOST="${LOCAL_PG_HOST}"
    export PG_PORT="${LOCAL_PG_PORT}"
    export PG_DATABASE="${LOCAL_PG_DB}"
    export PG_USER="${LOCAL_PG_USER}"
    export PG_PASSWORD="${LOCAL_PG_PASSWORD}"
    
    # Run the export
    bun run export
    
    # Move the export to timestamped directory
    mv postgres-raw-export/* "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"
    
    log "JSON export completed"
}

# Run transformation pipeline
transform_data() {
    log "Running data transformation..."
    
    cd "${SCRIPTS_DIR}/etl"
    
    # Backup existing data-export if it exists
    if [[ -d "data-export" ]]; then
        mv data-export "data-export-backup-$(date -u +%Y%m%d-%H%M%S)"
    fi
    
    # Copy raw export to ETL input directory
    mkdir -p data-export
    cp -r "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"/* ./data-export/
    
    # Run transformation
    bun run transform-data.ts
    
    # Move transformed data to versioned directory
    if [[ -d "data-transformed" ]]; then
        mv data-transformed/* "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
    else
        warning "No transformed data found"
    fi
    
    log "Transformation completed"
}

# Create versioned MongoDB database
create_versioned_mongodb() {
    log "Creating versioned MongoDB database..."
    
    local mongo_db="mediatool_${TIMESTAMP}"
    
    cd "${SCRIPTS_DIR}/etl"
    
    # Check if transformed data exists
    if [[ ! -f "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/campaigns.json" ]]; then
        warning "Transformed data not found, skipping MongoDB import"
        return
    fi
    
    # Copy transformed data to load location
    if [[ -d "data-transformed" ]]; then
        rm -rf data-transformed
    fi
    mkdir -p data-transformed
    cp -r "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}"/* ./data-transformed/
    
    # Modify the load script to use versioned database
    export DATABASE_NAME="${mongo_db}"
    
    # Load the transformed data
    bun run load-data.ts
    
    log "MongoDB database ${mongo_db} created"
    
    # Create/update version tracking file
    local version_file="${EXPORT_BASE_DIR}/mongodb-versions.json"
    local new_version=$(cat <<EOF
{
    "version": "${TIMESTAMP}",
    "database_name": "${mongo_db}",
    "source_postgres_db": "${LOCAL_PG_DB}",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "raw_export": "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/",
    "transformed_export": "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
}
EOF
)
    
    if [[ -f "$version_file" ]]; then
        # Append to existing array
        echo "$new_version" >> "$version_file"
    else
        # Create new array
        echo "[$new_version]" > "$version_file"
    fi
}

# Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove temporary dumps
    rm -f "${EXPORT_BASE_DIR}/temp/*.sql"
    
    # Optionally drop local PostgreSQL database
    if [[ "${DROP_LOCAL_DB:-false}" == "true" ]]; then
        log "Dropping temporary PostgreSQL database..."
        PGPASSWORD="${LOCAL_PG_PASSWORD}" dropdb \
            -h "${LOCAL_PG_HOST}" \
            -p "${LOCAL_PG_PORT}" \
            -U "${LOCAL_PG_USER}" \
            "${LOCAL_PG_DB}" || true
    fi
    
    log "Cleanup completed"
}

# Main execution
main() {
    log "Starting production export pipeline (LOCAL VERSION)..."
    log "Timestamp: ${TIMESTAMP}"
    
    # Create directories
    create_directories
    
    # Run pipeline steps
    dump_file=$(direct_pg_dump)
    restore_to_local "${dump_file}"
    export_to_json
    transform_data
    create_versioned_mongodb
    cleanup
    
    log "Pipeline completed successfully!"
    log "Exports available at:"
    log "  - Raw: ${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"
    log "  - Transformed: ${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
    log "  - MongoDB: mediatool_${TIMESTAMP}"
    
    # Show summary
    if [[ -f "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/export-summary.json" ]]; then
        log "\nExport Summary:"
        jq '.tables | to_entries | map({collection: .key, count: .value.count}) | sort_by(.count) | reverse | .[0:5]' \
            "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/export-summary.json"
    fi
}

# Run the pipeline
main "$@"