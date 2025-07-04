# Setup Guide for New Users

This guide helps new developers get the Bravo-1 project running with production data.

## Prerequisites

1. **Install Required Tools**

   ```bash
   # Install Homebrew if not already installed
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

   # Install AWS CLI
   brew install awscli

   # Install Docker Desktop
   # Download from: https://www.docker.com/products/docker-desktop

   # Install Bun
   curl -fsSL https://bun.sh/install | bash

   # Install Node.js (if not already installed)
   brew install node
   ```

2. **Clone the Repository**

   ```bash
   git clone https://github.com/brkthru/bravo_code.git
   cd bravo_code/bravo-1
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

## AWS Setup

1. **Configure AWS SSO**

   Add to `~/.aws/config`:

   ```ini
   [profile brkthru-mediatool-dev]
   sso_session = brkthru-sso
   sso_account_id = 654654602045
   sso_role_name = AdministratorAccess

   [sso-session brkthru-sso]
   sso_region = us-east-1
   sso_start_url = https://d-9067e956d7.awsapps.com/start/#
   sso_registration_scopes = sso:account:access
   ```

2. **Authenticate with AWS**
   ```bash
   aws sso login --sso-session brkthru-sso
   ```

## Database Setup

1. **Start MongoDB Container**

   ```bash
   docker-compose up -d mongodb
   ```

2. **Verify MongoDB is Running**
   ```bash
   docker ps | grep bravo1_mongodb
   ```

## Download and Load Data

### Option 1: Automated Download (Recommended)

```bash
# Navigate to scripts directory
cd scripts/production-pipeline

# Run the download script
./download-from-s3.sh

# This will:
# 1. Show available exports from S3
# 2. Let you choose which export to download
# 3. Download and extract the data
# 4. Optionally load it into MongoDB
```

### Option 2: Manual Download

1. **List Available Exports**

   ```bash
   aws s3 ls s3://media-tool-backups-1750593763/postgres-exports/metadata/ \
     --profile brkthru-mediatool-dev
   ```

2. **Download Specific Export**

   ```bash
   # Set the timestamp you want
   TIMESTAMP="20250622-072326"
   DATE=$(echo $TIMESTAMP | cut -c1-8)

   # Download files
   aws s3 cp \
     s3://media-tool-backups-1750593763/postgres-exports/transformed/${DATE:0:4}-${DATE:4:2}-${DATE:6:2}/${TIMESTAMP}-transformed.tar.gz \
     exports/temp/ \
     --profile brkthru-mediatool-dev
   ```

3. **Extract and Load**

   ```bash
   # Extract
   cd exports/transformed
   tar -xzf ../temp/${TIMESTAMP}-transformed.tar.gz

   # Load into MongoDB
   cd ../../scripts/etl
   cp -r ../../exports/transformed/${TIMESTAMP}/* ./data-transformed/
   bun run load-data.ts
   ```

## Start the Application

1. **Backend Server** (Terminal 1)

   ```bash
   npm run dev:backend
   ```

2. **Frontend Server** (Terminal 2)

   ```bash
   npm run dev:frontend
   ```

3. **Access the Application**
   - Frontend: http://localhost:5174
   - Backend API: http://localhost:3001

## Verify Data

1. **Check MongoDB**

   ```bash
   # Connect to MongoDB
   docker exec -it bravo1_mongodb mongosh

   # In MongoDB shell
   use mediatool_v2
   db.campaigns.countDocuments()  // Should show 13,417
   ```

2. **Check Application**
   - Navigate to http://localhost:5174
   - You should see campaign data loaded

## Troubleshooting

### AWS Authentication Issues

```bash
# Re-authenticate
aws sso login --sso-session brkthru-sso

# Verify authentication
aws sts get-caller-identity --profile brkthru-mediatool-dev
```

### MongoDB Connection Issues

```bash
# Restart MongoDB
docker-compose down
docker-compose up -d mongodb

# Check logs
docker logs bravo1_mongodb
```

### Data Loading Issues

```bash
# Check file permissions
ls -la exports/transformed/

# Verify data files exist
ls scripts/etl/data-transformed/

# Check MongoDB connection
docker exec -it bravo1_mongodb mongosh --eval "db.version()"
```

## Security Notes

- Never commit data files to git (they're in .gitignore)
- Keep AWS credentials secure
- Use read-only AWS profiles when possible
- Data exports may contain sensitive information

## Getting Help

- Check the main README.md
- Review logs in `exports/logs/`
- Ask team members for AWS access if needed
