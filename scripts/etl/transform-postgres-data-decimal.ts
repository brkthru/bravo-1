import fs from 'fs/promises';
import path from 'path';
import BigNumber from 'bignumber.js';
import { MongoDecimal } from '../../backend/src/utils/decimal';

const INPUT_DIR = './data-export';
const OUTPUT_DIR = './data-transformed';

// Configure BigNumber for financial calculations
BigNumber.config({
  DECIMAL_PLACES: 6,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-15, 20],
});

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
  media_budget?: string;
  target_unit_cost?: string;
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

/**
 * Convert financial value to proper decimal string
 * Handles null, undefined, and invalid values
 */
function toDecimalString(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  try {
    const bigNum = new BigNumber(value);
    if (bigNum.isNaN() || !bigNum.isFinite()) {
      console.warn(`Invalid financial value: ${value}, defaulting to 0`);
      return '0';
    }
    // Store with 6 decimal places as per ADR 0019
    return bigNum.toFixed(6);
  } catch (error) {
    console.warn(`Error converting financial value: ${value}, defaulting to 0`);
    return '0';
  }
}

/**
 * Transform PostgreSQL data with proper decimal handling
 */
async function transformPostgresDataWithDecimals() {
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

    // Transform campaigns with proper decimal handling
    console.log('Transforming campaigns with ADR 0019 decimal precision...');
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

        // Calculate total line items budget for this strategy
        let strategyBudgetTotal = new BigNumber(0);

        const transformedLineItems = strategyLineItems.map((lineItem) => {
          const price = toDecimalString(lineItem.price);
          const unitPrice = toDecimalString(lineItem.unit_price);
          const mediaBudget = toDecimalString(lineItem.media_budget);
          const targetUnitCost = toDecimalString(lineItem.target_unit_cost);

          // Add to strategy total
          strategyBudgetTotal = strategyBudgetTotal.plus(price);

          return {
            _id: lineItem.id,
            name: lineItem.name,
            description: lineItem.description,
            audience: lineItem.audience,
            startDate: lineItem.start_date,
            endDate: lineItem.end_date,
            // Financial fields stored as decimal strings
            price: price,
            unitPrice: unitPrice,
            mediaBudget: mediaBudget,
            targetUnitCost: targetUnitCost,
            targetMargin: lineItem.target_margin || 0,
            createdAt: lineItem.created_at,
            updatedAt: lineItem.updated_at,
          };
        });

        return {
          _id: strategy.id,
          name: strategy.name || 'Untitled Strategy',
          status: strategy.status || 'active',
          lineItems: transformedLineItems,
          // Strategy financial totals
          totalBudget: strategyBudgetTotal.toFixed(6),
          createdAt: strategy.created_at,
          updatedAt: strategy.updated_at,
        };
      });

      // Calculate campaign totals with proper precision
      const campaignBudget = toDecimalString(campaign.budget);
      const totalAllocated = transformedStrategies.reduce((sum, strategy) => {
        return sum.plus(strategy.totalBudget);
      }, new BigNumber(0));

      const totalLineItems = transformedStrategies.reduce(
        (sum, strategy) => sum + strategy.lineItems.length,
        0
      );

      // Ensure budget calculations maintain precision
      const budgetBigNum = new BigNumber(campaignBudget);
      const spent = new BigNumber(0); // Will be calculated from actual spend data
      const remaining = budgetBigNum.minus(spent);

      return {
        _id: campaign.id,
        campaignNumber: campaign.campaign_number,
        name: campaign.campaign_name || 'Unnamed Campaign',
        accountId: campaign.account_id,
        accountName: account?.account_name,
        status: campaign.stage || 'active',

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
          mediaTrader: null,
        },

        dates: {
          start: campaign.flight_date,
          end: campaign.end_date,
          created: campaign.created_at,
          updated: campaign.updated_at,
        },

        // Financial fields with decimal precision
        budget: {
          total: budgetBigNum.toFixed(6),
          allocated: totalAllocated.toFixed(6),
          spent: spent.toFixed(6),
          remaining: remaining.toFixed(6),
        },

        metrics: {
          lineItemCount: totalLineItems,
          strategyCount: transformedStrategies.length,
        },

        strategies: transformedStrategies,

        // Metadata for decimal handling
        _decimalMetadata: {
          version: '1.0.0',
          precision: 6,
          roundingMode: 'ROUND_HALF_UP',
        },

        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      };
    });

    // Save transformed data
    const outputPath = path.join(OUTPUT_DIR, 'campaigns-decimal.json');
    await fs.writeFile(outputPath, JSON.stringify(transformedCampaigns, null, 2));

    console.log(`\nTransformation complete with ADR 0019 decimal precision!`);
    console.log(`Saved ${transformedCampaigns.length} campaigns to ${outputPath}`);

    // Validate financial precision
    console.log('\nValidating financial precision...');
    let precisionIssues = 0;

    transformedCampaigns.forEach((campaign) => {
      const budget = new BigNumber(campaign.budget.total);
      const allocated = new BigNumber(campaign.budget.allocated);

      // Check if allocated exceeds budget (with 1 cent tolerance)
      if (allocated.minus(budget).isGreaterThan('0.01')) {
        console.warn(
          `Campaign ${campaign.campaignNumber}: Allocated (${allocated}) exceeds budget (${budget})`
        );
        precisionIssues++;
      }
    });

    if (precisionIssues === 0) {
      console.log('✓ All financial calculations passed precision validation');
    } else {
      console.log(`⚠ Found ${precisionIssues} precision issues that may need attention`);
    }

    // Save transformation summary
    const summary = {
      transformedAt: new Date().toISOString(),
      source: 'PostgreSQL export',
      decimalPrecision: {
        implementation: 'ADR 0019',
        library: 'bignumber.js',
        storagePrecision: 6,
        roundingMode: 'ROUND_HALF_UP',
      },
      totalCampaigns: transformedCampaigns.length,
      totalStrategies: strategies.length,
      totalLineItems: lineItems.length,
      totalUsers: users.length,
      financialFieldsTransformed: [
        'campaign.budget.*',
        'lineItem.price',
        'lineItem.unitPrice',
        'lineItem.mediaBudget',
        'lineItem.targetUnitCost',
      ],
      outputFile: 'campaigns-decimal.json',
      precisionIssues: precisionIssues,
    };

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'transformation-summary-decimal.json'),
      JSON.stringify(summary, null, 2)
    );
  } catch (error) {
    console.error('Transformation failed:', error);
    throw error;
  }
}

// Run the transformation
if (import.meta.main) {
  transformPostgresDataWithDecimals().catch(console.error);
}

export { transformPostgresDataWithDecimals };
