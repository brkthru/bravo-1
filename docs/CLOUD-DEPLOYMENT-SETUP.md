# Cloud Deployment Setup Guide

## Overview
This guide provides instructions for deploying the PostgreSQL raw data backup to cloud storage and setting up MongoDB with the migrated data.

## Raw Data Export Details

### Export Location
```
bravo-1/scripts/postgres-export/postgres-raw-export/
```

### Export Statistics
- **Total Size**: 924 MB
- **Total Records**: 848,937
- **Total Tables**: 24
- **Export Date**: Check export-summary.json

### Key Data Files
- `campaigns.json` - 13,417 campaigns (10.69 MB)
- `users.json` - 326 users with emails
- `line_items.json` - 4,118 line items (4.76 MB)
- `media_buys.json` - 56,020 media buys (34.21 MB)
- `media_platform_entities.json` - 142,333 entities (605.22 MB)

## Cloud Storage Setup

### Step 1: Compress the Export
```bash
cd bravo-1/scripts/postgres-export
tar -czf postgres-backup-$(date +%Y%m%d-%H%M%S).tar.gz postgres-raw-export/

# Verify compression
ls -lh postgres-backup-*.tar.gz
# Expected size: ~150-200 MB compressed
```

### Step 2: Cloud Storage Options

#### AWS S3
```bash
# Configure AWS CLI
aws configure

# Create bucket if needed
aws s3 mb s3://your-media-tool-backups

# Upload backup
aws s3 cp postgres-backup-*.tar.gz s3://your-media-tool-backups/postgres-exports/

# Set lifecycle policy for cost optimization
aws s3api put-bucket-lifecycle-configuration \
  --bucket your-media-tool-backups \
  --lifecycle-configuration file://s3-lifecycle.json
```

#### Google Cloud Storage
```bash
# Configure gcloud
gcloud auth login
gcloud config set project your-project-id

# Create bucket
gsutil mb gs://your-media-tool-backups

# Upload backup
gsutil cp postgres-backup-*.tar.gz gs://your-media-tool-backups/postgres-exports/

# Set storage class for cost optimization
gsutil defstorageclass set NEARLINE gs://your-media-tool-backups
```

#### Azure Blob Storage
```bash
# Login to Azure
az login

# Create storage account and container
az storage account create -n mediatoolbackups -g YourResourceGroup
az storage container create -n postgres-exports --account-name mediatoolbackups

# Upload backup
az storage blob upload \
  --container-name postgres-exports \
  --file postgres-backup-*.tar.gz \
  --name postgres-backup-$(date +%Y%m%d).tar.gz \
  --account-name mediatoolbackups
```

## MongoDB Setup

### Local Development Setup

1. **Start MongoDB**
```bash
cd bravo-1
docker-compose up -d mongodb
```

2. **Import Raw Data**
```bash
# Extract backup if needed
tar -xzf postgres-backup-*.tar.gz

# Import each collection
for file in postgres-raw-export/*.json; do
  collection=$(basename "$file" .json)
  mongoimport --uri mongodb://localhost:27017/mediatool_raw \
    --collection "$collection" \
    --file "$file" \
    --jsonArray
done
```

### Cloud MongoDB Setup

#### MongoDB Atlas

1. **Create Cluster**
   - Go to cloud.mongodb.com
   - Create M10+ cluster for production
   - Enable backup and monitoring

2. **Import Data**
```bash
# Get connection string from Atlas
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/mediatool"

# Import data
for file in postgres-raw-export/*.json; do
  collection=$(basename "$file" .json)
  mongoimport --uri "$MONGO_URI" \
    --collection "$collection" \
    --file "$file" \
    --jsonArray
done
```

3. **Create Indexes**
```javascript
// Connect to MongoDB
mongosh "$MONGO_URI"

// Create indexes for campaigns
db.campaigns.createIndex({ campaign_number: 1 })
db.campaigns.createIndex({ owner_user_id: 1 })
db.campaigns.createIndex({ created_at: -1 })

// Create indexes for users
db.users.createIndex({ zoho_user_id: 1 })
db.users.createIndex({ email: 1 })

// Create indexes for line_items
db.line_items.createIndex({ campaign_id: 1 })
db.line_items.createIndex({ strategy_id: 1 })
```

## Data Transformation Setup

### Step 1: Create Transformation Script
Create `transform-to-mongodb-schema.ts`:

```typescript
import { MongoClient } from 'mongodb';

async function transformData() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    
    const rawDb = client.db('mediatool_raw');
    const targetDb = client.db('mediatool_v2');
    
    // Transform campaigns with embedded users
    const campaigns = await rawDb.collection('campaigns').find().toArray();
    const users = await rawDb.collection('users').find().toArray();
    
    // Create user lookup
    const userMap = new Map(
      users.map(u => [u.zoho_user_id, u])
    );
    
    // Transform each campaign
    for (const campaign of campaigns) {
      const transformed = {
        _id: campaign.id,
        campaignNumber: campaign.campaign_number,
        campaignName: campaign.campaign_name,
        
        team: {
          owner: userMap.get(campaign.owner_user_id) ? {
            userId: campaign.owner_user_id,
            name: userMap.get(campaign.owner_user_id).name,
            email: userMap.get(campaign.owner_user_id).email
          } : null,
          leadAccountManager: userMap.get(campaign.lead_account_owner_user_id) ? {
            userId: campaign.lead_account_owner_user_id,
            name: userMap.get(campaign.lead_account_owner_user_id).name,
            email: userMap.get(campaign.lead_account_owner_user_id).email
          } : null
        },
        
        // ... rest of transformation
      };
      
      await targetDb.collection('campaigns').insertOne(transformed);
    }
    
  } finally {
    await client.close();
  }
}
```

### Step 2: Run Transformation
```bash
bun run transform-to-mongodb-schema.ts
```

## Testing the Migration

### Data Integrity Checks
```javascript
// Check campaign counts
db.campaigns.count() // Should be 13,417

// Verify user relationships
db.campaigns.aggregate([
  { $match: { "team.owner": { $ne: null } } },
  { $count: "campaignsWithOwners" }
])

// Check data structure
db.campaigns.findOne({ campaignNumber: "CN-46" })
```

### Performance Testing
```javascript
// Test campaign list query
db.campaigns.find({ status: "active" })
  .sort({ created_at: -1 })
  .limit(100)
  .explain("executionStats")

// Test aggregation performance
db.lineItems.aggregate([
  { $match: { campaign_id: "campaign_id" } },
  { $group: { _id: null, total: { $sum: "$price" } } }
]).explain("executionStats")
```

## Security Considerations

### Data Protection
1. **Encryption at Rest**
   - Enable encryption for cloud storage
   - Use encrypted MongoDB clusters
   
2. **Access Control**
   - Implement least privilege access
   - Use service accounts for applications
   - Enable audit logging

3. **Data Sanitization**
   - Remove sensitive data for dev/test
   - Anonymize user emails if needed
   - Hash any passwords or tokens

### Backup Strategy
1. **Regular Backups**
   - Daily automated backups
   - Point-in-time recovery enabled
   - Cross-region replication

2. **Restore Testing**
   - Monthly restore drills
   - Document restore procedures
   - Monitor backup health

## Monitoring Setup

### Key Metrics to Monitor
- Database size growth
- Query performance (p95, p99)
- Index usage statistics
- Connection pool utilization
- Replication lag (if applicable)

### Alerting
- Disk space > 80%
- Query time > 1 second
- Replication lag > 10 seconds
- Connection failures
- Backup failures

## Documentation for Team

### Setup Instructions
1. Clone the repository
2. Install dependencies: `bun install`
3. Download backup from cloud storage
4. Run import scripts
5. Verify data integrity

### Common Operations
- Adding new indexes
- Updating transformation logic
- Refreshing dev/test data
- Performance troubleshooting

### Support Contacts
- Database Admin: [contact]
- Cloud Infrastructure: [contact]
- Application Team: [contact]