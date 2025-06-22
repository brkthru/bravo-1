# MongoDB Developer Guide - Media Tool

## Table of Contents
1. [Understanding MongoDB Data Structures](#understanding-mongodb-data-structures)
2. [MongoDB Admin Tools](#mongodb-admin-tools)
3. [Implementing Full-Text Search](#implementing-full-text-search)
4. [Metrics Architecture](#metrics-architecture)
5. [Next Steps Implementation Plan](#next-steps-implementation-plan)

## Understanding MongoDB Data Structures

### Document-Oriented vs Relational Mindset

#### Key Differences from PostgreSQL

1. **Embedding vs Joining**
   - PostgreSQL: Normalize data, use JOINs to combine
   - MongoDB: Embed related data that's accessed together
   
   ```javascript
   // PostgreSQL mindset (multiple queries with JOINs)
   SELECT c.*, s.*, li.*
   FROM campaigns c
   JOIN strategies s ON s.campaign_id = c.id
   JOIN line_items li ON li.strategy_id = s.id
   
   // MongoDB mindset (single document fetch)
   db.campaigns.findOne({ _id: campaignId })
   // Returns campaign with embedded strategy and line items
   ```

2. **Schema Flexibility**
   - Documents in the same collection can have different fields
   - Add new fields without migrations
   - Store complex nested data naturally

3. **Denormalization for Performance**
   - Store redundant data to avoid lookups
   - Trade storage space for query speed
   - Example: Store both `channelId` and `channelName` in line items

### Our Data Model Design Decisions

#### 1. Campaign Document (Embed Pattern)
```javascript
{
  _id: "campaign-123",
  name: "Q1 Campaign",
  strategy: {                    // Embedded (1:1 relationship)
    _id: "strategy-456",
    lineItems: [                 // Embedded array (1:many, always accessed together)
      {
        _id: "line-item-789",
        mediaPlanIds: ["mp-1"]   // References (many:many relationship)
      }
    ]
  }
}
```

**Why embed?**
- Strategies are always accessed with campaigns
- Line items are always accessed with strategies
- Single read operation gets entire hierarchy

#### 2. Media Plans (Reference Pattern)
```javascript
{
  _id: "media-plan-123",
  lineItemId: "line-item-789",      // Reference
  platformEntityId: "entity-456",    // Reference
  campaignId: "campaign-123",        // Denormalized for queries
  lineItemName: "Display Campaign"   // Denormalized for display
}
```

**Why separate collection?**
- Many-to-many relationship
- Shared across multiple line items
- Independent lifecycle (can be created/deleted separately)

#### 3. Platform Metrics (Time Series Pattern)
```javascript
{
  date: ISODate("2024-01-15"),
  platformEntityId: "entity-456",
  metrics: [
    { unitType: "impressions", units: 250000 },
    { unitType: "clicks", units: 1250 }
  ]
}
```

**Why this structure?**
- Optimized for time-based queries
- Flexible metric types without schema changes
- Easy aggregation across time periods

## MongoDB Admin Tools

### 1. MongoDB Compass (Official GUI)
**Best for**: General browsing, query building, performance analysis
```bash
# Download from MongoDB website
# https://www.mongodb.com/products/compass

# Connect with:
mongodb://localhost:27017/mediatool_v2
```

Features:
- Visual query builder
- Schema analysis
- Index management
- Performance insights

### 2. Studio 3T (Premium with Free Trial)
**Best for**: Advanced queries, data migration, SQL translation
```bash
# Download from https://studio3t.com/
```

Features:
- SQL to MongoDB query translation
- Visual aggregation builder
- Data export/import
- IntelliShell with autocomplete

### 3. NoSQLBooster (Free Version Available)
**Best for**: Developer productivity
```bash
# Download from https://nosqlbooster.com/
```

Features:
- IntelliSense
- Query profiler
- ES6 syntax support
- Built-in MongoDB shell

### 4. Robo 3T (Free, Open Source)
**Best for**: Lightweight browsing
```bash
# Download from https://robomongo.org/
```

Features:
- Simple interface
- Basic CRUD operations
- Embedded shell

### 5. Web-Based Admin UIs

#### AdminMongo (Open Source)
```bash
# Install globally
npm install -g admin-mongo

# Run
admin-mongo

# Access at http://localhost:1234
```

#### Mongo Express (Open Source)
```bash
# Using Docker
docker run -it --rm \
  --name mongo-express \
  -p 8081:8081 \
  -e ME_CONFIG_MONGODB_URL="mongodb://host.docker.internal:27017/" \
  -e ME_CONFIG_BASICAUTH_USERNAME="admin" \
  -e ME_CONFIG_BASICAUTH_PASSWORD="pass" \
  mongo-express

# Access at http://localhost:8081
```

## Implementing Full-Text Search

### 1. MongoDB Native Text Search

#### Create Text Indexes
```javascript
// Campaign search
db.campaigns.createIndex({
  name: "text",
  campaignNumber: "text",
  "strategy.lineItems.name": "text",
  "strategy.lineItems.description": "text"
});

// Platform entity search
db.platformEntities.createIndex({
  name: "text",
  externalId: "text"
});

// User search
db.users.createIndex({
  name: "text",
  email: "text"
});
```

#### Search Implementation
```javascript
// Simple text search
async function searchCampaigns(searchTerm) {
  return await db.campaigns.find({
    $text: { $search: searchTerm }
  }).limit(20).toArray();
}

// With relevance scoring
async function searchWithScore(searchTerm) {
  return await db.campaigns.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } })
   .limit(20)
   .toArray();
}
```

### 2. MongoDB Atlas Search (Cloud)

If using MongoDB Atlas, you get Lucene-based search:

```javascript
// Atlas Search index definition
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "campaignNumber": {
        "type": "string"
      },
      "strategy.lineItems.name": {
        "type": "string",
        "analyzer": "lucene.standard"
      }
    }
  }
}

// Search query
db.campaigns.aggregate([
  {
    $search: {
      index: "campaign_search",
      text: {
        query: "digital marketing",
        path: ["name", "strategy.lineItems.name"],
        fuzzy: { maxEdits: 1 }
      }
    }
  },
  { $limit: 20 }
]);
```

### 3. Elasticsearch Integration

For advanced search capabilities:

```javascript
// Sync MongoDB to Elasticsearch using MongoDB Change Streams
const changeStream = db.campaigns.watch();

changeStream.on('change', async (change) => {
  switch(change.operationType) {
    case 'insert':
    case 'update':
      await esClient.index({
        index: 'campaigns',
        id: change.documentKey._id,
        body: change.fullDocument
      });
      break;
    case 'delete':
      await esClient.delete({
        index: 'campaigns',
        id: change.documentKey._id
      });
      break;
  }
});
```

### 4. Search API Design

```javascript
// Unified search endpoint
app.get('/api/search', async (req, res) => {
  const { q, type, filters } = req.query;
  
  const searchPipeline = [
    // Text search stage
    {
      $match: {
        $text: { $search: q },
        ...(filters.accountId && { accountId: filters.accountId }),
        ...(filters.dateRange && {
          flightDate: { $gte: new Date(filters.dateRange.start) },
          endDate: { $lte: new Date(filters.dateRange.end) }
        })
      }
    },
    // Add search score
    {
      $addFields: {
        searchScore: { $meta: "textScore" }
      }
    },
    // Join with media plans if needed
    {
      $lookup: {
        from: "mediaPlans",
        localField: "strategy.lineItems._id",
        foreignField: "lineItemId",
        as: "mediaPlansSummary"
      }
    },
    // Sort by relevance
    { $sort: { searchScore: -1 } },
    { $limit: 50 }
  ];
  
  const results = await db.campaigns.aggregate(searchPipeline).toArray();
  
  res.json({
    results,
    total: results.length,
    query: q
  });
});
```

## Metrics Architecture

### 1. Current Metrics Structure Analysis

Based on the PostgreSQL schema, we have several metrics sources:

#### Raw Daily Metrics Tables
```sql
-- platform_buy_daily_impressions
- impressions (integer)
- clicks (integer)
- conversions (integer)
- cost (currency)
- total_spend (currency)
- bids (integer)

-- platform_buy_daily_videos
- video_views (integer)
- video_views_2s (integer)
- video_views_p25 (integer) -- 25% completion
- video_views_p50 (integer) -- 50% completion
- video_views_p75 (integer) -- 75% completion
- video_completes (integer)
```

#### Calculated Metrics (from line_item_metrics_view)
```sql
-- Budget & Cost Metrics
- media_budget: calculated from price, unit_price, target_margin
- unit_cost: calculated from unit_price and target_margin
- media_budget_allocated: sum of line_item_media_buy budgets
- unit_cost_incurred: total_spend / actual_delivered_units

-- Delivery Metrics
- target_units: estimated units based on price/unit_price
- actual_delivered_units: sum from platform metrics
- percent_units_delivered: actual / target
- media_revenue_earned: actual_units * unit_price

-- Margin Metrics
- target_margin: specified margin goal
- actual_margin: (revenue - spend) / revenue
- margin_dollars: revenue - spend
```

These need to be transformed into a flexible metrics system that supports:
1. Multiple unit types (impressions, clicks, video views, etc.)
2. Financial calculations (spend, revenue, margin)
3. Performance KPIs (CTR, CPC, CPM, completion rates)
4. Time-based aggregations (hourly, daily, weekly, monthly)

### 2. Proposed Metrics Architecture

#### Level 1: Raw Metrics (Daily Granularity)
```javascript
// Collection: platformMetrics
{
  _id: ObjectId(),
  date: ISODate("2024-01-15"),
  platformEntityId: "entity-123",
  
  // Core metrics as array for flexibility
  metrics: [
    { unitType: "impressions", units: 250000 },
    { unitType: "clicks", units: 1250 },
    { unitType: "conversions", units: 25 },
    { unitType: "video_views", units: 50000 },
    { unitType: "video_completions", units: 40000 }
  ],
  
  // Financial metrics
  spend: 1250.50,
  
  // Denormalized references for fast filtering
  campaignId: "campaign-123",
  accountId: "account-456",
  mediaPlatformId: 1,
  
  // Data quality
  dataComplete: true,
  lastUpdated: ISODate()
}
```

#### Level 2: Pre-Aggregated Metrics (Performance Optimization)
```javascript
// Collection: metricsRollups
{
  _id: ObjectId(),
  
  // Dimensions
  period: "2024-01",          // YYYY-MM for monthly
  periodType: "month",        // day, week, month, quarter, year
  campaignId: "campaign-123",
  accountId: "account-456",
  
  // Aggregated metrics
  totals: {
    spend: 38765.50,
    metrics: [
      { unitType: "impressions", units: 7750000 },
      { unitType: "clicks", units: 38750 },
      { unitType: "conversions", units: 775 },
      { unitType: "video_views", units: 1550000 }
    ]
  },
  
  // Calculated KPIs
  kpis: {
    ctr: 0.005,        // clicks / impressions
    cpc: 1.00,         // spend / clicks
    cpm: 5.00,         // (spend / impressions) * 1000
    cpa: 50.02,        // spend / conversions
    vtr: 0.20,         // video_views / impressions
    vcr: 0.80          // video_completions / video_views
  },
  
  // Breakdowns
  byPlatform: [
    {
      mediaPlatformId: 1,
      mediaPlatformName: "Facebook",
      spend: 20000,
      metrics: [...]
    }
  ],
  
  byLineItem: [
    {
      lineItemId: "li-123",
      lineItemName: "Display Campaign",
      spend: 15000,
      metrics: [...]
    }
  ],
  
  // Metadata
  lastCalculated: ISODate(),
  version: 1
}
```

### 3. Aggregation Pipeline Examples

#### Daily to Monthly Rollup
```javascript
async function calculateMonthlyRollups(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const pipeline = [
    // Match date range
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    
    // Group by campaign
    {
      $group: {
        _id: {
          campaignId: "$campaignId",
          accountId: "$accountId"
        },
        
        // Sum spend
        totalSpend: { $sum: "$spend" },
        
        // Collect all metrics
        allMetrics: { $push: "$metrics" }
      }
    },
    
    // Flatten and sum metrics
    {
      $project: {
        campaignId: "$_id.campaignId",
        accountId: "$_id.accountId",
        period: `${year}-${String(month).padStart(2, '0')}`,
        periodType: "month",
        
        totals: {
          spend: "$totalSpend",
          metrics: {
            $map: {
              input: { $setUnion: ["$allMetrics.unitType"] },
              as: "type",
              in: {
                unitType: "$$type",
                units: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: { $reduce: {
                            input: "$allMetrics",
                            initialValue: [],
                            in: { $concatArrays: ["$$value", "$$this"] }
                          }},
                          cond: { $eq: ["$$this.unitType", "$$type"] }
                        }
                      },
                      in: "$$this.units"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ];
  
  const results = await db.platformMetrics.aggregate(pipeline).toArray();
  
  // Calculate KPIs and save
  for (const result of results) {
    const impressions = result.totals.metrics.find(m => m.unitType === 'impressions')?.units || 0;
    const clicks = result.totals.metrics.find(m => m.unitType === 'clicks')?.units || 0;
    const conversions = result.totals.metrics.find(m => m.unitType === 'conversions')?.units || 0;
    
    result.kpis = {
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? result.totals.spend / clicks : 0,
      cpm: impressions > 0 ? (result.totals.spend / impressions) * 1000 : 0,
      cpa: conversions > 0 ? result.totals.spend / conversions : 0
    };
    
    result.lastCalculated = new Date();
    result.version = 1;
    
    await db.metricsRollups.replaceOne(
      {
        period: result.period,
        campaignId: result.campaignId
      },
      result,
      { upsert: true }
    );
  }
}
```

#### Flexible Date Range Query
```javascript
async function getMetrics(filters) {
  const {
    startDate,
    endDate,
    granularity = 'day',  // day, week, month
    dimensions = ['campaign'],  // campaign, lineItem, platform
    metrics = ['impressions', 'clicks', 'spend'],
    campaignIds,
    accountIds
  } = filters;
  
  // Build match stage
  const matchStage = {
    $match: {
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      ...(campaignIds && { campaignId: { $in: campaignIds } }),
      ...(accountIds && { accountId: { $in: accountIds } })
    }
  };
  
  // Build group key based on granularity and dimensions
  const groupKey = {};
  
  // Time grouping
  switch (granularity) {
    case 'day':
      groupKey.date = "$date";
      break;
    case 'week':
      groupKey.week = { $week: "$date" };
      groupKey.year = { $year: "$date" };
      break;
    case 'month':
      groupKey.month = { $month: "$date" };
      groupKey.year = { $year: "$date" };
      break;
  }
  
  // Dimension grouping
  dimensions.forEach(dim => {
    switch (dim) {
      case 'campaign':
        groupKey.campaignId = "$campaignId";
        break;
      case 'platform':
        groupKey.mediaPlatformId = "$mediaPlatformId";
        break;
      case 'lineItem':
        // Would need to join with mediaPlans
        break;
    }
  });
  
  const pipeline = [
    matchStage,
    
    // Group and aggregate
    {
      $group: {
        _id: groupKey,
        totalSpend: { $sum: "$spend" },
        metricsData: { $push: "$metrics" }
      }
    },
    
    // Format output
    {
      $project: {
        period: "$_id",
        spend: "$totalSpend",
        metrics: {
          $map: {
            input: metrics,
            as: "metricType",
            in: {
              type: "$$metricType",
              value: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: { $reduce: {
                          input: "$metricsData",
                          initialValue: [],
                          in: { $concatArrays: ["$$value", "$$this"] }
                        }},
                        cond: { $eq: ["$$this.unitType", "$$metricType"] }
                      }
                    },
                    in: "$$this.units"
                  }
                }
              }
            }
          }
        }
      }
    },
    
    { $sort: { "period.year": 1, "period.month": 1, "period.date": 1 } }
  ];
  
  return await db.platformMetrics.aggregate(pipeline).toArray();
}
```

### 4. Real-time Metrics Updates

```javascript
// Use MongoDB Change Streams for real-time updates
const metricsChangeStream = db.platformMetrics.watch([
  { $match: { operationType: { $in: ['insert', 'update'] } } }
]);

metricsChangeStream.on('change', async (change) => {
  // Update affected rollups
  const doc = change.fullDocument;
  
  // Update daily rollup
  await updateDailyRollup(doc.date, doc.campaignId);
  
  // Update weekly rollup
  await updateWeeklyRollup(doc.date, doc.campaignId);
  
  // Update monthly rollup
  await updateMonthlyRollup(doc.date, doc.campaignId);
  
  // Emit to WebSocket for real-time dashboard
  io.emit('metrics-update', {
    campaignId: doc.campaignId,
    date: doc.date,
    metrics: doc.metrics
  });
});
```

## Next Steps Implementation Plan

### Phase 1: Search Implementation (Week 1-2)

1. **Create Text Indexes**
   ```bash
   # Run index creation script
   node scripts/create-search-indexes.js
   ```

2. **Build Search API**
   - Implement `/api/search` endpoint
   - Add type-ahead suggestions
   - Implement faceted search

3. **Frontend Integration**
   - Global search bar component
   - Search results page
   - Quick filters

### Phase 2: Metrics Pipeline (Week 2-4)

1. **Set Up Metrics Import**
   ```javascript
   // Daily metrics sync job
   const syncPlatformMetrics = async () => {
     // Fetch from platform APIs
     // Transform to our schema
     // Insert into platformMetrics
   };
   ```

2. **Create Aggregation Jobs**
   - Hourly: Update today's rollups
   - Daily: Finalize yesterday's rollups
   - Weekly: Recalculate last 7 days
   - Monthly: Generate monthly reports

3. **Build Metrics API**
   ```javascript
   // Flexible metrics endpoint
   GET /api/metrics
   POST /api/metrics/query
   GET /api/metrics/export
   ```

4. **Implement Caching**
   ```javascript
   // Redis for frequently accessed rollups
   const getCachedMetrics = async (key) => {
     const cached = await redis.get(key);
     if (cached) return JSON.parse(cached);
     
     const metrics = await calculateMetrics(key);
     await redis.setex(key, 3600, JSON.stringify(metrics));
     return metrics;
   };
   ```

### Phase 3: Analytics Dashboard (Week 4-6)

1. **Dashboard Components**
   - Date range picker
   - Metric selector
   - Dimension selector
   - Chart components (line, bar, pie)
   - Data table with export

2. **Visualization Library**
   ```javascript
   // Using Recharts or D3.js
   <LineChart data={metricsData}>
     <Line type="monotone" dataKey="impressions" />
     <Line type="monotone" dataKey="clicks" />
   </LineChart>
   ```

3. **Real-time Updates**
   ```javascript
   // WebSocket connection for live data
   useEffect(() => {
     const socket = io('/metrics');
     socket.on('metrics-update', (data) => {
       updateChartData(data);
     });
     return () => socket.disconnect();
   }, []);
   ```

### Phase 4: Advanced Features (Week 6-8)

1. **Predictive Analytics**
   - Trend analysis
   - Anomaly detection
   - Forecasting

2. **Custom Reports**
   - Report builder UI
   - Scheduled reports
   - Email delivery

3. **Data Export**
   - CSV/Excel export
   - API for BI tools
   - Scheduled data dumps

### Performance Considerations

1. **Indexing Strategy**
   ```javascript
   // Compound indexes for common queries
   db.platformMetrics.createIndex({ 
     campaignId: 1, 
     date: -1 
   });
   
   db.metricsRollups.createIndex({ 
     period: 1, 
     periodType: 1, 
     campaignId: 1 
   });
   ```

2. **Sharding for Scale**
   ```javascript
   // Shard by date for time-series data
   sh.shardCollection(
     "mediatool_v2.platformMetrics",
     { date: 1, platformEntityId: 1 }
   );
   ```

3. **Archival Strategy**
   - Move data older than 2 years to cold storage
   - Keep last 90 days in hot cache
   - Summarize historical data

## Tools and Libraries

### Backend
- **MongoDB Driver**: Official MongoDB Node.js driver
- **Mongoose**: ODM for schema validation (optional)
- **MongoDB Realm**: For real-time sync
- **Bull**: Job queue for aggregations
- **Redis**: Caching layer

### Search
- **MongoDB Atlas Search**: Cloud-based search
- **Elasticsearch**: Advanced search features
- **Algolia**: Hosted search with great UX

### Analytics
- **Cube.js**: Analytics API layer
- **Apache Superset**: Open-source BI
- **Metabase**: User-friendly analytics

### Visualization
- **Recharts**: React charts
- **D3.js**: Custom visualizations
- **Chart.js**: Simple charts
- **Apache ECharts**: Feature-rich charts

## Monitoring and Maintenance

### 1. Performance Monitoring
```javascript
// Track slow queries
db.setProfilingLevel(1, { slowms: 100 });

// Monitor index usage
db.campaigns.aggregate([
  { $indexStats: {} }
]);
```

### 2. Data Quality Checks
```javascript
// Daily data quality job
const checkDataQuality = async () => {
  // Check for missing metrics
  const missing = await db.platformMetrics.find({
    date: { $gte: yesterday },
    dataComplete: false
  });
  
  // Check for anomalies
  const anomalies = await detectAnomalies();
  
  // Send alerts
  if (missing.length > 0 || anomalies.length > 0) {
    await sendAlert('Data quality issues detected');
  }
};
```

### 3. Backup Strategy
```bash
# Daily backups
mongodump --uri="mongodb://localhost:27017/mediatool_v2" --out=/backup/daily

# Point-in-time recovery with oplog
mongodump --oplog --out=/backup/pitr
```

This guide should help you implement a robust, scalable analytics platform on MongoDB. Start with Phase 1 (search) and Phase 2 (metrics) as they provide immediate value, then build out the advanced features.