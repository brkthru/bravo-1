#!/usr/bin/env bun
import type {
  Campaign,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '../../shared/src/types';

// Test that TypeScript types are properly generated from Zod schemas
async function testTypeScriptTypes() {
  console.log('Testing TypeScript type generation...\n');

  // Test 1: Create a campaign object that satisfies the Campaign type
  const validCampaign: Campaign = {
    _id: '123456',
    campaignNumber: 'CN-123',
    name: 'Test Campaign',
    status: 'L1',
    displayStatus: 'Active',
    accountName: 'Test Account',
    team: {
      accountManager: {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'account_manager',
      },
      csd: null,
      seniorMediaTraders: [],
      mediaTraders: [],
    },
    dates: {
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31'),
      daysElapsed: 180,
      totalDuration: 365,
    },
    price: {
      targetAmount: 10000,
      actualAmount: 5000,
      remainingAmount: 5000,
      currency: 'USD',
    },
    metrics: {
      deliveryPacing: 0.5,
      spendPacing: 0.5,
      marginAmount: 1500,
      marginPercentage: 30,
      units: 100000,
      unitType: 'impressions',
      revenueDelivered: 5000,
      budgetSpent: 3500,
      marginActual: 0.3,
    },
    mediaActivity: 'Some active',
    lineItems: [],
    lineItemCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('✅ Campaign type validation successful');
  console.log(`   Campaign: ${validCampaign.name} (${validCampaign.campaignNumber})`);

  // Test 2: Create request type
  const createRequest: CreateCampaignRequest = {
    campaignNumber: 'CN-124',
    name: 'New Campaign',
    status: 'L1',
    displayStatus: 'Planning',
    accountName: 'New Account',
    team: {
      seniorMediaTraders: [],
      mediaTraders: [],
    },
    dates: {
      start: new Date('2025-02-01'),
      end: new Date('2025-06-30'),
      daysElapsed: 0,
      totalDuration: 149,
    },
    price: {
      targetAmount: 20000,
      actualAmount: 0,
      remainingAmount: 20000,
      currency: 'USD',
    },
    metrics: {
      deliveryPacing: 0,
      spendPacing: 0,
      marginAmount: 0,
      marginPercentage: 30,
      units: 0,
      unitType: 'impressions',
      revenueDelivered: 0,
      budgetSpent: 0,
      marginActual: 0,
    },
    mediaActivity: 'None active',
    lineItems: [],
    lineItemCount: 0,
  };

  console.log('✅ CreateCampaignRequest type validation successful');

  // Test 3: Update request type (partial)
  const updateRequest: UpdateCampaignRequest = {
    name: 'Updated Campaign Name',
    price: {
      targetAmount: 25000,
      actualAmount: 10000,
      remainingAmount: 15000,
      currency: 'USD',
    },
  };

  console.log('✅ UpdateCampaignRequest type validation successful');

  // Test 4: Verify type inference from Zod schema
  console.log('\n📊 Type information:');
  console.log(`   Campaign fields: ${Object.keys(validCampaign).length}`);
  console.log(`   Required team roles: ${Object.keys(validCampaign.team).length}`);
  console.log(`   Metric fields: ${Object.keys(validCampaign.metrics).length}`);

  // Test 5: Type errors would be caught at compile time
  // Uncomment these to see TypeScript errors:
  // const invalidCampaign: Campaign = {
  //   _id: 123, // Error: Type 'number' is not assignable to type 'string'
  //   status: 'INVALID', // Error: Type '"INVALID"' is not assignable to type 'CampaignStatus'
  //   ...
  // };

  console.log('\n✅ All TypeScript type tests passed!');
}

testTypeScriptTypes();
