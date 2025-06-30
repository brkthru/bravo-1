# Performance Metrics in Bravo-1

## Overview

The media-tool PostgreSQL database contains performance metrics tables that are synced daily from Snowflake. These tables track impressions, video metrics, and other performance data at the platform buy level.

## Available Metrics Tables

### platform_buy_daily_impressions

Daily impression data aggregated by platform buy:

- `date` - The date of the metrics
- `media_buy_id` - Foreign key to media_buys table
- `impressions` - Number of impressions
- `clicks` - Number of clicks
- `spend` - Amount spent
- `created_at` / `updated_at` - Sync timestamps

### platform_buy_daily_videos

Daily video performance metrics:

- `date` - The date of the metrics
- `media_buy_id` - Foreign key to media_buys table
- `video_starts` - Number of video starts
- `video_completions` - Number of completions
- `video_views` - Total views
- `created_at` / `updated_at` - Sync timestamps

## Data Pipeline

1. **Source**: Snowflake data warehouse (production metrics)
2. **Sync**: Daily job runs via pg-boss scheduler
3. **Process**:
   - Looks back 30 days for late-arriving data
   - Merges updates into PostgreSQL tables
   - Handles incremental updates
4. **Storage**: PostgreSQL media_tool database

## Exporting Performance Data

### Complete Export (Recommended)

```bash
# From scripts/postgres-export/
bun export-postgres-complete.ts

# This exports ALL tables including:
# - platform_buy_daily_impressions
# - platform_buy_daily_videos
```

### Upload to S3

```bash
# From scripts/production-pipeline/
./export-and-upload-to-s3.sh

# This will:
# 1. Run complete export
# 2. Create tar.gz archive
# 3. Upload to S3
# 4. Generate download URL
```

## Using Performance Data in ETL

The ETL pipeline automatically loads performance metrics if present:

```bash
# Load data with performance metrics
bun etl-pipeline.ts --clean --verify

# The pipeline will:
# 1. Check for platform_buy_daily_* tables
# 2. Transform date fields to MongoDB dates
# 3. Load into platformBuyDailyImpressions/Videos collections
```

## MongoDB Collections

### platformBuyDailyImpressions

```javascript
{
  _id: ObjectId,
  date: Date,
  media_buy_id: string,
  impressions: number,
  clicks: number,
  spend: number,
  createdAt: Date,
  updatedAt: Date
}
```

### platformBuyDailyVideos

```javascript
{
  _id: ObjectId,
  date: Date,
  media_buy_id: string,
  video_starts: number,
  video_completions: number,
  video_views: number,
  createdAt: Date,
  updatedAt: Date
}
```

## Querying Performance Data

### Aggregate by Campaign

```javascript
// Get total impressions for a campaign
const campaignId = 'some-campaign-id';

// First get all media buys for the campaign
const mediaBuys = await db
  .collection('mediaBuys')
  .find({
    /* criteria to link to campaign */
  })
  .toArray();

const mediaBuyIds = mediaBuys.map((mb) => mb.mediaBuyId);

// Then aggregate impressions
const impressions = await db
  .collection('platformBuyDailyImpressions')
  .aggregate([
    { $match: { media_buy_id: { $in: mediaBuyIds } } },
    {
      $group: {
        _id: null,
        totalImpressions: { $sum: '$impressions' },
        totalClicks: { $sum: '$clicks' },
        totalSpend: { $sum: '$spend' },
      },
    },
  ])
  .toArray();
```

### Daily Performance

```javascript
// Get daily performance for a date range
const startDate = new Date('2025-01-01');
const endDate = new Date('2025-01-31');

const dailyMetrics = await db
  .collection('platformBuyDailyImpressions')
  .find({
    date: { $gte: startDate, $lte: endDate },
  })
  .sort({ date: 1 })
  .toArray();
```

## Notes

1. **Data Availability**: Performance metrics depend on:
   - Snowflake access being configured
   - Daily sync job running successfully
   - Data being available in Snowflake

2. **Data Freshness**:
   - Synced daily with 30-day lookback
   - May have 1-2 day lag from actual performance

3. **Missing Data**: If performance tables are empty:
   - Check PostgreSQL sync logs
   - Verify Snowflake connection
   - Ensure sync job is scheduled

4. **Future Enhancements**:
   - Real-time metrics API integration
   - Hourly granularity
   - Additional metrics (conversions, viewability)
