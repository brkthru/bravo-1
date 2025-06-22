#!/bin/bash

# Restore from Backup Script
# Downloads a specific timestamped backup from S3 and restores it locally

set -euo pipefail

# Configuration
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    -t, --timestamp TIMESTAMP    Timestamp of backup to restore (required)
    -d, --date DATE             Date of backup (default: derives from timestamp)
    -m, --mongodb               Also restore to MongoDB
    -p, --postgres              Also restore to PostgreSQL
    --skip-download             Skip download if files exist locally
    --profile PROFILE           AWS profile to use (default: default)
    --bucket BUCKET             S3 bucket name (default: media-tool-backups)
    -h, --help                  Show this help message

Examples:
    # Restore a specific backup
    $0 --timestamp 20250621-143000

    # Restore and load into MongoDB
    $0 --timestamp 20250621-143000 --mongodb

    # Restore from local files (skip download)
    $0 --timestamp 20250621-143000 --skip-download --mongodb

EOF
}

# Parse arguments
TIMESTAMP=""
DATE=""
RESTORE_MONGODB=false
RESTORE_POSTGRES=false
SKIP_DOWNLOAD=false
AWS_PROFILE="default"
S3_BUCKET="media-tool-backups"

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--timestamp)
            TIMESTAMP="$2"
            shift 2
            ;;
        -d|--date)
            DATE="$2"
            shift 2
            ;;
        -m|--mongodb)
            RESTORE_MONGODB=true
            shift
            ;;
        -p|--postgres)
            RESTORE_POSTGRES=true
            shift
            ;;
        --skip-download)
            SKIP_DOWNLOAD=true
            shift
            ;;
        --profile)
            AWS_PROFILE="$2"
            shift 2
            ;;
        --bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate required arguments
if [[ -z "$TIMESTAMP" ]]; then
    error "Timestamp is required. Use -t or --timestamp"
fi

# Derive date from timestamp if not provided
if [[ -z "$DATE" ]]; then
    DATE=$(echo "$TIMESTAMP" | cut -d'-' -f1 | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/')
fi

# Create directories
mkdir -p "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"
mkdir -p "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}"
mkdir -p "${EXPORT_BASE_DIR}/temp"

# Download metadata
download_metadata() {
    log "Downloading metadata for ${TIMESTAMP}..."
    
    aws s3 cp \
        "s3://${S3_BUCKET}/postgres-exports/metadata/${DATE}/${TIMESTAMP}.json" \
        "${EXPORT_BASE_DIR}/temp/${TIMESTAMP}-metadata.json" \
        --profile "${AWS_PROFILE}"
    
    if [[ ! -f "${EXPORT_BASE_DIR}/temp/${TIMESTAMP}-metadata.json" ]]; then
        error "Metadata file not found for timestamp ${TIMESTAMP}"
    fi
    
    log "Metadata downloaded successfully"
}

# Download raw export
download_raw_export() {
    if [[ "$SKIP_DOWNLOAD" == "true" ]]; then
        log "Skipping download of raw export (--skip-download flag)"
        return
    fi
    
    log "Downloading raw export for ${TIMESTAMP}..."
    
    aws s3 cp \
        "s3://${S3_BUCKET}/postgres-exports/raw/${DATE}/${TIMESTAMP}-raw.tar.gz" \
        "${EXPORT_BASE_DIR}/temp/" \
        --profile "${AWS_PROFILE}"
    
    log "Extracting raw export..."
    tar -xzf "${EXPORT_BASE_DIR}/temp/${TIMESTAMP}-raw.tar.gz" \
        -C "${EXPORT_BASE_DIR}/raw/"
    
    log "Raw export extracted to ${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"
}

# Download transformed export
download_transformed_export() {
    if [[ "$SKIP_DOWNLOAD" == "true" ]]; then
        log "Skipping download of transformed export (--skip-download flag)"
        return
    fi
    
    log "Downloading transformed export for ${TIMESTAMP}..."
    
    aws s3 cp \
        "s3://${S3_BUCKET}/postgres-exports/transformed/${DATE}/${TIMESTAMP}-transformed.tar.gz" \
        "${EXPORT_BASE_DIR}/temp/" \
        --profile "${AWS_PROFILE}"
    
    log "Extracting transformed export..."
    tar -xzf "${EXPORT_BASE_DIR}/temp/${TIMESTAMP}-transformed.tar.gz" \
        -C "${EXPORT_BASE_DIR}/transformed/"
    
    log "Transformed export extracted to ${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
}

# Restore to PostgreSQL
restore_to_postgres() {
    log "Restoring to PostgreSQL..."
    
    local db_name="media_tool_${TIMESTAMP}"
    
    # Create database
    createdb -h localhost -U postgres "${db_name}"
    
    # Import each JSON file
    cd "${SCRIPTS_DIR}/postgres-import"
    
    # Create import script if it doesn't exist
    if [[ ! -f "import-from-json.ts" ]]; then
        warning "PostgreSQL import script not found. Creating basic importer..."
        # Would create the import script here
    fi
    
    log "PostgreSQL database ${db_name} created (import script needed)"
}

# Restore to MongoDB
restore_to_mongodb() {
    log "Restoring to MongoDB..."
    
    local mongo_db="mediatool_${TIMESTAMP}"
    
    # Check if transformed data exists
    if [[ ! -d "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}" ]]; then
        error "Transformed data not found. Please run transformation first."
    fi
    
    # Import using mongoimport
    for file in "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}"/*.json; do
        if [[ -f "$file" ]]; then
            collection=$(basename "$file" .json)
            log "Importing ${collection}..."
            
            mongoimport \
                --uri "mongodb://localhost:27017/${mongo_db}" \
                --collection "${collection}" \
                --file "$file" \
                --jsonArray \
                --drop
        fi
    done
    
    log "MongoDB database ${mongo_db} created successfully"
    
    # Update version tracking
    cat >> "${EXPORT_BASE_DIR}/mongodb-versions.json" <<EOF
{
    "version": "${TIMESTAMP}",
    "database_name": "${mongo_db}",
    "restored_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "restored_from": "s3://${S3_BUCKET}/postgres-exports/transformed/${DATE}/${TIMESTAMP}-transformed.tar.gz"
}
EOF
}

# Show restore summary
show_summary() {
    log "Restore Summary:"
    log "==============="
    log "Timestamp: ${TIMESTAMP}"
    log "Date: ${DATE}"
    log "Raw data: ${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"
    log "Transformed data: ${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
    
    if [[ "$RESTORE_POSTGRES" == "true" ]]; then
        log "PostgreSQL database: media_tool_${TIMESTAMP}"
    fi
    
    if [[ "$RESTORE_MONGODB" == "true" ]]; then
        log "MongoDB database: mediatool_${TIMESTAMP}"
    fi
    
    # Show metadata
    if [[ -f "${EXPORT_BASE_DIR}/temp/${TIMESTAMP}-metadata.json" ]]; then
        log "\nMetadata:"
        jq '.' "${EXPORT_BASE_DIR}/temp/${TIMESTAMP}-metadata.json"
    fi
}

# Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    rm -f "${EXPORT_BASE_DIR}/temp/${TIMESTAMP}-*.tar.gz"
}

# Main execution
main() {
    log "Starting restore process for timestamp: ${TIMESTAMP}"
    
    # Download metadata
    download_metadata
    
    # Download exports
    download_raw_export
    download_transformed_export
    
    # Restore to databases if requested
    if [[ "$RESTORE_POSTGRES" == "true" ]]; then
        restore_to_postgres
    fi
    
    if [[ "$RESTORE_MONGODB" == "true" ]]; then
        restore_to_mongodb
    fi
    
    # Show summary
    show_summary
    
    # Cleanup
    cleanup
    
    log "Restore completed successfully!"
}

# Run the restore
main