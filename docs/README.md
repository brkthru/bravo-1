# Bravo-1 Documentation

Welcome to the Bravo-1 documentation. This directory contains organized documentation for the MongoDB-based media planning system.

## Documentation Structure

### 📁 [MongoDB Documentation](./mongodb/)
- [MongoDB Quick Reference](./mongodb/MONGODB-QUICK-REFERENCE.md) - Common MongoDB commands and operations
- [MongoDB Developer Guide](./mongodb/MONGODB-DEVELOPER-GUIDE.md) - Comprehensive guide with tools and patterns
- [MongoDB Joins Guide](./mongodb/MONGODB-JOINS-GUIDE.md) - How to perform joins in MongoDB
- [MongoDB Advanced Patterns](./mongodb/MONGODB-ADVANCED-PATTERNS.md) - Advanced querying and optimization

### 📁 [Migration Documentation](./migration/)
- [Current MongoDB State](./migration/CURRENT-MONGODB-STATE.md) - Current database structure and statistics
- [Migration README](./migration/MIGRATION-README.md) - Basic migration instructions
- [Migration Summary](./migration/MIGRATION-SUMMARY.md) - Summary of migration accomplishments
- [ETL Data Recovery Summary](./migration/ETL-DATA-RECOVERY-SUMMARY.md) - ETL process documentation
- [Final Summary](./migration/FINAL-SUMMARY.md) - Comprehensive migration results
- [Versioning Analysis Report](./migration/VERSIONING-ANALYSIS-REPORT.md) - Version control implementation analysis

### 📁 [UI Documentation](./ui/)
- [Frontend Migration Guide](./ui/FRONTEND-MIGRATION-GUIDE.md) - Guide for frontend developers
- [Tailwind UI Components](./ui/TAILWIND-UI-COMPONENTS.md) - Available UI components

### 📁 [Development Documentation](./development/)
- [Data Structure Proposal](./development/DATA-STRUCTURE-PROPOSAL.md) - Proposed MongoDB schema
- [Demo Data](./development/DEMO-DATA.md) - Locations of mocked/demo data
- [Test Coverage Report](./development/TEST-COVERAGE-REPORT.md) - Test coverage analysis

## Important Notes

### ⚠️ Documentation Accuracy

Some documentation reflects the **proposed** MongoDB structure while others document the **actual implementation**. Key differences:

1. **Proposed Structure** (in proposal docs):
   - Campaigns contain embedded strategies and line items
   - Single document per campaign with all data

2. **Actual Implementation** (current state):
   - Campaigns, strategies, and lineItems are SEPARATE collections
   - Linked by foreign keys (campaignId, strategyId)
   - Line items can be queried independently

Always refer to [Current MongoDB State](./migration/CURRENT-MONGODB-STATE.md) for the actual database structure.

## Quick Links

- [Key Differences from Media-Tool](../KEY-DIFFERENCES.md)
- [Main README](../README.md)
- [Backend README](../backend/README.md)