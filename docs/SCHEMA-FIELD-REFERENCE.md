# Schema Field Reference

This document provides a comprehensive reference of all proposed field names, data types, and their meanings for the Bravo-1 schema system. Fields are organized by entity and include examples to clarify usage.

## Terminology Alignment

Based on the Confluence documentation, we're using these standardized terms:

- **Price**: Amount Brkthru charges the client (not "gross revenue")
- **Net Revenue**: Price minus referral commission (what Brkthru keeps)
- **Media Budget**: Amount available for media spend after margin
- **Unit Price**: Cost per unit (CPM, CPC, etc.)
- **Media Cost**: What Brkthru pays for media

## Important Notes

- **API and DB field names are identical** - No transformation between storage and API
- **Financial values** - MongoDB Decimal128 type, serialized as strings in API per ADR 0019
- **Percentages** - Stored as Decimal128 (0.70 = 70%), serialized as strings in API
- **Pacing metrics** - Indexed at 100% (1.0 = on pace), calculated at query time
- **Zoho fields** - Suffixed with "Zoho" in camelCase (e.g., `startDateZoho`)
- **Rates are snapshots** - Campaign rates are set at creation, not references to account
- **Versioning** - All changes tracked with who, when, what changed, and optional comments

## Account Schema

Fields that define account-level settings that cascade to campaigns:

| Field Name | Type | Description | Example | Display Name | Special Notes |
|------------|------|-------------|---------|--------------|---------------|
| `_id` | string | MongoDB ObjectId | "507f1f77bcf86cd799439011" | ID |
| `name` | string | Account name | "Acme Corporation" | Account Name |
| `zohoAccountId` | string | External Zoho CRM ID | "ACC-12345" | Zoho Account ID | Zoho source |
| **Referral Commission** |
| `hasReferralPartner` | boolean | Whether account has referral partner | true | Has Referral Partner | |
| `referralPartnerName` | string? | Name of referring partner | "Agency ABC" | Referral Partner | |
| `referralRate` | Decimal128? | Commission as decimal (0.10 = 10%) | 0.10 | Referral Rate | ADR 0019 |
| **Agency Markup** |
| `hasAgencyMarkup` | boolean | Whether this is an agency account | false | Agency Account | |
| `agencyMarkupRate` | Decimal128? | Markup as decimal (0.25 = 25%) | 0.25 | Agency Markup Rate | ADR 0019 |
| **Metadata** |
| `isActive` | boolean | Account active status | true | Active | |
| `createdAt` | Date | Creation timestamp | 2025-01-15T10:00:00Z | Created At | |
| `updatedAt` | Date | Last update timestamp | 2025-01-20T15:30:00Z | Updated At | |

## Campaign & Media Strategy Schema

Campaigns contain both Zoho-owned fields and a nested MediaStrategy object with Bravo-owned fields. This 1:1 relationship helps distinguish data ownership and responsibilities.

### Campaign Fields (Zoho-owned)

| Field Name | Type | Description | Example | Display Name | Special Notes |
|------------|------|-------------|---------|--------------|---------------|
| `_id` | string | MongoDB ObjectId | "507f1f77bcf86cd799439011" | Campaign ID | |
| `nameZoho` | string | Campaign name from Zoho | "Summer 2025 Campaign" | Campaign Name | Zoho source |
| `campaignNumberZoho` | string | Unique campaign identifier | "CN-13999" | Campaign Number | Zoho source |
| `accountIdZoho` | string | Link to account | "507f1f77bcf86cd799439011" | Account | Zoho source |
| `statusZoho` | enum | Campaign status | "active" | Status | Zoho source |
| `startDateZoho` | Date | Zoho campaign start date | 2025-07-01 | Campaign Start (Zoho) | Zoho source |
| `endDateZoho` | Date | Zoho campaign end date | 2025-08-31 | Campaign End (Zoho) | Zoho source |
| **Referral & Markup (snapshot from account at creation)** |
| `referralRateZoho` | Decimal128? | Campaign-level referral rate | 0.15 | Referral Rate (Zoho) | Snapshot from account |
| `agencyMarkupRateZoho` | Decimal128? | Campaign-level markup | 0.30 | Agency Markup (Zoho) | Snapshot from account |

### MediaStrategy Fields (Bravo-owned)

| Field Name | Type | Description | Example | Display Name | Special Notes |
|------------|------|-------------|---------|--------------|---------------|
| `startDate` | Date | Media strategy start | 2025-07-01 | Campaign Start | Bravo-owned |
| `endDate` | Date | Media strategy end | 2025-08-31 | Campaign End | Bravo-owned |
| `price` | Decimal128 | Total campaign price | 100000.00 | Campaign Price | ADR 0019 |
| `referralRate` | Decimal128? | Override Zoho rate | 0.12 | Referral Rate | Bravo-owned |
| `agencyMarkupRate` | Decimal128? | Override Zoho rate | 0.25 | Agency Markup | Bravo-owned |

### Calculated/Storage Fields

| Field Name | Type | Description | Example | When Calculated | Display Name |
|------------|------|-------------|---------|-----------------|-------------|
| **Account Snapshots (copied from account at creation, not references)** |
| `initialReferralRate` | Decimal128? | Account rate at creation | 0.10 | Creation | Initial Referral Rate | Snapshot |
| `initialAgencyMarkupRate` | Decimal128? | Account rate at creation | 0.25 | Creation | Initial Agency Markup | Snapshot |
| **Financial Totals (Forward Metrics - Persisted)** |
| `price` | Decimal128 | Sum of all line item prices | 100000.00 | Create/Update | Campaign Price | ADR 0019 |
| `netRevenue` | Decimal128 | Price - commission | 90000.00 | Create/Update | Net Revenue | ADR 0019 |
| `mediaBudget` | Decimal128 | Available for media spend | 27000.00 | Create/Update | Media Budget | ADR 0019 |
| **Metadata** |
| `createdAt` | Date | Creation timestamp | 2025-01-15T10:00:00Z | Creation | Created At |
| `updatedAt` | Date | Last update timestamp | 2025-01-20T15:30:00Z | Update | Updated At |
| `calculatedAt` | Date | When calculations were done | 2025-01-15T10:00:00Z | Create/Update | Calculated At |
| `calculationVersion` | string | Business rule version used | "v1.0" | Create/Update | Calculation Version |

## Line Item Schema

### Base Fields (All Types)

| Field Name | Type | Description | Example | Display Name | Special Notes |
|------------|------|-------------|---------|--------------|---------------|
| `_id` | string | MongoDB ObjectId | "507f1f77bcf86cd799439011" | Line Item ID |
| `name` | string | Line item name | "Display Ads - Q3" | Line Item Name |
| `type` | enum | Line item type | "standard" | Type |
| `campaignId` | string | Parent campaign | "507f1f77bcf86cd799439011" | Campaign |
| `strategyId` | string | Parent strategy | "507f1f77bcf86cd799439012" | Strategy |
| `unitType` | enum | Type of units | "impressions" | Unit Type |
| `flightDates.start` | Date | Line item start | 2025-07-01 | Start Date |
| `flightDates.end` | Date | Line item end | 2025-07-31 | End Date |
| `mediaBudget` | Decimal128 | Media spend allocation | 3000.00 | Media Budget | ADR 0019 |
| **Forward Metrics (Persisted)** |
| `estimatedUnits` | Int64 | Units to deliver | 2857143 | Estimated Units | |

### Standard Line Item

**Input Fields:**
| Field Name | Type | Description | Example | Display Name | Input/Calculated |
|------------|------|-------------|---------|--------------|------------------|
| `price` | Decimal128 | Amount charged to client | 10000.00 | Line Item Price | Input | ADR 0019 |
| `unitPrice` | Decimal128 | Price per unit | 3.50 | Unit Price | Input | ADR 0019 |
| `targetMargin` | Decimal128 | Target margin as decimal | 0.70 | Target Margin | Input | ADR 0019 |

**Calculated Fields (Persisted as Forward Metrics):**
| Field Name | Type | Description | Calculation | Display Name |
|------------|------|-------------|-------------|-------------|
| `estimatedUnits` | Int64 | Units to deliver | price ÷ unitPrice | Estimated Units | |
| `netRevenue` | Decimal128 | After commission | price × (1 - referralRate) | Net Revenue | ADR 0019 |
| `mediaBudget` | Decimal128 | For media spend | netRevenue × (1 - targetMargin) | Media Budget | ADR 0019 |
| `unitCost` | Decimal128 | Cost per unit | mediaBudget ÷ estimatedUnits | Unit Cost | ADR 0019 |

### Management Fee Line Item

**Input Fields:**
| Field Name | Type | Description | Example | Display Name | Input/Calculated |
|------------|------|-------------|---------|--------------|------------------|
| `managementFee` | number | Brkthru's fee | 5000.00 | Management Fee | Input |
| `mediaBudget` | number | Client's media budget | 50000.00 | Media Budget | Input |
| `estimatedUnits` | number | Expected delivery | 1000000 | Estimated Units | Input |

**Calculated Fields (Persisted as Forward Metrics):**
| Field Name | Type | Description | Calculation | Display Name |
|------------|------|-------------|-------------|-------------|
| `price` | number | Same as fee | = managementFee | Line Item Price |
| `unitCost` | number | Media cost per unit | mediaBudget ÷ estimatedUnits | Unit Cost |

### Zero Dollar Line Item

**Input Fields:**
| Field Name | Type | Description | Example | Display Name | Input/Calculated |
|------------|------|-------------|---------|--------------|------------------|
| `mediaBudget` | number | Brkthru pays this | 5000.00 | Media Budget | Input |
| `estimatedUnits` | number | Units to deliver | 100000 | Estimated Units | Input |
| `justification` | string | Why free | "Q4 bonus value-add" | Justification | Input |

**Calculated Fields (Persisted as Forward Metrics):**
| Field Name | Type | Description | Value | Display Name |
|------------|------|-------------|-------|-------------|
| `price` | number | Client price | 0 | Line Item Price |
| `netRevenue` | number | Brkthru revenue | 0 | Net Revenue |
| `targetMargin` | number | Negative margin | -1 | Target Margin |

### Zero Margin Line Item

**Input Fields:**
| Field Name | Type | Description | Example | Display Name | Input/Calculated |
|------------|------|-------------|---------|--------------|------------------|
| `price` | number | Amount charged | 10000.00 | Line Item Price | Input |
| `estimatedUnits` | number | Units to deliver | 500000 | Estimated Units | Input |
| `justification` | string | Why no margin | "Competitive match" | Justification | Input |

**Calculated Fields (Persisted as Forward Metrics):**
| Field Name | Type | Description | Calculation | Display Name |
|------------|------|-------------|-------------|-------------|
| `mediaBudget` | number | Same as net revenue | = netRevenue | Media Budget |
| `targetMargin` | number | No margin | 0 | Target Margin |
| `unitCost` | number | Cost per unit | netRevenue ÷ estimatedUnits | Unit Cost |
| `netRevenue` | number | After commission | price × (1 - referralRate) | Net Revenue |

## PacingSchedule Schema

Each line item has a 1:1 relationship with a PacingSchedule that contains BudgetBlocks defining how budget and units should be allocated over time.

### PacingSchedule Fields

| Field Name | Type | Description | Example | Display Name | Special Notes |
|------------|------|-------------|---------|--------------|---------------|
| `_id` | string | MongoDB ObjectId | "507f1f77bcf86cd799439011" | Pacing Schedule ID |
| `lineItemId` | string | Parent line item | "507f1f77bcf86cd799439012" | Line Item |
| `budgetBlocks` | BudgetBlock[] | Time-based allocations | See below | Budget Blocks |
| `createdAt` | Date | Creation timestamp | 2025-01-15T10:00:00Z | Created At |
| `updatedAt` | Date | Last update timestamp | 2025-01-20T15:30:00Z | Updated At |

### BudgetBlock Fields

| Field Name | Type | Description | Example | Display Name | Input/Calculated |
|------------|------|-------------|---------|--------------|------------------|
| `startDate` | Date | Block start date | 2025-07-01 | Start Date | Input |
| `endDate` | Date | Block end date | 2025-07-31 | End Date | Input |
| `price` | number | Contract price for period | 25000.00 | Block Price | Input |
| `units` | number | Units for period | 714286 | Block Units | Calculated |

**Validation Rules:**
- Sum of all BudgetBlock prices should equal line item price
- Sum of all BudgetBlock units should equal line item estimatedUnits
- Every line item must have at least one BudgetBlock (default: entire flight dates)

## Backward-Looking Metrics (Runtime)

These are calculated on-demand based on actual performance:

| Field Name | Type | Description | Calculation | Display Name | Special Notes |
|------------|------|-------------|-------------|--------------|---------------|
| **Delivery Metrics** |
| `actualUnitsDelivered` | number | Units delivered to date | Sum of actuals | Actual Units | Base metric |
| `deliveryPacing` | number | Delivery vs on-pace target | deliveredPrice ÷ onPacePrice | Delivery Pacing | Indexed at 100% |
| `deliveryProgress` | number | Overall delivery progress | actualUnits ÷ estimatedUnits | Delivery Progress | 0-100% of total |
| `projectedEndUnits` | number | Expected final delivery | Extrapolated | Projected Units | |
| **Spend Metrics** |
| `actualMediaSpend` | number | Money spent to date | Sum of costs | Actual Spend | Base metric |
| `spendPacing` | number | Spend vs on-pace target | actualSpend ÷ onPaceSpend | Spend Pacing | Indexed at 100% |
| `spendProgress` | number | Overall spend progress | actualSpend ÷ mediaBudget | Spend Progress | 0-100% of budget |
| `actualMediaCostPerUnit` | number | Actual unit cost | spend ÷ units | Actual CPM/CPC | |
| **Revenue Metrics** |
| `revenueRecognized` | number | Billable to date | Based on net revenue | Revenue Recognized | Uses netRevenue |
| `revenuePacing` | number | Revenue vs on-pace target | actualRevenue ÷ onPaceRevenue | Revenue Pacing | Indexed at 100% |
| **Margin Metrics** |
| `actualMargin` | number | Current margin % | (netRevenue - spend) ÷ netRevenue | Actual Margin | |
| `marginPerformance` | number | Actual vs target | actualMargin ÷ targetMargin | Margin Performance | |
| `projectedEndMargin` | number | Expected final margin | Extrapolated | Projected Margin | |

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
  referralRate: 10%

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

## Pacing Calculation Examples (Per Confluence 387678209)

### Delivery Pacing (Indexed at 100%)
```
Campaign: $100,000 total, 100 days duration
Day 10: Target delivery = $10,000
        Actual delivery = $11,000
        
Delivery Pacing = $11,000 ÷ $10,000 = 1.10 (110%)
```

### Spend Pacing with Mixed Margins
```
Line Item A: $60,000 price, 70% margin → $18,000 media budget
Line Item B: $40,000 price, 90% margin → $4,000 media budget
Total: $22,000 media budget over 100 days

Day 10: On-pace spend = $2,200
        Actual spend = $2,600
        
Spend Pacing = $2,600 ÷ $2,200 = 1.182 (118.2%)
```

## Versioning & Audit Schema

Every change to MediaStrategy, LineItem, and other Bravo-owned entities is versioned. The system supports both individual entity versioning and campaign-wide version tags (like git commits).

### Campaign Version Tag (Like Git Commit)

| Field Name | Type | Description | Example | Display Name | Special Notes |
|------------|------|-------------|---------|--------------|---------------|
| `_id` | string | Tag ID | "tag-507f1f77bcf86cd799439011" | Tag ID | |
| `campaignId` | string | Campaign this tag belongs to | "507f1f77bcf86cd799439012" | Campaign ID | |
| `tagName` | string | Human-readable tag name | "v1.2-q1-pricing" | Tag Name | Like git tag |
| `tagType` | enum | Type of tag | "release" | Tag Type | release/milestone/checkpoint |
| `description` | string | What this version represents | "Q1 2025 approved pricing" | Description | |
| `userId` | string | Who created the tag | "user-123" | Tagged By | |
| `timestamp` | Date | When tagged | 2025-01-15T10:00:00Z | Tagged At | |
| `entityVersions` | object | Version numbers at tag time | See below | Entity Versions | |

**Entity Versions Structure:**
```javascript
{
  "mediaStrategy": 42,
  "lineItems": {
    "lineitem-001": 15,
    "lineitem-002": 12,
    "lineitem-003": 18
  },
  "pacingSchedules": {
    "pacing-001": 5,
    "pacing-002": 3,
    "pacing-003": 7
  }
}
```

### Version History Entry (Individual Changes)

| Field Name | Type | Description | Example | Display Name | Special Notes |
|------------|------|-------------|---------|--------------|---------------|
| `_id` | string | Version ID | "507f1f77bcf86cd799439011" | Version ID | |
| `entityId` | string | ID of versioned entity | "507f1f77bcf86cd799439012" | Entity ID | |
| `entityType` | enum | Type of entity | "mediaStrategy" | Entity Type | |
| `version` | number | Sequential version number | 42 | Version | |
| `campaignId` | string | Parent campaign | "507f1f77bcf86cd799439013" | Campaign ID | For retrieval |
| `changesetId` | string | Groups related changes | "chg-2025-01-15-001" | Changeset ID | |
| `userId` | string | Who made the change | "user-123" | Changed By | |
| `timestamp` | Date | When changed | 2025-01-15T10:00:00Z | Changed At | |
| `comment` | string? | Optional change comment | "Updated pricing" | Comment | |
| `tags` | string[] | Associated tag IDs | ["tag-507f1f77bcf86cd799439011"] | Tags | |
| `changes` | FieldChange[] | What changed | See below | Changes | |
| `snapshot` | object | Complete entity state | {...} | Snapshot | |

### Field Change Entry

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|  
| `field` | string | Field path | "price" |
| `oldValue` | any | Previous value | 100000.00 |
| `newValue` | any | New value | 110000.00 |
| `calculated` | boolean | Was this calculated? | false |

## Validation Response Schema

API responses include both errors and warnings:

```typescript
interface ValidationResponse {
  success: boolean;
  errors: ValidationError[];    // Blocking issues
  warnings: ValidationWarning[]; // Non-blocking issues
  data?: any;                   // Result if successful
}

interface ValidationError {
  field: string;
  message: string;
  code: string;  // e.g., "INVALID_MARGIN"
}

interface ValidationWarning {
  field: string;
  message: string;
  code: string;  // e.g., "BUDGET_BLOCKS_MISMATCH"
  severity: 'low' | 'medium' | 'high';
}
```

## Key Implementation Notes

1. **Field Naming**: Use exact field names in both API and database (no transformation)
2. **Display Names**: UI can show human-readable names that differ from field names
3. **Financial Precision**: MongoDB Decimal128 type, serialized as strings in API per ADR 0019
4. **Pacing Metrics**: Calculate at query time, index at 100% (1.0 = on pace)
5. **Forward Metrics**: Store directly on entities as persisted fields
6. **Business Logic Versioning**: Track calculation version for all persisted values
7. **Zoho Fields**: Suffixed with "Zoho" (e.g., `nameZoho`, `startDateZoho`)
8. **Rate Snapshots**: Campaign rates are copied from account at creation, not live references
9. **Validation**: Business rules return both errors (blocking) and warnings (informational)
10. **Audit Trail**: Every change tracked with full history, tags, and comments
11. **Version Tags**: Campaign-wide tags capture complete state (like git commits)
12. **Point-in-Time Retrieval**: Can reconstruct entire campaign state at any tag

## Version Retrieval Examples

### Get Campaign State at Tag
```javascript
// Retrieve complete campaign state as of "v1.2-q1-pricing" tag
const taggedVersion = await getCampaignVersionByTag(campaignId, "v1.2-q1-pricing");
// Returns:
{
  mediaStrategy: { /* state at version 42 */ },
  lineItems: [
    { /* lineitem-001 at version 15 */ },
    { /* lineitem-002 at version 12 */ },
    { /* lineitem-003 at version 18 */ }
  ],
  pacingSchedules: [ /* ... */ ]
}
```

### Get Campaign State at Timestamp
```javascript
// Retrieve campaign as it was on specific date
const historicalState = await getCampaignVersionByDate(campaignId, "2025-01-15T10:00:00Z");
```