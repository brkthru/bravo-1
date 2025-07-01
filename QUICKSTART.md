# 🚀 Bravo-1 Quick Start Guide

This guide helps you get Bravo-1 running with production data in under 10 minutes.

## Prerequisites

- Docker Desktop installed and running
- Node.js 18+ and Bun installed
- AWS CLI configured with `brkthru-mediatool-dev` profile
- ~1GB free disk space

## Option 1: Fresh Start with S3 Data (Recommended)

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/brkthru/bravo-1.git
cd bravo-1

# Install dependencies (this sets up workspace links)
npm install

# If you get module errors, force reinstall to ensure workspace links are created
# npm install --force

# Create .env files from examples
cp .env.example .env
cp headless-api/.env.example headless-api/.env
```

### 2. Start MongoDB

```bash
docker-compose up -d mongodb
```

### 3. Start the Backend API

The import process requires the API to be running. In a new terminal:

```bash
npm run dev:api
```

Wait for the message: `Server is running on port 3001`

### 4. Import Production Data

In another terminal:

```bash
# Login to AWS (if needed)
aws sso login --profile brkthru-mediatool-dev

# Import latest production data
./scripts/production-pipeline/import-from-s3.sh --latest

# Or force clean import (skip confirmation prompts)
./scripts/production-pipeline/import-from-s3.sh --latest --force
```

This will:

- Download the latest PostgreSQL export from S3 (~91MB)
- Extract and transform the data
- Call the ETL API to load it into MongoDB
- Show you the record counts

### 5. Start the Frontend

```bash
# In another terminal
npm run dev:frontend
```

### 6. Open Browser

Navigate to http://localhost:5174

You should see:

- 13,417 campaigns
- AG-Grid table with sorting/filtering
- Click any campaign to see details

## Option 2: Export Fresh Data from PostgreSQL

If you need the absolute latest data:

### 1. Ensure PostgreSQL is Running

```bash
docker ps | grep postgres
# Should show: media-tool-postgres-1
```

### 2. Export to S3

```bash
./scripts/production-pipeline/export-postgres-to-s3.sh
```

This will:

- Export the entire media_tool database to JSON
- Create a compressed archive (~91MB)
- Upload to S3
- Give you a download URL

### 3. Import the New Export

Use the URL from step 2:

```bash
./scripts/production-pipeline/import-from-s3.sh --s3-url <your-s3-url>
```

## Troubleshooting

### Module Not Found Error (@bravo-1/shared)

If you get an error like "Cannot find module '@bravo-1/shared'":

```bash
# Force reinstall to create workspace symlinks
npm install --force

# Or if that doesn't work, try:
npm run install:all
```

This is a monorepo with npm workspaces, so the shared package needs to be properly linked.

### MongoDB Connection Failed

```bash
# Check if MongoDB is running
docker ps | grep mongo

# Restart if needed
docker-compose down
docker-compose up -d mongodb
```

### AWS Access Denied

```bash
# Login to AWS SSO
aws sso login --profile brkthru-mediatool-dev
```

### Port Already in Use

```bash
# Kill processes on ports
lsof -ti:3001 | xargs kill -9  # Backend
lsof -ti:5174 | xargs kill -9  # Frontend
```

## What's Included

The production data import includes:

- **13,417 campaigns** with full details
- **13,417 strategies** linked to campaigns
- **4,118 line items** with media buys
- **56,020 media buys** with platform data
- **142,333 platform entities** (Facebook, Google, etc.)
- All supporting data (users, teams, accounts)

## Next Steps

1. **Run Tests**: `npm test` and `npx playwright test`
2. **Check Logs**: Backend logs show API calls, MongoDB queries
3. **Explore Code**:
   - Backend: `backend/src/`
   - Frontend: `frontend/src/`
   - ETL: `scripts/etl/`

## Daily Development Workflow

```bash
# 1. Start MongoDB
docker-compose up -d mongodb

# 2. Start backend API (in terminal 1)
npm run dev:api

# 3. Start frontend (in terminal 2)
npm run dev:frontend

# 4. Make changes and test

# 5. Run linters before committing
trunk check

# 6. Commit changes
git add .
git commit -m "feat: your changes"
```

## Environment Variables

The `.env` files are created from the `.env.example` files during setup (step 1). The default values should work for local development:

- **Root .env**: MongoDB and server configuration
- **headless-api/.env**: API-specific settings including PostgreSQL config (for migrations)

No changes are needed unless you're using non-standard ports or remote databases.

## Support

- Check `CLAUDE.md` for detailed project information
- Run `npm run test:all` to verify everything works
- See `docs/` folder for architecture details
