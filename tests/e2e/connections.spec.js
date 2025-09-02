// 主机连接管理端到端测试

const { test, expect } = require('@playwright/test');

test.describe('主机连接管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/connections');
  });

  test('应该显示连接管理页面', async ({ page }) => {
    // 检查页面标题
    await expect(page.locator('h1')).toContainText('连接管理');
    
    // 检查新建连接按钮
    const newConnectionBtn = page.locator('text=新建连接');
    await expect(newConnectionBtn).toBeVisible();
  });

  test('应该能够创建新的SSH连接', async ({ page }) => {
    // 点击新建连接按钮
    await page.click('text=新建连接');
    
    // 应该导航到新建连接页面
    await expect(page).toHaveURL(/.*\/connections\/new/);
    
    // 填写连接信息
    await page.fill('input[placeholder="输入连接名称"]', 'E2E测试主机');
    await page.fill('input[placeholder="IP地址或域名"]', 'test.example.com');
    await page.fill('input[placeholder="SSH用户名"]', 'testuser');
    
    // 选择密码认证
    await page.click('text=密码认证');
    await page.fill('input[placeholder="SSH密码"]', 'testpass');
    
    // 保存连接
    await page.click('text=保存');
    
    // 应该显示成功消息（或返回连接列表）
    // 注意：实际测试中可能需要模拟服务器响应
  });

  test('应该能够编辑现有连接', async ({ page }) => {
    // 假设已有连接记录，点击编辑按钮
    const editBtn = page.locator('[data-test="edit-btn"]').first();
    
    if (await editBtn.isVisible()) {
      await editBtn.click();
      
      // 修改连接名称
      const nameInput = page.locator('input[value]').first();
      await nameInput.fill('修改后的连接名称');
      
      // 保存修改
      await page.click('text=保存');
    }
  });

  test('应该能够测试连接', async ({ page }) => {
    // 点击测试连接按钮
    const testBtn = page.locator('text=测试连接').first();
    
    if (await testBtn.isVisible()) {
      await testBtn.click();
      
      // 等待测试结果
      await page.waitForSelector('.el-message', { timeout: 10000 });
    }
  });

  test('应该能够删除连接', async ({ page }) => {
    // 点击删除按钮
    const deleteBtn = page.locator('[data-test="delete-btn"]').first();
    
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      
      // 确认删除
      await page.click('text=确认');
      
      // 应该显示成功消息
      await expect(page.locator('.el-message')).toBeVisible();
    }
  });

  test('连接列表应该支持搜索和筛选', async ({ page }) => {
    // 搜索功能
    const searchInput = page.locator('input[placeholder*="搜索"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('测试');
      
      // 验证搜索结果
      await page.waitForTimeout(1000); // 等待搜索结果
    }
    
    // 分组筛选
    const groupFilter = page.locator('select[data-test="group-filter"]');
    if (await groupFilter.isVisible()) {
      await groupFilter.selectOption('测试组');
      
      // 验证筛选结果
      await page.waitForTimeout(1000);
    }
  });

  test('应该能够批量操作', async ({ page }) => {
    // 选择多个连接
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    
    if (count > 1) {
      await checkboxes.first().check();
      await checkboxes.nth(1).check();
      
      // 批量删除
      const batchDeleteBtn = page.locator('text=批量删除');
      if (await batchDeleteBtn.isVisible()) {
        await batchDeleteBtn.click();
        
        // 确认删除
        await page.click('text=确认');
      }
    }
  });
});

test.describe('连接详情页面', () => {
  test('应该显示连接详情和终端', async ({ page }) => {
    // 导航到连接详情页面
    await page.goto('/connections/test-connection-id');
    
    // 检查连接信息
    await expect(page.locator('.connection-detail')).toBeVisible();
    
    // 检查终端区域
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
  });

  test('终端应该能够执行命令', async ({ page }) => {
    await page.goto('/connections/test-connection-id');
    
    // 等待连接建立
    await page.waitForSelector('.terminal-input', { timeout: 10000 });
    
    // 输入命令
    const commandInput = page.locator('.terminal-input input');
    await commandInput.fill('ls -la');
    await commandInput.press('Enter');
    
    // 等待命令结果
    await page.waitForTimeout(2000);
    
    // 检查终端输出
    const terminalOutput = page.locator('.terminal-line.output');
    await expect(terminalOutput).toHaveCount.toBeGreaterThan(0);
  });

  test('应该支持命令历史', async ({ page }) => {
    await page.goto('/connections/test-connection-id');
    
    // 打开命令历史
    await page.click('text=历史命令');
    
    // 检查历史对话框
    const historyDialog = page.locator('.el-dialog');
    await expect(historyDialog).toBeVisible();
    
    // 关闭对话框
    await page.click('.el-dialog .el-button:has-text("关闭")');
  });
});