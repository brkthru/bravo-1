# User Management Architecture

## Overview

We've implemented a two-collection approach for user management in Bravo-1:

1. **zohoUsers** - Direct sync from PostgreSQL/Zoho (read-only reference)
2. **bravoUsers** - Enhanced user profiles with Bravo-specific features

## Collections

### zohoUsers Collection

- **Purpose**: Preserve Zoho data exactly as-is
- **Source**: PostgreSQL export (users.json)
- **Updates**: ETL pipeline refreshes this data
- **Count**: 327 users

```typescript
{
  _id: ObjectId,
  userId: string,           // Original PostgreSQL ID
  zohoUserId: string,       // Zoho CRM ID
  name: string,
  email: string,
  syncedAt: Date,
  // ... other Zoho fields preserved
}
```

### bravoUsers Collection

- **Purpose**: Application users with enhanced features
- **Source**: Created from zohoUsers + manual additions
- **Updates**: Application manages this data
- **Count**: 327 users (all linked to Zoho currently)

```typescript
{
  _id: ObjectId,
  email: string,            // Primary identifier
  zohoUserId?: string,      // Optional link to Zoho

  // Profile
  name: string,
  title?: string,
  department?: string,
  managerId?: ObjectId,     // Link to another bravoUser

  // Status
  isActive: boolean,
  outOfOffice?: {
    enabled: boolean,
    startDate?: Date,
    endDate?: Date,
    backupUserId?: ObjectId
  },

  // Access Control
  roles: string[],          // ['admin', 'media_trader', 'account_manager']
  permissions?: string[],   // Future granular permissions

  // Preferences
  preferences?: {
    theme: 'light' | 'dark',
    notifications: {...},
    aiSettings: {...},
    dashboardLayout: {...}
  },

  // Metadata
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt?: Date
}
```

## Current Statistics

From `setup-bravo-users.ts` run:

- Total users: 327
- Active: 327 (100%)
- Linked to Zoho: 327 (100%)
- Admins: 1 (ryan@brkthru.com)
- Account Managers: 66
- Media Traders: 31

## Benefits of This Architecture

1. **Data Integrity**: Zoho data remains pristine
2. **Flexibility**: Support non-Zoho users in the future
3. **Enhanced Features**: Add Bravo-specific fields without pollution
4. **Performance**: Optimized queries for different use cases
5. **Migration Path**: Easy to evolve independently

## Usage Examples

### Finding a user's campaigns (Account Manager)

```javascript
// Find Bravo user
const bravoUser = await db.collection('bravoUsers').findOne({
  email: 'user@example.com',
});

// Find their Zoho user (if needed)
const zohoUser = await db.collection('zohoUsers').findOne({
  zohoUserId: bravoUser.zohoUserId,
});

// Find campaigns they manage
const campaigns = await db
  .collection('campaigns')
  .find({
    'team.accountManager.id': zohoUser.zohoUserId,
  })
  .toArray();
```

### Role-based filtering

```javascript
// Find all admin users
const admins = await db
  .collection('bravoUsers')
  .find({
    roles: 'admin',
    isActive: true,
  })
  .toArray();

// Find users who are out of office
const outOfOffice = await db
  .collection('bravoUsers')
  .find({
    'outOfOffice.enabled': true,
    'outOfOffice.startDate': { $lte: new Date() },
    'outOfOffice.endDate': { $gte: new Date() },
  })
  .toArray();
```

## Future Enhancements

1. **Permissions System**: Add granular permissions array
2. **Team Hierarchy**: Use managerId to build org charts
3. **Delegation**: Automatic task reassignment when OOO
4. **AI Preferences**: Store personalized AI assistant settings
5. **Audit Trail**: Track role/permission changes

## Setup Instructions

1. Run ETL to populate zohoUsers:

   ```bash
   bun etl-pipeline.ts --verify
   ```

2. Create bravoUsers from zohoUsers:

   ```bash
   bun setup-bravo-users.ts
   ```

3. Manually assign admin roles as needed in the setup script
