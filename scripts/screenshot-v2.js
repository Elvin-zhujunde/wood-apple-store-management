// 交互优化四项改动验证截图
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://127.0.0.1:55080';
const OUT = 'C:/Users/Lenovo/Desktop/wood-apple-store-management/screenshots-v2';
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
    // ============ 桌面端 (1440x900) ============
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.waitForSelector('input[placeholder="账号"]', { timeout: 8000 });

    // ARE-90 去角色化：用 sale 登录（原 sale 看不到入库/领料，现在应全见）
    await page.type('input[placeholder="账号"]', 'sale');
    await page.type('input[placeholder="密码"]', '123456');
    await page.click('button.el-button--primary');
    await page.waitForSelector('.el-aside, .el-menu', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1800));
    // ARE-90 验证：sale 登录后菜单项数量（应 10 项全开）
    const menuCount = await page.$$eval('.el-menu .el-menu-item', els => els.length);
    console.log('ARE-90: sale登录菜单项数 =', menuCount, '(应为10)');
    await shot(page, 'v2-01-sale全菜单');

    // ARE-92 工作台待办清单
    await go(page, '/dashboard');
    await shot(page, 'v2-02-工作台待办清单');

    // ARE-93 订单行内发货按钮（新建状态显示"发货"）
    await go(page, '/orders');
    await shot(page, 'v2-03-订单行内发货按钮');

    // 点发货弹窗
    const shipBtn = await page.$('.row-btn');
    if (shipBtn) {
      await shipBtn.click();
      await new Promise((r) => setTimeout(r, 1200));
      await shot(page, 'v2-04-发货小弹窗');
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 500));
    } else {
      console.log('⚠️ 未找到发货按钮（可能无新建订单）');
    }

    // ============ 移动端 (375x812 iPhone) ============
    const m = await browser.newPage();
    await m.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await m.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await m.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await m.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    await m.waitForSelector('input[placeholder="账号"]', { timeout: 8000 });
    await m.type('input[placeholder="账号"]', 'stock');
    await m.type('input[placeholder="密码"]', '123456');
    await m.click('button.el-button--primary');
    await m.waitForSelector('.header', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1500));

    // ARE-91 移动端工作台（统计卡2列）
    await shot(m, 'v2-05-移动端工作台');
    // ARE-91 移动端汉堡菜单
    const ham = await m.$('.hamburger');
    if (ham) {
      await ham.click();
      await new Promise((r) => setTimeout(r, 1000));
      await shot(m, 'v2-06-移动端抽屉菜单');
      await m.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 500));
    }
    // ARE-91 移动端订单表格横向滚动
    await go(m, '/orders');
    await shot(m, 'v2-07-移动端订单表格');
    // ARE-91 移动端库存查询
    await go(m, '/inventory');
    await shot(m, 'v2-08-移动端库存查询');

    console.log('\n✅ 全部验证截图完成:', OUT);
  } catch (e) {
    console.error('❌ 截图失败:', e.message);
  } finally {
    await browser.close();
  }
})();
