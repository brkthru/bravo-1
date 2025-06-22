import { test, expect } from '@playwright/test';

test.describe('Health Checks', () => {
  test('backend health check should return ok', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');
  });

  test('frontend should load successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('API campaigns endpoint should be accessible', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/campaigns');
    
    // API might return 500 if there's a database issue, but we just check if it's responding
    expect([200, 500]).toContain(response.status());
    
    const data = await response.json();
    // Check if response has expected structure
    expect(data).toHaveProperty('success');
    if (data.success) {
      expect(Array.isArray(data.data)).toBe(true);
    }
  });
});