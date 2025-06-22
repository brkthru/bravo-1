# PostgreSQL View Functionality Requirements

## Overview
This document outlines the functionality provided by PostgreSQL views in media-tool and requirements for replicating this functionality in MongoDB.

## Core Views and Their Functions

### 1. detailed_campaigns View
**Purpose**: Provides a denormalized, comprehensive view of campaigns with calculated metrics and aggregated data.

**Key Calculations**:
- **Line Item Stats**: Total allocated price, margin calculations, units delivered
- **Media Plan Stats**: Budget allocation, active media plans count
- **Campaign Metrics**: Delivery pacing, spend pacing, margin variance
- **Team Information**: Aggregated team members by role

**Used By**: Campaign search/listing API

**Business Logic**:
```sql
- delivery_pacing = on_pace_revenue / actual_revenue_delivered
- spend_pacing = on_pace_spend / actual_media_spend  
- margin_actual = (revenue - spend) / revenue
- margin_variance = (margin_actual - target_margin) / target_margin
```

### 2. line_item_metrics_view View
**Purpose**: Calculates performance metrics for individual line items.

**Key Calculations**:
- Units delivered vs target
- Revenue earned vs budget
- Pacing calculations (delivery and spend)
- Margin performance
- Media plan allocation status

**Used By**: Line items listing API

**Business Logic**:
```sql
- percent_units_delivered = actual_units / target_units
- percent_revenue_delivered = revenue_earned / line_item_price
- percent_budget_spent = media_spend / media_budget
- days_elapsed calculation for pacing
```

### 3. line_item_delivery_metrics_view View
**Purpose**: Wrapper for line_item_delivery_metrics() function that aggregates platform-level delivery data.

**Key Data**:
- Actual delivered units (impressions, clicks, conversions)
- Total spend across all platforms
- Aggregated by line item

**Used By**: Other views (not directly by application)

### 4. active_platform_buys_view View
**Purpose**: Identifies media buys that had spend activity in the last 24 hours.

**Key Logic**:
- Filters media buys with yesterday's spend > 0
- Used to determine "active" status

**Used By**: Other views for filtering active campaigns

## Calculated Metrics Requirements

### Financial Metrics
1. **Budget Tracking**
   - Total budget vs allocated vs spent
   - Remaining budget calculations
   - Budget utilization percentage

2. **Margin Calculations**
   - Target margin (from line items)
   - Actual margin (revenue - cost) / revenue
   - Margin variance tracking

3. **Revenue Tracking**
   - Revenue earned (units × unit price)
   - Revenue remaining
   - Revenue pacing

### Performance Metrics
1. **Delivery Metrics**
   - Units delivered (impressions, clicks, etc.)
   - Delivery percentage
   - Delivery pacing (actual vs expected based on time)

2. **Spend Metrics**
   - Media spend tracking
   - Spend pacing
   - Cost per unit calculations

3. **Pacing Calculations**
   - Days elapsed / total days
   - Expected delivery based on time
   - Over/under pacing indicators

### Aggregation Requirements
1. **Campaign Level**
   - Sum of all line items
   - Weighted averages for margins
   - Count of active/total items

2. **Strategy Level**
   - Group line items by strategy
   - Roll up metrics to strategy

3. **Time-based**
   - Daily/weekly/monthly aggregations
   - Historical tracking
   - Trend analysis

## Data Relationships in Views

### Team/User Aggregation
- Campaigns → Users (owner, lead account manager)
- Teams → Users (by role: Senior Media Trader, Account Manager, etc.)
- Line Items → Media Traders (array of user IDs)

### Hierarchical Aggregation
```
Campaign
  └── Strategies
      └── Line Items
          └── Media Buys
              └── Platform Entities
```

### Cross-Entity Calculations
- Line item metrics affect campaign totals
- Media buy activity determines active status
- Platform performance rolls up to line items

## MongoDB Implementation Considerations

### Option 1: Materialized Views (Aggregation Pipeline)
- Create aggregation pipelines that replicate view logic
- Store results in separate collections
- Update periodically or on-demand

### Option 2: Real-time Aggregation
- Calculate metrics on query
- Use MongoDB aggregation framework
- May impact performance for complex queries

### Option 3: Hybrid Approach
- Store raw data in normalized collections
- Pre-calculate frequently used metrics
- Use aggregation for complex/rare queries

### Option 4: Event-Driven Updates
- Update calculated fields on data changes
- Use change streams or application events
- Balance between accuracy and performance

## Performance Requirements

### Query Response Times
- Campaign list: < 500ms for 1000 records
- Line item metrics: < 300ms per item
- Aggregated totals: < 100ms

### Update Frequency
- Delivery metrics: Every hour (from platforms)
- Financial calculations: Real-time
- Pacing metrics: Daily recalculation

### Scale Considerations
- 15,000+ campaigns
- 50,000+ line items
- 100,000+ media buys
- Millions of platform entities

## Next Steps

1. **Create Raw Export**: Export all base tables without transformations
2. **Design Schema**: Choose MongoDB schema pattern based on query patterns
3. **Implement Calculations**: Port business logic to MongoDB aggregations
4. **Test Performance**: Ensure queries meet performance requirements
5. **Create Update Strategy**: Design how calculated fields stay current