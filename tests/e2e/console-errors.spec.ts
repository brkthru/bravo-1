import { test, expect } from '@playwright/test';

test.describe('Console Errors', () => {
  test('should not have any console errors on campaigns page', async ({ page }) => {
    // Collect all console messages
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore AG-Grid license warnings
        if (
          !text.includes('AG Grid') &&
          !text.includes('License Key Not Found') &&
          !text.includes('*****') &&
          !text.includes('ag-grid.com')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // Navigate to campaigns page
    await page.goto('/campaigns');
    await page.waitForTimeout(2000); // Wait for page to fully load

    // Check that there are no console errors
    expect(consoleErrors).toEqual([]);
  });

  test('should load campaigns page without DateSchema errors', async ({ page }) => {
    let hasSchemaError = false;

    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('DateSchema')) {
        hasSchemaError = true;
      }
    });

    await page.goto('/campaigns');
    await page.waitForTimeout(2000);

    expect(hasSchemaError).toBe(false);
  });
});
