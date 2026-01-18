const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function addSampleData(page) {
  // Add Thin Mints sale
  await page.selectOption('select#cookieType', 'Thin Mints');
  await page.fill('input#quantity', '5');
  await page.fill('input#customerName', 'Mrs. Johnson');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Add Samoas sale
  await page.selectOption('select#cookieType', 'Samoas/Caramel deLites');
  await page.fill('input#quantity', '3');
  await page.fill('input#customerName', 'Mr. Smith');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Add Exploremores sale
  await page.selectOption('select#cookieType', 'Exploremores');
  await page.fill('input#quantity', '2');
  await page.fill('input#customerName', 'Ms. Davis');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function captureScreenshots() {
  const browser = await chromium.launch();
  const screenshotsDir = path.join(__dirname, '../../screenshots');
  let currentStep = 'initialization';
  
  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // Desktop view with empty state
    currentStep = 'capturing desktop empty state';
    const desktopPage = await browser.newPage({
      viewport: { width: 1280, height: 720 }
    });
    await desktopPage.goto('http://localhost:3000');
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-empty-state.png'),
      fullPage: true
    });

    // Add sample data
    currentStep = 'adding sample data to desktop view';
    await addSampleData(desktopPage);

    // Desktop view with data
    currentStep = 'capturing desktop with data';
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-with-data.png'),
      fullPage: true
    });
    await desktopPage.close();

    // Mobile view
    currentStep = 'capturing mobile view';
    const mobilePage = await browser.newPage({
      viewport: { width: 375, height: 667 }
    });
    await mobilePage.goto('http://localhost:3000');
    await mobilePage.waitForLoadState('networkidle');

    // Add sample data for mobile view
    currentStep = 'adding sample data to mobile view';
    await addSampleData(mobilePage);

    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-view.png'),
      fullPage: true
    });
    await mobilePage.close();

    console.log('Screenshots captured successfully!');
  } catch (error) {
    console.error(`Error during ${currentStep}:`, error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
