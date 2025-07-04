#!/bin/bash

# Export PostgreSQL database to JSON and upload to S3
# This script exports the complete media_tool database including all history tables

set -euo pipefail

# Configuration
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
# Get the script's directory and derive BASE_DIR from it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"

# PostgreSQL configuration (Docker)
DOCKER_CONTAINER="${DOCKER_CONTAINER:-media-tool-postgres-1}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"
PG_DATABASE="${PG_DATABASE:-media_tool}"

# AWS configuration
AWS_PROFILE="${AWS_PROFILE:-brkthru-mediatool-dev}"
S3_BUCKET="${S3_BUCKET:-media-tool-backups-1750593763}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() {
	# shellcheck disable=SC2312
	echo -e "${GREEN}[$(date -u +'%Y-%m-%d %H:%M:%S UTC')]${NC} $1"
}

error() {
	echo -e "${RED}[ERROR]${NC} $1" >&2
	exit 1
}

# Validate Docker container is running
echo -e "${BLUE}PostgreSQL to S3 Export${NC}"
echo "======================="

if ! docker ps | grep -q "${DOCKER_CONTAINER}"; then
	error "Docker container ${DOCKER_CONTAINER} is not running!"
fi

# Verify database exists
DB_EXISTS=$(docker exec "${DOCKER_CONTAINER}" psql -U "${PG_USER}" -t -c "SELECT 1 FROM pg_database WHERE datname = '${PG_DATABASE}';" | tr -d ' ')
if [[ ${DB_EXISTS} != "1" ]]; then
	error "Database ${PG_DATABASE} does not exist!"
fi

# Show database stats
log "Database: ${PG_DATABASE}"
TOTAL_SIZE=$(docker exec "${DOCKER_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DATABASE}" -t -c "SELECT pg_size_pretty(pg_database_size('${PG_DATABASE}'));" | tr -d ' ')
log "Database size: ${TOTAL_SIZE}"

# Export to JSON
log "Starting JSON export..."
cd "${SCRIPTS_DIR}/postgres-export"

export PG_HOST PG_PORT PG_DATABASE PG_USER PG_PASSWORD

if ! bun export-postgres-complete.ts; then
	error "Export failed!"
fi

# Find the export directory
# shellcheck disable=SC2012
LATEST_EXPORT=$(ls -t "${EXPORT_BASE_DIR}/raw" | head -1)
EXPORT_DIR="${EXPORT_BASE_DIR}/raw/${LATEST_EXPORT}"

if [[ ! -d ${EXPORT_DIR} ]]; then
	error "Export directory not found: ${EXPORT_DIR}"
fi

# Count records in key files
log "Export summary:"
echo "---------------"
for table in campaigns strategies line_items media_buys accounts users teams; do
	if [[ -f "${EXPORT_DIR}/${table}.json" ]]; then
		COUNT=$(wc -l <"${EXPORT_DIR}/${table}.json" 2>/dev/null || echo "0")
		printf "  %-30s %10s records\n" "${table}:" "${COUNT}"
	fi
done

# Create metadata
TOTAL_FILES=$(find "${EXPORT_DIR}" -name "*.json" | wc -l)
TOTAL_SIZE=$(du -sh "${EXPORT_DIR}" | cut -f1)

# shellcheck disable=SC2312
cat >"${EXPORT_DIR}/export-metadata.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "export_type": "complete-postgres-export",
  "database": "${PG_DATABASE}",
  "docker_container": "${DOCKER_CONTAINER}",
  "total_files": ${TOTAL_FILES},
  "total_size": "${TOTAL_SIZE}",
  "export_date": "$(date -u +%Y-%m-%d 2>/dev/null || echo 'unknown')",
  "export_time": "$(date -u +%H:%M:%S 2>/dev/null || echo 'unknown')"
}
EOF

# Create archive
cd "${EXPORT_BASE_DIR}/raw"
ARCHIVE_NAME="${LATEST_EXPORT}.tar.gz"
log "Creating archive: ${ARCHIVE_NAME}"
tar -czf "${ARCHIVE_NAME}" "${LATEST_EXPORT}"
# shellcheck disable=SC2012
ARCHIVE_SIZE=$(ls -lh "${ARCHIVE_NAME}" | awk '{print $5}')
log "Archive size: ${ARCHIVE_SIZE}"

# Upload to S3
log "Uploading to S3..."
S3_PATH="s3://${S3_BUCKET}/postgres-exports/${ARCHIVE_NAME}"

# shellcheck disable=SC2312
if ! aws s3 cp "${ARCHIVE_NAME}" "${S3_PATH}" \
	--profile "${AWS_PROFILE}" \
	--storage-class STANDARD_IA \
	--metadata "export-type=postgres-complete,export-date=${TIMESTAMP}"; then
	error "S3 upload failed! Make sure you're logged in: aws sso login --profile ${AWS_PROFILE}"
fi

# Generate presigned URL
log "Generating download URL..."
PRESIGNED_URL=$(aws s3 presign "${S3_PATH}" --expires-in 604800 --profile "${AWS_PROFILE}")

# Create summary file
SUMMARY_FILE="${EXPORT_BASE_DIR}/export-summary-${TIMESTAMP}.txt"
cat >"${SUMMARY_FILE}" <<EOF
POSTGRESQL EXPORT COMPLETE
==========================
Date: ${TIMESTAMP}
Database: ${PG_DATABASE}
Archive: ${ARCHIVE_NAME}
Size: ${ARCHIVE_SIZE}

S3 Location: ${S3_PATH}

Download URL (valid for 7 days):
${PRESIGNED_URL}

To use this export:
1. Download: wget -O ${ARCHIVE_NAME} "${PRESIGNED_URL}"
2. Extract: tar -xzf ${ARCHIVE_NAME}
3. Run ETL: ./scripts/production-pipeline/import-from-s3.sh --local-file ${ARCHIVE_NAME}
EOF

# Display summary
echo
echo -e "${GREEN}✅ Export Complete!${NC}"
echo
echo "Archive: ${ARCHIVE_NAME} (${ARCHIVE_SIZE})"
echo "S3 Path: ${S3_PATH}"
echo
echo -e "${BLUE}Download URL (valid 7 days):${NC}"
echo "${PRESIGNED_URL}"
echo
echo "Summary saved to: ${SUMMARY_FILE}"

# Clean up local archive if desired
read -p "Delete local archive? (y/N) " -n 1 -r
echo
if [[ ${REPLY} =~ ^[Yy]$ ]]; then
	rm -f "${ARCHIVE_NAME}"
	log "Local archive deleted"
fi
