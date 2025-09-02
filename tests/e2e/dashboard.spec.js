// 仪表板端到端测试

const { test, expect } = require('@playwright/test');

test.describe('仪表板页面', () => {
  test.beforeEach(async ({ page }) => {
    // 访问应用首页
    await page.goto('/');
  });

  test('应该显示仪表板标题和概览', async ({ page }) => {
    // 检查页面标题
    await expect(page).toHaveTitle(/Temctl/);
    
    // 检查仪表板标题
    await expect(page.locator('h1')).toContainText('仪表板');
    
    // 检查统计卡片
    const statCards = page.locator('.stat-card');
    await expect(statCards).toHaveCount(4);
    
    // 检查统计卡片内容
    await expect(statCards.first()).toContainText('主机总数');
  });

  test('快速操作按钮应该正常工作', async ({ page }) => {
    // 点击新建连接按钮
    await page.click('text=新建连接');
    
    // 应该导航到新建连接页面
    await expect(page).toHaveURL(/.*\/connections\/new/);
    
    // 返回仪表板
    await page.goBack();
    
    // 点击AI助手按钮
    await page.click('text=AI助手');
    
    // 应该导航到AI页面
    await expect(page).toHaveURL(/.*\/ai/);
  });

  test('系统状态应该正确显示', async ({ page }) => {
    // 检查系统状态卡片
    const systemStatus = page.locator('.system-status');
    await expect(systemStatus).toBeVisible();
    
    // 检查CPU和内存进度条
    const progressBars = page.locator('.el-progress');
    await expect(progressBars).toHaveCount(2);
    
    // 检查网络状态
    const networkStatus = page.locator('.network-status');
    await expect(networkStatus).toBeVisible();
  });

  test('最近连接列表应该显示', async ({ page }) => {
    const recentConnections = page.locator('.recent-connections');
    await expect(recentConnections).toBeVisible();
    
    // 如果有连接记录，检查连接项
    const connectionItems = page.locator('.connection-item');
    const count = await connectionItems.count();
    
    if (count > 0) {
      // 检查第一个连接项的信息
      const firstItem = connectionItems.first();
      await expect(firstItem.locator('.host-name')).toBeVisible();
      await expect(firstItem.locator('.host-address')).toBeVisible();
      await expect(firstItem.locator('.connection-status')).toBeVisible();
    }
  });

  test('响应式布局应该正常工作', async ({ page }) => {
    // 测试桌面布局
    await page.setViewportSize({ width: 1200, height: 800 });
    
    const statsGrid = page.locator('.stats-grid');
    await expect(statsGrid).toBeVisible();
    
    // 测试平板布局
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(statsGrid).toBeVisible();
    
    // 测试移动设备布局
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(statsGrid).toBeVisible();
  });
});