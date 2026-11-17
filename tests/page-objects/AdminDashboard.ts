import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, safeClick, waitForPageLoad } from '../utils/test-helpers';

export class AdminDashboard {
  readonly page: Page;
  readonly metricsCards: Locator;
  readonly chartsSection: Locator;
  readonly pendingActions: Locator;

  constructor(page: Page) {
    this.page = page;
    this.metricsCards = page.locator('.grid a[href^="/admin"]');
    this.chartsSection = page.locator('.space-y-6');
    this.pendingActions = page.locator('section:has-text("Needs Attention")');
  }

  async goto() {
    await this.page.goto('/admin', { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    // Wait for the dashboard heading - it may have different text
    await waitForElement(this.page, 'h1:has-text("Dashboard")', 20000);
  }

  async getMetrics() {
    const metrics: Record<string, string> = {};
    const cards = this.metricsCards;
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const label = await card.locator('p.text-gray-500').textContent();
      const value = await card.locator('p.text-2xl').textContent();
      if (label && value) {
        metrics[label.trim()] = value.trim();
      }
    }
    return metrics;
  }

  async clickMetric(label: string) {
    await safeClick(this.page, `.grid a:has-text("${label}")`);
  }

  async toggleCharts() {
    await safeClick(this.page, 'button:has-text("Hide Charts"), button:has-text("Show Charts")');
  }

  async getPendingActions() {
    const actions = this.pendingActions.locator('a');
    const count = await actions.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const action = actions.nth(i);
      const text = await action.textContent();
      result.push(text?.trim() || '');
    }
    return result;
  }

  async clickPendingAction(index: number) {
    await this.pendingActions.locator('a').nth(index).click();
  }
}

export class AdminShopsPage {
  readonly page: Page;
  readonly tabs: Locator;
  readonly shopTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.locator('[role="tablist"] button, .tab-button');
    this.shopTable = page.locator('table, .shop-list');
  }

  async goto(tab = 'all') {
    await this.page.goto(`/admin/shops?tab=${tab}`, { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    await waitForElement(this.page, 'h1:has-text("Shops"), h1:has-text("Shop")', 20000);
  }

  async clickTab(tabName: string) {
    await safeClick(this.page, `button:has-text("${tabName}"), a:has-text("${tabName}")`);
    await this.page.waitForTimeout(500);
  }

  async getShopCount(): Promise<number> {
    return await this.page.locator('tbody tr, .shop-card').count();
  }

  async getShopDetails(rowIndex: number) {
    const row = this.page.locator('tbody tr, .shop-card').nth(rowIndex);
    const name = await row.locator('td:first-child, .shop-name').textContent();
    const status = await row.locator('.status-badge, .badge, [class*="status"]').textContent();
    return { name: name?.trim() || '', status: status?.trim() || '' };
  }

  async approveShop(rowIndex: number) {
    const row = this.page.locator('tbody tr, .shop-card').nth(rowIndex);
    await safeClick(row, 'button:has-text("Approve"), button:has-text("Accept")');
    await waitForElement(this.page, '[role="status"]:has-text("approved"), .toast-success', 20000);
  }

  async rejectShop(rowIndex: number, reason?: string) {
    const row = this.page.locator('tbody tr, .shop-card').nth(rowIndex);
    await safeClick(row, 'button:has-text("Reject"), button:has-text("Decline")');
    if (reason) {
      await this.page.fill('textarea[name="reason"], input[name="reason"]', reason);
      await safeClick(this.page, 'button:has-text("Confirm")');
    }
    await waitForElement(this.page, '[role="status"]:has-text("rejected"), .toast-success', 20000);
  }

  async viewShopDetails(rowIndex: number) {
    const row = this.page.locator('tbody tr, .shop-card').nth(rowIndex);
    await safeClick(row, 'a:has-text("View"), button:has-text("View")');
    await waitForElement(this.page, '.shop-detail, h1', 20000);
  }
}

export class AdminOrdersPage {
  readonly page: Page;
  readonly filters: Locator;
  readonly ordersTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filters = page.locator('.filters');
    this.ordersTable = page.locator('tbody tr, .order-row');
  }

  async goto(status?: string) {
    const url = status ? `/admin/orders?status=${status}` : '/admin/orders';
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    await waitForElement(this.page, 'h1:has-text("Orders")', 20000);
  }

  async filterByStatus(status: string) {
    await this.page.locator(`select[name="status"]`).selectOption(status);
    await this.page.waitForTimeout(500);
  }

  async filterByDateRange(start: string, end: string) {
    await this.page.fill('input[name="startDate"]', start);
    await this.page.fill('input[name="endDate"]', end);
    await safeClick(this.page, 'button:has-text("Apply")');
    await this.page.waitForTimeout(500);
  }

  async getOrderCount(): Promise<number> {
    return await this.ordersTable.count();
  }

  async getOrderDetails(rowIndex: number) {
    const row = this.ordersTable.nth(rowIndex);
    const id = await row.locator('td:first-child, .order-id').textContent();
    const customer = await row.locator('.customer-name, td:nth-child(2)').textContent();
    const shop = await row.locator('.shop-name, td:nth-child(3)').textContent();
    const status = await row.locator('.status-badge, .badge').textContent();
    const total = await row.locator('.order-total, td:last-child').textContent();
    return {
      id: id?.trim() || '',
      customer: customer?.trim() || '',
      shop: shop?.trim() || '',
      status: status?.trim() || '',
      total: total?.trim() || '',
    };
  }

  async viewOrderDetails(rowIndex: number) {
    const row = this.ordersTable.nth(rowIndex);
    await safeClick(row, 'a:has-text("View"), button:has-text("View")');
    await waitForElement(this.page, '.order-detail, h1', 20000);
  }

  async assignRider(rowIndex: number, riderName: string) {
    const row = this.ordersTable.nth(rowIndex);
    await safeClick(row, 'button:has-text("Assign"), button:has-text("Dispatch")');
    await this.page.locator(`option:has-text("${riderName}")`).click();
    await safeClick(this.page, 'button:has-text("Confirm")');
    await waitForElement(this.page, '[role="status"]:has-text("assigned"), .toast-success', 20000);
  }
}

export class AdminRidersPage {
  readonly page: Page;
  readonly tabs: Locator;
  readonly ridersList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.locator('[role="tablist"] button');
    this.ridersList = page.locator('tbody tr, .rider-card');
  }

  async goto(tab = 'all') {
    await this.page.goto(`/admin/riders?tab=${tab}`, { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    await waitForElement(this.page, 'h1:has-text("Riders")', 20000);
  }

  async clickTab(tabName: string) {
    await safeClick(this.page, `button:has-text("${tabName}")`);
    await this.page.waitForTimeout(500);
  }

  async getRiderCount(): Promise<number> {
    return await this.ridersList.count();
  }

  async getRiderDetails(rowIndex: number) {
    const row = this.ridersList.nth(rowIndex);
    const name = await row.locator('.rider-name, td:first-child').textContent();
    const status = await row.locator('.status-badge, .badge').textContent();
    const vehicle = await row.locator('.vehicle-type, td:nth-child(3)').textContent();
    return {
      name: name?.trim() || '',
      status: status?.trim() || '',
      vehicle: vehicle?.trim() || '',
    };
  }

  async approveRider(rowIndex: number) {
    const row = this.ridersList.nth(rowIndex);
    await safeClick(row, 'button:has-text("Approve"), button:has-text("Accept")');
    await waitForElement(this.page, '[role="status"]:has-text("approved"), .toast-success', 20000);
  }

  async rejectRider(rowIndex: number) {
    const row = this.ridersList.nth(rowIndex);
    await safeClick(row, 'button:has-text("Reject"), button:has-text("Decline")');
    await waitForElement(this.page, '[role="status"]:has-text("rejected"), .toast-success', 20000);
  }
}

export class AdminPaymentsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/admin/payments', { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    await waitForElement(this.page, 'h1:has-text("Payments"), h1:has-text("Payouts")', 20000);
  }

  async getCommissionStats() {
    const stats = this.page.locator('.stat-card, .metric-card');
    const count = await stats.count();
    const result: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      const label = await stats.nth(i).locator('.label, .text-gray-500').textContent();
      const value = await stats.nth(i).locator('.value, .text-2xl').textContent();
      if (label && value) result[label.trim()] = value.trim();
    }
    return result;
  }

  async recordPayout(type: 'vendor' | 'rider', id: string, amount: string) {
    await safeClick(this.page, 'button:has-text("Record Payout"), button:has-text("New Payout")');
    await this.page.selectOption('select[name="type"]', type);
    await this.page.fill('input[name="recipient"]', id);
    await this.page.fill('input[name="amount"]', amount);
    await safeClick(this.page, 'button:has-text("Submit")');
    await waitForElement(this.page, '[role="status"]:has-text("recorded"), .toast-success', 20000);
  }
}
