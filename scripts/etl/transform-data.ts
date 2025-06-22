import fs from 'fs/promises';
import path from 'path';

const INPUT_DIR = './data-export';
const OUTPUT_DIR = './data-transformed';

interface BackupCampaign {
  _id: string;
  campaignNumber: string;
  name: string;
  accountName?: string;
  accountId?: string;
  status: string;
  team: any;
  dates: any;
  budget: any;
  metrics: any;
  mediaActivity: string;
  lineItemCount: number;
  strategy: any;
  createdAt: string;
  updatedAt: string;
}

interface LineItem {
  _id: string;
  strategyId: string;
  name: string;
  description?: string;
  audience?: string;
  geo?: string;
  targeting?: string;
  adFormats?: string;
  startDate: string;
  endDate: string;
  price: number;
  unitPrice: number;
  targetMargin: number;
  pacingType?: string;
  pacingDetails?: any;
  mediaTraderUserIds?: string[];
  mediaPlatformIds?: number[];
  channelId?: number;
  tacticId?: number;
  unitPriceTypeId?: number;
  purchaseOrderNumber?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

async function transformData() {
  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Load the data
    console.log('Loading extracted data...');
    
    const campaignsBackupPath = path.join(INPUT_DIR, 'campaigns_backup.json');
    const lineItemsPath = path.join(INPUT_DIR, 'lineItems.json');
    const strategiesPath = path.join(INPUT_DIR, 'strategies.json');
    const channelsPath = path.join(INPUT_DIR, 'channels.json');
    const tacticsPath = path.join(INPUT_DIR, 'tactics.json');
    const mediaPlatformsPath = path.join(INPUT_DIR, 'mediaPlatforms.json');
    
    // Check if files exist
    const fileChecks = [
      { path: campaignsBackupPath, name: 'campaigns_backup.json' },
      { path: lineItemsPath, name: 'lineItems.json' },
      { path: strategiesPath, name: 'strategies.json' }
    ];
    
    for (const check of fileChecks) {
      try {
        await fs.access(check.path);
        console.log(`✓ Found ${check.name}`);
      } catch {
        console.error(`✗ Missing ${check.name}`);
        throw new Error(`Required file ${check.name} not found. Run extract-data.ts first.`);
      }
    }
    
    // Load data
    const campaignsBackup: BackupCampaign[] = JSON.parse(
      await fs.readFile(campaignsBackupPath, 'utf-8')
    );
    const lineItems: LineItem[] = JSON.parse(
      await fs.readFile(lineItemsPath, 'utf-8')
    );
    const strategies = JSON.parse(
      await fs.readFile(strategiesPath, 'utf-8')
    );
    
    // Load reference data if available
    let channels = [];
    let tactics = [];
    let mediaPlatforms = [];
    
    try {
      channels = JSON.parse(await fs.readFile(channelsPath, 'utf-8'));
      tactics = JSON.parse(await fs.readFile(tacticsPath, 'utf-8'));
      mediaPlatforms = JSON.parse(await fs.readFile(mediaPlatformsPath, 'utf-8'));
    } catch {
      console.log('Some reference data files not found, continuing...');
    }
    
    console.log(`\nLoaded data:
    - ${campaignsBackup.length} campaigns
    - ${lineItems.length} line items
    - ${strategies.length} strategies
    - ${channels.length} channels
    - ${tactics.length} tactics
    - ${mediaPlatforms.length} media platforms`);
    
    // Create lookup maps
    const strategyMap = new Map(strategies.map(s => [s._id, s]));
    const channelMap = new Map(channels.map(c => [c._id, c]));
    const tacticMap = new Map(tactics.map(t => [t._id, t]));
    const platformMap = new Map(mediaPlatforms.map(p => [p._id, p]));
    
    // Group line items by strategy
    const lineItemsByStrategy = new Map<string, LineItem[]>();
    for (const lineItem of lineItems) {
      if (!lineItemsByStrategy.has(lineItem.strategyId)) {
        lineItemsByStrategy.set(lineItem.strategyId, []);
      }
      lineItemsByStrategy.get(lineItem.strategyId)!.push(lineItem);
    }
    
    // Transform campaigns to new structure
    console.log('\nTransforming campaigns...');
    const transformedCampaigns = [];
    
    for (let i = 0; i < campaignsBackup.length; i++) {
      if (i % 1000 === 0) {
        console.log(`  Processing campaign ${i + 1}/${campaignsBackup.length}`);
      }
      
      const campaign = campaignsBackup[i];
      const strategy = campaign.strategy;
      const strategyLineItems = lineItemsByStrategy.get(strategy._id) || [];
      
      // Transform line items to embedded structure
      const embeddedLineItems = strategyLineItems.map(li => {
        const channel = channelMap.get(li.channelId);
        const tactic = tacticMap.get(li.tacticId);
        
        return {
          _id: li._id,
          name: li.name,
          status: li.isActive ? 'active' : 'inactive',
          deliveryPacing: campaign.metrics?.deliveryPacing || 0,
          spendPacing: campaign.metrics?.spendPacing || 0,
          margin: li.targetMargin || 0.3,
          price: li.price,
          channel: channel?.name || 'Unknown',
          tactic: tactic?.name || 'Unknown',
          unitType: getUnitType(li.unitPriceTypeId),
          unitPrice: li.unitPrice,
          targetMargin: li.targetMargin,
          estimatedUnits: Math.round(li.price / li.unitPrice),
          dates: {
            start: li.startDate,
            end: li.endDate
          },
          mediaPlan: [] // This would need to be populated from mediaBuys data
        };
      });
      
      // Calculate total budget from line items
      const totalBudget = strategyLineItems.reduce((sum, li) => sum + li.price, 0);
      
      // Transform to new structure
      const transformedCampaign = {
        _id: campaign._id,
        campaignNumber: campaign.campaignNumber,
        name: campaign.name || generateCampaignName(campaign, strategyLineItems),
        accountName: campaign.accountName,
        accountId: campaign.accountId,
        status: campaign.status,
        team: campaign.team,
        dates: campaign.dates,
        budget: {
          total: totalBudget || campaign.budget?.total || 0,
          allocated: totalBudget || campaign.budget?.allocated || 0,
          spent: campaign.budget?.spent || 0,
          remaining: (totalBudget || campaign.budget?.total || 0) - (campaign.budget?.spent || 0)
        },
        metrics: campaign.metrics,
        mediaActivity: campaign.mediaActivity,
        lineItems: embeddedLineItems,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        version: 'v1.0.0'
      };
      
      transformedCampaigns.push(transformedCampaign);
    }
    
    // Save transformed data
    console.log('\nSaving transformed data...');
    
    const outputPath = path.join(OUTPUT_DIR, 'campaigns.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify(transformedCampaigns, null, 2),
      'utf-8'
    );
    
    // Save transformation summary
    const summaryPath = path.join(OUTPUT_DIR, 'transformation-summary.json');
    await fs.writeFile(
      summaryPath,
      JSON.stringify({
        transformedAt: new Date().toISOString(),
        inputCampaigns: campaignsBackup.length,
        outputCampaigns: transformedCampaigns.length,
        totalLineItems: lineItems.length,
        campaignsWithLineItems: transformedCampaigns.filter(c => c.lineItems.length > 0).length,
        averageLineItemsPerCampaign: (lineItems.length / transformedCampaigns.length).toFixed(2)
      }, null, 2),
      'utf-8'
    );
    
    console.log(`\n=== Transformation Complete ===`);
    console.log(`Transformed ${transformedCampaigns.length} campaigns`);
    console.log(`Output saved to: ${path.resolve(outputPath)}`);
    console.log(`Summary saved to: ${path.resolve(summaryPath)}`);
    
  } catch (error) {
    console.error('Transformation failed:', error);
    process.exit(1);
  }
}

function getUnitType(unitPriceTypeId?: number): string {
  const unitTypes = {
    1: 'impressions',
    2: 'clicks',
    3: 'conversions',
    4: 'video_views',
    5: 'engagements',
    6: 'reach',
    7: 'frequency'
  };
  return unitTypes[unitPriceTypeId || 1] || 'impressions';
}

function generateCampaignName(campaign: BackupCampaign, lineItems: LineItem[]): string {
  // Try to generate a meaningful name from account or line items
  if (campaign.accountName && campaign.accountName !== 'Unknown Account') {
    return campaign.accountName;
  }
  
  if (lineItems.length > 0) {
    // Extract common prefix from line item names
    const firstItemName = lineItems[0].name;
    const parts = firstItemName.split(' - ');
    if (parts.length > 1) {
      return parts[0];
    }
    return firstItemName;
  }
  
  return `Campaign ${campaign.campaignNumber}`;
}

// Run the transformation
transformData();