# CLAUDE.md - Bravo-1 Project Guide

This file provides guidance to Claude Code when working with the Bravo-1 MongoDB migration project.

## 🚨 TESTING REQUIREMENTS
**ALWAYS run tests after making changes:**
1. **Unit Tests**: `npm test` - Run after model/service changes
2. **E2E Tests**: `npx playwright test` - Run after UI/API changes
3. **Full Test Suite**: `npm run test:all` - Run before committing

**When adding features:**
- Write unit tests for new functions/models
- Write E2E tests for new UI features
- Update existing tests if behavior changes
- Run `npm run test:coverage` to ensure coverage doesn't drop

## 🚀 Session Start Checklist
1. **Read Serena Initial Instructions**: Run `mcp__serena__initial_instructions` 
2. **Query Project Memories**: Search for "bravo-1", "MongoDB structure", "read-only"
3. **Check Current Config**: Run `mcp__serena__get_current_config`
4. **Verify Read-Only Rules**: Ensure media-tool editing is disabled

## Project Overview
Bravo-1 is a MongoDB-based media planning system migrated from the PostgreSQL-based media-tool. It uses:
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express 4, TypeScript, MongoDB native driver
- **Database**: MongoDB (in Docker container)
- **Testing**: Jest for unit tests, Playwright for E2E

## Important Memory Management

### When to Store Memories
ALWAYS use `mcp__openmemory__add_memories` to store:
1. **Project Structure Changes**: Directory reorganizations, new file locations
2. **Configuration Details**: Port numbers, connection strings, environment variables
3. **Key Decisions**: Why certain approaches were chosen (e.g., separate collections vs embedded)
4. **Migration Progress**: What has been migrated, what remains
5. **Common Issues & Solutions**: Debugging notes, workarounds
6. **User Preferences**: Coding style, testing approaches, deployment preferences

### When to Query Memories
ALWAYS use `mcp__openmemory__search_memory` when:
1. **Starting a new session**: Query for project context
   - Search: "bravo-1" or "media-tool" 
   - Search: "MongoDB structure" or "ports"
   - Search: "read-only" to get access rules
2. **Before making architectural decisions**: Check past decisions and rationale
3. **When encountering familiar errors**: Search for previous solutions
4. **Before suggesting approaches**: Ensure consistency with past work
5. **Before any file edits**: Search "read-only" to ensure compliance

### Memory Format Guidelines
- Keep memories concise but complete
- Include specific paths, ports, and configuration values
- Tag with project name (bravo-1 or media-tool)
- Include dates for time-sensitive information

## Current Project State

### Database Structure
- **MongoDB**: Runs on `mongodb://localhost:27017/mediatool_v2`
- **Collections**: campaigns, strategies, lineItems (SEPARATE, not embedded)
- **Docker**: Container name `bravo1_mongodb`

### Server Configuration
- **Backend**: `http://localhost:3001` (Express server)
- **Frontend**: `http://localhost:5174` (Vite dev server)
- **API**: RESTful endpoints at `/api/*`

### Key Differences from media-tool
1. **Database**: MongoDB instead of PostgreSQL
2. **ORM**: Native MongoDB driver instead of pg-promise
3. **UI**: Tailwind CSS instead of mixed styling
4. **Structure**: Simplified, fewer dependencies

## Commands
```bash
# Install dependencies
npm install

# Start MongoDB (Docker)
docker-compose up -d mongodb

# Run servers
npm run dev:backend  # Backend on :3001
npm run dev:frontend # Frontend on :5174

# Run tests
npm test            # Unit tests
npx playwright test # E2E tests

# Seed database (5 test campaigns only)
cd backend && npm run seed

# Load full production data (13,417 campaigns)
# From bravo-1 directory:
bun run scripts/etl/run-etl.ts transform
bun run scripts/etl/run-etl.ts load
```

## MongoDB Data Management

### Production Data Backup
- **Location**: `bravo-1/scripts/data-export/`
- **Extracted**: 2025-06-18 from PostgreSQL media-tool
- **Total Records**: 238,463 documents
- **Main Collections**:
  - `campaigns_backup.json` - 13,417 campaigns
  - `lineItems.json` - 3,343 line items
  - `strategies.json` - 13,417 strategies
  - `mediaBuys.json` - 56,020 media buys
  - `platformEntities.json` - 142,333 platform entities (695MB)

### Restore Full Production Data
```bash
# Ensure MongoDB is running
docker-compose up -d mongodb

# Transform and load the full dataset
cd bravo-1
bun run scripts/etl/run-etl.ts transform  # Creates denormalized structure
bun run scripts/etl/run-etl.ts load       # Loads into MongoDB

# Or run complete ETL process
bun run scripts/etl/run-etl.ts           # Runs extract, transform, load
```

### Testing Considerations
- **Seed data** (5 campaigns): Quick tests, development
- **Full data** (13,417 campaigns): E2E tests, performance testing, production simulation
- ETL process automatically backs up current data before loading
- Use `mongodump` for traditional BSON backups if needed

## Automated Testing with Full Data

### Benefits of Full Dataset Testing
1. **Realistic Performance Testing**: Test with 13,417 campaigns vs 5
2. **Pagination Testing**: Verify pagination with real data volumes
3. **Search/Filter Testing**: Test search performance at scale
4. **Edge Cases**: Discover issues only visible with production data
5. **Memory/Load Testing**: Ensure app handles large datasets

### Setup for E2E Tests with Full Data
```bash
# One-time setup: Load full dataset
cd bravo-1
docker-compose up -d mongodb
bun run scripts/etl/run-etl.ts transform
bun run scripts/etl/run-etl.ts load

# Run E2E tests
npm run dev:backend  # Start backend
npm run dev:frontend # Start frontend  
npx playwright test  # Run tests against full data
```

### CI/CD Considerations
```bash
# In CI pipeline, restore from backup before tests
- name: Restore MongoDB Data
  run: |
    cd bravo-1
    bun run scripts/etl/run-etl.ts transform
    bun run scripts/etl/run-etl.ts load
    
- name: Run E2E Tests
  run: npx playwright test
```

### Test Data Strategies
- **Development**: Use seed script (5 campaigns) for quick iteration
- **E2E Testing**: Use full backup (13,417 campaigns) for comprehensive testing
- **Unit Tests**: Use MongoDB Memory Server with minimal fixtures

## File Structure
```
bravo-1/
├── backend/          # Express API server
│   ├── src/
│   │   ├── config/   # Database config
│   │   ├── models/   # MongoDB models
│   │   ├── routes/   # API routes
│   │   └── scripts/  # Migration & seed scripts
├── frontend/         # React application
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── services/
├── shared/          # Shared types
├── tests/           # E2E tests
└── docs/            # Organized documentation
```

## Testing
- **Unit Tests**: Jest with MongoDB memory server
- **E2E Tests**: Playwright with real servers
- **Coverage**: Run `npm run test:coverage`

## Migration Status
✅ Completed:
- User management with teams
- Campaign CRUD operations
- Basic authentication
- MongoDB schema design
- Tailwind UI components
- E2E test setup

❌ Not Yet Migrated:
- Media buy entities
- Platform integrations
- Advanced reporting
- Full authentication (JWT)
- Background jobs

## Testing Strategy

### Test Types
1. **Unit Tests** (Jest)
   - Location: `backend/src/**/*.test.ts`, `frontend/src/**/*.test.tsx`
   - Run: `npm test` (in backend or frontend directory)
   - Focus: Individual functions, models, components

2. **E2E Tests** (Playwright)
   - Location: `tests/e2e/*.spec.ts`
   - Run: `npx playwright test`
   - Focus: User workflows, API integration, UI behavior

3. **Integration Tests**
   - Location: `backend/src/**/*.integration.test.ts`
   - Run: `npm run test:integration`
   - Focus: Database operations, API endpoints

### Test Commands
```bash
# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage

# Run specific test file
npx playwright test tests/e2e/campaigns.spec.ts

# Run tests in watch mode
npm test -- --watch

# Run tests in UI mode (Playwright)
npx playwright test --ui
```

### When to Run Tests
- **Before committing**: Run full test suite
- **After API changes**: Run integration + E2E tests
- **After UI changes**: Run component tests + E2E tests
- **After model changes**: Run unit + integration tests

## Common Issues & Solutions

### MongoDB Connection Failed
- Ensure Docker is running: `docker ps`
- Check MongoDB container: `docker-compose up -d mongodb`
- Verify port 27017 is free: `lsof -i :27017`

### Tests Failing
- **E2E tests**: Check if using seed data vs production data
  - Seed: `cd backend && npm run seed` (5 campaigns)
  - Production: `bun run scripts/etl/run-etl.ts` (13,417 campaigns)
- Ensure servers are running before E2E tests
- Update test expectations if data changed

### Frontend Not Loading
- Verify backend is running on :3001
- Check CORS settings in backend
- Ensure .env file exists with correct values

## Development Workflow
1. Always check memories at session start
2. Run tests before committing
3. Update documentation when structure changes
4. Store important decisions in memory
5. Use Serena for code navigation in active project

## Serena MCP Integration
- Currently active at parent directory level
- Use `mcp__serena__` tools for code navigation
- Particularly useful for finding symbols and references
- Write memories for cross-project knowledge

### Serena Setup (if needed)
```bash
# From bravo_code directory:
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena-mcp-server --context ide-assistant --project $(pwd)
```

### Key Serena Tools
- `mcp__serena__initial_instructions` - Get project-specific guidance
- `mcp__serena__find_symbol` - Find code symbols by name
- `mcp__serena__search_for_pattern` - Search code patterns
- `mcp__serena__read_memory` / `write_memory` - Project memories
- `mcp__serena__get_current_config` - Check active configuration

## CRITICAL: Read-Only Policy for media-tool
**IMPORTANT**: The `media-tool/` directory is READ-ONLY. 
- ✅ **ALLOWED**: Read, search, analyze media-tool files
- ❌ **FORBIDDEN**: Edit, modify, or delete anything in media-tool
- All edits must be made in `bravo-1/` only
- Use media-tool as reference for migration only

When using Serena tools:
- Check file path before any edit operation
- If path contains `media-tool/`, use only read tools:
  - `read_file`, `find_symbol`, `search_for_pattern`, etc.
- For `bravo-1/` paths, all tools are available