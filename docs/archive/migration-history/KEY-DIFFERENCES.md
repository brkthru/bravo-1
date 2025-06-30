# Key Differences: media-tool vs bravo-1

This document highlights the major differences between the legacy media-tool (PostgreSQL) and the new bravo-1 (MongoDB) systems.

## Database Technology

### media-tool (Legacy)

- **Database**: PostgreSQL 16
- **ORM/Driver**: pg-promise, raw SQL
- **Migrations**: Flyway (SQL files)
- **Schema**: Strict relational schema with foreign keys
- **Connection**: `postgresql://localhost:5432/media_tool`

### bravo-1 (New)

- **Database**: MongoDB
- **ODM/Driver**: Native MongoDB driver (not Mongoose)
- **Migrations**: Custom TypeScript scripts
- **Schema**: Flexible document model
- **Connection**: `mongodb://localhost:27017/mediatool_v2`

## Data Structure

### media-tool

```sql
-- Relational tables with foreign keys
campaigns -> strategies -> line_items -> media_buys
users -> user_teams -> teams
```

### bravo-1

```javascript
// Separate collections with reference IDs
campaigns: { _id, name, accountId, ... }
strategies: { _id, campaignId, name, ... }
lineItems: { _id, strategyId, campaignId, ... }
users: { _id, email, role, teamIds[], ... }
```

## Architecture Differences

### API Structure

**media-tool**:

- Express 5 with tRPC
- Complex route structure in `packages/backend/api/`
- Separate routers for each entity
- SQL-based queries with joins

**bravo-1**:

- Express 4 with REST endpoints
- Simple route files in `backend/src/routes/`
- Direct MongoDB queries
- Aggregation pipelines for complex queries

### Authentication

**media-tool**:

- Microsoft Entra ID (OAuth 2.0)
- Complex auth flow with redirects
- Session-based authentication
- Role-based access control

**bravo-1**:

- Simplified auth (currently basic)
- User roles stored in MongoDB
- JWT tokens (planned)
- Team-based permissions

## Frontend Differences

### UI Framework

**media-tool**:

- Mixed styling approaches
- AG-Grid Enterprise for tables
- Custom components
- Complex state management with Zustand

**bravo-1**:

- Tailwind CSS throughout
- Consistent component library
- Simplified state management
- React Context for user state

### Key UI Changes

1. **Campaign List**:
   - media-tool: AG-Grid with complex filtering
   - bravo-1: Simple table with basic search

2. **Forms**:
   - media-tool: Multi-step wizards
   - bravo-1: Single-page forms

3. **Navigation**:
   - media-tool: Complex nested routing
   - bravo-1: Simplified flat routing

## Development Workflow

### Dependencies

**media-tool**:

```bash
bun install -y  # Updates both bun and yarn lockfiles
bun dev:frontend
bun dev:backend
```

**bravo-1**:

```bash
npm install  # or bun install
npm run dev  # Runs both frontend and backend
```

### Testing

**media-tool**:

- Jest with complex setup
- Playwright for E2E
- Database fixtures with SQL

**bravo-1**:

- Jest with simpler config
- In-memory MongoDB for tests
- Seed scripts for test data

## Migration Scripts

### Location

- media-tool: `db/migrations/` (SQL files)
- bravo-1: `scripts/` and `scripts/etl/` (TypeScript)

### Key Scripts in bravo-1

- `extract-data.ts` - Pulls from PostgreSQL
- `transform-data.ts` - Converts to MongoDB format
- `load-data.ts` - Inserts into MongoDB
- `migrate-postgres-to-mongo.ts` - Full migration

## Configuration

### Environment Variables

**media-tool** requires:

- PostgreSQL credentials
- Snowflake credentials
- Microsoft auth tokens
- Zoho API keys
- Beeswax credentials

**bravo-1** simplified:

- MongoDB URI
- Basic auth secret
- Port configuration

## Features Comparison

### Currently Implemented in bravo-1

✅ User management with teams
✅ Campaign CRUD operations
✅ Basic line item management
✅ MongoDB migrations
✅ Simple authentication
✅ Tailwind UI

### Not Yet Migrated

❌ Media buy management
❌ Platform integrations (Beeswax, etc.)
❌ Advanced reporting
❌ Snowflake integration
❌ Complex permissions
❌ AG-Grid tables
❌ Background jobs (pg-boss)

## Performance Considerations

### media-tool

- Complex SQL queries with many joins
- View-based aggregations
- Stored procedures for calculations
- Heavy reliance on indexes

### bravo-1

- Denormalized data for read performance
- Aggregation pipelines for complex queries
- Document-based queries are faster
- Less need for joins

## Deployment

### media-tool

- Complex AWS infrastructure
- Terraform configuration
- Multiple environment configs
- RDS for PostgreSQL

### bravo-1

- Simplified deployment (planned)
- MongoDB Atlas ready
- Single environment config
- Containerized approach

## Developer Experience

### Advantages of bravo-1

1. Simpler data model
2. Fewer dependencies
3. Consistent UI framework
4. Better TypeScript types
5. Faster local development

### Trade-offs

1. Lost some advanced features
2. Need to rebuild integrations
3. Different query patterns
4. Learning curve for MongoDB

## Next Steps

To complete the migration:

1. Implement remaining entity types
2. Rebuild platform integrations
3. Add advanced filtering/search
4. Implement full authentication
5. Set up deployment pipeline
6. Migrate historical data
