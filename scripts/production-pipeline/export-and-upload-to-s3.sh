#!/bin/bash
# Export complete PostgreSQL data and upload to S3
# This includes performance metrics and all available data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
S3_BUCKET="brkthru-media-tool-exports"
S3_PREFIX="postgres-complete"
EXPORT_SCRIPT="../postgres-export/export-postgres-complete.ts"

echo -e "${BLUE}🚀 Complete PostgreSQL Export & S3 Upload${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check for bun
if ! command -v bun &>/dev/null; then
	echo -e "${RED}❌ Bun is not installed${NC}"
	echo "   Install from: https://bun.sh"
	exit 1
fi

# Check for AWS CLI
if ! command -v aws &>/dev/null; then
	echo -e "${RED}❌ AWS CLI is not installed${NC}"
	echo "   Install from: https://aws.amazon.com/cli/"
	exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
	echo -e "${RED}❌ AWS credentials not configured${NC}"
	echo "   Run: aws configure"
	exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo

# Run the export
echo -e "${BLUE}Running PostgreSQL export...${NC}"
cd ../postgres-export
bun export-postgres-complete.ts

# Find the latest export directory
LATEST_EXPORT=$(ls -t ../../exports/raw/ | head -1)
EXPORT_PATH="../../exports/raw/${LATEST_EXPORT}"

if [[ ! -d ${EXPORT_PATH} ]]; then
	echo -e "${RED}❌ Export directory not found${NC}"
	exit 1
fi

echo
echo -e "${GREEN}✓ Export completed: ${LATEST_EXPORT}${NC}"

# Create tar.gz archive
echo
echo -e "${BLUE}Creating archive...${NC}"
cd ../../exports/raw
tar -czf "${LATEST_EXPORT}.tar.gz" "${LATEST_EXPORT}"
ARCHIVE_SIZE=$(ls -lh "${LATEST_EXPORT}.tar.gz" | awk '{print $5}')
echo -e "${GREEN}✓ Archive created: ${LATEST_EXPORT}.tar.gz (${ARCHIVE_SIZE})${NC}"

# Upload to S3
echo
echo -e "${BLUE}Uploading to S3...${NC}"
S3_PATH="s3://${S3_BUCKET}/${S3_PREFIX}/${LATEST_EXPORT}.tar.gz"

aws s3 cp "${LATEST_EXPORT}.tar.gz" "${S3_PATH}" \
	--storage-class STANDARD_IA \
	--metadata "export-type=complete,includes-metrics=true,timestamp=${LATEST_EXPORT}"

if [[ $? -eq 0 ]]; then
	echo -e "${GREEN}✓ Upload successful${NC}"
	echo -e "  S3 location: ${S3_PATH}"

	# Generate presigned URL (valid for 7 days)
	PRESIGNED_URL=$(aws s3 presign "${S3_PATH}" --expires-in 604800)
	echo
	echo -e "${BLUE}Download URL (valid for 7 days):${NC}"
	echo "${PRESIGNED_URL}"

	# Save URL to file
	echo "${PRESIGNED_URL}" >"${LATEST_EXPORT}-download-url.txt"
	echo
	echo -e "${GREEN}✓ Download URL saved to: ${LATEST_EXPORT}-download-url.txt${NC}"
else
	echo -e "${RED}❌ Upload failed${NC}"
	exit 1
fi

# Cleanup local archive (optional)
echo
read -p "Delete local archive? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
	rm "${LATEST_EXPORT}.tar.gz"
	echo -e "${GREEN}✓ Local archive deleted${NC}"
fi

echo
echo -e "${GREEN}🎉 Complete export pipeline finished!${NC}"
echo -e "  Export timestamp: ${LATEST_EXPORT}"
echo -e "  S3 location: ${S3_PATH}"
echo
echo -e "${BLUE}To download and use this export:${NC}"
echo "1. Download: aws s3 cp ${S3_PATH} ."
echo "2. Extract: tar -xzf ${LATEST_EXPORT}.tar.gz"
echo "3. Run ETL: bun etl-pipeline.ts --export=${LATEST_EXPORT:0:8} --clean --verify"
