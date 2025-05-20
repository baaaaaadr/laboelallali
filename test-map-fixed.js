const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:3000...');
  
  // Set up console logging
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  // Set up error handling
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
  
  try {
    // Navigate to the page with a timeout
    const response = await page.goto('http://localhost:3000', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 // 30 second timeout
    });
    
    console.log('Page loaded, waiting for map container...');
    
    // Wait for either the map container or an error message
    await Promise.race([
      page.waitForSelector('.mapContainer', { timeout: 10000 })
        .then(() => console.log('Map container found')),
      page.waitForSelector('.errorContainer', { timeout: 10000 })
        .then(() => console.log('Error container found')),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout waiting for map or error container')), 10000)
      )
    ]);
    
    // Take a screenshot
    await page.screenshot({ path: 'map-debug.png' });
    console.log('Screenshot saved as map-debug.png');
    
    // Check for any visible errors
    const errorText = await page.evaluate(() => {
      const errorEl = document.querySelector('.errorContainer');
      return errorEl ? errorEl.textContent : 'No error message found';
    });
    
    console.log('Error message (if any):', errorText.trim());
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    console.log('Test completed. Closing browser in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
  }
})();
