import fs from 'fs/promises';
import path from 'path';

const INPUT_DIR = './mongodb-export-20250618';
const OUTPUT_DIR = './data-transformed';

// PostgreSQL data interfaces
interface PgCampaign {
  id: string;
  campaign_number: string;
  campaign_name: string;
  owner_user_id?: string;
  lead_account_owner_user_id?: string;
  account_id?: string;
  budget?: string;
  flight_date?: string;
  end_date?: string;
  stage?: string;
  created_at: string;
  updated_at: string;
}

interface PgStrategy {
  id: string;
  campaign_id: string;
  name?: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface PgLineItem {
  id: string;
  strategy_id: string;
  name: string;
  description?: string;
  audience?: string;
  start_date?: string;
  end_date?: string;
  price?: string;
  unit_price?: string;
  target_margin?: number;
  created_at: string;
  updated_at: string;
}

interface PgUser {
  id: string;
  zoho_user_id: string;
  name: string;
  email: string;
}

interface PgAccount {
  id: string;
  account_name: string;
}

async function transformPostgresData() {
  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    console.log('Loading PostgreSQL data...');

    // Load all the data
    const campaigns: PgCampaign[] = JSON.parse(
      await fs.readFile(path.join(INPUT_DIR, 'campaigns.json'), 'utf-8')
    );
    const strategies: PgStrategy[] = JSON.parse(
      await fs.readFile(path.join(INPUT_DIR, 'strategies.json'), 'utf-8')
    );
    const lineItems: PgLineItem[] = JSON.parse(
      await fs.readFile(path.join(INPUT_DIR, 'line_items.json'), 'utf-8')
    );
    const users: PgUser[] = JSON.parse(
      await fs.readFile(path.join(INPUT_DIR, 'users.json'), 'utf-8')
    );
    const accounts: PgAccount[] = JSON.parse(
      await fs.readFile(path.join(INPUT_DIR, 'accounts.json'), 'utf-8')
    );

    console.log(`Loaded data:
    - ${campaigns.length} campaigns
    - ${strategies.length} strategies
    - ${lineItems.length} line items
    - ${users.length} users
    - ${accounts.length} accounts`);

    // Create lookup maps
    const userMap = new Map(users.map((u) => [u.zoho_user_id, u]));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const strategyMap = new Map<string, PgStrategy[]>();
    const lineItemMap = new Map<string, PgLineItem[]>();

    // Group strategies by campaign
    strategies.forEach((strategy) => {
      const campaignStrategies = strategyMap.get(strategy.campaign_id) || [];
      campaignStrategies.push(strategy);
      strategyMap.set(strategy.campaign_id, campaignStrategies);
    });

    // Group line items by strategy
    lineItems.forEach((lineItem) => {
      const strategyLineItems = lineItemMap.get(lineItem.strategy_id) || [];
      strategyLineItems.push(lineItem);
      lineItemMap.set(lineItem.strategy_id, strategyLineItems);
    });

    // Transform campaigns
    console.log('Transforming campaigns...');
    const transformedCampaigns = campaigns.map((campaign, i) => {
      if (i % 1000 === 0) {
        console.log(`  Processing campaign ${i + 1}/${campaigns.length}`);
      }

      // Get related data
      const campaignStrategies = strategyMap.get(campaign.id) || [];
      const account = accountMap.get(campaign.account_id || '');
      const owner = userMap.get(campaign.owner_user_id || '');
      const leadAccountManager = userMap.get(campaign.lead_account_owner_user_id || '');

      // Transform strategies with embedded line items
      const transformedStrategies = campaignStrategies.map((strategy) => {
        const strategyLineItems = lineItemMap.get(strategy.id) || [];

        return {
          _id: strategy.id,
          name: strategy.name || 'Untitled Strategy',
          status: strategy.status || 'active',
          lineItems: strategyLineItems.map((lineItem) => ({
            _id: lineItem.id,
            name: lineItem.name,
            description: lineItem.description,
            audience: lineItem.audience,
            startDate: lineItem.start_date,
            endDate: lineItem.end_date,
            price: parseFloat(lineItem.price || '0'),
            unitPrice: parseFloat(lineItem.unit_price || '0'),
            targetMargin: lineItem.target_margin || 0,
            createdAt: lineItem.created_at,
            updatedAt: lineItem.updated_at,
          })),
          createdAt: strategy.created_at,
          updatedAt: strategy.updated_at,
        };
      });

      // Calculate totals
      const totalPrice = parseFloat(campaign.budget || '0'); // Map budget to price
      const totalLineItems = transformedStrategies.reduce(
        (sum, strategy) => sum + strategy.lineItems.length,
        0
      );

      return {
        _id: campaign.id,
        campaignNumber: campaign.campaign_number,
        name: campaign.campaign_name || 'Unnamed Campaign',
        accountId: campaign.account_id,
        accountName: account?.account_name,
        status: campaign.stage || 'active',

        team: {
          // UPDATED TEAM STRUCTURE
          accountManager: leadAccountManager
            ? {
                id: leadAccountManager.zoho_user_id,
                name: leadAccountManager.name,
                email: leadAccountManager.email,
                role: 'account_manager',
              }
            : undefined,
          csd: undefined,
          seniorMediaTraders: [],
          mediaTraders: [],
        },

        dates: {
          start: campaign.flight_date,
          end: campaign.end_date,
          created: campaign.created_at,
          updated: campaign.updated_at,
        },

        price: {
          // NEW FIELD NAME: budget -> price
          targetAmount: totalPrice,
          actualAmount: 0,
          remainingAmount: totalPrice,
          currency: 'USD',
        },

        metrics: {
          lineItemCount: totalLineItems,
          strategyCount: transformedStrategies.length,
          deliveryPacing: 0,
          spendPacing: 0,
          marginAmount: totalPrice * 0.3, // NEW: split margin field
          marginPercentage: 30, // NEW: split margin field
          units: 0, // NEW: changed from impressions
          unitType: 'impressions',
          revenueDelivered: 0,
          budgetSpent: 0,
          marginActual: 0,
        },

        strategies: transformedStrategies,

        mediaActivity: totalLineItems > 0 ? 'Some active' : 'None active', // NEW FIELD

        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      };
    });

    // Save transformed data
    const outputPath = path.join(OUTPUT_DIR, 'campaigns.json');
    await fs.writeFile(outputPath, JSON.stringify(transformedCampaigns, null, 2));

    console.log(`\nTransformation complete!`);
    console.log(`Saved ${transformedCampaigns.length} campaigns to ${outputPath}`);

    // Save transformation summary
    const summary = {
      transformedAt: new Date().toISOString(),
      source: 'PostgreSQL export',
      totalCampaigns: transformedCampaigns.length,
      totalStrategies: strategies.length,
      totalLineItems: lineItems.length,
      totalUsers: users.length,
      outputFile: 'campaigns.json',
    };

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'transformation-summary.json'),
      JSON.stringify(summary, null, 2)
    );
  } catch (error) {
    console.error('Transformation failed:', error);
    throw error;
  }
}

// Run the transformation
if (import.meta.main) {
  transformPostgresData().catch(console.error);
}
