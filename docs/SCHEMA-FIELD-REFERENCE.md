# Schema Field Reference

This document provides a comprehensive reference of all proposed field names, data types, and their meanings for the Bravo-1 schema system. Fields are organized by entity and include examples to clarify usage.

## Terminology Alignment

Based on the Confluence documentation, we're using these standardized terms:

- **Price**: Amount Brkthru charges the client (not "gross revenue")
- **Net Revenue**: Price minus referral commission (what Brkthru keeps)
- **Media Budget**: Amount available for media spend after margin
- **Unit Price**: Cost per unit (CPM, CPC, etc.)
- **Media Cost**: What Brkthru pays for media

## Account Schema

Fields that define account-level settings that cascade to campaigns:

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `_id` | string | MongoDB ObjectId | "507f1f77bcf86cd799439011" |
| `name` | string | Account name | "Acme Corporation" |
| `zohoAccountId` | string | External Zoho CRM ID | "ACC-12345" |
| **Referral Commission** |
| `hasReferralPartner` | boolean | Whether account has referral partner | true |
| `referralPartnerName` | string? | Name of referring partner | "Agency ABC" |
| `referralCommissionRate` | number? | Commission as decimal (0.10 = 10%) | 0.10 |
| **Agency Markup** |
| `hasAgencyMarkup` | boolean | Whether this is an agency account | false |
| `agencyMarkupRate` | number? | Markup as decimal (0.25 = 25%) | 0.25 |
| **Metadata** |
| `isActive` | boolean | Account active status | true |
| `createdAt` | Date | Creation timestamp | 2025-01-15T10:00:00Z |
| `updatedAt` | Date | Last update timestamp | 2025-01-20T15:30:00Z |

## Campaign Schema

### Input Fields (User Provided)

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `name` | string | Campaign name | "Summer 2025 Campaign" |
| `campaignNumber` | string | Unique campaign identifier | "CN-13999" |
| `accountId` | string | Link to account | "507f1f77bcf86cd799439011" |
| `status` | enum | Campaign status | "active" |
| `dates.start` | Date | Campaign start date | 2025-07-01 |
| `dates.end` | Date | Campaign end date | 2025-08-31 |
| **Optional Overrides** |
| `referralCommissionRate` | number? | Override account default | 0.15 |
| `agencyMarkupRate` | number? | Override account default | 0.30 |

### Calculated/Storage Fields

| Field Name | Type | Description | Example | When Calculated |
|------------|------|-------------|---------|-----------------|
| `_id` | string | MongoDB ObjectId | "507f1f77bcf86cd799439011" | Creation |
| **Account Snapshots** |
| `initialAccountCommissionRate` | number? | Account rate at creation | 0.10 | Creation |
| `initialAccountMarkupRate` | number? | Account rate at creation | 0.25 | Creation |
| **Financial Totals** |
| `totalPrice` | number | Sum of all line item prices | 100000.00 | Create/Update |
| `totalNetRevenue` | number | Price - commission | 90000.00 | Create/Update |
| `totalMediaBudget` | number | Available for media spend | 27000.00 | Create/Update |
| **Metadata** |
| `createdAt` | Date | Creation timestamp | 2025-01-15T10:00:00Z | Creation |
| `updatedAt` | Date | Last update timestamp | 2025-01-20T15:30:00Z | Update |
| `calculatedAt` | Date | When calculations were done | 2025-01-15T10:00:00Z | Create/Update |
| `calculationVersion` | string | Business rule version used | "v1.0" | Create/Update |

## Line Item Schema

### Base Fields (All Types)

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `_id` | string | MongoDB ObjectId | "507f1f77bcf86cd799439011" |
| `name` | string | Line item name | "Display Ads - Q3" |
| `type` | enum | Line item type | "standard" |
| `campaignId` | string | Parent campaign | "507f1f77bcf86cd799439011" |
| `strategyId` | string | Parent strategy | "507f1f77bcf86cd799439012" |
| `unitType` | enum | Type of units | "impressions" |
| `flightDates.start` | Date | Line item start | 2025-07-01 |
| `flightDates.end` | Date | Line item end | 2025-07-31 |

### Standard Line Item

**Input Fields:**
| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `price` | number | Amount charged to client | 10000.00 |
| `unitPrice` | number | Price per unit | 3.50 |
| `targetMargin` | number | Target margin as decimal | 0.70 |

**Calculated Fields:**
| Field Name | Type | Description | Calculation |
|------------|------|-------------|-------------|
| `estimatedUnits` | number | Units to deliver | price ÷ unitPrice |
| `netRevenue` | number | After commission | price × (1 - commissionRate) |
| `mediaBudget` | number | For media spend | netRevenue × (1 - targetMargin) |
| `unitCost` | number | Cost per unit | mediaBudget ÷ estimatedUnits |

### Management Fee Line Item

**Input Fields:**
| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `managementFee` | number | Brkthru's fee | 5000.00 |
| `mediaBudget` | number | Client's media budget | 50000.00 |
| `estimatedUnits` | number | Expected delivery | 1000000 |

**Calculated Fields:**
| Field Name | Type | Description | Calculation |
|------------|------|-------------|-------------|
| `price` | number | Same as fee | = managementFee |
| `unitCost` | number | Media cost per unit | mediaBudget ÷ estimatedUnits |

### Zero Dollar Line Item

**Input Fields:**
| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `mediaBudget` | number | Brkthru pays this | 5000.00 |
| `estimatedUnits` | number | Units to deliver | 100000 |
| `justification` | string | Why free | "Q4 bonus value-add" |

**Calculated Fields:**
| Field Name | Type | Description | Value |
|------------|------|-------------|-------|
| `price` | number | Client price | 0 |
| `netRevenue` | number | Brkthru revenue | 0 |
| `targetMargin` | number | Negative margin | -1 |

### Zero Margin Line Item

**Input Fields:**
| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `price` | number | Amount charged | 10000.00 |
| `estimatedUnits` | number | Units to deliver | 500000 |
| `justification` | string | Why no margin | "Competitive match" |

**Calculated Fields:**
| Field Name | Type | Description | Calculation |
|------------|------|-------------|-------------|
| `mediaBudget` | number | Same as price | = price |
| `targetMargin` | number | No margin | 0 |
| `unitCost` | number | Cost per unit | price ÷ estimatedUnits |

## Forward-Looking Metrics (Persisted)

These are calculated once and stored, representing contractual obligations:

| Field Name | Type | Description | When Set |
|------------|------|-------------|----------|
| **Financial Commitments** |
| `estimatedUnits` | number | Contracted delivery | Creation |
| `estimatedGrossRevenue` | number | Total billable (same as price) | Creation |
| `estimatedNetRevenue` | number | After commissions | Creation |
| `contractedMarginAmount` | number | Expected profit | Creation |
| `mediaBudget` | number | Allocated for media | Creation |
| **Commission/Markup** |
| `referralCommissionAmount` | number? | Commission owed | Creation |
| `agencyMarkupAmount` | number? | Markup amount | Creation |
| **Metadata** |
| `calculatedAt` | Date | When calculated | Creation |
| `calculationVersion` | string | Rules version | Creation |

## Backward-Looking Metrics (Runtime)

These are calculated on-demand based on actual performance:

| Field Name | Type | Description | Calculation |
|------------|------|-------------|-------------|
| **Delivery Metrics** |
| `actualUnitsDelivered` | number | Units delivered to date | Sum of actuals |
| `deliveryPacing` | number | Progress vs target | actual ÷ target |
| `deliveryPacingCumulative` | number | Overall progress | cumulative ÷ total |
| `projectedEndUnits` | number | Expected final delivery | Extrapolated |
| **Spend Metrics** |
| `actualMediaSpend` | number | Money spent to date | Sum of costs |
| `spendPacing` | number | Spend vs budget | spend ÷ budget |
| `costEfficiency` | number | Target ÷ actual cost | Higher is better |
| `mediaCostPerUnit` | number | Actual unit cost | spend ÷ units |
| **Revenue Metrics** |
| `revenueRecognized` | number | Billable to date | Based on delivery |
| `revenuePacing` | number | Revenue vs target | actual ÷ target |
| **Margin Metrics** |
| `actualMargin` | number | Current margin % | (revenue - spend) ÷ revenue |
| `marginPerformance` | number | Actual vs target | actual ÷ target |
| `projectedEndMargin` | number | Expected final margin | Extrapolated |

## API Field Formats

Per ADR 0019, financial values in API requests/responses use string format:

| Internal Type | API Format | Example |
|---------------|------------|---------|
| number (financial) | string | "10000.00" |
| number (percentage) | string | "0.70" |
| Date | ISO 8601 string | "2025-01-15T10:00:00Z" |
| ObjectId | string | "507f1f77bcf86cd799439011" |

## Unit Types

Valid values for `unitType` field:

- `impressions` - Display ad views
- `clicks` - Click-throughs
- `conversions` - Completed actions
- `video_views` - Video plays
- `completed_video_views` - Videos watched to completion
- `engagements` - Social interactions
- `leads` - Form submissions

## Calculation Examples

### Standard Line Item with Referral Commission

```
Input:
  price: $10,000
  unitPrice: $5.00 CPM
  targetMargin: 70%
  referralCommissionRate: 10%

Calculations:
  estimatedUnits = $10,000 ÷ $5.00 = 2,000,000 impressions
  referralCommission = $10,000 × 10% = $1,000
  netRevenue = $10,000 - $1,000 = $9,000
  mediaBudget = $9,000 × (1 - 70%) = $2,700
  unitCost = $2,700 ÷ 2,000,000 = $1.35 CPM
```

### Agency Markup Campaign

```
Input (advertiser price mode):
  advertiserPrice: $20,000
  agencyMarkupRate: 25%
  targetMargin: 70%

Calculations:
  price = $20,000 ÷ (1 + 25%) = $16,000
  netRevenue = $16,000 (no commission)
  mediaBudget = $16,000 × (1 - 70%) = $4,800
```

## Questions for Review

1. Should we use `price` consistently instead of any revenue terminology for client-facing amounts?
2. Are the commission/markup field names clear enough?
3. Should calculated fields have a prefix like `calculated_` or suffix like `_calculated`?
4. Do we need to track who/what system calculated each field?
5. Should we use basis points (integer) or decimals for percentages?