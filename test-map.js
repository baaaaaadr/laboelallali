const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console logs
  page.on('console', msg => {
    console.log('Browser console log:', msg.text());
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });

  // Listen for request failures
  page.on('requestfailed', request => {
    console.error('Request failed:', request.url(), request.failure().errorText);
  });

  try {
    console.log('Navigating to http://localhost:3003...');
    const response = await page.goto('http://localhost:3003', { waitUntil: 'networkidle' });
    
    if (!response.ok()) {
      console.error(`Failed to load page: ${response.status()} ${response.statusText()}`);
    } else {
      console.log('Page loaded successfully');
    }

    // Wait for the map container to be visible
    console.log('Waiting for map container...');
    await page.waitForSelector('.mapContainer', { timeout: 10000 })
      .then(() => console.log('Map container found'))
      .catch(() => console.log('Map container not found after 10 seconds'));

    // Take a screenshot for debugging
    await page.screenshot({ path: 'map-debug.png' });
    console.log('Screenshot saved as map-debug.png');

    // Check for any Leaflet errors
    const leafletErrors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent.includes('leaflet') || el.textContent.includes('map'));
    });

    if (leafletErrors.length > 0) {
      console.log('Potential Leaflet-related elements found:', leafletErrors.length);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Keep the browser open for inspection
    console.log('Test completed. Keeping browser open for inspection...');
    await page.pause();
  }
})();
