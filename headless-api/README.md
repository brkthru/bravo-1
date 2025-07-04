# Bravo Backend API

This backend provides both the original API structure and OpenAPI-compatible endpoints as specified in the packages/backend/src/api/openapi.yaml file.

## API Endpoints

### Original MongoDB API

- `GET /api/campaigns` - List campaigns with search
- `POST /api/campaigns` - Create single campaign
- `GET /api/campaigns/:id` - Get specific campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `GET /api/users` - List users with filtering
- `GET /api/users/hierarchy` - Get organizational hierarchy

### Bulk Operations API

- `POST /api/campaigns/bulk` - Create multiple campaigns
- `PUT /api/campaigns/bulk` - Update multiple campaigns
- `POST /api/campaigns/bulk/upsert` - Upsert multiple campaigns

### ETL API

- `GET /api/etl/status` - Get ETL system status
- `POST /api/etl/import` - Import data with calculations

### OpenAPI Compatible Endpoints

#### Proposals

- `GET /api/proposals` - List all proposals
- `POST /api/proposals` - Create a new draft proposal
- `GET /api/proposals/:proposalId` - Get specific proposal
- `PATCH /api/proposals/:proposalId` - Update proposal
- `DELETE /api/proposals/:proposalId` - Delete proposal
- `POST /api/proposals/:proposalId/commit` - Commit draft to ready
- `POST /api/proposals/:proposalId/revise` - Create revision from ready
- `POST /api/proposals/:proposalId/execute` - Execute ready proposal

#### Proposal Line Items

- `GET /api/proposals/:proposalId/line-items` - List line items
- `POST /api/proposals/:proposalId/line-items` - Create line item
- `GET /api/proposals/:proposalId/line-items/:lineItemId` - Get line item
- `PATCH /api/proposals/:proposalId/line-items/:lineItemId` - Update line item
- `DELETE /api/proposals/:proposalId/line-items/:lineItemId` - Delete line item

#### Execution Plans

- `GET /api/execution-plans` - List execution plans
- `GET /api/execution-plans/:campaignId` - Get execution plan
- `PATCH /api/execution-plans/:campaignId` - Update execution plan
- `DELETE /api/execution-plans/:campaignId` - Delete execution plan

#### Execution Media Plans

- `POST /api/execution-plans/:campaignId/media-plans` - Create media plan
- `PATCH /api/execution-plans/:campaignId/media-plans/:mediaPlanId` - Update media plan
- `DELETE /api/execution-plans/:campaignId/media-plans/:mediaPlanId` - Delete media plan

#### Insertion Orders

- `GET /api/insertion-orders` - List insertion orders
- `POST /api/insertion-orders` - Create insertion order
- `GET /api/insertion-orders/:insertionOrderNumber` - Get insertion order
- `PATCH /api/insertion-orders/:insertionOrderNumber` - Update insertion order
- `DELETE /api/insertion-orders/:insertionOrderNumber` - Delete insertion order

## Data Model Mapping

### Proposals → Campaigns Collection

- Proposals are stored as campaigns with a `strategy` field
- `strategy.status` indicates proposal status (draft/ready)
- Line items are embedded in `strategy.lineItems`

### Execution Plans → Campaigns Collection

- Execution plans are campaigns with an `execution` field
- Campaign status 'L1' indicates active execution
- Media plans are stored in separate `mediaPlans` collection

### Users Collection

- Supports roles: admin, account_director, account_manager, media_trader, viewer
- Hierarchical structure via `managerId` field
- Full-text search on name and email

## Migration Tools

### Run Migration from Postgres

```bash
npm run migrate
```

This will:

1. Connect to PostgreSQL and MongoDB
2. Create users with hierarchy
3. Transform campaigns to use units/unitType
4. Create proper indexes
5. Generate API documentation

### Load Production Data

```bash
# Ensure backend is running first:
npm run dev:backend

# Then run ETL process:
bun run scripts/etl/run-etl.ts          # Run complete ETL
# OR run individual steps:
bun run scripts/etl/run-etl.ts extract  # Extract from source
bun run scripts/etl/run-etl.ts transform # Transform structure
bun run scripts/etl/run-etl.ts load     # Load via API
```

**Why API-Only Loading:**

- **Single source of truth** - All data goes through the same business logic
- **Calculation engine** - Financial calculations applied consistently
- **Validation** - Data validated before persistence
- **Audit trail** - Every calculation versioned and tracked
- **No duplicate code** - Business logic exists in one place only

**Note**: The seed script has been removed. Always use the full production dataset.

## Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=mediatool_v2

# PostgreSQL (for migration)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=mediatool
PG_USER=postgres
PG_PASSWORD=postgres

# Server
PORT=3001
```

## Key Features

1. **OpenAPI Compatibility**: All endpoints match the OpenAPI spec while using MongoDB
2. **Units System**: Flexible unit types instead of just impressions
3. **User Hierarchy**: Manager relationships and role-based access
4. **Full-Text Search**: Indexed search across campaigns and users
5. **Proposal Workflow**: Draft → Ready → Execute states
6. **Media Plans**: Separate collection for junction between line items and platform entities
7. **Calculation Engine**: Integrated financial calculations with version tracking
8. **Bulk Operations**: Efficient bulk create/update/upsert for ETL processes
9. **API-First ETL**: Standardized data loading through API endpoints

## Testing

### API Testing

```bash
# Test proposals API
curl http://localhost:3001/api/proposals

# Test execution plans API
curl http://localhost:3001/api/execution-plans

# Test users hierarchy
curl http://localhost:3001/api/users/hierarchy

# Test bulk operations
curl -X POST http://localhost:3001/api/campaigns/bulk \
  -H "Content-Type: application/json" \
  -d '{"campaigns":[{"name":"Test 1","campaignNumber":"TEST-001"}]}'

# Test ETL status
curl http://localhost:3001/api/etl/status
```

### Unit Tests

```bash
# Run all tests
npm test

# Run bulk endpoint tests
npm test campaigns.bulk.test
```

### E2E Tests

```bash
# From bravo-1 directory
npx playwright test etl-import.spec.ts
```
