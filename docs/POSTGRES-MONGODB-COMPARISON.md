# PostgreSQL vs MongoDB Backup Data Comparison

## Overview
This document compares the PostgreSQL source database with the MongoDB backup files to identify data integrity issues and plan proper migration strategies.

## Key Findings

### 1. Campaign Count ✅
- **PostgreSQL**: 13,417 campaigns
- **MongoDB Backup**: 13,417 campaigns
- **Status**: Count matches correctly

### 2. Campaign Identifiers ❌
- **PostgreSQL**: Uses `CN-` prefix (e.g., CN-46, CN-47)
- **MongoDB Backup**: Uses `STR-` prefix (e.g., STR-D1F227C0)
- **Issue**: Campaign numbers don't match between systems

### 3. User/Team Data ❌
- **PostgreSQL**: 
  - Has actual user data with names and emails
  - Example: Shannon Walion (shannon@brkthru.com), Patricia Stewart (patricia@brkthru.com)
  - Users linked via `owner_user_id` and `lead_account_owner_user_id`
- **MongoDB Backup**: 
  - ALL campaigns have the same generic team data:
    ```json
    "team": {
      "leadAccountManager": {
        "id": "default-am",
        "name": "Account Manager",
        "email": "am@company.com"
      },
      "mediaTrader": null
    }
    ```
- **Issue**: User relationships were lost during migration

### 4. Campaign Names ❌
- **PostgreSQL**: Real campaign names (e.g., "Communications Match Agency Promotion")
- **MongoDB Backup**: Generic "Unknown Account Campaign" for many entries
- **Issue**: Campaign names were not properly migrated

## PostgreSQL Schema Analysis

### Tables (34 total)
Key tables include:
- `campaigns` - Main campaign data
- `users` - User information with zoho_user_id
- `teams` - Team structures
- `line_items` - Line item data
- `strategies` - Strategy information
- `media_buys` - Media buy records

### Views (10 total)
Important views:
- `detailed_campaigns` - Comprehensive campaign view with calculated metrics
- `line_item_metrics_view` - Line item performance metrics
- `line_item_delivery_metrics_view` - Delivery metrics

### Campaign Table Structure
```sql
campaigns:
- id (text)
- campaign_name (text)
- campaign_number (text)
- owner_user_id (text) - Links to users.zoho_user_id
- lead_account_owner_user_id (text) - Links to users.zoho_user_id
- budget (currency)
- flight_date (timestamp)
- end_date (timestamp)
- stage (text)
```

### User Table Structure
```sql
users:
- id (uuid) - Primary key
- zoho_user_id (text) - Used for campaign relationships
- name (text)
- email (text)
```

## Migration Issues Identified

1. **User Relationship Mapping**
   - PostgreSQL uses `zoho_user_id` for relationships
   - MongoDB backup lost all user associations
   - Need to re-establish user mappings during migration

2. **Campaign Identification**
   - Campaign numbers changed from CN- to STR- format
   - Original campaign names replaced with generic text
   - Need to map back to original identifiers

3. **Data Structure**
   - PostgreSQL uses normalized structure (separate tables)
   - MongoDB backup appears partially denormalized
   - Missing proper user embeddings

## Recommendations for Proper Migration

### Option 1: Direct PostgreSQL to MongoDB Migration
```javascript
// Pseudo-code for proper migration
const campaign = {
  campaignNumber: pgCampaign.campaign_number,
  name: pgCampaign.campaign_name,
  team: {
    leadAccountManager: {
      id: pgUser.zoho_user_id,
      name: pgUser.name,
      email: pgUser.email
    },
    mediaTrader: null // or fetch from media_trader relationships
  },
  // ... other fields
}
```

### Option 2: Fix Existing MongoDB Data
1. Create a mapping of campaign IDs between systems
2. Query PostgreSQL for user data
3. Update MongoDB documents with correct user information

### Option 3: Hybrid Approach
1. Keep normalized structure in MongoDB
2. Create separate collections:
   - campaigns
   - users
   - teams
3. Use references instead of embedding

## Schema Design Considerations

### Denormalized (Embedded) Design
```javascript
{
  campaignNumber: "CN-46",
  name: "Communications Match Agency Promotion",
  team: {
    leadAccountManager: {
      id: "2461504000000183001",
      name: "Shannon Walion",
      email: "shannon@brkthru.com"
    },
    mediaTrader: {
      id: "user_id",
      name: "Trader Name",
      email: "trader@example.com"
    }
  },
  lineItems: [
    // Embedded line items
  ],
  strategies: [
    // Embedded strategies
  ]
}
```

### Normalized (Referenced) Design
```javascript
// campaigns collection
{
  _id: ObjectId(),
  campaignNumber: "CN-46",
  name: "Communications Match Agency Promotion",
  leadAccountManagerId: "2461504000000183001",
  mediaTraderId: "user_id",
  lineItemIds: [ObjectId(), ObjectId()],
  strategyIds: [ObjectId()]
}

// users collection
{
  _id: "2461504000000183001",
  name: "Shannon Walion",
  email: "shannon@brkthru.com",
  role: "account_manager"
}
```

## Next Steps

1. **Verify PostgreSQL Connection**
   - Connection string: `postgresql://media_tool:pass@localhost:5432/media_tool`
   - Ensure all tables are accessible

2. **Create Proper Migration Script**
   - Map zoho_user_ids to user documents
   - Preserve original campaign numbers (CN- format)
   - Maintain actual campaign names

3. **Test Different Schema Designs**
   - Performance test with denormalized data
   - Compare query patterns for both approaches
   - Consider hybrid approach for frequently accessed data

4. **Data Validation**
   - Compare record counts for all entities
   - Verify user relationships are preserved
   - Ensure metrics and calculations match

## Conclusion

The current MongoDB backup has significant data integrity issues, particularly with user relationships and campaign identifiers. A fresh migration from PostgreSQL is recommended to ensure data accuracy and proper relationships are maintained.