const fs = require('fs-extra');
const path = require('path');

async function copyServiceWorker() {
  try {
    const sourcePath = path.join(__dirname, '../src/lib/sw.js');
    const destPath = path.join(__dirname, '../public/sw.js');
    
    // Ensure the public directory exists
    await fs.ensureDir(path.dirname(destPath));
    
    // Copy the service worker file
    await fs.copyFile(sourcePath, destPath);
    
    console.log('✅ Service worker copied to public directory');
  } catch (error) {
    console.error('❌ Error copying service worker:', error);
    process.exit(1);
  }
}

// Run the copy function
copyServiceWorker();
