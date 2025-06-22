# Outdated Documentation Notice

This document identifies documentation that may contain outdated or inconsistent information.

## Documentation Status Overview

### ✅ Current and Accurate
- **MongoDB Quick Reference** - Generic MongoDB commands
- **MongoDB Developer Guide** - General best practices
- **MongoDB Joins Guide** - Shows actual separate collection structure
- **MongoDB Advanced Patterns** - Covers multiple approaches
- **Current MongoDB State** - Accurately describes implementation
- **Demo Data** - Current file locations
- **Versioning Analysis** - Accurate assessment

### ⚠️ Contains Proposed Structure (Not Implemented)
These documents describe an embedded document structure that was proposed but not implemented:

1. **Data Structure Proposal** 
   - Shows campaigns with embedded strategies and line items
   - Actual: Separate collections with foreign keys

2. **Frontend Migration Guide**
   - Shows queries for embedded line items
   - Actual: Line items are in a separate collection

3. **Final Summary** 
   - Mixed content: some sections describe proposed structure
   - Other sections correctly describe separate collections

## Key Structural Difference

### Proposed (in some docs):
```javascript
{
  _id: "campaign123",
  name: "Campaign Name",
  strategies: [{
    _id: "strategy456",
    lineItems: [{
      _id: "lineItem789",
      // ... line item data
    }]
  }]
}
```

### Actual Implementation:
```javascript
// Separate collections:
campaigns: { _id: "campaign123", name: "Campaign Name" }
strategies: { _id: "strategy456", campaignId: "campaign123" }
lineItems: { _id: "lineItem789", strategyId: "strategy456", campaignId: "campaign123" }
```

## Recommendations

1. When implementing features, always verify the actual structure using:
   - MongoDB Compass or similar tools
   - The `CURRENT-MONGODB-STATE.md` document
   - Test queries in the actual database

2. For new developers:
   - Start with `CURRENT-MONGODB-STATE.md` for accurate structure
   - Use `MONGODB-JOINS-GUIDE.md` for query examples (uses actual structure)
   - Be aware that some guides show unimplemented proposals

3. Documentation updates needed:
   - Update Frontend Migration Guide with actual query patterns
   - Clarify in proposal documents that they are not implemented
   - Add "PROPOSED" or "ACTUAL" labels to conflicting sections

## Why the Discrepancy?

The documentation reflects the evolution of the project:
1. Initial proposal used embedded documents (traditional MongoDB pattern)
2. Implementation used separate collections (more SQL-like, easier migration)
3. This allowed independent querying of line items as required

The separate collection approach was chosen to:
- Simplify migration from PostgreSQL
- Allow direct line item queries
- Maintain familiar patterns for developers
- Avoid document size limits with large campaigns