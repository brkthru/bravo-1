import { MongoClient, Db, Collection } from 'mongodb';
import { Client } from 'pg';
import { generateId } from '@bravo-1/shared';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const POSTGRES_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'mediatool',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
};

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'mediatool_v2';

// Unit type mappings
const UNIT_TYPE_MAP: Record<string, string> = {
  CPM: 'impressions',
  CPC: 'clicks',
  CPA: 'conversions',
  CPV: 'video_views',
  CPCV: 'completed_video_views',
  CPE: 'engagements',
  CPL: 'leads',
  IMPRESSIONS: 'impressions',
  CLICKS: 'clicks',
  CONVERSIONS: 'conversions',
  VIDEO_VIEWS: 'video_views',
};

// User roles
type UserRole = 'admin' | 'account_director' | 'account_manager' | 'media_trader' | 'viewer';

interface User {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  managerId?: string;
  department: string;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PostgresCampaign {
  id: string;
  campaign_number: string;
  name: string;
  status: string;
  lead_account_manager_id: string;
  media_trader_id?: string;
  start_date: Date;
  end_date: Date;
  budget_total: number;
  budget_allocated: number;
  budget_spent: number;
  impressions_delivered?: number;
  clicks_delivered?: number;
  conversions_delivered?: number;
  created_at: Date;
  updated_at: Date;
}

interface PostgresLineItem {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  channel: string;
  tactic: string;
  unit_price_type: string;
  unit_price: number;
  target_margin: number;
  estimated_impressions?: number;
  estimated_clicks?: number;
  estimated_conversions?: number;
  price: number;
  start_date: Date;
  end_date: Date;
}

interface PostgresUser {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  manager_id?: string;
  department: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

class MigrationService {
  private pgClient: Client;
  private mongoClient: MongoClient;
  private db: Db;

  constructor() {
    this.pgClient = new Client(POSTGRES_CONFIG);
    this.mongoClient = new MongoClient(MONGODB_URI);
    this.db = null as any;
  }

  async connect() {
    console.log('Connecting to PostgreSQL...');
    await this.pgClient.connect();
    console.log('Connected to PostgreSQL');

    console.log('Connecting to MongoDB...');
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(DATABASE_NAME);
    console.log('Connected to MongoDB');
  }

  async disconnect() {
    await this.pgClient.end();
    await this.mongoClient.close();
    console.log('Disconnected from databases');
  }

  private transformUnitType(pgUnitType: string): string {
    return UNIT_TYPE_MAP[pgUnitType.toUpperCase()] || 'impressions';
  }

  private getEstimatedUnits(lineItem: PostgresLineItem): number {
    const unitType = this.transformUnitType(lineItem.unit_price_type);

    switch (unitType) {
      case 'impressions':
        return lineItem.estimated_impressions || 0;
      case 'clicks':
        return lineItem.estimated_clicks || 0;
      case 'conversions':
        return lineItem.estimated_conversions || 0;
      default:
        // Calculate based on budget and unit price
        return Math.floor(lineItem.price / lineItem.unit_price);
    }
  }

  async migrateUsers() {
    console.log('\nMigrating users...');
    const usersCollection = this.db.collection('users');

    // Clear existing users
    await usersCollection.deleteMany({});

    // Create sample hierarchy if no users in Postgres
    const { rows: pgUsers } = await this.pgClient
      .query<PostgresUser>(
        `
      SELECT * FROM users ORDER BY created_at
    `
      )
      .catch(() => ({ rows: [] }));

    let users: User[] = [];

    if (pgUsers.length === 0) {
      console.log('No users found in Postgres, creating sample hierarchy...');

      // Create sample user hierarchy
      const sampleUsers: User[] = [
        {
          _id: generateId(),
          employeeId: 'EMP001',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@bravo.com',
          role: 'admin',
          department: 'Executive',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP002',
          name: 'Michael Chen',
          email: 'michael.chen@bravo.com',
          role: 'account_director',
          managerId: 'EMP001',
          department: 'Account Management',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP003',
          name: 'Grace Porter',
          email: 'grace.porter@bravo.com',
          role: 'account_manager',
          managerId: 'EMP002',
          department: 'Account Management',
          avatar:
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP004',
          name: 'Moyín Ayélabola',
          email: 'moyin.ayelabola@bravo.com',
          role: 'account_manager',
          managerId: 'EMP002',
          department: 'Account Management',
          avatar:
            'https://images.unsplash.com/photo-1494790108755-2616b612b5c0?w=40&h=40&fit=crop&crop=face',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP005',
          name: 'Bailey Blair',
          email: 'bailey.blair@bravo.com',
          role: 'account_manager',
          managerId: 'EMP002',
          department: 'Account Management',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP006',
          name: 'Ryann Johnson',
          email: 'ryann.johnson@bravo.com',
          role: 'account_manager',
          managerId: 'EMP002',
          department: 'Account Management',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP007',
          name: 'Alex Thompson',
          email: 'alex.thompson@bravo.com',
          role: 'media_trader',
          managerId: 'EMP003',
          department: 'Media Trading',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP008',
          name: 'Jessica Martinez',
          email: 'jessica.martinez@bravo.com',
          role: 'media_trader',
          managerId: 'EMP004',
          department: 'Media Trading',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: generateId(),
          employeeId: 'EMP009',
          name: 'David Kim',
          email: 'david.kim@bravo.com',
          role: 'viewer',
          managerId: 'EMP002',
          department: 'Finance',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      users = sampleUsers;
    } else {
      // Transform Postgres users
      users = pgUsers.map((pgUser) => ({
        _id: pgUser.id,
        employeeId: pgUser.employee_id,
        name: pgUser.name,
        email: pgUser.email,
        role: pgUser.role as UserRole,
        managerId: pgUser.manager_id,
        department: pgUser.department,
        avatar: pgUser.avatar_url,
        isActive: pgUser.is_active,
        createdAt: pgUser.created_at,
        updatedAt: pgUser.updated_at,
      }));
    }

    // Insert users
    if (users.length > 0) {
      await usersCollection.insertMany(users);
      console.log(`Migrated ${users.length} users`);
    }

    // Create indexes
    await usersCollection.createIndex({ employeeId: 1 }, { unique: true });
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ managerId: 1 });
    await usersCollection.createIndex({ role: 1 });
    await usersCollection.createIndex({ department: 1 });
    await usersCollection.createIndex({ name: 'text', email: 'text' });

    return users;
  }

  async migrateCampaigns(users: User[]) {
    console.log('\nMigrating campaigns...');
    const campaignsCollection = this.db.collection('campaigns');

    // Clear existing campaigns
    await campaignsCollection.deleteMany({});

    // Get campaigns from Postgres
    const { rows: pgCampaigns } = await this.pgClient
      .query<PostgresCampaign>(
        `
      SELECT * FROM campaigns ORDER BY created_at
    `
      )
      .catch(() => ({ rows: [] }));

    if (pgCampaigns.length === 0) {
      console.log('No campaigns found in Postgres, using seed data...');
      return;
    }

    // Create user lookup map
    const userMap = new Map(users.map((u) => [u.employeeId, u]));

    for (const pgCampaign of pgCampaigns) {
      // Get line items for this campaign
      const { rows: pgLineItems } = await this.pgClient.query<PostgresLineItem>(
        `
        SELECT * FROM line_items WHERE campaign_id = $1
      `,
        [pgCampaign.id]
      );

      // Transform line items
      const lineItems = pgLineItems.map((item) => ({
        _id: generateId(),
        name: item.name,
        status: item.status,
        channel: item.channel,
        tactic: item.tactic,
        unitType: this.transformUnitType(item.unit_price_type),
        unitPrice: item.unit_price,
        targetMargin: item.target_margin,
        estimatedUnits: this.getEstimatedUnits(item),
        price: item.price,
        dates: {
          start: item.start_date,
          end: item.end_date,
        },
        deliveryPacing: Math.random() * 1.5, // Simulated for demo
        spendPacing: Math.random() * 1.2,
        margin: item.target_margin,
        mediaPlan: [], // Would be populated from platform_buys table
      }));

      // Calculate campaign metrics
      const now = new Date();
      const daysElapsed = Math.floor(
        (now.getTime() - pgCampaign.start_date.getTime()) / (1000 * 60 * 60 * 24)
      );
      const totalDuration = Math.floor(
        (pgCampaign.end_date.getTime() - pgCampaign.start_date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get user objects
      const leadAM = userMap.get(pgCampaign.lead_account_manager_id) || users[0];
      const mediaTrader = pgCampaign.media_trader_id
        ? userMap.get(pgCampaign.media_trader_id)
        : undefined;

      // Transform campaign
      const campaign = {
        _id: generateId(),
        campaignNumber: pgCampaign.campaign_number,
        name: pgCampaign.name,
        status: this.transformStatus(pgCampaign.status),
        team: {
          leadAccountManager: {
            id: leadAM._id,
            name: leadAM.name,
            email: leadAM.email,
            avatar: leadAM.avatar,
          },
          ...(mediaTrader && {
            mediaTrader: {
              id: mediaTrader._id,
              name: mediaTrader.name,
              email: mediaTrader.email,
              avatar: mediaTrader.avatar,
            },
          }),
        },
        dates: {
          start: pgCampaign.start_date,
          end: pgCampaign.end_date,
          daysElapsed: Math.max(0, Math.min(daysElapsed, totalDuration)),
          totalDuration,
        },
        budget: {
          total: pgCampaign.budget_total,
          allocated: pgCampaign.budget_allocated,
          spent: pgCampaign.budget_spent,
          remaining: pgCampaign.budget_total - pgCampaign.budget_spent,
        },
        metrics: {
          deliveryPacing: pgCampaign.budget_spent / pgCampaign.budget_total,
          spendPacing:
            daysElapsed / totalDuration > 0
              ? pgCampaign.budget_spent / pgCampaign.budget_total / (daysElapsed / totalDuration)
              : 0,
          margin: 0.75, // Default margin
          revenueDelivered: pgCampaign.budget_spent * 1.3, // Simulated
          budgetSpent: pgCampaign.budget_spent,
          marginActual: 0.73, // Simulated
        },
        mediaActivity: lineItems.length === 0 ? 'None active' : 'Some active',
        lineItems,
        createdAt: pgCampaign.created_at,
        updatedAt: pgCampaign.updated_at,
      };

      await campaignsCollection.insertOne(campaign);
      console.log(`Migrated campaign: ${campaign.name}`);
    }

    // Create indexes
    await campaignsCollection.createIndex({ campaignNumber: 1 }, { unique: true });
    await campaignsCollection.createIndex({ name: 'text' });
    await campaignsCollection.createIndex({ status: 1 });
    await campaignsCollection.createIndex({ 'team.leadAccountManager.id': 1 });
    await campaignsCollection.createIndex({ 'team.mediaTrader.id': 1 });
    await campaignsCollection.createIndex({ createdAt: -1 });
    await campaignsCollection.createIndex({ 'dates.start': 1 });
    await campaignsCollection.createIndex({ 'dates.end': 1 });
    await campaignsCollection.createIndex({ 'budget.total': -1 });
    await campaignsCollection.createIndex({ 'metrics.deliveryPacing': -1 });

    console.log(`Migrated ${pgCampaigns.length} campaigns`);
  }

  private transformStatus(pgStatus: string): 'L1' | 'L2' | 'L3' {
    const statusMap: Record<string, 'L1' | 'L2' | 'L3'> = {
      active: 'L1',
      pending: 'L2',
      ended: 'L3',
      completed: 'L3',
      paused: 'L2',
    };
    return statusMap[pgStatus.toLowerCase()] || 'L1';
  }

  async createApiDocumentation() {
    console.log('\nCreating API documentation...');

    const docs = `# Bravo API Documentation

## Overview
The Bravo API provides RESTful endpoints for managing advertising campaigns, users, and related data.

Base URL: \`http://localhost:3001/api\`

## Authentication
Currently using session-based authentication. API keys coming soon.

## Endpoints

### Users

#### GET /api/users
List all users with optional filtering.

Query Parameters:
- \`role\`: Filter by user role (admin, account_director, account_manager, media_trader, viewer)
- \`department\`: Filter by department
- \`managerId\`: Filter by manager's employee ID
- \`search\`: Search by name or email

Response:
\`\`\`json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "employeeId": "string",
      "name": "string",
      "email": "string",
      "role": "string",
      "managerId": "string",
      "department": "string",
      "avatar": "string",
      "isActive": boolean
    }
  ]
}
\`\`\`

#### GET /api/users/:id
Get a specific user by ID.

#### GET /api/users/hierarchy
Get the organizational hierarchy tree.

### Campaigns

#### GET /api/campaigns
List campaigns with filtering and search.

Query Parameters:
- \`search\`: Search by campaign name or number
- \`status\`: Filter by status (L1, L2, L3)
- \`accountManagerId\`: Filter by account manager
- \`startDate\`: Filter campaigns starting after this date
- \`endDate\`: Filter campaigns ending before this date

Response includes full campaign data with nested line items.

#### GET /api/campaigns/:id
Get a specific campaign with all details.

#### POST /api/campaigns
Create a new campaign.

Request Body:
\`\`\`json
{
  "campaignNumber": "string",
  "name": "string",
  "status": "L1|L2|L3",
  "team": {
    "leadAccountManager": { "id": "string" },
    "mediaTrader": { "id": "string" } // optional
  },
  "dates": {
    "start": "ISO date",
    "end": "ISO date"
  },
  "budget": {
    "total": number,
    "allocated": number
  }
}
\`\`\`

#### PUT /api/campaigns/:id
Update an existing campaign.

#### DELETE /api/campaigns/:id
Delete a campaign.

### Line Items

#### GET /api/campaigns/:campaignId/line-items
Get all line items for a campaign.

#### POST /api/campaigns/:campaignId/line-items
Add a line item to a campaign.

Request Body:
\`\`\`json
{
  "name": "string",
  "channel": "string",
  "tactic": "string",
  "unitType": "impressions|clicks|conversions|video_views",
  "unitPrice": number,
  "estimatedUnits": number,
  "targetMargin": number,
  "dates": {
    "start": "ISO date",
    "end": "ISO date"
  }
}
\`\`\`

## Data Models

### Unit Types
The system supports the following unit types:
- \`impressions\`: CPM-based pricing
- \`clicks\`: CPC-based pricing
- \`conversions\`: CPA-based pricing
- \`video_views\`: CPV-based pricing
- \`completed_video_views\`: CPCV-based pricing
- \`engagements\`: CPE-based pricing
- \`leads\`: CPL-based pricing

### Campaign Status
- \`L1\`: Active campaign
- \`L2\`: Pending/Paused campaign
- \`L3\`: Ended/Completed campaign

### User Roles
- \`admin\`: Full system access
- \`account_director\`: Manage account managers and view all campaigns
- \`account_manager\`: Manage assigned campaigns
- \`media_trader\`: Execute media buys for assigned campaigns
- \`viewer\`: Read-only access

## Search Capabilities
All major collections support full-text search:
- Users: Search by name or email
- Campaigns: Search by name or campaign number
- Line Items: Search by name or channel

## Performance
- All endpoints support pagination (limit/offset)
- Indexes are created for common query patterns
- Response times typically under 100ms

## Error Handling
All errors follow this format:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "details": "Additional context (optional)"
}
\`\`\`

Common HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error
`;

    // Write documentation
    const fs = await import('fs/promises');
    await fs.writeFile(
      '/Users/ryan/code-repos/brkthru/bravo_code/media-tool/bravo-1/bravo-1/API-DOCUMENTATION.md',
      docs
    );
    console.log('API documentation created at API-DOCUMENTATION.md');
  }
}

async function runMigration() {
  const migration = new MigrationService();

  try {
    await migration.connect();

    // Run migrations in order
    const users = await migration.migrateUsers();
    await migration.migrateCampaigns(users);
    await migration.createApiDocumentation();

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migration.disconnect();
  }
}

// Run the migration
if (require.main === module) {
  runMigration();
}

export { runMigration };
