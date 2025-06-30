#!/bin/bash
# Export complete PostgreSQL data (local only)
# This includes all available data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Complete PostgreSQL Export (Local)${NC}"
echo -e "${BLUE}=====================================${NC}"
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
echo -e "${GREEN}✅ Export completed successfully!${NC}"
echo -e "  📁 Location: ${EXPORT_PATH}"

# Show summary
echo
echo -e "${BLUE}Export Summary:${NC}"
ls -lh "${EXPORT_PATH}" | tail -n +2 | head -10
echo "..."
echo
TOTAL_SIZE=$(du -sh "${EXPORT_PATH}" | cut -f1)
TOTAL_FILES=$(ls -1 "${EXPORT_PATH}" | wc -l)
echo -e "  Total files: ${TOTAL_FILES}"
echo -e "  Total size: ${TOTAL_SIZE}"

# Check for performance data
if [[ -f "${EXPORT_PATH}/platform_buy_daily_impressions.json" ]]; then
	IMP_COUNT=$(grep -c "media_buy_id" "${EXPORT_PATH}/platform_buy_daily_impressions.json" || echo "0")
	echo -e "  ${GREEN}✅ Daily impressions: ${IMP_COUNT} records${NC}"
else
	echo -e "  ${YELLOW}⚠️  No daily impressions data${NC}"
fi

if [[ -f "${EXPORT_PATH}/platform_buy_daily_videos.json" ]]; then
	VID_COUNT=$(grep -c "media_buy_id" "${EXPORT_PATH}/platform_buy_daily_videos.json" || echo "0")
	echo -e "  ${GREEN}✅ Daily videos: ${VID_COUNT} records${NC}"
else
	echo -e "  ${YELLOW}⚠️  No daily videos data${NC}"
fi

echo
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run ETL with this export:"
echo "   cd ../etl"
echo "   bun etl-pipeline.ts --export=${LATEST_EXPORT:0:8} --clean --verify"
echo
echo "2. Or use latest export (default):"
echo "   bun etl-pipeline.ts --clean --verify"
