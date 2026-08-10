// ARE-94 采购建议闭环截图
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://127.0.0.1:55080';
const OUT = 'C:/Users/Lenovo/Desktop/wood-apple-store-management/screenshots-are94';
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
  console.log('📷 截图:', name);
}
async function go(page, p) {
  await page.goto(BASE + p, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.waitForSelector('input[placeholder="账号"]', { timeout: 8000 });
    await page.type('input[placeholder="账号"]', 'stock');
    await page.type('input[placeholder="密码"]', '123456');
    await page.click('button.el-button--primary');
    await page.waitForSelector('.el-menu', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1500));

    // 1. 采购建议列表（含采纳按钮）
    await go(page, '/suggestion');
    await shot(page, 'are94-01-采购建议列表');

    // 2. 点采纳弹窗
    const adoptBtn = await page.$('button.row-btn');
    if (adoptBtn) {
      await adoptBtn.click();
      await new Promise((r) => setTimeout(r, 1200));
      await shot(page, 'are94-02-采纳弹窗');
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 500));
    } else {
      console.log('⚠️ 无待采购建议可采纳');
    }

    // 3. 采购入库页（可见采纳生成的待到货单）
    await go(page, '/inbound');
    await shot(page, 'are94-03-采购入库单列表');

    console.log('\n✅ ARE-94 截图完成:', OUT);
  } catch (e) {
    console.error('❌ 截图失败:', e.message);
  } finally {
    await browser.close();
  }
})();
