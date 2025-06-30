#!/bin/bash

# E2E Test Data Setup Script
# Loads a specific timestamped export for consistent E2E tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."
DATA_TIMESTAMP="20250622-072326"
DATA_PATH="$PROJECT_ROOT/exports/raw/$DATA_TIMESTAMP"

echo "🧪 Setting up E2E test data..."
echo "📦 Using timestamped data: $DATA_TIMESTAMP"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
	echo "❌ Docker is not running. Please start Docker first."
	exit 1
fi

# Check if MongoDB container is running
if ! docker ps | grep -q bravo1_mongodb; then
	echo "🚀 Starting MongoDB container..."
	cd "$PROJECT_ROOT"
	docker-compose up -d mongodb
	sleep 5
fi

# Check if test data exists
if [ ! -d "$DATA_PATH" ]; then
	echo "❌ Test data not found at: $DATA_PATH"
	echo "Please ensure you have the timestamped export available."
	exit 1
fi

# Backup current data (if any)
echo "💾 Backing up current MongoDB data..."
docker exec bravo1_mongodb mongodump --db bravo-1 --out /data/backup-before-e2e-$(date +%Y%m%d-%H%M%S) >/dev/null 2>&1 || true

# Clear existing data
echo "🧹 Clearing existing data..."
docker exec bravo1_mongodb mongosh bravo-1 --eval "db.campaigns.deleteMany({})" >/dev/null
docker exec bravo1_mongodb mongosh bravo-1 --eval "db.lineItems.deleteMany({})" >/dev/null
docker exec bravo1_mongodb mongosh bravo-1 --eval "db.strategies.deleteMany({})" >/dev/null

# Load test data using the ETL process
echo "📥 Loading test data..."
cd "$PROJECT_ROOT"

# Run the ETL load process with the specific timestamped data
# First, ensure the transformed data exists
if [ ! -f "$PROJECT_ROOT/scripts/etl/data-transformed/campaigns.json" ]; then
	echo "🔄 Transforming test data..."
	bun run scripts/etl/run-etl.ts transform
fi

# Load the data
echo "💫 Loading data into MongoDB..."
bun run scripts/etl/run-etl.ts load

# Verify the data was loaded
echo "✅ Verifying data load..."
CAMPAIGN_COUNT=$(docker exec bravo1_mongodb mongosh bravo-1 --quiet --eval "db.campaigns.countDocuments()")
echo "📊 Loaded $CAMPAIGN_COUNT campaigns"

if [ "$CAMPAIGN_COUNT" -ne "13417" ]; then
	echo "⚠️  Warning: Expected 13,417 campaigns but loaded $CAMPAIGN_COUNT"
fi

echo "✨ E2E test data setup complete!"
echo ""
echo "📝 Test data details:"
echo "   - Timestamp: $DATA_TIMESTAMP"
echo "   - Total campaigns: $CAMPAIGN_COUNT"
echo "   - First campaign: 'Aces Automotive Repair - Phoenix location 1' (CN-13999)"
echo ""
echo "🚀 You can now run E2E tests with: npx playwright test"
