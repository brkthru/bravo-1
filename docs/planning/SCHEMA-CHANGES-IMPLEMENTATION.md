# Schema Changes Implementation Plan

## Overview

This document tracks the implementation of schema changes based on RR feedback from FIELD-CALCULATIONS-COMPREHENSIVE.md.

## High Priority Changes

### 1. Budget → Price Terminology (In Progress)

**Challenge**: ETL scripts from PostgreSQL use `budget` field, but we want to use `price` in Bravo.

**Solution**:

- Keep both fields during transition
- ETL continues to populate `budget` field
- Transform layer maps `budget` → `price`
- Eventually deprecate `budget` field

**Files to Update**:

- [ ] `shared/src/schemas/entities/campaign.schema.ts`
- [ ] `scripts/etl/transform-postgres-data.ts`
- [ ] `backend/src/services/CampaignService.ts`
- [ ] Frontend components using budget field

### 2. Change metrics.impressions → metrics.units

**Rationale**: Impressions are just one type of unit delivery

**Files to Update**:

- [ ] Campaign schema
- [ ] Line item schema
- [ ] ETL transformation
- [ ] Frontend display components

### 3. Split Margin Fields

**Current**: Single `margin` field
**New**: Separate `marginAmount` (Decimal128) and `marginPercentage` (number)

### 4. Integrate Media Strategy into Campaigns

**Current**: Separate collection
**New**: Embed as subdocument or merge fields

### 5. Performance.impressions → Performance.units

**In**: Line items and platform buys
**Change**: Support multiple unit types beyond impressions

## Medium Priority Changes

### 6. Create Reusable Schemas

- [ ] TeamMember schema (id, name, email, role)
- [ ] User entity schema (preferences, manager, OOO dates)
- [ ] Duration schema (start, end, calculated fields)
- [ ] Budget/Target schema (amount, pacing, tracking)

### 7. Define Enum Schemas

- [ ] Campaign status enum
- [ ] Media strategy status enum
- [ ] Pacing type enum

### 8. Platform Buys Rename

- Rename "Media Buys" → "Platform Buys" throughout system

## Low Priority Changes

### 9. Field Naming Consistency

- Standardize date fields: `dates.start` vs `startDate`
- Remove duplicate fields (profitAmount vs marginAmount)

### 10. Remove Future Fields

- Remove CTR, CVR from campaign metrics
- Remove conversions tracking (not needed yet)

## ETL Compatibility Requirements

### Data Flow

1. PostgreSQL Extract → JSON files
2. Transform script → MongoDB format
3. Load script → API bulk upsert
4. CampaignService → Apply calculations

### Backward Compatibility

- Support both old and new field names during transition
- Use field mapping in transform layer
- Deprecate old fields after migration complete

## Implementation Order

1. **Phase 1**: Schema Updates
   - Add new fields alongside old ones
   - Update validation to accept both

2. **Phase 2**: ETL Updates
   - Update transform script to populate new fields
   - Keep old fields for compatibility

3. **Phase 3**: Service Layer
   - Update calculations to use new fields
   - Add fallback to old fields

4. **Phase 4**: Frontend Updates
   - Update components to use new fields
   - Add TypeScript migrations

5. **Phase 5**: Cleanup
   - Remove old fields from schema
   - Update all tests
   - Remove compatibility code
