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
        status: 'active',
        budget: {
          total: 50000,
          allocated: 40000,
          spent: 20000,
        },
        dates: {
          start: '2025-01-01',
          end: '2025-12-31',
        },
      },
      {
        name: 'ETL Test Campaign 2',
        campaignNumber: 'ETL-TEST-002',
        status: 'planning',
        budget: {
          total: 75000,
          allocated: 60000,
          spent: 0,
        },
        dates: {
          start: '2025-02-01',
          end: '2025-11-30',
        },
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
    expect(campaign.budget.remaining).toBeDefined();

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
        status: 'active',
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
      status: i % 3 === 0 ? 'active' : 'planning',
      budget: {
        total: 10000 + i * 1000,
        allocated: 8000 + i * 800,
        spent: i * 100,
      },
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
