# CLAUDE.md - Bravo-1 Development Guide

## 🎯 Core Mission

Media planning system: PostgreSQL → MongoDB migration with versioned business logic and financial precision.

## 🧪 TEST-DRIVEN DEVELOPMENT MANDATORY

### Before ANY code changes:

1. Write failing test first
2. Make test pass with minimal code
3. Refactor with confidence

### Testing Requirements:

```bash
# ALWAYS run before committing:
trunk check                    # Linting (auto-runs pre-commit)
npm test                      # Unit tests (60% coverage minimum)
npx playwright test          # E2E tests with FULL dataset

# Coverage check:
npm run test:coverage        # Must maintain/increase coverage
```

### Test Data Rules:

- **NEVER** use seed data (5 campaigns)
- **ALWAYS** use production backup: `bun scripts/etl/run-etl.ts`
- Dataset: 13,417 campaigns from 20250622-072326 export

## 🏗️ Architecture: Layered Business Logic

### Data Flow:

```
User Input → Validation → Storage → Calculations → Response
    ↓           ↓            ↓           ↓             ↓
   Zod     Multi-level   MongoDB    Versioned    Formatted
 Schemas   Validation   Decimal128   Engine      Output
```

### Key Components:

#### 1. Calculation Engine (v1.0.0)

- **Location**: `headless-api/src/calculations/calculation-engine.ts`
- **Pattern**: Pure calculations → Context-aware rounding
- **Versioning**: Business rules tracked with version/timestamp
- **See**: `docs/FIELD-CALCULATIONS-COMPREHENSIVE.md`

#### 2. Multi-Level Validation

- **Schema**: Zod v4 schemas in `shared/src/schemas/`
- **API**: Request validation (implement middleware)
- **Service**: Business rules validation
- **Database**: MongoDB JSON Schema validators
- **Pattern**: Errors (blocking) vs Warnings (non-blocking)
- **See**: `docs/SCHEMA-REFERENCE.md`

#### 3. Precision Rules

- **Storage**: 6 decimal places (MongoDB Decimal128)
- **API/Display**: 2 decimal places
- **Contextual**: YouTube CPV = 3 decimals
- **See**: `docs/adr-0019-implementation.md`

## 📋 Development Checklist

### Starting Work:

1. Search memories: `mcp__openmemory__search_memory "bravo-1"`
2. Check docs: `docs/INDEX.md` for documentation map
3. Review architecture: `ARCHITECTURE.md`

### While Coding:

- Write test FIRST, then implementation
- Run `trunk check` frequently
- Commit atomically with conventional format:
  - `feat:` new features
  - `fix:` bug fixes
  - `test:` test additions
  - `refactor:` code improvements
  - `docs:` documentation

### Before Committing:

1. `trunk check` - Must pass
2. `npm test` - Must pass with coverage
3. `npx playwright test` - Must pass
4. Update relevant docs if needed

## 🔧 Quick Reference

### Servers:

- MongoDB: `localhost:27017/bravo-1`
- Headless API: `localhost:3001`
- Frontend: `localhost:5174`

### Key Collections:

- campaigns, strategies, lineItems (SEPARATE, not embedded)

### Documentation:

- Architecture decisions: `docs/MONGODB-SCHEMA-DESIGN.md`
- ETL pipeline: `docs/ETL-SYSTEM-DESIGN.md`
- Field calculations: `docs/FIELD-CALCULATIONS-COMPREHENSIVE.md`
- Testing guide: `tests/README.md`

## ⚠️ Critical Rules

1. **media-tool/** is READ-ONLY - never edit
2. Store key decisions in memory: `mcp__openmemory__add_memories`
3. Validate at multiple levels (schema → API → service → DB)
4. Version all business logic changes
5. Maintain calculation audit trail

## 🚀 Problem We're Solving

Migrating complex PostgreSQL views with calculated metrics to MongoDB while:

- Preserving financial precision
- Versioning business logic
- Supporting bulk operations
- Maintaining calculation history
- Enabling multi-level validation

**Goal**: Clean, testable, versioned business logic layer separate from data storage.
