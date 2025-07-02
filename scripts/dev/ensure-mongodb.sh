#!/bin/bash

# Script to ensure MongoDB is running in Docker
# Used by npm run dev:db

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
MONGODB_CONTAINER="bravo1_mongodb"
COMPOSE_SERVICE="mongodb"

echo "🔍 Checking MongoDB status..."

# Function to check if Docker is running
check_docker() {
	if ! docker info >/dev/null 2>&1; then
		echo -e "${RED}❌ Docker is not running${NC}"

		# Try to start Docker Desktop based on OS
		if [[ ${OSTYPE} == "darwin"* ]]; then
			echo "🚀 Attempting to start Docker Desktop on macOS..."
			open -a Docker

			# Wait for Docker to start (max 30 seconds)
			echo "⏳ Waiting for Docker to start..."
			for _ in {1..30}; do
				if docker info >/dev/null 2>&1; then
					echo -e "${GREEN}✓ Docker is now running${NC}"
					return 0
				fi
				sleep 1
				echo -n "."
			done
			echo ""
			echo -e "${RED}❌ Docker failed to start. Please start Docker Desktop manually.${NC}"
			exit 1
		else
			echo -e "${RED}Please start Docker manually and try again.${NC}"
			exit 1
		fi
	else
		echo -e "${GREEN}✓ Docker is running${NC}"
	fi
}

# Function to check if MongoDB container exists
check_container_exists() {
	# shellcheck disable=SC2312
	if docker ps -a --format '{{.Names}}' | grep -q "^${MONGODB_CONTAINER}$"; then
		return 0
	else
		return 1
	fi
}

# Function to check if MongoDB container is running
check_container_running() {
	# shellcheck disable=SC2312
	if docker ps --format '{{.Names}}' | grep -q "^${MONGODB_CONTAINER}$"; then
		return 0
	else
		return 1
	fi
}

# Main logic
check_docker

# shellcheck disable=SC2310
if check_container_running; then
	echo -e "${GREEN}✓ MongoDB is already running${NC}"

	# Show connection info
	# shellcheck disable=SC2312
	MONGO_PORT=$(docker port "${MONGODB_CONTAINER}" 27017 2>/dev/null | cut -d: -f2)
	echo "📊 MongoDB connection: mongodb://localhost:${MONGO_PORT:-27017}/bravo-1"
	exit 0
fi

# shellcheck disable=SC2310
if check_container_exists; then
	echo -e "${YELLOW}⚠️  MongoDB container exists but is not running${NC}"
	echo "🚀 Starting MongoDB container..."
	docker start "${MONGODB_CONTAINER}"

	# Wait for container to be ready
	echo "⏳ Waiting for MongoDB to be ready..."
	for _ in {1..10}; do
		if docker exec "${MONGODB_CONTAINER}" mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
			echo -e "${GREEN}✓ MongoDB is ready${NC}"
			exit 0
		fi
		sleep 1
		echo -n "."
	done
	echo ""
	echo -e "${RED}❌ MongoDB failed to start properly${NC}"
	exit 1
else
	echo -e "${YELLOW}⚠️  MongoDB container does not exist${NC}"
	echo "🚀 Creating and starting MongoDB using docker-compose..."

	# Run docker-compose from project root
	SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

	cd "${PROJECT_ROOT}"
	docker-compose up -d "${COMPOSE_SERVICE}"

	# Wait for MongoDB to be ready
	echo "⏳ Waiting for MongoDB to be ready..."
	for _ in {1..20}; do
		if docker exec "${MONGODB_CONTAINER}" mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
			echo -e "${GREEN}✓ MongoDB is ready${NC}"
			echo "📊 MongoDB connection: mongodb://localhost:27017/bravo-1"
			exit 0
		fi
		sleep 1
		echo -n "."
	done
	echo ""
	echo -e "${RED}❌ MongoDB failed to start properly${NC}"
	exit 1
fi
