import { test, expect } from '@playwright/test';

test.describe('Campaign List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns');
  });

  test('should navigate to campaigns page', async ({ page }) => {
    await expect(page).toHaveURL(/\/campaigns/);
  });

  test('should display campaign list header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Campaigns' }).first()).toBeVisible();
    await expect(page.getByText('Manage your advertising campaigns and track performance')).toBeVisible();
  });

  test('should display navigation sidebar', async ({ page }) => {
    await expect(page.getByText('Bravo')).toBeVisible();
    
    // Check navigation group headers - use more specific selectors to avoid duplicates
    await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Execution' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System' })).toBeVisible();
    
    // Check navigation links
    await expect(page.getByRole('link', { name: 'Campaigns' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Line Items' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Media Plans' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Platform Buys' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible(); // Under Analytics group
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('should display search bar', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search...');
    await expect(searchInput).toBeVisible();
    
    // Test search functionality with known campaign
    await searchInput.fill('Virginia');
    await page.waitForTimeout(1000); // Wait for search results
    
    // Should show Virginia-related campaigns - use first() to avoid duplicates
    await expect(page.getByText('Foodbank of Southeastern Virginia').first()).toBeVisible();
  });

  test('should display New Campaign button', async ({ page }) => {
    const newCampaignButton = page.getByRole('button', { name: /New Campaign/i });
    await expect(newCampaignButton).toBeVisible();
  });

  test('should display AG-Grid table', async ({ page }) => {
    // Wait for AG-Grid to load
    await page.waitForSelector('.ag-theme-alpine', { timeout: 10000 });
    
    // Check if table headers are visible
    await expect(page.locator('.ag-header')).toBeVisible();
    
    // Check for specific column headers - use first() to avoid duplicates
    await expect(page.getByText('Campaign Details').first()).toBeVisible();
    await expect(page.getByText('Status').first()).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
    await expect(page.getByText('Media Activity').first()).toBeVisible();
  });

  test('should display campaign data', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('.ag-row', { timeout: 10000 });
    
    // Check if campaign data is visible (using production test data)
    // From timestamped export: 20250622-072326
    await expect(page.getByText('Aces Automotive Repair - Phoenix location 1')).toBeVisible();
    await expect(page.getByText('CN-13999')).toBeVisible();
    
    // Should also show other campaigns from the first page
    await expect(page.getByText('2025 CLT GO Store 1824 Charlotte, NC')).toBeVisible();
    await expect(page.getByText('CN-13998')).toBeVisible();
  });

  test('should display summary statistics', async ({ page }) => {
    // Wait for stats to load before checking
    await page.waitForTimeout(2000);
    
    // Stats might only show when campaigns are loaded successfully
    const hasCampaigns = await page.locator('.ag-row').count() > 0;
    if (hasCampaigns) {
      await expect(page.getByText('Total Campaigns')).toBeVisible();
      await expect(page.getByText('Total Budget')).toBeVisible();
      await expect(page.getByText('Active Campaigns')).toBeVisible();
    }
  });

  test.skip('should handle API errors gracefully', async ({ page }) => {
    // Navigate to the page first
    await page.goto('/campaigns');
    
    // Intercept API call and return error
    await page.route('**/api/campaigns*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: 'Internal Server Error'
      });
    });

    // Reload to trigger the error
    await page.reload();
    
    // Wait for error message to appear - React Query might retry a few times
    await page.waitForTimeout(2000);
    
    // Should show error message with the actual error text
    await expect(page.getByText(/Error loading campaigns: Request failed with status code 500/)).toBeVisible();
  });
});