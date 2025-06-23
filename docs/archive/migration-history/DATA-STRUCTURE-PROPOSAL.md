# Media Tool Data Structure Analysis & Proposal

## Business Context

### Data Ownership & Flow
- **Campaigns** come from Zoho CRM (external system, not owned by Bravo)
- **Strategies** are Bravo-owned data (up to 1 per campaign)
- **Line Items** define the tactical execution within strategies
- **Media Plans** (formerly media_buys) map line items to platform entities with planning data
- **Platform Entities** sync from external platforms (Facebook, TikTok, Beeswax, etc.)

### Key Business Rules
1. **Non-overlapping Media Plans**: Two different media plans cannot use the same platform entity for overlapping date ranges
2. **Strategy-Campaign Relationship**: Maximum one strategy per campaign (0:1 relationship)
3. **Data Ownership**: 
   - Zoho owns campaign data (read-only in Bravo)
   - Bravo owns strategy and line item data
   - Platform entities are synced from external systems

### Current PostgreSQL Structure (What We Migrated)

#### Core Entities
1. **campaigns** - From Zoho CRM
   - External campaign data (budget, dates, goals, ownership)
   - Links to accounts and users

2. **strategies** - Bravo-owned strategy data
   - One-to-one with campaigns (but not all campaigns have strategies)
   - Contains Bravo-specific planning and execution details

3. **line_items** - Tactical execution items
   - Zero-to-many per strategy
   - Contains targeting, pricing, dates, audience info
   - Links to channels, tactics, unit price types

4. **media_buys** → **media_plans** (rename needed)
   - Maps line items to platform entities
   - Minimal data currently

5. **line_item_media_buys** - Junction table with planning data
   - Contains planned cost, impressions, time periods
   - Enforces non-overlapping time periods per platform entity
   - Many-to-many between line items and platform entities

6. **media_platform_entities** → **platform_entities**
   - Synced from external platforms (Facebook campaigns, TikTok ads, etc.)
   - Has configuration and performance data
   - Tracked with history

7. **platform_buy_daily_impressions** & **platform_buy_daily_videos** - Metrics tables
   - Daily granularity performance data
   - Per platform entity metrics (spend, units)

#### Supporting Entities
- **accounts** - Client accounts (contain campaigns, but not embedded)
- **teams** - Team organizations  
- **users** - System users
- **channels** - Media channels (e.g., Display, Video)
- **tactics** - Specific tactics within channels
- **media_platforms** - Platform definitions (e.g., Google Ads, Facebook)
- **unit_price_types** - Pricing models (CPM, CPC, etc.)

## Proposed MongoDB Structure

### 1. Campaign Document (with embedded Strategy)
```javascript
{
  _id: "campaign-uuid",
  
  // Campaign Info (from Zoho, read-only in Bravo)
  name: "Campaign Name",
  campaignNumber: "CAMP-001",
  budget: 150000,
  stage: "active",
  isNewBusiness: true,
  goalsKPIs: "Achieve 10M impressions",
  flightDate: ISODate("2024-01-01"),
  endDate: ISODate("2024-03-31"),
  
  // Relationships
  accountId: "account-uuid",
  agencyId: "agency-uuid",
  ownerUserId: "user-uuid",
  leadAccountOwnerUserId: "user-uuid",
  salesRepUserId: "user-uuid",
  
  // Strategy (Bravo-owned, optional - not all campaigns have strategies)
  strategy: {
    _id: "strategy-uuid",
    name: "Q1 2024 Digital Strategy",
    objectives: "Drive brand awareness in key markets",
    
    // Line Items (embedded in strategy)
    lineItems: [
      {
        _id: "line-item-uuid",
        name: "Display - Prospecting",
        description: "Top funnel display campaign",
        
        // Targeting
        audience: "Adults 25-54",
        geo: "US National",
        targeting: "Interest-based targeting",
        adFormats: "Display banners",
        
        // Budget & Pricing
        startDate: ISODate("2024-01-01"),
        endDate: ISODate("2024-01-31"),
        budget: 50000,
        unitPrice: 5.00,
        targetMargin: 0.20,
        
        // Pacing
        pacingType: "even",
        pacingDetails: {},
        
        // References (with denormalized names for performance)
        channelId: 1,
        channelName: "Display",
        tacticId: 5,
        tacticName: "Prospecting",
        unitPriceTypeId: 2,
        unitPriceTypeName: "CPM",
        
        // Media Plan IDs (references to mediaPlan collection)
        mediaPlanIds: ["media-plan-uuid-1", "media-plan-uuid-2"],
        
        // Team assignments
        mediaTraderUserIds: ["user-uuid-1", "user-uuid-2"],
        
        // Rollup metrics (calculated from media plans)
        metrics: {
          totalPlannedSpend: 45000,
          totalPlannedUnits: 9000000,
          totalActualSpend: 12500,
          totalActualUnits: 2500000,
          lastUpdated: ISODate("2024-01-15")
        }
      }
    ],
    
    createdAt: ISODate("2023-12-01"),
    updatedAt: ISODate("2024-01-01")
  },
  
  // Metadata
  createdAt: ISODate("2023-12-01"),
  updatedAt: ISODate("2024-01-01"),
  isActive: true,
  version: 1
}
```

### 2. Media Plan Document (Junction between Line Items and Platform Entities)
```javascript
{
  _id: "media-plan-uuid",
  
  // References
  lineItemId: "line-item-uuid",
  strategyId: "strategy-uuid",  // For faster queries
  campaignId: "campaign-uuid",   // For faster queries
  platformEntityId: "platform-entity-uuid",
  
  // Planning Data
  plannedSpend: 25000,
  plannedUnits: 5000000,
  unitType: "impressions",  // impressions, clicks, conversions, video_views
  
  // Date Range (enforced non-overlapping per platformEntityId)
  startDate: ISODate("2024-01-01"),
  endDate: ISODate("2024-01-15"),
  
  // Actual Performance (rolled up from daily metrics)
  actualSpend: 12500,
  actualUnits: 2500000,
  
  // Status
  status: "active",  // planned, active, paused, completed
  
  // Denormalized for performance
  lineItemName: "Display - Prospecting",
  platformEntityName: "Facebook Campaign XYZ",
  mediaPlatformName: "Facebook",
  
  // Metadata
  createdAt: ISODate("2023-12-01"),
  updatedAt: ISODate("2024-01-15"),
  createdBy: "user-uuid",
  isActive: true
}
```

### 3. Platform Entity Document (Synced from External Platforms)
```javascript
{
  _id: "platform-entity-uuid",
  
  // Platform Identification
  mediaPlatformId: 1,
  mediaPlatformName: "Facebook",
  externalId: "fb_campaign_123",  // ID in the external platform
  entityType: "campaign",  // campaign, ad_set, ad, etc.
  
  // Configuration (how it's set up on the platform)
  name: "Q1 2024 Prospecting Campaign",
  config: {
    objective: "CONVERSIONS",
    bidStrategy: "LOWEST_COST",
    dailyBudget: 1000,
    targeting: {
      ageMin: 25,
      ageMax: 54,
      geoLocations: ["US"],
      interests: ["technology", "business"]
    },
    // Platform-specific config
    platformSpecific: {
      // Facebook-specific settings
    }
  },
  
  // Sync Status
  lastSynced: ISODate("2024-01-15T10:00:00Z"),
  syncStatus: "success",
  
  // Media Plans using this entity
  mediaPlanIds: ["media-plan-uuid-1", "media-plan-uuid-2"],
  
  // Metadata
  createdAt: ISODate("2023-12-01"),
  updatedAt: ISODate("2024-01-15"),
  isActive: true
}
```

### 4. Platform Metrics Document (Time Series Data)
```javascript
{
  _id: ObjectId(),
  
  // Entity Reference
  platformEntityId: "platform-entity-uuid",
  mediaPlatformId: 1,
  mediaPlatformName: "Facebook",
  
  // Date (indexed for range queries)
  date: ISODate("2024-01-15"),
  
  // Core Metrics
  spend: 1250.50,
  
  // Units (all metric types stored as units with type)
  metrics: [
    { unitType: "impressions", units: 250000 },
    { unitType: "clicks", units: 1250 },
    { unitType: "conversions", units: 25 },
    { unitType: "video_views", units: 50000 }
  ],
  
  // Calculated metrics
  calculatedMetrics: {
    ctr: 0.005,      // clicks / impressions
    cpc: 1.00,       // spend / clicks
    cpm: 5.00,       // (spend / impressions) * 1000
    cpa: 50.02       // spend / conversions
  },
  
  // Data Quality
  dataComplete: true,
  lastUpdated: ISODate("2024-01-16T02:00:00Z"),
  
  // Denormalized for faster queries
  campaignId: "campaign-uuid",
  accountId: "account-uuid"
}
```

### 5. Account Document (Separate, not embedding campaigns)
```javascript
{
  _id: "account-uuid",
  name: "Acme Corporation",
  type: "client",
  
  // Relationships
  parentId: "parent-account-uuid",
  teamId: "team-uuid",
  
  // Business Info
  referralPartner: "Partner ABC",
  referralPartnerCommission: 0.10,
  hasReferralCommission: true,
  
  // Rollup Metrics (calculated periodically)
  metrics: {
    totalCampaigns: 15,
    activeCampaigns: 5,
    totalSpend: 1500000,
    ytdSpend: 500000,
    lastUpdated: ISODate("2024-01-15")
  },
  
  // Metadata
  modifiedTime: ISODate("2024-01-01"),
  createdAt: ISODate("2023-01-01"),
  isActive: true
}
```

### 6. User Document (Enhanced with roles and hierarchy)
```javascript
{
  _id: "user-uuid",
  email: "john.doe@company.com",
  name: "John Doe",
  
  // Role-based access
  role: "media_trader",  // account_manager, account_director, media_trader, senior_media_trader, media_director, supervisor, csd
  department: "media",
  
  // Organizational hierarchy
  managerId: "manager-user-uuid",  // Direct manager
  teamId: "team-uuid",
  
  // Permissions (based on role)
  permissions: {
    canEditCampaigns: false,
    canEditStrategies: true,
    canEditLineItems: true,
    canViewReports: true,
    canManageUsers: false
  },
  
  // Activity tracking
  lastLogin: ISODate("2024-01-15T09:00:00Z"),
  loginCount: 245,
  
  // Metadata
  createdAt: ISODate("2023-01-01"),
  updatedAt: ISODate("2024-01-15"),
  isActive: true,
  zohoUserId: "zoho_123"
}
```

### 7. Supporting Collections (Reference Data)
- **teams** - Team organizations with hierarchy
- **channels** - Media channels (Display, Video, Social, etc.)
- **tactics** - Specific tactics within channels
- **mediaPlatforms** - Platform definitions (Facebook, Google, TikTok, etc.)
- **unitPriceTypes** - Pricing models (CPM, CPC, CPA, etc.)

## Handling Many-to-Many Relationships in MongoDB

### The Media Plan Junction Pattern
The many-to-many relationship between Line Items and Platform Entities is handled through a separate `mediaPlan` collection that acts as a junction table with additional attributes:

1. **Separate Collection**: Media Plans are stored separately, not embedded
2. **Bidirectional References**: 
   - Line Items store array of mediaPlanIds
   - Platform Entities store array of mediaPlanIds
   - Media Plans store both lineItemId and platformEntityId
3. **Denormalized Data**: Key fields are duplicated for query performance
4. **Enforced Constraints**: Application logic prevents overlapping date ranges

### Non-Overlapping Date Range Enforcement
To ensure no two media plans overlap for the same platform entity:

```javascript
// Index to help with overlap checking
db.mediaPlans.createIndex({ 
  platformEntityId: 1, 
  startDate: 1, 
  endDate: 1,
  isActive: 1 
});

// Query to check for overlaps before insert/update
db.mediaPlans.find({
  platformEntityId: "platform-entity-uuid",
  isActive: true,
  $or: [
    { startDate: { $lte: newEndDate }, endDate: { $gte: newStartDate } }
  ]
});
```

## Indexing Strategy

### Campaign Collection
```javascript
db.campaigns.createIndex({ accountId: 1, isActive: 1 });
db.campaigns.createIndex({ campaignNumber: 1 });
db.campaigns.createIndex({ "strategy.lineItems._id": 1 });
db.campaigns.createIndex({ flightDate: 1, endDate: 1 });
```

### Media Plan Collection
```javascript
db.mediaPlans.createIndex({ lineItemId: 1 });
db.mediaPlans.createIndex({ platformEntityId: 1 });
db.mediaPlans.createIndex({ campaignId: 1, startDate: 1, endDate: 1 });
db.mediaPlans.createIndex({ status: 1, endDate: 1 }); // For active plans
```

### Platform Metrics Collection (Time Series)
```javascript
db.platformMetrics.createIndex({ platformEntityId: 1, date: -1 });
db.platformMetrics.createIndex({ date: -1 });
db.platformMetrics.createIndex({ campaignId: 1, date: -1 });
db.platformMetrics.createIndex({ accountId: 1, date: -1 });
```

## Common Query Patterns

### 1. Get Campaign with Full Hierarchy
```javascript
// Single query gets everything except media plans
const campaign = await db.campaigns.findOne({ 
  _id: campaignId 
});

// Optional: Get media plans for all line items
const lineItemIds = campaign.strategy?.lineItems.map(li => li._id) || [];
const mediaPlans = await db.mediaPlans.find({ 
  lineItemId: { $in: lineItemIds } 
}).toArray();
```

### 2. Get Platform Entity Performance
```javascript
// Get metrics for date range
const metrics = await db.platformMetrics.find({
  platformEntityId: entityId,
  date: { $gte: startDate, $lte: endDate }
}).sort({ date: 1 }).toArray();

// Aggregate by month
const monthlyMetrics = await db.platformMetrics.aggregate([
  { $match: { 
    platformEntityId: entityId,
    date: { $gte: startDate, $lte: endDate }
  }},
  { $group: {
    _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
    totalSpend: { $sum: "$spend" },
    totalImpressions: { $sum: "$impressions" }
  }}
]);
```

### 3. Check for Media Plan Overlaps
```javascript
async function checkMediaPlanOverlap(platformEntityId, startDate, endDate, excludeId = null) {
  const query = {
    platformEntityId,
    isActive: true,
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return await db.mediaPlans.findOne(query);
}
```

## Migration Mapping

### Old Structure → New Structure
- `campaigns` → `campaigns` collection (same structure)
- `strategies` → Embedded as `strategy` within campaigns
- `line_items` → Embedded as `lineItems[]` within strategy
- `media_buys` + `media_platform_entities` → `platformEntities` collection
- `line_item_media_buys` → `mediaPlans` collection (junction)
- `platform_buy_daily_impressions/videos` → `platformMetrics` collection

### Benefits of This Structure

1. **Natural Hierarchy**: Campaigns contain strategies contain line items
2. **Flexible Metrics**: Time series data supports any granularity
3. **Performance**: Denormalization reduces joins while references prevent duplication
4. **Scalability**: Metrics in separate collection won't bloat main documents
5. **Business Logic**: Non-overlapping media plans enforced at application level

## Considerations

1. **Transactions**: Use MongoDB transactions when updating media plans to ensure consistency
2. **Aggregations**: May need materialized views for complex cross-campaign analytics
3. **Data Sync**: Platform entities need regular sync jobs
4. **Metrics Rollup**: Consider pre-aggregating metrics for common time periods

## Recommended Naming Changes

### Collections
- `media_buys` → `mediaPlans`
- `line_item_media_buys` → Merged into `mediaPlans` collection
- `media_platform_entities` → `platformEntities`
- `platform_buy_daily_impressions/videos` → `platformMetrics`

### Field Names
- Within campaigns/strategies:
  - Keep `campaigns` as the collection name
  - Embed `strategy` object (singular) within campaign
  - Embed `lineItems` array within strategy
  
- Within media plans:
  - `media_buy_id` → `_id`
  - `line_item_id` → `lineItemId`
  - `media_platform_entity_id` → `platformEntityId`
  - Add `strategyId` and `campaignId` for faster queries
  
- Within platform entities:
  - `media_platform_entity_id` → `_id`
  - Add `externalId` for the platform's ID
  - Add `entityType` to distinguish campaigns/ad sets/ads
  
- Consistent naming patterns:
  - Use camelCase for all field names
  - Use `Id` suffix for foreign keys (not `_id`)
  - Use past tense for dates (`createdAt`, `updatedAt`)
  - Use `is` prefix for booleans (`isActive`, `isDeleted`)