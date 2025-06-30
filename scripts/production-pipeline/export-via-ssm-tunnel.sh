#!/bin/bash

# Export Raw PostgreSQL Data via SSM Tunnel
# This script uses the media-tool's SSM tunnel to access production RDS

set -euo pipefail

# Configuration
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
EXPORT_DATE=$(date -u +%Y-%m-%d)
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"
MEDIA_TOOL_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/media-tool"

# AWS Configuration
AWS_PROFILE="${AWS_PROFILE:-brkthru-mediatool-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"
S3_BUCKET="media-tool-backups-1750593763"
S3_PREFIX="postgres-exports"

# Local staging database for export
LOCAL_PG_HOST="localhost"
LOCAL_PG_PORT="5432"
LOCAL_PG_DB="media_tool_export_${TIMESTAMP}"
LOCAL_PG_USER="postgres"
LOCAL_PG_PASSWORD="postgres"

# Production via tunnel
PROD_PG_HOST="localhost"
PROD_PG_PORT="5437"
PROD_PG_DB="media_tool_prod"
PROD_PG_USER="root"

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
	command -v just &>/dev/null || error "Just not found. Please install: brew install just"

	# Check AWS authentication for prod
	if ! aws sts get-caller-identity --profile "${AWS_PROFILE}" &>/dev/null; then
		error "AWS authentication failed. Please run: aws sso login --sso-session brkthru-sso"
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

# Get RDS password from AWS Secrets Manager
get_rds_password() {
	log "Retrieving RDS password from AWS Secrets Manager..."

	# List secrets and find the RDS one
	RDS_SECRET_NAME=$(aws secretsmanager list-secrets --profile "${AWS_PROFILE}" --region "${AWS_REGION}" | jq -r '.SecretList[].Name' | grep '^rds')

	if [[ -z ${RDS_SECRET_NAME} ]]; then
		error "Could not find RDS secret in Secrets Manager"
	fi

	# Get the password
	PROD_PG_PASSWORD=$(aws secretsmanager get-secret-value \
		--secret-id "${RDS_SECRET_NAME}" \
		--profile "${AWS_PROFILE}" \
		--region "${AWS_REGION}" |
		jq -r '.SecretString' | jq -r '.password')

	log "Password retrieved successfully"
}

# Check if SSM tunnel is running
check_tunnel() {
	log "Checking SSM tunnel..."

	if ! nc -z localhost 5437 2>/dev/null; then
		error "SSM tunnel not running on port 5437. Please run: cd ${MEDIA_TOOL_DIR}/terraform && just ssm-db-tunnel prod"
	fi

	log "SSM tunnel is active"
}

# Step 1: Create PostgreSQL dump via tunnel
create_pg_dump() {
	log "Creating PostgreSQL dump from production database via SSM tunnel..."
	local dump_file="${EXPORT_BASE_DIR}/temp/prod_dump_${TIMESTAMP}.sql"

	info "Connecting via localhost:5437 (SSM tunnel)"

	PGPASSWORD="${PROD_PG_PASSWORD}" pg_dump \
		-h "${PROD_PG_HOST}" \
		-p "${PROD_PG_PORT}" \
		-U "${PROD_PG_USER}" \
		-d "${PROD_PG_DB}" \
		-f "${dump_file}" \
		--verbose \
		--no-owner \
		--no-acl \
		--exclude-table-data=media_tool.media_platform_entities_history \
		--exclude-table-data=media_tool.platform_buy_daily_impressions \
		--exclude-table-data=media_tool.platform_buy_daily_videos ||
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
		-q \
		<"${dump_file}" ||
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
  "source_host": "production RDS via SSM tunnel",
  "export_type": "raw_postgres_json",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

	# Compress raw export
	cd "${EXPORT_BASE_DIR}/raw"
	log "Compressing export..."
	tar -czf "${TIMESTAMP}-raw.tar.gz" "${TIMESTAMP}/" || error "Failed to compress export"

	# Upload to S3 using brkthru-mediatool-dev profile (has access to S3 bucket)
	log "Uploading to S3..."

	# Upload compressed data
	aws s3 cp \
		"${TIMESTAMP}-raw.tar.gz" \
		"s3://${S3_BUCKET}/${S3_PREFIX}/raw/${EXPORT_DATE}/${TIMESTAMP}-raw.tar.gz" \
		--profile brkthru-mediatool-dev \
		--region "${AWS_REGION}" ||
		error "Failed to upload to S3"

	# Upload metadata separately for easy listing
	aws s3 cp \
		"${TIMESTAMP}/metadata.json" \
		"s3://${S3_BUCKET}/${S3_PREFIX}/metadata/${EXPORT_DATE}/${TIMESTAMP}.json" \
		--profile brkthru-mediatool-dev \
		--region "${AWS_REGION}" ||
		error "Failed to upload metadata"

	log "Upload completed successfully"
}

# Step 5: Clean up old exports from S3
cleanup_old_exports() {
	log "Checking for old exports to clean up..."

	# List all exports, keep only the latest 3
	local exports=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/metadata/" \
		--profile brkthru-mediatool-dev \
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
				--profile brkthru-mediatool-dev \
				--region "${AWS_REGION}"

			# Delete raw data
			aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/raw/${old_date}/${old_timestamp}-raw.tar.gz" \
				--profile brkthru-mediatool-dev \
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
	echo -e "${BLUE}=== PostgreSQL Export via SSM Tunnel ===${NC}"
	echo
	info "Timestamp: ${TIMESTAMP}"
	info "S3 Bucket: ${S3_BUCKET}"
	echo

	# Check prerequisites
	check_prerequisites

	# Create directories
	create_directories

	# Check tunnel
	check_tunnel

	# Get RDS password
	get_rds_password

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
	info "Next steps:"
	info "  1. Download and transform: ./download-raw-from-s3.sh --auto"
	info "  2. Close SSM tunnel when done"
}

# Run main function
main
