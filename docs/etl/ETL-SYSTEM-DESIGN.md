# ETL System Design

## Overview

The Bravo-1 ETL system is designed to be a robust, schema-aware pipeline that can handle production data synchronization with automatic change detection and intelligent decision-making capabilities.

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Production     │     │   ETL Engine    │     │   Local Dev     │
│  PostgreSQL     │────▶│  (Bun/TS)       │────▶│   MongoDB       │
│  (AWS RDS)      │     │                 │     │   (bravo-1)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   S3 Backup     │     │ Schema Change   │     │   Parallel DBs  │
│   (Snapshots)   │     │   Detection     │     │  (bravo-1a...)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. Production Data Acquisition

**Two Methods:**

- **S3 Download** (Recommended): Pre-exported snapshots for developers without production access
- **Direct Export**: For users with VPN/bastion access to production RDS

**Benefits:**

- No production database impact
- Consistent snapshots for team development
- Audit trail of data exports

### 2. Schema Change Detection

**Automated Detection:**

- Compares PostgreSQL data structure with Zod schemas
- Identifies new fields, type changes, dropped fields
- Categorizes changes by severity (breaking/warning/info)

**Intelligent Handling:**

```typescript
interface SchemaChange {
  type: 'new_field' | 'type_change' | 'dropped_field';
  severity: 'breaking' | 'warning' | 'info';
  details: {
    currentType?: string;
    expectedType?: string;
    required?: boolean;
  };
}
```

### 3. Cascade Update System

When schema changes are detected, the system automatically:

1. **Updates Zod Schemas** → Source of truth for data structure
2. **Regenerates Artifacts:**
   - TypeScript types
   - OpenAPI specifications
   - JSON Schema definitions
   - MongoDB validators

3. **Updates Business Logic:**
   - Calculation functions
   - Serialization logic
   - Validation rules
   - Rounding precision

4. **Updates Tests:**
   - Test fixtures
   - Expected values
   - API response assertions

### 4. Interactive Mode (Claude Code Integration)

The system can operate in two modes:

**Automated Mode:**

- Applies safe, non-breaking changes automatically
- Skips questionable changes for manual review
- Suitable for CI/CD pipelines

**Interactive Mode:**

- Presents changes to developer/Claude Code
- Requests decisions on:
  - Default values for new required fields
  - Mapping strategies for renamed fields
  - Migration approach for type changes
- Generates custom transformation code

Example interaction:

```
Detected: campaigns.performance_score (number, required)

How should we handle this new required field?
1. Calculate from existing data
2. Set default value
3. Make optional for now
4. Custom transformation

> Select option: _
```

### 5. Database Versioning

**Naming Convention:**

- Primary: `bravo-1`
- Testing: `bravo-1-test`
- Branches: `bravo-1-feature-x`
- Dated: `bravo-1-20250628`

**Benefits:**

- Parallel development
- A/B testing
- Safe schema migrations
- Easy rollback

## Workflow Execution

### Manual Workflow

```bash
# 1. Quick start menu
./quick-start-etl.sh

# 2. Or step-by-step
bun download-from-s3.ts
bun detect-schema-changes.ts
bun transform-postgres-to-mongodb.ts
bun load-new-schema-data.ts
```

### Automated Workflow

```bash
# Full automation with defaults
bun run-production-etl.ts --auto-latest --skip-backup

# With Claude Code assistance
bun run-production-etl.ts --interactive
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Sync Production Data
  run: |
    bun install
    bun run-production-etl.ts --auto-latest --db bravo-1-ci
    bun test
```

## Decision Points

The system handles various decision points:

### 1. Database Refresh Strategy

- **Full Refresh**: Drop and recreate (clean development)
- **Incremental**: Merge new data (preserve test data)
- **Parallel**: New database version (safe testing)

### 2. Schema Change Handling

- **Auto-approve**: Optional fields, new indexes
- **Review Required**: Required fields, type changes
- **Block**: Breaking changes without migration

### 3. Transformation Rules

- **Standard**: Use default field mappings
- **Custom**: Apply project-specific logic
- **Preserve**: Keep original values

## Error Handling

### Rollback Capabilities

```bash
# List available backups
bun list-etl-versions.ts

# Rollback to specific version
bun rollback-etl.ts --version 2025-06-28-001
```

### Validation Steps

1. **Pre-transform**: Validate PostgreSQL data completeness
2. **Post-transform**: Verify transformation accuracy
3. **Post-load**: Check MongoDB data integrity
4. **API tests**: Ensure endpoints work correctly

## Monitoring & Logging

### Log Locations

- Console output with progress indicators
- File logs: `logs/etl/YYYY-MM-DD-HH-mm-ss.log`
- MongoDB audit collection: `bravo-1.etl_audit`
- Schema changes: `schema-change-report.json`

### Metrics Tracked

- Records processed per table
- Transformation time
- Schema changes detected
- Validation failures
- Memory usage

## Security Considerations

1. **Credentials**: Never stored in code, use environment variables
2. **Data Privacy**: PII handling during transformation
3. **Access Control**: AWS SSO for production access
4. **Audit Trail**: All ETL runs logged with user/timestamp

## Future Enhancements

1. **Real-time Sync**: CDC (Change Data Capture) integration
2. **Schema Registry**: Central schema version management
3. **Data Quality**: Automated anomaly detection
4. **Performance**: Parallel processing for large tables
5. **Observability**: DataDog/CloudWatch integration

## Conclusion

This ETL system design provides:

- **Flexibility**: Multiple execution modes
- **Safety**: Schema validation and rollback
- **Intelligence**: Automated decision making
- **Scalability**: Handles production data volumes
- **Maintainability**: Clear separation of concerns

The system serves as both a reliable automation tool and an intelligent assistant that can work with Claude Code to handle complex schema evolution scenarios.
