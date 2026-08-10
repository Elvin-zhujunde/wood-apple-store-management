// 截图脚本：用 puppeteer 驱动浏览器，登录并截取关键页面
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://127.0.0.1:55080';
const OUT = 'C:/Users/Lenovo/Desktop/wood-apple-store-management/screenshots';
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
  console.log('📷 截图:', name);
}

async function go(page, path_) {
  await page.goto(BASE + path_, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. 登录页 —— 先清空 localStorage 确保未登录
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.waitForSelector('input[placeholder="账号"]', { timeout: 8000 });
    await shot(page, '01-login');

    // 2. 登录 stock
    await page.type('input[placeholder="账号"]', 'stock');
    await page.type('input[placeholder="密码"]', '123456');
    await page.click('button.el-button--primary');
    await page.waitForSelector('.el-aside', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1500));
    await shot(page, '02-dashboard');

    // 3-11 各页面
    await go(page, '/inventory');    await shot(page, '03-inventory');
    await go(page, '/suggestion');   await shot(page, '04-suggestion');
    await go(page, '/orders');       await shot(page, '05-orders');

    // 6. 接单对话框
    const addBtn = await page.$('button.el-button--success');
    if (addBtn) {
      await addBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      await shot(page, '06-order-add');
      await page.keyboard.press('Escape');
    }

    await go(page, '/materials');    await shot(page, '07-materials');
    await go(page, '/door-bom');     await shot(page, '08-door-bom');
    await go(page, '/inbound');      await shot(page, '09-inbound');
    await go(page, '/report/orders'); await shot(page, '10-report-orders');
    await go(page, '/report/inventory'); await shot(page, '11-report-inventory');

    console.log('\n✅ 全部截图完成:', OUT);
  } catch (e) {
    console.error('❌ 截图失败:', e.message);
    await page.screenshot({ path: path.join(OUT, 'ERROR.png') }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
