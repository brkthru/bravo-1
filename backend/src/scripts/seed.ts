import { database } from '../config/database';
import { CampaignModel } from '../models/Campaign';
import { Campaign, generateId } from '@mediatool/shared';

const sampleCampaigns = [
  {
    campaignNumber: 'CN-7021',
    name: 'Virginia Spine Care',
    status: 'L1' as const,
    team: {
      leadAccountManager: {
        id: 'user1',
        name: 'Moyín Ayélabola',
        email: 'moyin@example.com',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c0?w=40&h=40&fit=crop&crop=face'
      },
      mediaTrader: {
        id: 'user2', 
        name: 'Grace Porter',
        email: 'grace@example.com',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face'
      }
    },
    dates: {
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31'),
      daysElapsed: 167,
      totalDuration: 365
    },
    budget: {
      total: 36850.00,
      allocated: 36850.00,
      spent: 14340.00,
      remaining: 22510.00
    },
    metrics: {
      deliveryPacing: 0.006,
      spendPacing: 0.003,
      margin: 0.867,
      revenueDelivered: 125.3,
      budgetSpent: 65.5,
      marginActual: 78.5
    },
    mediaActivity: 'None active' as const,
    lineItems: [
      {
        _id: generateId(),
        name: 'Virginia Spine Care - SEM',
        status: 'active' as const,
        deliveryPacing: 0.006,
        spendPacing: 0.003,
        margin: 0.867,
        price: 36850.00,
        channel: 'SEM & YouTube',
        tactic: 'SEM',
        unitType: 'clicks' as const,
        unitPrice: 18.00,
        targetMargin: 0.70,
        estimatedUnits: 2047,
        dates: {
          start: new Date('2025-01-01'),
          end: new Date('2025-12-31')
        },
        mediaPlan: [
          {
            _id: generateId(),
            name: 'Google Search Campaign',
            platform: 'Google Search Campaigns',
            budget: 1000.00,
            cpcCost: 1.00,
            margin: 0.944,
            clicks: 1000,
            platformBuyName: 'CN-7021#N6934E...',
            deliveryPacing: 0.94,
            status: 'Pending' as const
          }
        ]
      }
    ]
  },
  {
    campaignNumber: 'CN-7022',
    name: 'Angelo\'s Fairmount Tavern Digital Campaign',
    status: 'L1' as const,
    team: {
      leadAccountManager: {
        id: 'user3',
        name: 'Grace Porter',
        email: 'grace@example.com'
      }
    },
    dates: {
      start: new Date('2025-02-01'),
      end: new Date('2025-08-31'),
      daysElapsed: 45,
      totalDuration: 212
    },
    budget: {
      total: 25000.00,
      allocated: 25000.00,
      spent: 8750.00,
      remaining: 16250.00
    },
    metrics: {
      deliveryPacing: 0.869,
      spendPacing: 0.770,
      margin: 0.805,
      revenueDelivered: 77.0,
      budgetSpent: 62.8,
      marginActual: 80.5
    },
    mediaActivity: 'None active' as const,
    lineItems: []
  },
  {
    campaignNumber: 'CN-7023',
    name: 'Technology and Language Center - SEM',
    status: 'L2' as const,
    team: {
      leadAccountManager: {
        id: 'user4',
        name: 'Grace Porter',
        email: 'grace@example.com'
      }
    },
    dates: {
      start: new Date('2025-01-15'),
      end: new Date('2025-06-30'),
      daysElapsed: 85,
      totalDuration: 166
    },
    budget: {
      total: 18500.00,
      allocated: 18500.00,
      spent: 6289.00,
      remaining: 12211.00
    },
    metrics: {
      deliveryPacing: 1.148,
      spendPacing: 1.159,
      margin: 0.809,
      revenueDelivered: 115.9,
      budgetSpent: 85.5,
      marginActual: 80.9
    },
    mediaActivity: 'None active' as const,
    lineItems: []
  },
  {
    campaignNumber: 'CN-7024',
    name: 'Oast & Taylor',
    status: 'L1' as const,
    team: {
      leadAccountManager: {
        id: 'user5',
        name: 'Bailey Blair',
        email: 'bailey@example.com'
      }
    },
    dates: {
      start: new Date('2025-03-01'),
      end: new Date('2025-09-30'),
      daysElapsed: 30,
      totalDuration: 213
    },
    budget: {
      total: 42000.00,
      allocated: 42000.00,
      spent: 15750.00,
      remaining: 26250.00
    },
    metrics: {
      deliveryPacing: 2.621,
      spendPacing: 1.169,
      margin: 0.811,
      revenueDelivered: 116.9,
      budgetSpent: 76.4,
      marginActual: 81.1
    },
    mediaActivity: 'None active' as const,
    lineItems: []
  },
  {
    campaignNumber: 'CN-7025',
    name: 'Bounce to Zero',
    status: 'L1' as const,
    team: {
      leadAccountManager: {
        id: 'user6',
        name: 'Ryann Johnson',
        email: 'ryann@example.com'
      }
    },
    dates: {
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31'),
      daysElapsed: 167,
      totalDuration: 365
    },
    budget: {
      total: 32500.00,
      allocated: 32500.00,
      spent: 25237.50,
      remaining: 7262.50
    },
    metrics: {
      deliveryPacing: 2.140,
      spendPacing: 1.387,
      margin: 0.837,
      revenueDelivered: 138.7,
      budgetSpent: 77.6,
      marginActual: 83.7
    },
    mediaActivity: 'Some active' as const,
    lineItems: []
  }
];

async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    await database.connect();

    const campaignModel = new CampaignModel();
    
    // Clear existing campaigns
    console.log('Clearing existing campaigns...');
    const db = database.getDb();
    await db.collection('campaigns').deleteMany({});

    // Create indexes
    console.log('Creating indexes...');
    await campaignModel.createIndexes();

    // Insert sample campaigns
    console.log('Inserting sample campaigns...');
    for (const campaignData of sampleCampaigns) {
      await campaignModel.create(campaignData as any);
      console.log(`Created campaign: ${campaignData.name}`);
    }

    console.log(`Successfully seeded ${sampleCampaigns.length} campaigns`);

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

// Run the seed script
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };