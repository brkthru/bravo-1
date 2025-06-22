# E2E Testing Guide

## Overview
E2E tests use Playwright to test the full application with real data from a timestamped export.

## Test Data Setup

### Using Timestamped Export
Tests use a specific timestamped export (`20250622-072326`) to ensure consistent results:
- **Total Campaigns**: 13,417
- **First Campaign**: "Aces Automotive Repair - Phoenix location 1" (CN-13999)
- **Search Results**: Known campaigns for predictable search tests

### Loading Test Data
Before running E2E tests, ensure the test data is loaded:

```bash
# Load the timestamped test data
./tests/e2e/setup/load-test-data.sh

# This will:
# 1. Backup current MongoDB data
# 2. Clear existing data
# 3. Load the timestamped export (13,417 campaigns)
# 4. Verify the data was loaded correctly
```

## Running Tests

### Run All E2E Tests
```bash
npx playwright test
```

### Run Specific Test File
```bash
# Campaign tests
npx playwright test tests/e2e/campaigns.spec.ts

# Pagination tests
npx playwright test tests/e2e/pagination.spec.ts
```

### Run in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run with Debug Mode
```bash
npx playwright test --debug
```

## Test Structure

### Campaign Tests (`campaigns.spec.ts`)
- Navigation and page structure
- Campaign list display
- Search functionality
- Uses production data (not seed data)

### Pagination Tests (`pagination.spec.ts`)
- Pagination controls display
- Page navigation
- Page size changes
- Search + pagination interaction
- Verifies 13,417 total campaigns

## Troubleshooting

### Tests Failing with Wrong Data
If tests are looking for the wrong campaigns:
1. Run `./tests/e2e/setup/load-test-data.sh` to load correct data
2. Verify MongoDB has 13,417 campaigns: `docker exec bravo1_mongodb mongosh mediatool_v2 --eval "db.campaigns.countDocuments()"`

### Connection Issues
Ensure services are running:
```bash
# Start MongoDB
docker-compose up -d mongodb

# Start backend (port 3001)
cd backend && npm run dev

# Start frontend (port 5174)
cd frontend && npm run dev
```

## Adding New Tests

When adding new E2E tests:
1. Use data from `tests/e2e/setup/test-data.ts` for consistent values
2. Add page objects for complex interactions
3. Use appropriate timeouts for data loading
4. Document any new test data requirements