#!/bin/bash
# Quick Start ETL Script
# This script provides an interactive way to run the complete ETL workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Bravo-1 ETL Quick Start${NC}"
echo -e "${BLUE}=========================${NC}"
echo

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check for bun
if ! command -v bun &>/dev/null; then
	echo -e "${RED}❌ Bun is not installed${NC}"
	echo "   Install from: https://bun.sh"
	exit 1
fi

# Check for MongoDB
if docker exec bravo1_mongodb mongosh --eval "db.version()" &>/dev/null; then
	echo -e "${GREEN}✓ MongoDB running in Docker${NC}"
elif mongosh --eval "db.version()" &>/dev/null; then
	echo -e "${GREEN}✓ MongoDB running locally${NC}"
else
	echo -e "${RED}❌ MongoDB is not running${NC}"
	echo "   Start MongoDB first with: docker-compose up -d mongodb"
	exit 1
fi

# Check for AWS CLI
if ! command -v aws &>/dev/null; then
	echo -e "${YELLOW}⚠️  AWS CLI not installed${NC}"
	echo "   You can only use local data"
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo

# Database migration check
echo -e "${BLUE}Checking database configuration...${NC}"
if docker exec bravo1_mongodb mongosh --eval "db.getMongo().getDBNames()" | grep -q "mediatool_v2"; then
	echo -e "${YELLOW}⚠️  Found old database 'mediatool_v2'${NC}"
	read -p "Migrate to 'bravo-1'? (y/n): " -n 1 -r
	echo
	if [[ ${REPLY} =~ ^[Yy]$ ]]; then
		bun migrate-mongo-database.ts
	fi
fi

# Main menu
while true; do
	echo
	echo -e "${BLUE}What would you like to do?${NC}"
	echo "1) Run complete production ETL (PostgreSQL → MongoDB)"
	echo "2) Download latest data from S3"
	echo "3) Transform existing PostgreSQL data"
	echo "4) Detect schema changes"
	echo "5) Migrate database name (mediatool_v2 → bravo-1)"
	echo "6) Run ETL with Claude Code assistance"
	echo "7) Exit"
	echo
	read -p "Select option (1-7): " choice

	case ${choice} in
	1)
		echo -e "${BLUE}Running complete ETL workflow...${NC}"

		# Ask about database refresh
		echo
		read -p "Drop and recreate database? (y/n): " -n 1 -r
		echo
		if [[ ${REPLY} =~ ^[Yy]$ ]]; then
			echo -e "${YELLOW}Cleaning databases...${NC}"
			bun etl-pipeline.ts --clean --verify
		else
			bun etl-pipeline.ts --verify
		fi
		;;

	2)
		echo -e "${BLUE}Downloading from S3...${NC}"
		cd ../production-pipeline
		./download-from-s3.sh
		cd ../etl
		;;

	3)
		echo -e "${BLUE}Running ETL with specific export...${NC}"

		# Find available exports
		echo "Available exports:"
		ls -t ../../exports/raw/ | head -10
		echo
		read -p "Enter export date (YYYYMMDD) or press Enter for latest: " export_date

		if [[ -z ${export_date} ]]; then
			bun etl-pipeline.ts --verify
		else
			bun etl-pipeline.ts --export=${export_date} --verify
		fi
		;;

	4)
		echo -e "${BLUE}Detecting schema changes...${NC}"
		bun detect-schema-changes.ts
		;;

	5)
		echo -e "${BLUE}Migrating database name...${NC}"
		bun migrate-mongo-database.ts
		;;

	6)
		echo -e "${BLUE}Running ETL with Claude Code assistance...${NC}"
		echo -e "${YELLOW}This mode will:${NC}"
		echo "  - Ask for decisions on schema changes"
		echo "  - Provide recommendations"
		echo "  - Allow custom transformations"
		echo
		bun run-production-etl.ts --interactive
		;;

	7)
		echo -e "${GREEN}Goodbye!${NC}"
		exit 0
		;;

	*)
		echo -e "${RED}Invalid option${NC}"
		;;
	esac
done
