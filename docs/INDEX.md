# Bravo-1 Documentation Index

## 📚 Active Documentation

### Getting Started
- **[Main README](../README.md)** - Quick start guide and project overview
- **[CLAUDE.md](../CLAUDE.md)** - AI assistant guidelines and conventions

### Database & Data
- **[MongoDB Guide](./MONGODB-GUIDE.md)** - Query patterns, best practices, and common operations
- **[MongoDB Schema Design](./MONGODB-SCHEMA-DESIGN.md)** - Architecture decisions
- **[Current MongoDB State](./migration/CURRENT-MONGODB-STATE.md)** - Actual database structure
- **[ETL Pipeline](./ETL-PIPELINE-DETAILED.md)** - Data transformation process

### Deployment & Operations
- **[Cloud Deployment Setup](./CLOUD-DEPLOYMENT-SETUP.md)** - AWS deployment guide
- **[Pipeline Timestamped Exports](./PIPELINE-TIMESTAMPED-EXPORTS.md)** - Backup/restore process
- **Production Pipeline Scripts:**
  - [AWS S3 Setup](../scripts/production-pipeline/AWS-S3-SETUP.md)
  - [Pipeline README](../scripts/production-pipeline/README.md)
  - [New User Setup](../scripts/production-pipeline/SETUP-NEW-USER.md)

### Development Resources
- **[Test README](../tests/README.md)** - E2E testing guide
- **[Demo Data](./development/DEMO-DATA.md)** - Sample data structure
- **[Tailwind UI Components](./ui/TAILWIND-UI-COMPONENTS.md)** - Component library

### Architecture Analysis
- **[PostgreSQL vs MongoDB Comparison](./POSTGRES-MONGODB-COMPARISON.md)**
- **[PostgreSQL View Requirements](./POSTGRESQL-VIEW-REQUIREMENTS.md)**
- **[Versioning Analysis](./migration/VERSIONING-ANALYSIS-REPORT.md)**

## 🗄 Archived Documentation

Historical migration documents have been moved to `archive/migration-history/`. These contain proposed structures that were not implemented.

## 📝 Documentation Guidelines

1. **Keep docs current** - Update when making changes
2. **Use examples** - Show real query patterns and code
3. **Be concise** - Get to the point quickly
4. **Archive don't delete** - Move outdated docs to archive