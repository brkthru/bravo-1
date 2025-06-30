#!/bin/bash

# Download Raw Data from S3 and Transform Locally
# This script downloads raw PostgreSQL exports from S3 and runs local transformation

set -euo pipefail

# Configuration
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
SCRIPTS_DIR="${BASE_DIR}/scripts"

# AWS Configuration (with defaults)
AWS_PROFILE="${AWS_PROFILE:-brkthru-mediatool-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
S3_BUCKET="${S3_BUCKET:-media-tool-backups-1750593763}"
S3_PREFIX="${S3_PREFIX:-postgres-exports}"

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

	# Check AWS CLI
	if ! command -v aws &>/dev/null; then
		error "AWS CLI not found. Please install: brew install awscli"
	fi

	# Check AWS authentication
	if ! aws sts get-caller-identity --profile "${AWS_PROFILE}" &>/dev/null; then
		error "AWS authentication failed. Please run: aws sso login --sso-session brkthru-sso"
	fi

	# Check bun
	if ! command -v bun &>/dev/null; then
		error "Bun not found. Please install from https://bun.sh"
	fi

	# Check MongoDB
	if ! docker ps | grep -q bravo1_mongodb; then
		warning "MongoDB container not running. Starting it now..."
		cd "${BASE_DIR}"
		docker-compose up -d mongodb
		sleep 5
	fi

	log "Prerequisites check passed"
}

# Create directory structure
create_directories() {
	log "Creating directory structure..."
	mkdir -p "${EXPORT_BASE_DIR}/raw"
	mkdir -p "${EXPORT_BASE_DIR}/transformed"
	mkdir -p "${EXPORT_BASE_DIR}/temp"
	mkdir -p "${EXPORT_BASE_DIR}/logs"
}

# List available exports
list_available_exports() {
	info "Fetching available exports from S3..."

	local exports=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/metadata/" \
		--profile "${AWS_PROFILE}" \
		--region "${AWS_REGION}" \
		--recursive \
		2>/dev/null |
		grep -E '[0-9]{8}-[0-9]{6}\.json' |
		awk '{print $4}' |
		awk -F'/' '{print $NF}' |
		sed 's/\.json$//' |
		sort -r)

	if [[ -z ${exports} ]]; then
		error "No exports found in S3"
	fi

	echo "${exports}"
}

# Download raw export from S3
download_raw_export() {
	local timestamp=$1
	local date_part=$(echo "${timestamp}" | cut -c1-8)

	log "Downloading raw export ${timestamp} from S3..."

	# Download metadata
	aws s3 cp \
		"s3://${S3_BUCKET}/${S3_PREFIX}/metadata/${date_part:0:4}-${date_part:4:2}-${date_part:6:2}/${timestamp}.json" \
		"${EXPORT_BASE_DIR}/temp/${timestamp}-metadata.json" \
		--profile "${AWS_PROFILE}" \
		--region "${AWS_REGION}"

	# Download raw export
	log "Downloading raw data..."
	aws s3 cp \
		"s3://${S3_BUCKET}/${S3_PREFIX}/raw/${date_part:0:4}-${date_part:4:2}-${date_part:6:2}/${timestamp}-raw.tar.gz" \
		"${EXPORT_BASE_DIR}/temp/" \
		--profile "${AWS_PROFILE}" \
		--region "${AWS_REGION}"

	# Extract files
	log "Extracting files..."
	cd "${EXPORT_BASE_DIR}/raw"
	tar -xzf "${EXPORT_BASE_DIR}/temp/${timestamp}-raw.tar.gz"

	log "Raw export downloaded successfully"
}

# Transform data locally
transform_data() {
	local timestamp=$1

	log "Transforming data locally..."

	# Check if raw data exists
	if [[ ! -d "${EXPORT_BASE_DIR}/raw/${timestamp}" ]]; then
		error "Raw data not found for timestamp ${timestamp}"
	fi

	cd "${SCRIPTS_DIR}/etl"

	# Clean up any existing data directories
	rm -rf data-export
	mkdir -p data-export

	# Copy raw data
	cp -r "${EXPORT_BASE_DIR}/raw/${timestamp}"/* ./data-export/

	# Run transformation
	log "Running transformation script..."
	bun transform-postgres-data.ts

	# Move transformed data
	if [[ -d "data-transformed" ]]; then
		rm -rf "${EXPORT_BASE_DIR}/transformed/${timestamp}"
		mv data-transformed "${EXPORT_BASE_DIR}/transformed/${timestamp}"
		log "Transformation completed"
	else
		error "Transformation failed - no output directory found"
	fi
}

# Load data into MongoDB
load_into_mongodb() {
	local timestamp=$1

	log "Loading data into MongoDB..."

	# Check if transformed data exists
	if [[ ! -f "${EXPORT_BASE_DIR}/transformed/${timestamp}/campaigns.json" ]]; then
		error "Transformed data not found for timestamp ${timestamp}"
	fi

	cd "${SCRIPTS_DIR}/etl"

	# Clean up any existing data directories
	rm -rf data-transformed
	mkdir -p data-transformed

	# Copy transformed data
	cp -r "${EXPORT_BASE_DIR}/transformed/${timestamp}"/* ./data-transformed/

	# Load into MongoDB
	log "Loading into MongoDB database: bravo-1"
	export DATABASE_NAME="bravo-1"
	bun load-data.ts

	log "Data loaded successfully into MongoDB"
}

# Clean up temporary files
cleanup() {
	log "Cleaning up temporary files..."
	rm -f "${EXPORT_BASE_DIR}/temp"/*.tar.gz
	rm -f "${EXPORT_BASE_DIR}/temp"/*.json
}

# Main function
main() {
	echo -e "${BLUE}=== Download Raw Data from S3 ===${NC}"
	echo

	# Check prerequisites
	check_prerequisites

	# Create directories
	create_directories

	# List available exports
	info "Available exports:"
	exports=$(list_available_exports)

	# Show last 5 exports
	echo "${exports}" | head -5 | nl -w2 -s'. '
	echo

	# Ask user to select
	read -p "Enter the number of the export to download (1-5) or 'latest' for the most recent: " choice

	if [[ ${choice} == "latest" ]]; then
		timestamp=$(echo "${exports}" | head -1)
	else
		timestamp=$(echo "${exports}" | sed -n "${choice}p")
	fi

	if [[ -z ${timestamp} ]]; then
		error "Invalid selection"
	fi

	info "Selected export: ${timestamp}"

	# Download the raw export
	download_raw_export "${timestamp}"

	# Ask if user wants to transform the data
	if [[ ${AUTO_TRANSFORM:-false} == "true" ]]; then
		transform_choice="y"
	else
		read -p "Do you want to transform this data locally? (y/n): " transform_choice
	fi

	if [[ ${transform_choice} =~ ^[Yy]$ ]]; then
		transform_data "${timestamp}"

		# Ask if user wants to load into MongoDB
		if [[ ${AUTO_LOAD:-false} == "true" ]]; then
			load_choice="y"
		else
			read -p "Do you want to load the transformed data into MongoDB? (y/n): " load_choice
		fi

		if [[ ${load_choice} =~ ^[Yy]$ ]]; then
			load_into_mongodb "${timestamp}"
		fi
	fi

	# Cleanup
	cleanup

	log "Process completed successfully!"
	echo
	info "Export files available at:"
	info "  - Raw: ${EXPORT_BASE_DIR}/raw/${timestamp}/"

	if [[ ${transform_choice} =~ ^[Yy]$ ]]; then
		info "  - Transformed: ${EXPORT_BASE_DIR}/transformed/${timestamp}/"
	fi

	if [[ ${load_choice} =~ ^[Yy]$ ]]; then
		info "  - MongoDB: bravo-1 database"
		info ""
		info "You can now start the application:"
		info "  cd ${BASE_DIR}"
		info "  npm run dev:backend  # In one terminal"
		info "  npm run dev:frontend # In another terminal"
	fi
}

# Show help
show_help() {
	cat <<EOF
Usage: $0 [OPTIONS]

Download raw PostgreSQL data from S3 and optionally transform/load locally.

Options:
    -h, --help          Show this help message
    --profile PROFILE   AWS profile to use (default: brkthru-mediatool-dev)
    --region REGION     AWS region (default: us-east-1)
    --bucket BUCKET     S3 bucket name (default: media-tool-backups-1750593763)
    --auto-transform    Automatically transform data without prompting
    --auto-load         Automatically load to MongoDB without prompting
    --auto              Auto transform and load (same as --auto-transform --auto-load)

Examples:
    # Interactive mode - prompts for each step
    $0
    
    # Download, transform, and load automatically
    $0 --auto
    
    # Just download and transform, skip MongoDB load
    $0 --auto-transform
    
    # Use specific AWS profile
    $0 --profile brkthru-mediatool-dev

Prerequisites:
    - AWS CLI installed and configured
    - Docker running with MongoDB container
    - Bun runtime installed
    - AWS SSO login completed

Workflow:
    1. Downloads raw PostgreSQL export from S3
    2. Runs local transformation using latest code
    3. Optionally loads into MongoDB
    
This approach ensures transformations use the latest schema/logic from git.
EOF
}

# Parse command line arguments
AUTO_TRANSFORM=false
AUTO_LOAD=false

while [[ $# -gt 0 ]]; do
	case $1 in
	-h | --help)
		show_help
		exit 0
		;;
	--profile)
		AWS_PROFILE="$2"
		shift 2
		;;
	--region)
		AWS_REGION="$2"
		shift 2
		;;
	--bucket)
		S3_BUCKET="$2"
		shift 2
		;;
	--auto-transform)
		AUTO_TRANSFORM=true
		shift
		;;
	--auto-load)
		AUTO_LOAD=true
		shift
		;;
	--auto)
		AUTO_TRANSFORM=true
		AUTO_LOAD=true
		shift
		;;
	*)
		error "Unknown option: $1"
		;;
	esac
done

# Run main function
main
