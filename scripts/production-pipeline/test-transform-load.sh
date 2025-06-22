#!/bin/bash

# Test script for transformation and MongoDB loading

set -euo pipefail

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date -u +'%Y-%m-%d %H:%M:%S UTC')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Create directories
mkdir -p "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"
mkdir -p "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}"

# Copy existing postgres export
log "Copying existing PostgreSQL export..."
cp -r "${SCRIPTS_DIR}/postgres-export/postgres-raw-export"/* "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"

log "Files copied:"
ls -la "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/" | head -10

# Transform data
log "Running data transformation..."
cd "${SCRIPTS_DIR}/etl"

# Backup existing data-export if it exists
if [[ -d "data-export" ]]; then
    mv data-export "data-export-backup-$(date -u +%Y%m%d-%H%M%S)"
fi

# Copy raw export to ETL input directory
mkdir -p data-export
cp "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"/*.json ./data-export/

log "Running transform script..."
bun run transform-data.ts

# Check if transformation succeeded
if [[ -d "data-transformed" ]]; then
    log "Transformation completed. Files created:"
    ls -la data-transformed/
    
    # Move to versioned directory
    mv data-transformed/* "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}/"
else
    error "No transformed data found"
    exit 1
fi

# Load into MongoDB
log "Loading into MongoDB..."
local mongo_db="mediatool_${TIMESTAMP}"

# Copy transformed data for loading
mkdir -p data-transformed
cp "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}"/*.json ./data-transformed/

# Set database name
export DATABASE_NAME="${mongo_db}"

log "Creating MongoDB database: ${mongo_db}"
bun run load-data.ts

log "Process completed!"
log "MongoDB database created: ${mongo_db}"

# Show databases
log "Current MongoDB databases:"
mongosh --quiet --eval "db.adminCommand('listDatabases').databases.filter(d => d.name.startsWith('mediatool')).forEach(d => print(d.name + ' - ' + (d.sizeOnDisk/1024/1024).toFixed(2) + ' MB'))"