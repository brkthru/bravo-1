import { test, expect } from '@playwright/test';

test.describe('Debug Frontend Issues', () => {
  test('check if page loads and capture screenshot', async ({ page }) => {
    // Enable console logging
    page.on('console', (msg) => console.log('Console:', msg.type(), msg.text()));
    page.on('pageerror', (error) => console.log('Page error:', error.message));

    // Navigate to the app
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    console.log('Response status:', response?.status());

    // Take a screenshot
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });

    // Check basic page structure
    const html = await page.content();
    console.log('Page HTML length:', html.length);

    // Check if root element exists
    const root = await page.$('#root');
    expect(root).not.toBeNull();

    // Check if React mounted
    const rootContent = await page.evaluate(() => {
      const el = document.getElementById('root');
      return el ? el.innerHTML : 'No root element';
    });
    console.log('Root content:', rootContent.substring(0, 200));

    // Wait a bit for React to render
    await page.waitForTimeout(2000);

    // Check for any visible text
    const bodyText = await page.textContent('body');
    console.log('Body text:', bodyText);
  });

  test('check API connection', async ({ page, request }) => {
    // Check backend health
    const healthResponse = await request.get('http://localhost:3001/health');
    console.log('Health check:', await healthResponse.json());

    // Check campaigns API
    const campaignsResponse = await request.get('http://localhost:3001/api/campaigns');
    const campaigns = await campaignsResponse.json();
    console.log('Campaigns response:', campaigns);
  });
});
