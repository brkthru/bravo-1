import fs from 'fs/promises';
import path from 'path';

const INPUT_DIR = './data-export';
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

      // Calculate totals
      const totalBudget = parseFloat(campaign.budget || '0');
      let totalLineItems = 0;
      let totalUnits = 0;

      // Transform strategies with embedded line items
      const transformedStrategies = campaignStrategies.map((strategy) => {
        const strategyLineItems = lineItemMap.get(strategy.id) || [];
        totalLineItems += strategyLineItems.length;

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

      // Build transformed campaign with both budget and price fields
      const transformedCampaign = {
        _id: campaign.id,
        campaignNumber: campaign.campaign_number,
        name: campaign.campaign_name || 'Unnamed Campaign',
        accountId: campaign.account_id,
        accountName: account?.account_name,
        status: campaign.stage || 'active',

        // Enhanced team structure
        team: {
          owner: owner
            ? {
                id: owner.zoho_user_id,
                name: owner.name,
                email: owner.email,
              }
            : null,
          leadAccountManager: leadAccountManager
            ? {
                id: leadAccountManager.zoho_user_id,
                name: leadAccountManager.name,
                email: leadAccountManager.email,
              }
            : null,
          accountManager: leadAccountManager
            ? {
                id: leadAccountManager.zoho_user_id,
                name: leadAccountManager.name,
                email: leadAccountManager.email,
                role: 'account_manager',
              }
            : null,
          csd: null, // Would need to be identified from user roles
          seniorMediaTraders: [],
          mediaTraders: [],
        },

        // Updated dates structure
        dates: {
          start: campaign.flight_date,
          end: campaign.end_date,
          created: campaign.created_at,
          updated: campaign.updated_at,
        },

        // IMPORTANT: Supporting both budget (legacy) and price (new) fields
        // During transition, both fields contain the same data
        budget: {
          total: totalBudget,
          allocated: totalBudget,
          spent: 0,
          remaining: totalBudget,
          currency: 'USD',
        },

        // New price field structure
        price: {
          targetAmount: totalBudget,
          actualAmount: 0,
          remainingAmount: totalBudget,
          currency: 'USD',
          unitType: 'dollars',
        },

        // Updated metrics with units instead of impressions
        metrics: {
          lineItemCount: totalLineItems,
          activeLineItemCount: totalLineItems, // Assume all active for now
          strategyCount: transformedStrategies.length,
          units: totalUnits,
          unitType: 'impressions', // Default, would be determined by line items
          marginAmount: 0, // Would be calculated
          marginPercentage: 0, // Would be calculated
          mediaActivity: `${totalLineItems} active line items across ${transformedStrategies.length} strategies`,
        },

        // Integrate media strategy into campaign
        mediaStrategy:
          transformedStrategies.length > 0
            ? {
                name: transformedStrategies[0].name,
                status: transformedStrategies[0].status,
                isActive: true,
                lineItemIds: transformedStrategies.flatMap((s) => s.lineItems.map((li) => li._id)),
                totalBudget: {
                  targetAmount: totalBudget,
                  currency: 'USD',
                  unitType: 'dollars',
                },
              }
            : null,

        // Keep strategies array for backward compatibility
        strategies: transformedStrategies,

        // Field source tracking
        fieldSources: {
          status: 'zoho',
          price: 'zoho',
          team: 'zoho',
          dates: 'zoho',
        },

        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      };

      return transformedCampaign;
    });

    // Save transformed data
    const outputPath = path.join(OUTPUT_DIR, 'campaigns.json');
    await fs.writeFile(outputPath, JSON.stringify(transformedCampaigns, null, 2));

    // Also save with Decimal128 format for MongoDB
    const campaignsWithDecimal = transformedCampaigns.map((campaign) => ({
      ...campaign,
      budget: campaign.budget
        ? {
            ...campaign.budget,
            total: { $numberDecimal: campaign.budget.total.toString() },
            allocated: { $numberDecimal: campaign.budget.allocated.toString() },
            spent: { $numberDecimal: campaign.budget.spent.toString() },
            remaining: { $numberDecimal: campaign.budget.remaining.toString() },
          }
        : undefined,
      price: campaign.price
        ? {
            ...campaign.price,
            targetAmount: { $numberDecimal: campaign.price.targetAmount.toString() },
            actualAmount: { $numberDecimal: campaign.price.actualAmount.toString() },
            remainingAmount: { $numberDecimal: campaign.price.remainingAmount.toString() },
          }
        : undefined,
    }));

    const decimalOutputPath = path.join(OUTPUT_DIR, 'campaigns-decimal.json');
    await fs.writeFile(decimalOutputPath, JSON.stringify(campaignsWithDecimal, null, 2));

    console.log(`\nTransformation complete!`);
    console.log(`Saved ${transformedCampaigns.length} campaigns to:`);
    console.log(`  - ${outputPath} (standard format)`);
    console.log(`  - ${decimalOutputPath} (MongoDB Decimal128 format)`);

    // Save transformation summary
    const summary = {
      transformedAt: new Date().toISOString(),
      source: 'PostgreSQL export',
      totalCampaigns: transformedCampaigns.length,
      totalStrategies: strategies.length,
      totalLineItems: lineItems.length,
      totalUsers: users.length,
      outputFiles: ['campaigns.json', 'campaigns-decimal.json'],
      schemaVersion: '2.0',
      changes: [
        'Added price field alongside budget for transition',
        'Changed metrics.impressions to metrics.units',
        'Split margin into marginAmount and marginPercentage',
        'Integrated media strategy into campaign',
        'Enhanced team structure with new roles',
        'Added field source tracking',
      ],
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

// Run if called directly
if (import.meta.main) {
  transformPostgresData()
    .then(() => console.log('\nDone!'))
    .catch((error) => {
      console.error('\nError:', error);
      process.exit(1);
    });
}

export { transformPostgresData };
