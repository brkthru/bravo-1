const { chromium } = require('@playwright/test');

async function debugFrontend() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log console messages
  page.on('console', msg => {
    console.log(`Console ${msg.type()}: ${msg.text()}`);
  });

  // Log errors
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });

  // Log requests
  page.on('request', request => {
    console.log('Request:', request.method(), request.url());
  });

  // Log failed requests
  page.on('requestfailed', request => {
    console.error('Request failed:', request.url(), request.failure()?.errorText);
  });

  try {
    console.log('Navigating to http://localhost:5174...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    
    console.log('Page loaded, waiting for React to render...');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'frontend-debug.png', fullPage: true });
    console.log('Screenshot saved as frontend-debug.png');

    // Check if root element has content
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML : 'No root element found';
    });
    console.log('Root element content length:', rootContent.length);

    // Check for any React errors
    const reactErrors = await page.evaluate(() => {
      return window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size || 'React DevTools not found';
    });
    console.log('React DevTools status:', reactErrors);

    // Try to find specific elements
    const hasLayout = await page.locator('text=MediaTool').count();
    console.log('Found MediaTool text:', hasLayout > 0);

    const hasCampaigns = await page.locator('text=Campaigns').count();
    console.log('Found Campaigns text:', hasCampaigns > 0);

    // Check network tab for failed requests
    const failedRequests = [];
    page.on('requestfailed', request => failedRequests.push(request.url()));
    
    await page.reload();
    await page.waitForTimeout(2000);
    
    if (failedRequests.length > 0) {
      console.log('Failed requests:', failedRequests);
    }

    console.log('\nTest complete! Check frontend-debug.png for visual output.');
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

debugFrontend().catch(console.error);