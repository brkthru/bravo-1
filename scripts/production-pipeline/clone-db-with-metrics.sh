#!/bin/bash
# Clone PostgreSQL database INCLUDING performance metrics tables
# This is a modified version that includes daily impressions and videos

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Database Clone with Performance Metrics${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-media_tool}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DUMP_DIR="${DUMP_DIR:-/tmp/bravo-dump-complete}"

# Create dump directory
mkdir -p "$DUMP_DIR"

echo -e "${BLUE}Dumping database WITH performance metrics...${NC}"

# Dump ALL tables including performance metrics
PGPASSWORD="$DB_PASSWORD" pg_dump \
	-h "$DB_HOST" \
	-p "$DB_PORT" \
	-U "$DB_USER" \
	-d "$DB_NAME" \
	-Z gzip:1 \
	-v \
	-j 10 \
	-F d \
	-f "$DUMP_DIR" \
	--no-tablespaces \
	--no-privileges \
	--no-owner

echo -e "${GREEN}✅ Database dumped successfully${NC}"
echo -e "  Location: $DUMP_DIR"
echo

# Check if performance tables were included
echo -e "${BLUE}Checking for performance tables...${NC}"
tar -tzf "$DUMP_DIR/toc.dat.gz" 2>/dev/null | grep -E "(daily_impressions|daily_videos)" || echo "  ⚠️  Performance tables might be empty"

echo
echo -e "${BLUE}Next steps:${NC}"
echo "1. Load the dump: pg_restore -d media_tool -F d -j 10 -v $DUMP_DIR"
echo "2. Export to JSON: bun export-postgres-complete.ts"
echo "3. Run ETL: bun etl-pipeline.ts --clean --verify"
