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

# Install dependencies
npm install
```

### 2. Start MongoDB

```bash
docker-compose up -d mongodb
```

### 3. Import Production Data

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
- Load it into MongoDB
- Show you the record counts

### 4. Start the Application

In separate terminals:

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

### 5. Open Browser

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
# 1. Start services
docker-compose up -d mongodb
npm run dev:backend
npm run dev:frontend

# 2. Make changes and test

# 3. Run linters before committing
trunk check

# 4. Commit changes
git add .
git commit -m "feat: your changes"
```

## Environment Variables

Create `.env` files if missing:

**backend/.env**

```
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/bravo-1
LOG_LEVEL=debug
```

**frontend/.env**

```
VITE_API_URL=http://localhost:3001/api
```

## Support

- Check `CLAUDE.md` for detailed project information
- Run `npm run test:all` to verify everything works
- See `docs/` folder for architecture details
