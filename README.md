# Bravo - Modern Campaign Management Platform

A powerful advertising campaign management platform built with React, MongoDB, and modern Tailwind UI components.

## Overview

Bravo is a modern campaign management platform featuring:
- **MongoDB** instead of PostgreSQL for simpler data modeling
- **Tailwind UI** components for consistent, accessible design
- **Simplified AG-Grid** implementation with standard cell renderers
- **React Query** for efficient server state management
- **Express.js** REST API instead of tRPC for broader compatibility

## Architecture

```
bravo-1/
├── backend/          # Express.js + MongoDB API
├── frontend/         # React + Tailwind UI
├── shared/           # Shared types and utilities
└── README.md
```

## Key Features

### ✅ Implemented
- Campaign list view with AG-Grid
- MongoDB integration with sample data
- Tailwind UI component library
- Express REST API
- TypeScript throughout
- Basic search and filtering

### 🚧 In Progress
- Campaign detail pages
- Line item management
- Media plan functionality

### 📋 Planned
- Platform integrations
- Real-time metrics
- User authentication
- Performance dashboards

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally
- Git

### Installation

1. **Clone and setup**
   ```bash
   cd bravo-1
   cp .env.example .env
   npm run install:all
   ```

2. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or using local MongoDB
   mongod
   ```

3. **Seed the database**
   ```bash
   npm run dev:backend
   # In another terminal:
   cd backend && npm run seed
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

5. **Open the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

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

## Data Model

### MongoDB Collections

**campaigns** - Main collection with denormalized data:
```javascript
{
  _id: ObjectId,
  campaignNumber: "CN-7021",
  name: "Virginia Spine Care",
  status: "L1", // L1, L2, L3
  team: {
    leadAccountManager: { id, name, email, avatar },
    mediaTrader: { ... }
  },
  dates: { start, end, daysElapsed, totalDuration },
  budget: { total, allocated, spent, remaining },
  metrics: { deliveryPacing, spendPacing, margin, ... },
  lineItems: [{ ... }], // Embedded line items
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