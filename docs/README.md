# Bravo-1 Documentation

Welcome to the Bravo-1 documentation. This directory contains comprehensive documentation for the MongoDB-based media planning system.

## 🚀 Start Here

1. **[Architecture Overview](../ARCHITECTURE.md)** - System design and technology decisions
2. **[Main README](../README.md)** - Quick start guide
3. **[Documentation Index](./INDEX.md)** - Complete documentation listing

## 📚 Key Documentation

### System Design

- **[Architecture](../ARCHITECTURE.md)** - Complete system architecture
- **[UI Component Architecture](./ui/TAILWIND-UI-COMPONENTS.md)** - HeadlessUI + Tailwind patterns
- **[MongoDB Schema Design](./MONGODB-SCHEMA-DESIGN.md)** - Database architecture

### Development Guides

- **[MongoDB Guide](./MONGODB-GUIDE.md)** - Query patterns and best practices
- **[CLAUDE.md](../CLAUDE.md)** - AI assistant guidelines
- **[ETL Pipeline](./ETL-PIPELINE-DETAILED.md)** - Data transformation process

### Deployment & Operations

- **[Cloud Deployment Setup](./CLOUD-DEPLOYMENT-SETUP.md)** - AWS deployment
- **[Pipeline Timestamped Exports](./PIPELINE-TIMESTAMPED-EXPORTS.md)** - Backup/restore

## 📁 Documentation Structure

```
docs/
├── INDEX.md                  # Documentation index
├── MONGODB-GUIDE.md          # MongoDB usage guide
├── MONGODB-SCHEMA-DESIGN.md  # Schema decisions
├── archive/                  # Historical documents
├── development/              # Development resources
├── migration/                # Migration documentation
└── ui/                       # UI documentation
```

## ⚠️ Important Notes

### Database Structure

The actual implementation uses **separate collections** (not embedded):

- `campaigns` collection
- `strategies` collection
- `lineItems` collection
- Collections are linked by foreign keys

Always refer to [Current MongoDB State](./migration/CURRENT-MONGODB-STATE.md) for the actual structure.

### UI Architecture

We use **HeadlessUI + Tailwind CSS** pattern:

- HeadlessUI provides behavior and accessibility
- Tailwind CSS provides all visual styling
- See [UI Component Architecture](./ui/TAILWIND-UI-COMPONENTS.md) for details

## 🔗 Quick Links

- [Test Guide](../tests/README.md) - E2E testing with Playwright
- [Backend Scripts](../backend/src/scripts/) - Database utilities
- [ETL Scripts](../scripts/etl/) - Data migration tools
