import { test, expect } from '@playwright/test';

test.describe('ETL Import API', () => {
  const API_URL = 'http://localhost:3001/api';

  test('should get ETL status', async ({ request }) => {
    const response = await request.get(`${API_URL}/etl/status`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('operational');
    expect(data.data.calculationVersion).toBeDefined();
    expect(data.data.supportedEntities).toContain('campaigns');
    expect(data.data.maxBatchSize).toBe(1000);
  });

  test('should import campaigns via ETL endpoint', async ({ request }) => {
    const testCampaigns = [
      {
        name: 'ETL Test Campaign 1',
        campaignNumber: 'ETL-TEST-001',
        status: 'L1',
        price: {
          targetAmount: 50000,
          actualAmount: 20000,
          remainingAmount: 30000,
          currency: 'USD',
        },
        dates: {
          start: '2025-01-01',
          end: '2025-12-31',
        },
        team: {},
        metrics: {
          deliveryPacing: 0.5,
          spendPacing: 0.4,
          marginAmount: 10000,
          marginPercentage: 20,
          units: 100000,
          unitType: 'impressions',
          revenueDelivered: 40000,
          budgetSpent: 20000,
          marginActual: 0.5,
        },
        mediaActivity: 'None active',
        lineItems: [],
      },
      {
        name: 'ETL Test Campaign 2',
        campaignNumber: 'ETL-TEST-002',
        status: 'L2',
        price: {
          targetAmount: 75000,
          actualAmount: 0,
          remainingAmount: 75000,
          currency: 'USD',
        },
        dates: {
          start: '2025-02-01',
          end: '2025-11-30',
        },
        team: {},
        metrics: {
          deliveryPacing: 0,
          spendPacing: 0,
          marginAmount: 15000,
          marginPercentage: 20,
          units: 150000,
          unitType: 'impressions',
          revenueDelivered: 0,
          budgetSpent: 0,
          marginActual: 0,
        },
        mediaActivity: 'Pending',
        lineItems: [],
      },
    ];

    // Import via ETL endpoint
    const importResponse = await request.post(`${API_URL}/etl/import`, {
      data: {
        entity: 'campaigns',
        data: testCampaigns,
        options: {
          validateAll: true,
          applyCalculations: true,
        },
      },
    });

    expect(importResponse.ok()).toBeTruthy();
    const importResult = await importResponse.json();

    expect(importResult.success).toBe(true);
    expect(importResult.data.entity).toBe('campaigns');
    expect(importResult.data.inserted + importResult.data.updated).toBe(2);
    expect(importResult.data.failed).toBe(0);
    expect(importResult.data.calculationVersion).toBeDefined();

    // Verify campaigns were imported
    const listResponse = await request.get(`${API_URL}/campaigns?search=ETL-TEST`);
    expect(listResponse.ok()).toBeTruthy();

    const listResult = await listResponse.json();
    expect(listResult.success).toBe(true);
    expect(listResult.data.length).toBeGreaterThanOrEqual(2);

    // Check that calculations were applied
    const campaign = listResult.data.find((c) => c.campaignNumber === 'ETL-TEST-001');
    expect(campaign).toBeDefined();
    expect(campaign.price.remainingAmount).toBeDefined();

    // If calculatedFields are exposed in the API response
    if (campaign.calculatedFields) {
      expect(campaign.calculatedFields.allocationPercentage).toBeDefined();
      expect(campaign.calculatedFields.spendPercentage).toBeDefined();
    }
  });

  test('should validate ETL import data', async ({ request }) => {
    const invalidCampaigns = [
      {
        // Missing required fields
        status: 'L1',
      },
    ];

    const response = await request.post(`${API_URL}/etl/import`, {
      data: {
        entity: 'campaigns',
        data: invalidCampaigns,
        options: {
          validateAll: true,
          returnFailedRecords: true,
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.failed).toBe(1);
    expect(result.data.errors).toBeDefined();
    expect(result.data.errors[0].error).toContain('required');
  });

  test('should reject invalid entity type', async ({ request }) => {
    const response = await request.post(`${API_URL}/etl/import`, {
      data: {
        entity: 'invalid_entity',
        data: [],
      },
    });

    expect(response.status()).toBe(400);
    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid entity');
  });

  test('should handle large batch import', async ({ request }) => {
    // Create 100 test campaigns
    const campaigns = Array.from({ length: 100 }, (_, i) => ({
      name: `Batch Campaign ${i + 1}`,
      campaignNumber: `BATCH-${String(i + 1).padStart(3, '0')}`,
      status: i % 3 === 0 ? 'L1' : 'L2',
      price: {
        targetAmount: 10000 + i * 1000,
        actualAmount: i * 100,
        remainingAmount: 10000 + i * 1000 - i * 100,
        currency: 'USD',
      },
      team: {},
      metrics: {
        deliveryPacing: Math.random() * 0.5,
        spendPacing: Math.random() * 0.4,
        marginAmount: 2000 + i * 200,
        marginPercentage: 20,
        units: 100000 + i * 1000,
        unitType: 'impressions',
        revenueDelivered: i * 100,
        budgetSpent: i * 100,
        marginActual: 0.2,
      },
      mediaActivity: i % 3 === 0 ? 'Some active' : 'None active',
      lineItems: [],
    }));

    const response = await request.post(`${API_URL}/etl/import`, {
      data: {
        entity: 'campaigns',
        data: campaigns,
      },
      timeout: 30000, // 30 second timeout for large batch
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.inserted + result.data.updated).toBe(100);
    expect(result.data.duration).toBeDefined();
    expect(result.data.duration).toBeLessThan(30000); // Should complete within 30 seconds
  });
});
