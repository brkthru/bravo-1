import { test, expect } from '@playwright/test';

test.describe('Campaign Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');
  });

  test('should display pagination controls', async ({ page }) => {
    // Check pagination controls are visible
    await expect(page.getByText(/Showing \d+ to \d+ of .* results/)).toBeVisible();
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();
    
    // Check pagination buttons
    await expect(page.getByRole('button', { name: 'First' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last' })).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    // Wait for real data to load
    await page.waitForSelector('.ag-row', { timeout: 10000 });
    await page.waitForTimeout(2000); // Extra wait for AG-Grid to fully render
    
    // Check we're on page 1 and see specific campaigns
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    await expect(page.getByText('Aces Automotive Repair - Phoenix location 1')).toBeVisible();
    await expect(page.getByText('CN-13999')).toBeVisible();
    
    // Navigate to page 2
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(2000); // Wait for data to load
    
    // Verify we're on page 2
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    
    // Page 1 campaigns should not be visible
    await expect(page.getByText('Aces Automotive Repair - Phoenix location 1')).not.toBeVisible();
    // Different campaigns should be visible on page 2
    
    // Navigate back to page 1
    await page.getByRole('button', { name: 'Previous' }).click();
    await page.waitForTimeout(2000);
    
    // Verify we're back on page 1
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    await expect(page.getByText('Aces Automotive Repair - Phoenix location 1')).toBeVisible();
  });

  test('should allow changing page size', async ({ page }) => {
    // Find and change the page size selector
    const pageSizeSelector = page.locator('select').filter({ hasText: 'per page' });
    
    // Select 25 per page
    await pageSizeSelector.selectOption('25');
    await page.waitForTimeout(1000);
    
    // Verify the results count updated
    await expect(page.getByText(/Showing 1 to 25 of .* results/)).toBeVisible();
    
    // Select 100 per page
    await pageSizeSelector.selectOption('100');
    await page.waitForTimeout(1000);
    
    // Verify the results count updated
    await expect(page.getByText(/Showing 1 to 100 of .* results/)).toBeVisible();
  });

  test('should reset to page 1 when searching', async ({ page }) => {
    // Navigate to page 2
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    
    // Search for something
    await page.getByPlaceholder('Search...').fill('Hotel');
    await page.waitForTimeout(1000);
    
    // Should be back on page 1
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  });

  test('should show correct total count', async ({ page }) => {
    // Check that the total count is 13,417 (production data)
    await expect(page.getByText('13,417').first()).toBeVisible();
    
    // Also verify it's shown in the pagination text
    await expect(page.getByText(/of 13,417 results/)).toBeVisible();
  });

  test('should disable navigation buttons appropriately', async ({ page }) => {
    // On page 1, First and Previous should be disabled
    await expect(page.getByRole('button', { name: 'First' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    
    // Next and Last should be enabled
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Last' })).toBeEnabled();
    
    // Navigate to last page
    await page.getByRole('button', { name: 'Last' }).click();
    await page.waitForTimeout(1000);
    
    // On last page, Next and Last should be disabled
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Last' })).toBeDisabled();
    
    // First and Previous should be enabled
    await expect(page.getByRole('button', { name: 'First' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });
});