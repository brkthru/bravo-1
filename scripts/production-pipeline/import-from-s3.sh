#!/bin/bash

# Import PostgreSQL export from S3 and run full ETL pipeline to MongoDB
# This script downloads from S3 (or uses local file) and populates MongoDB

set -euo pipefail

# Configuration
# Get the script's directory and derive BASE_DIR from it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"
ETL_DIR="${SCRIPTS_DIR}/etl"

# AWS configuration
AWS_PROFILE="${AWS_PROFILE:-brkthru-mediatool-dev}"
S3_BUCKET="${S3_BUCKET:-media-tool-backups-1750593763}"
S3_PREFIX="${S3_PREFIX:-postgres-complete-exports}"

# MongoDB configuration
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/bravo-1}"
MONGO_CONTAINER="${MONGO_CONTAINER:-bravo1_mongodb}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Parse arguments
LOCAL_FILE=""
S3_URL=""
SKIP_DOWNLOAD=false
FORCE_CLEAN=false

while [[ $# -gt 0 ]]; do
	case $1 in
	--local-file)
		LOCAL_FILE="$2"
		SKIP_DOWNLOAD=true
		shift 2
		;;
	--s3-url)
		S3_URL="$2"
		shift 2
		;;
	--latest)
		# Get latest export from S3
		LATEST_S3=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --profile "${AWS_PROFILE}" | grep "\.tar\.gz" | sort | tail -1 | awk '{print $4}')
		if [[ -z ${LATEST_S3} ]]; then
			error "No exports found in S3!"
		fi
		S3_URL="s3://${S3_BUCKET}/${S3_PREFIX}/${LATEST_S3}"
		shift
		;;
	--force)
		FORCE_CLEAN=true
		shift
		;;
	*)
		echo "Usage: $0 [--local-file <file>] [--s3-url <url>] [--latest] [--force]"
		echo "  --force: Skip confirmation prompts and clean existing data"
		exit 1
		;;
	esac
done

echo -e "${BLUE}PostgreSQL Import & ETL Pipeline${NC}"
echo "================================"

# Ensure MongoDB is running
if ! docker ps | grep -q "${MONGO_CONTAINER}"; then
	log "Starting MongoDB container..."
	cd "${BASE_DIR}"
	docker-compose up -d mongodb
	sleep 5
fi

# Check for existing data
log "Checking for existing data..."
DB_EXISTS=$(docker exec "${MONGO_CONTAINER}" mongosh bravo-1 --quiet --eval "db.getName()" 2>/dev/null || echo "")
if [[ ${DB_EXISTS} == "bravo-1" ]]; then
	CAMPAIGN_COUNT=$(docker exec "${MONGO_CONTAINER}" mongosh bravo-1 --quiet --eval "db.campaigns.countDocuments()" 2>/dev/null || echo "0")
	if [[ ${CAMPAIGN_COUNT} -gt 0 ]]; then
		echo
		echo -e "${YELLOW}⚠️  WARNING: Existing data detected!${NC}"
		echo "   Database 'bravo-1' contains ${CAMPAIGN_COUNT} campaigns"
		echo

		if [[ ${FORCE_CLEAN} == true ]]; then
			log "Force flag detected - cleaning existing data..."
		else
			read -p "Do you want to DELETE all existing data and start fresh? (y/N) " -n 1 -r
			echo
			if [[ ! ${REPLY} =~ ^[Yy]$ ]]; then
				echo "Import cancelled. To force cleanup, use --force flag"
				exit 0
			fi
		fi

		# Drop the database
		log "Dropping existing bravo-1 database..."
		docker exec "${MONGO_CONTAINER}" mongosh bravo-1 --quiet --eval "db.dropDatabase()"
		log "Database cleaned"
	fi
fi

# Download from S3 if needed
if [[ ${SKIP_DOWNLOAD} == false ]]; then
	if [[ -z ${S3_URL} ]]; then
		error "No S3 URL specified! Use --s3-url or --latest"
	fi

	ARCHIVE_NAME=$(basename "${S3_URL}")
	LOCAL_FILE="${EXPORT_BASE_DIR}/downloads/${ARCHIVE_NAME}"

	mkdir -p "${EXPORT_BASE_DIR}/downloads"

	log "Downloading from S3: ${S3_URL}"
	if ! aws s3 cp "${S3_URL}" "${LOCAL_FILE}" --profile "${AWS_PROFILE}"; then
		error "Failed to download from S3! Make sure you're logged in: aws sso login --profile ${AWS_PROFILE}"
	fi
fi

# Verify local file exists
if [[ ! -f ${LOCAL_FILE} ]]; then
	error "Local file not found: ${LOCAL_FILE}"
fi

log "Using archive: ${LOCAL_FILE}"

# Extract archive
EXTRACT_DIR="${EXPORT_BASE_DIR}/raw"
cd "${EXTRACT_DIR}"

log "Extracting archive..."
tar -xzf "${LOCAL_FILE}"

# Find the extracted directory
EXPORT_DIR=$(tar -tzf "${LOCAL_FILE}" | head -1 | cut -d'/' -f1)
FULL_EXPORT_PATH="${EXTRACT_DIR}/${EXPORT_DIR}"

if [[ ! -d ${FULL_EXPORT_PATH} ]]; then
	error "Extracted directory not found: ${FULL_EXPORT_PATH}"
fi

log "Extracted to: ${FULL_EXPORT_PATH}"

# Show what we have
log "Export contents:"
# shellcheck disable=SC2010
find "${FULL_EXPORT_PATH}" -name "*.json" -o -name "*.txt" | head -10

# Run the ETL pipeline
cd "${ETL_DIR}"

# Check if dependencies are installed
if [[ ! -d "node_modules" ]]; then
	log "Installing ETL dependencies..."
	bun install
fi

# Backup current MongoDB data (if any)
log "Backing up current MongoDB data..."
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
docker exec "${MONGO_CONTAINER}" mongodump --db bravo-1 --out "/data/backups/${BACKUP_NAME}" 2>/dev/null || true

# Run the full ETL pipeline
log "Starting ETL pipeline..."
log "This will:"
log "  1. Transform PostgreSQL data to MongoDB format"
log "  2. Validate against schemas"
log "  3. Load into MongoDB (with --clean to remove existing data)"

# Always use --clean to ensure fresh data
if ! bun run-full-etl-pipeline.ts --source="${FULL_EXPORT_PATH}" --clean --drop-before-import; then
	error "ETL pipeline failed!"
fi

# Verify MongoDB data
log "Verifying MongoDB data..."
CAMPAIGN_COUNT=$(docker exec "${MONGO_CONTAINER}" mongosh bravo-1 --quiet --eval "db.campaigns.countDocuments()")
STRATEGY_COUNT=$(docker exec "${MONGO_CONTAINER}" mongosh bravo-1 --quiet --eval "db.strategies.countDocuments()")
LINEITEM_COUNT=$(docker exec "${MONGO_CONTAINER}" mongosh bravo-1 --quiet --eval "db.lineItems.countDocuments()")

echo
echo -e "${GREEN}✅ Import Complete!${NC}"
echo
echo "MongoDB Collections:"
echo "-------------------"
echo "  Campaigns:  ${CAMPAIGN_COUNT}"
echo "  Strategies: ${STRATEGY_COUNT}"
echo "  LineItems:  ${LINEITEM_COUNT}"
echo
echo "Next steps:"
echo "1. Start the backend:  cd ${BASE_DIR} && npm run dev:api"
echo "2. Start the frontend: cd ${BASE_DIR} && npm run dev:frontend"
echo "3. Open browser to:    http://localhost:5174"

# Create success marker
SUCCESS_FILE="${EXPORT_BASE_DIR}/last-import-success.txt"
# shellcheck disable=SC2312
cat >"${SUCCESS_FILE}" <<EOF
Import Date: $(date -u)
Source: ${LOCAL_FILE}
Export Dir: ${FULL_EXPORT_PATH}
Campaigns: ${CAMPAIGN_COUNT}
Strategies: ${STRATEGY_COUNT}
LineItems: ${LINEITEM_COUNT}
EOF

log "Success marker saved to: ${SUCCESS_FILE}"
