#!/bin/bash

# Export Raw PostgreSQL Data to S3
# This script creates a fresh PostgreSQL export from production and uploads only raw data to S3
# Developers can then download and transform locally with latest code

set -euo pipefail

# Configuration
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
EXPORT_DATE=$(date -u +%Y-%m-%d)
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"

# Source configuration if available
if [[ -f "${SCRIPTS_DIR}/production-pipeline/config/pipeline.env" ]]; then
	source "${SCRIPTS_DIR}/production-pipeline/config/pipeline.env"
fi

# Database Configuration - Production
PROD_PG_HOST="${PROD_PG_HOST-}"
PROD_PG_PORT="${PROD_PG_PORT:-5432}"
PROD_PG_DB="${PROD_PG_DB:-media_tool}"
PROD_PG_USER="${PROD_PG_USER-}"
PROD_PG_PASSWORD="${PROD_PG_PASSWORD-}"

# Local staging database for export
LOCAL_PG_HOST="${LOCAL_PG_HOST:-localhost}"
LOCAL_PG_PORT="${LOCAL_PG_PORT:-5432}"
LOCAL_PG_DB="media_tool_export_${TIMESTAMP}"
LOCAL_PG_USER="${LOCAL_PG_USER:-postgres}"
LOCAL_PG_PASSWORD="${LOCAL_PG_PASSWORD:-postgres}"

# AWS S3 Configuration
AWS_PROFILE="${AWS_PROFILE:-brkthru-mediatool-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
S3_BUCKET="${S3_BUCKET:-media-tool-backups-1750593763}"
S3_PREFIX="postgres-exports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
log() {
	echo -e "${GREEN}[$(date -u +'%Y-%m-%d %H:%M:%S UTC')]${NC} $1"
}

error() {
	echo -e "${RED}[ERROR]${NC} $1" >&2
	exit 1
}

warning() {
	echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
	echo -e "${BLUE}[INFO]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
	log "Checking prerequisites..."

	# Check required tools
	command -v pg_dump &>/dev/null || error "pg_dump not found. Please install PostgreSQL client tools"
	command -v aws &>/dev/null || error "AWS CLI not found. Please install: brew install awscli"
	command -v bun &>/dev/null || error "Bun not found. Please install from https://bun.sh"

	# Check AWS authentication
	if ! aws sts get-caller-identity --profile "${AWS_PROFILE}" &>/dev/null; then
		error "AWS authentication failed. Please run: aws sso login --sso-session brkthru-sso"
	fi

	# Check production database credentials
	if [[ -z ${PROD_PG_HOST} || -z ${PROD_PG_USER} || -z ${PROD_PG_PASSWORD} ]]; then
		error "Production database credentials not configured. Please set PROD_PG_HOST, PROD_PG_USER, and PROD_PG_PASSWORD"
	fi

	log "Prerequisites check passed"
}

# Create directory structure
create_directories() {
	log "Creating directory structure..."
	mkdir -p "${EXPORT_BASE_DIR}/raw"
	mkdir -p "${EXPORT_BASE_DIR}/temp"
	mkdir -p "${EXPORT_BASE_DIR}/logs"
}

# Step 1: Create PostgreSQL dump from production
create_pg_dump() {
	log "Creating PostgreSQL dump from production database..."
	local dump_file="${EXPORT_BASE_DIR}/temp/prod_dump_${TIMESTAMP}.sql"

	info "Connecting to ${PROD_PG_HOST}:${PROD_PG_PORT}/${PROD_PG_DB}"

	PGPASSWORD="${PROD_PG_PASSWORD}" pg_dump \
		-h "${PROD_PG_HOST}" \
		-p "${PROD_PG_PORT}" \
		-U "${PROD_PG_USER}" \
		-d "${PROD_PG_DB}" \
		-f "${dump_file}" \
		--verbose \
		--no-owner \
		--no-acl ||
		error "Failed to create database dump"

	log "Database dumped to ${dump_file}"
	echo "${dump_file}"
}

# Step 2: Restore to local for JSON export
restore_to_local() {
	local dump_file=$1
	log "Creating local staging database ${LOCAL_PG_DB}..."

	# Drop database if exists
	PGPASSWORD="${LOCAL_PG_PASSWORD}" dropdb \
		-h "${LOCAL_PG_HOST}" \
		-p "${LOCAL_PG_PORT}" \
		-U "${LOCAL_PG_USER}" \
		--if-exists \
		"${LOCAL_PG_DB}" 2>/dev/null || true

	# Create new database
	PGPASSWORD="${LOCAL_PG_PASSWORD}" createdb \
		-h "${LOCAL_PG_HOST}" \
		-p "${LOCAL_PG_PORT}" \
		-U "${LOCAL_PG_USER}" \
		"${LOCAL_PG_DB}" ||
		error "Failed to create local database"

	log "Restoring dump to local database..."
	PGPASSWORD="${LOCAL_PG_PASSWORD}" psql \
		-h "${LOCAL_PG_HOST}" \
		-p "${LOCAL_PG_PORT}" \
		-U "${LOCAL_PG_USER}" \
		-d "${LOCAL_PG_DB}" \
		-f "${dump_file}" \
		-q ||
		error "Failed to restore database"

	log "Database restored successfully"
}

# Step 3: Export to JSON format
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
	bun run export-postgres-raw.ts || error "Failed to export to JSON"

	# Move the export to timestamped directory
	if [[ -d "postgres-raw-export" ]]; then
		mv postgres-raw-export "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"
		log "JSON export completed to ${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"
	else
		error "Export directory not found"
	fi
}

# Step 4: Upload to S3
upload_to_s3() {
	log "Preparing raw export for S3 upload..."

	# Create metadata file
	cat >"${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/metadata.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "export_date": "${EXPORT_DATE}",
  "source_database": "${PROD_PG_DB}",
  "source_host": "${PROD_PG_HOST}",
  "export_type": "raw_postgres_json",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

	# Compress raw export
	cd "${EXPORT_BASE_DIR}/raw"
	log "Compressing export..."
	tar -czf "${TIMESTAMP}-raw.tar.gz" "${TIMESTAMP}/" || error "Failed to compress export"

	# Upload to S3
	log "Uploading to S3..."

	# Upload compressed data
	aws s3 cp \
		"${TIMESTAMP}-raw.tar.gz" \
		"s3://${S3_BUCKET}/${S3_PREFIX}/raw/${EXPORT_DATE}/${TIMESTAMP}-raw.tar.gz" \
		--profile "${AWS_PROFILE}" \
		--region "${AWS_REGION}" ||
		error "Failed to upload to S3"

	# Upload metadata separately for easy listing
	aws s3 cp \
		"${TIMESTAMP}/metadata.json" \
		"s3://${S3_BUCKET}/${S3_PREFIX}/metadata/${EXPORT_DATE}/${TIMESTAMP}.json" \
		--profile "${AWS_PROFILE}" \
		--region "${AWS_REGION}" ||
		error "Failed to upload metadata"

	log "Upload completed successfully"
}

# Step 5: Clean up old exports from S3
cleanup_old_exports() {
	log "Checking for old exports to clean up..."

	# List all exports, keep only the latest 3
	local exports=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/metadata/" \
		--profile "${AWS_PROFILE}" \
		--region "${AWS_REGION}" \
		--recursive |
		grep -E '[0-9]{8}-[0-9]{6}\.json' |
		sort -r |
		awk '{print $4}')

	local count=0
	while IFS= read -r metadata_file; do
		count=$((count + 1))
		if [[ ${count} -gt 3 ]]; then
			# Extract date and timestamp from metadata path
			local old_date=$(echo "${metadata_file}" | awk -F'/' '{print $(NF-1)}')
			local old_timestamp=$(basename "${metadata_file}" .json)

			warning "Deleting old export: ${old_timestamp}"

			# Delete metadata
			aws s3 rm "s3://${S3_BUCKET}/${metadata_file}" \
				--profile "${AWS_PROFILE}" \
				--region "${AWS_REGION}"

			# Delete raw data
			aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/raw/${old_date}/${old_timestamp}-raw.tar.gz" \
				--profile "${AWS_PROFILE}" \
				--region "${AWS_REGION}"
		fi
	done <<<"${exports}"

	log "Cleanup completed"
}

# Step 6: Cleanup local files
cleanup_local() {
	log "Cleaning up local files..."

	# Drop temporary database
	PGPASSWORD="${LOCAL_PG_PASSWORD}" dropdb \
		-h "${LOCAL_PG_HOST}" \
		-p "${LOCAL_PG_PORT}" \
		-U "${LOCAL_PG_USER}" \
		--if-exists \
		"${LOCAL_PG_DB}" 2>/dev/null || true

	# Remove temporary files
	rm -f "${EXPORT_BASE_DIR}/temp/prod_dump_${TIMESTAMP}.sql"
	rm -f "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}-raw.tar.gz"

	log "Local cleanup completed"
}

# Main function
main() {
	echo -e "${BLUE}=== PostgreSQL Raw Export to S3 ===${NC}"
	echo
	info "Timestamp: ${TIMESTAMP}"
	info "S3 Bucket: ${S3_BUCKET}"
	echo

	# Check prerequisites
	check_prerequisites

	# Create directories
	create_directories

	# Step 1: Create PostgreSQL dump
	dump_file=$(create_pg_dump)

	# Step 2: Restore to local
	restore_to_local "${dump_file}"

	# Step 3: Export to JSON
	export_to_json

	# Step 4: Upload to S3
	upload_to_s3

	# Step 5: Clean up old exports
	cleanup_old_exports

	# Step 6: Local cleanup
	cleanup_local

	echo
	log "Export pipeline completed successfully!"
	info "Raw export available at:"
	info "  S3: s3://${S3_BUCKET}/${S3_PREFIX}/raw/${EXPORT_DATE}/${TIMESTAMP}-raw.tar.gz"
	info "  Local: ${EXPORT_BASE_DIR}/raw/${TIMESTAMP}/"
	echo
	info "Developers can download and transform using:"
	info "  ./download-from-s3.sh --profile ${AWS_PROFILE}"
	info "  cd scripts/etl && bun transform-postgres-data.ts"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
	case $1 in
	-h | --help)
		cat <<EOF
Usage: $0 [OPTIONS]

Export raw PostgreSQL data from production to S3.

Options:
    -h, --help          Show this help message
    --skip-cleanup      Don't delete old exports from S3
    --keep-local        Don't clean up local files after upload

Environment Variables:
    PROD_PG_HOST        Production database host (required)
    PROD_PG_PORT        Production database port (default: 5432)
    PROD_PG_DB          Production database name (default: media_tool)
    PROD_PG_USER        Production database user (required)
    PROD_PG_PASSWORD    Production database password (required)
    
    AWS_PROFILE         AWS profile to use (default: brkthru-mediatool-dev)
    S3_BUCKET          S3 bucket name (default: media-tool-backups-1750593763)

Example:
    export PROD_PG_HOST=your-rds-instance.amazonaws.com
    export PROD_PG_USER=your-username
    export PROD_PG_PASSWORD=your-password
    $0
EOF
		exit 0
		;;
	--skip-cleanup)
		SKIP_CLEANUP=true
		shift
		;;
	--keep-local)
		KEEP_LOCAL=true
		shift
		;;
	*)
		error "Unknown option: $1"
		;;
	esac
done

# Run main function
main
