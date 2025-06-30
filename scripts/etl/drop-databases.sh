#!/bin/bash

# Drop databases script for fresh ETL start
echo "🗑️  Dropping MongoDB databases for fresh start..."
echo "=================================="

# Check if MongoDB is running
if ! docker ps | grep -q bravo1_mongodb; then
	echo "❌ MongoDB container is not running!"
	echo "Please start it with: docker-compose up -d mongodb"
	exit 1
fi

echo "Dropping databases..."

# Drop bravo-1 database
docker exec bravo1_mongodb mongosh bravo-1 --quiet --eval "db.dropDatabase()" 2>/dev/null
echo "✅ Dropped bravo-1 database"

# Drop mediatool_v2 database (old migration)
docker exec bravo1_mongodb mongosh mediatool_v2 --quiet --eval "db.dropDatabase()" 2>/dev/null
echo "✅ Dropped mediatool_v2 database"

# Drop any test databases
docker exec bravo1_mongodb mongosh bravo-1-test --quiet --eval "db.dropDatabase()" 2>/dev/null
echo "✅ Dropped test databases"

echo ""
echo "✨ All databases dropped successfully!"
echo "You can now run ./quick-start-etl.sh for a fresh import"
