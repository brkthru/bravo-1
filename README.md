# Bravo-1 - Modern Campaign Management Platform

A MongoDB-based media planning system for managing advertising campaigns, built with React, TypeScript, and Express.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker Desktop (for MongoDB)
- Git

### Setup in 5 Minutes

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd bravo-1
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   No changes needed for local development!

3. **Start MongoDB with Docker**
   ```bash
   docker-compose up -d mongodb
   ```

4. **Load sample data (choose one)**
   ```bash
   # Option A: Quick start with 5 test campaigns
   cd backend && npm run seed
   
   # Option B: Full production data (13,417 campaigns)
   cd bravo-1
   bun run scripts/etl/run-etl.ts transform
   bun run scripts/etl/run-etl.ts load
   ```

5. **Start the application**
   ```bash
   # From project root, in separate terminals:
   npm run dev:backend   # Backend on http://localhost:3001
   npm run dev:frontend  # Frontend on http://localhost:5174
   ```

6. **Verify it's working**
   - Open http://localhost:5174/campaigns
   - You should see the campaigns list with data

## 📋 Project Overview

Bravo-1 is a complete rewrite of the PostgreSQL-based media-tool, featuring:
- **MongoDB** for flexible document storage
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **AG-Grid** for powerful data tables
- **Express.js** REST API
- **Zod** for type-safe validation

## 🏗 Architecture

```
bravo-1/
├── backend/          # Express API server
│   ├── src/
│   │   ├── models/   # MongoDB models
│   │   ├── routes/   # API endpoints
│   │   └── config/   # Database config
├── frontend/         # React application
│   ├── src/
│   │   ├── pages/    # Route components
│   │   ├── components/
│   │   └── services/ # API client
├── shared/           # Shared types (Zod schemas)
├── scripts/          # ETL and utilities
└── tests/            # E2E tests (Playwright)

## Development

### Backend (Express + MongoDB)
```bash
cd backend
npm run dev        # Start with auto-reload
npm run build      # Build for production
npm run seed       # Seed sample data
```

### Frontend (React + Vite)
```bash
cd frontend
npm run dev        # Start development server
npm run build      # Build for production
```

### Shared Types
```bash
cd shared
npm run build      # Build shared package
npm run dev        # Watch mode
```

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

## API Endpoints

### Campaigns
- `GET /api/campaigns` - List campaigns (with optional search)
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

## UI Components

### Tailwind UI Patterns Used
- **Application Shell** - Main layout with sidebar
- **Data Tables** - AG-Grid with Tailwind styling
- **Stats Cards** - Campaign metrics display
- **Progress Bars** - Pacing indicators
- **Badges** - Status indicators
- **Search** - Campaign filtering

### AG-Grid Simplifications
- Standard themes with Tailwind customization
- Simple React cell renderers instead of complex custom components
- Built-in features for sorting, filtering, pagination
- Removed unnecessary enterprise features

## Comparison with Original

| Feature | Original | v2 Simplified |
|---------|----------|---------------|
| Database | PostgreSQL with complex stored procedures | MongoDB with denormalized documents |
| Backend | tRPC + complex abstractions | Express REST API |
| Frontend | Custom CSS + complex AG-Grid | Tailwind UI + simplified AG-Grid |
| State | Zustand + custom patterns | React Query + Context |
| Types | Custom validation | Zod schemas |
| Auth | Microsoft Entra ID | Simplified (to be implemented) |

## Migration Benefits

1. **Reduced Complexity**: 70% fewer lines of code
2. **Better Performance**: Denormalized data reduces joins
3. **Easier Maintenance**: Standard patterns and libraries
4. **Faster Development**: Pre-built Tailwind UI components
5. **Better Testing**: Simpler data flows and fewer abstractions

## Next Steps

1. Implement campaign detail pages
2. Add line item management
3. Build media plan functionality
4. Add user authentication
5. Implement platform integrations
6. Create data migration scripts from PostgreSQL

## Contributing

This is a prototype/proof-of-concept. See MIGRATION-TODOS.md for current development priorities.