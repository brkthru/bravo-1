# Bravo-1

A modern media planning system built with a headless API architecture, MongoDB, and React.

Bravo-1 is a ground-up rewrite of the media-tool system, focusing on:

- **Headless API** architecture for multiple client support
- **MongoDB** document store for flexible data modeling
- **Versioned business logic** with audit trails
- **Financial precision** handling for media budgets
- **Modern UI** with AG-Grid and Tailwind CSS

## 🚀 Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for a detailed getting started guide.

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- AWS CLI configured with SSO (for data access)
- macOS (primary development platform)

### 1. Clone and Install

```bash
git clone https://github.com/brkthru/bravo-1.git
cd bravo-1
npm install
```

### 2. Start MongoDB

```bash
docker-compose up -d mongodb
```

### 3. Load Production Data (NEW Simplified Method)

```bash
# Login to AWS
aws sso login --profile brkthru-mediatool-dev

# Import latest production data from S3
./scripts/production-pipeline/import-from-s3.sh --latest
```

### 4. Start Development Servers

```bash
# From project root
npm run dev
```

This starts:

- Headless API: http://localhost:3001
- Frontend: http://localhost:5174
- API Docs: http://localhost:3001/api-docs

## 📚 Full Setup Guide

### Environment Configuration

1. Copy environment templates:

```bash
cp headless-api/.env.example headless-api/.env
cp frontend/.env.example frontend/.env
```

2. Verify MongoDB connection in `headless-api/.env`:

```env
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=bravo-1
```

### Data Pipeline

The ETL pipeline imports production data from PostgreSQL exports:

```bash
cd scripts/etl

# Step 1: Download latest export from S3
bun run-production-etl.ts download

# Step 2: Transform to MongoDB format
bun run-production-etl.ts transform

# Step 3: Load into MongoDB
bun run-production-etl.ts load
```

**Dataset**: 13,417 campaigns from 2025-06-22 export

### Running Tests

```bash
# All tests (unit + E2E)
npm test

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e

# Test coverage report
npm run test:coverage

# Code quality
npm run check  # Trunk linting
npm run fmt    # Auto-format
```

## 🏗️ Architecture

### Project Structure

```
bravo-1/
├── headless-api/       # Express.js REST API
├── frontend/           # React + Vite application
├── shared/            # Shared types and schemas
├── bff-backend/       # (Placeholder) Backend for Frontend
├── scripts/           # ETL and utility scripts
├── tests/             # E2E Playwright tests
└── docs/              # Architecture and guides
```

### Key Architectural Decisions

1. **Headless API First**: True headless design supporting multiple clients
2. **Document Store**: MongoDB for flexible schema evolution
3. **Schema-First Development**: Single source of truth in Zod schemas
4. **Versioned Business Logic**: All calculations tracked with versions
5. **Layered Architecture**: Clear separation of concerns

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design documentation.

## 🔧 Development

### Code Quality Standards

We enforce strict code quality through:

- **Trunk.io**: Pre-commit hooks and CI checks
- **Test Coverage**: Minimum 60% coverage required
- **TDD Approach**: Write tests first, then implementation

### Git Workflow

```bash
# Feature branch
git checkout -b feat/your-feature

# Make changes with TDD
# 1. Write failing test
# 2. Implement feature
# 3. Ensure tests pass

# Run quality checks
trunk check
npm test

# Commit with conventional format
git commit -m "feat: add campaign bulk operations"

# Create PR for review
```

### API Development

The headless API uses:

- OpenAPI 3.0 specification
- Automatic documentation generation
- Versioned endpoints (`/v0/campaigns`)

View live API docs at http://localhost:3001/api-docs

## 📊 Data Model

### MongoDB Collections (Separate, not embedded)

```javascript
// campaigns collection
{
  _id: ObjectId("..."),
  campaignNumber: "CN-13999",
  name: "Campaign Name",
  accountId: "account-123",
  status: "active",
  budget: 100000,
  createdAt: Date,
  updatedAt: Date
}

// strategies collection
{
  _id: ObjectId("..."),
  campaignId: ObjectId("..."),  // Foreign key to campaigns
  name: "Strategy Name",
  objectives: "...",
  createdAt: Date,
  updatedAt: Date
}

// lineItems collection
{
  _id: ObjectId("..."),
  strategyId: ObjectId("..."),  // Foreign key to strategies
  campaignId: ObjectId("..."),  // Foreign key to campaigns
  name: "Line Item Name",
  budget: 50000,
  platform: "Google Ads",
  createdAt: Date,
  updatedAt: Date
}
```

## 📖 Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](http://localhost:3001/api-docs)
- [ETL Pipeline Guide](./docs/ETL-SYSTEM-DESIGN.md)
- [Testing Guide](./tests/README.md)
- [Field Calculations](./docs/FIELD-CALCULATIONS-COMPREHENSIVE.md)

## 🤝 Contributing

This is a private repository for the Brkthru organization. We welcome contributions from team members and AI agents.

### For AI Agents

- Follow TDD practices outlined in [CLAUDE.md](./CLAUDE.md)
- Use memory tools to maintain context
- Create issues with `ai-generated` label
- All PRs require human review

### For Developers

- Review [ARCHITECTURE.md](./ARCHITECTURE.md) first
- Follow existing patterns and conventions
- Maintain test coverage above 60%
- Document significant changes

## 🚨 Important Notes

1. **Never use seed data** - Always load full production dataset
2. **media-tool/ is read-only** - Reference only, never modify
3. **No direct DB access** - All operations through headless API
4. **Version business logic** - Track all calculation changes

## 📄 License

Private repository - Brkthru proprietary
