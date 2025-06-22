# Bravo Migration Guide

This guide explains how to migrate data from PostgreSQL to MongoDB and the new data architecture.

## Prerequisites

1. Install dependencies:
```bash
cd backend
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

## Running the Migration

```bash
cd backend
npm run migrate
```

This will:
1. Connect to both PostgreSQL and MongoDB
2. Create a users collection with hierarchy
3. Migrate campaigns and line items
4. Transform impressions to units with unit types
5. Create search indexes
6. Generate API documentation

## Data Architecture Changes

### 1. Units System
Instead of impressions, we now use a flexible units system:
- `unitType`: The type of unit (impressions, clicks, conversions, video_views, etc.)
- `unitPrice`: Cost per unit
- `estimatedUnits`: Expected number of units
- `actualUnits`: Delivered units (optional)

### 2. User Hierarchy
Users now have:
- Roles: admin, account_director, account_manager, media_trader, viewer
- Manager relationships via `managerId`
- Departments for organizational structure

### 3. Enhanced Search
All collections have text indexes for fast searching:
- Campaigns: Search by name or campaign number
- Users: Search by name or email
- Line Items: Search by name or channel

## API Endpoints

See `API-DOCUMENTATION.md` for full API documentation.

Key endpoints:
- `GET /api/users` - List users with filtering
- `GET /api/users/hierarchy` - Get org chart
- `GET /api/campaigns?search=query` - Search campaigns
- `POST /api/campaigns/:id/line-items` - Add line items with units

## Sample Data

If no PostgreSQL data exists, the migration creates sample:
- 9 users in a hierarchy
- 5 campaigns with different statuses
- Line items with various unit types

## Next Steps

1. Run the migration: `npm run migrate`
2. Verify data: `npm run dev` and check http://localhost:3001/api/campaigns
3. Update frontend to use new unit types
4. Test search functionality
5. Implement user authentication using the new users collection