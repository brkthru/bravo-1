#!/bin/bash

# Test script for new user setup
# This simulates what a new user would do

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Testing New User Setup ===${NC}"
echo

# Step 1: Clean MongoDB
echo -e "${GREEN}Step 1: Cleaning MongoDB...${NC}"
docker exec bravo1_mongodb mongosh mediatool_v2 --quiet --eval "db.dropDatabase()" || true
echo "MongoDB cleaned"

# Step 2: Clean local exports
echo -e "${GREEN}Step 2: Cleaning local exports...${NC}"
cd /Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1
rm -rf exports/raw/* exports/transformed/* exports/temp/*
echo "Local exports cleaned"

# Step 3: Source configuration
echo -e "${GREEN}Step 3: Loading configuration...${NC}"
cd scripts/production-pipeline
source config/pipeline.env
echo "AWS Profile: ${AWS_PROFILE}"
echo "S3 Bucket: ${S3_BUCKET}"

# Step 4: Download from S3
echo -e "${GREEN}Step 4: Downloading from S3...${NC}"
cd ../../exports

# Download raw export
echo "Downloading raw export..."
mkdir -p raw/20250622-072326
aws s3 cp \
    s3://${S3_BUCKET}/${S3_PREFIX}/raw/2025-06-22/20250622-072326-raw.tar.gz \
    temp/ \
    --profile "${AWS_PROFILE}"

# Extract
cd raw
tar -xzf ../temp/20250622-072326-raw.tar.gz
cd ..

# Download transformed export
echo "Downloading transformed export..."
mkdir -p transformed/20250622-072326
aws s3 cp \
    s3://${S3_BUCKET}/${S3_PREFIX}/transformed/2025-06-22/20250622-072326-transformed.tar.gz \
    temp/ \
    --profile "${AWS_PROFILE}"

# Extract
cd transformed
tar -xzf ../temp/20250622-072326-transformed.tar.gz
cd ..

echo -e "${GREEN}Downloads complete!${NC}"

# Step 5: Load into MongoDB
echo -e "${GREEN}Step 5: Loading into MongoDB...${NC}"
cd ../scripts/etl

# Clean up any existing data
rm -rf data-transformed
mkdir -p data-transformed

# Copy transformed data
cp -r ../../exports/transformed/20250622-072326/* ./data-transformed/

# Load data
export DATABASE_NAME=mediatool_v2
bun run load-data.ts

# Step 6: Verify
echo -e "${GREEN}Step 6: Verifying data...${NC}"
CAMPAIGN_COUNT=$(docker exec bravo1_mongodb mongosh mediatool_v2 --quiet --eval "db.campaigns.countDocuments()")
echo "Campaigns loaded: ${CAMPAIGN_COUNT}"

if [[ "$CAMPAIGN_COUNT" == "13417" ]]; then
    echo -e "${GREEN}✅ Success! Data loaded correctly.${NC}"
else
    echo -e "${RED}❌ Error: Expected 13,417 campaigns but got ${CAMPAIGN_COUNT}${NC}"
fi

echo
echo -e "${BLUE}=== Setup Complete ===${NC}"
echo
echo "You can now start the application:"
echo "  cd /Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
echo "  npm run dev:backend  # In one terminal"
echo "  npm run dev:frontend # In another terminal"