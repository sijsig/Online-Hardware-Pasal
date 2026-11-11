import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, safeClick } from '../utils/test-helpers';

export class AdminDashboard {
  readonly page: Page;
  readonly metricsCards: Locator;
  readonly chartsSection: Locator;
  readonly pendingActions: Locator;

  constructor(page: Page) {
    this.page = page;
    this.metricsCards = page.locator('.grid a[href^="/admin"], [data-testid="metric-card"]');
    this.chartsSection = page.locator('.space-y-6, [data-testid="charts-section"]');
    this.pendingActions = page.locator('section:has-text("Needs Attention"), [data-testid="pending-actions"]');
  }

  async goto() {
    await this.page.goto('/admin', { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Dashboard"), [data-testid="admin-dashboard"]', 15000);
  }

  async getMetrics() {
    const metrics: Record<string, string> = {};
    const cards = this.metricsCards;
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const label = await card.locator('p.text-gray-500, [data-testid="metric-label"]').textContent();
      const value = await card.locator('p.text-2xl, [data-testid="metric-value"]').textContent();
      if (label && value) {
        metrics[label.trim()] = value.trim();
      }
    }
    return metrics;
  }

  async clickMetric(label: string) {
    await safeClick(this.page, `.grid a:has-text("${label}"), [data-testid="metric-card"]:has-text("${label}")`);
  }

  async toggleCharts() {
    await safeClick(this.page, 'button:has-text("Hide Charts"), button:has-text("Show Charts"), [data-testid="toggle-charts"]');
  }

  async getPendingActions() {
    const actions = this.pendingActions.locator('a, [data-testid="pending-action"]');
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
    await this.pendingActions.locator('a, [data-testid="pending-action"]').nth(index).click();
  }
}

export class AdminShopsPage {
  readonly page: Page;
  readonly tabs: Locator;
  readonly shopTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.locator('[role="tablist"] button, .tab-button, [data-testid="tab"]');
    this.shopTable = page.locator('table, .shop-list, [data-testid="shop-list"]');
  }

  async goto(tab = 'all') {
    await this.page.goto(`/admin/shops?tab=${tab}`, { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Shops"), h1:has-text("Shop"), [data-testid="shops-page"]', 15000);
  }

  async clickTab(tabName: string) {
    await safeClick(this.page, `button:has-text("${tabName}"), a:has-text("${tabName}"), [data-testid="tab-${tabName.toLowerCase()}"]`);
    await this.page.waitForTimeout(500);
  }

  async getShopCount(): Promise<number> {
    return await this.page.locator('tbody tr, .shop-card, [data-testid="shop-row"]').count();
  }

  async getShopDetails(rowIndex: number) {
    const row = this.page.locator('tbody tr, .shop-card, [data-testid="shop-row"]').nth(rowIndex);
    const name = await row.locator('td:first-child, .shop-name, [data-testid="shop-name"]').textContent();
    const status = await row.locator('.status-badge, .badge, [class*="status"], [data-testid="shop-status"]').textContent();
    return { name: name?.trim() || '', status: status?.trim() || '' };
  }

  async approveShop(rowIndex: number) {
    const row = this.page.locator('tbody tr, .shop-card, [data-testid="shop-row"]').nth(rowIndex);
    await safeClick(row, 'button:has-text("Approve"), button:has-text("Accept"), [data-testid="approve-shop"]');
    await waitForElement(this.page, '[role="status"]:has-text("approved"), .toast-success', 15000);
  }

  async rejectShop(rowIndex: number, reason?: string) {
    const row = this.page.locator('tbody tr, .shop-card, [data-testid="shop-row"]').nth(rowIndex);
    await safeClick(row, 'button:has-text("Reject"), button:has-text("Decline"), [data-testid="reject-shop"]');
    if (reason) {
      await this.page.fill('textarea[name="reason"], input[name="reason"], [data-testid="reject-reason"]', reason);
      await safeClick(this.page, 'button:has-text("Confirm"), [data-testid="confirm-reject"]');
    }
    await waitForElement(this.page, '[role="status"]:has-text("rejected"), .toast-success', 15000);
  }

  async viewShopDetails(rowIndex: number) {
    const row = this.page.locator('tbody tr, .shop-card, [data-testid="shop-row"]').nth(rowIndex);
    await safeClick(row, 'a:has-text("View"), button:has-text("View"), [data-testid="view-shop"]');
    await waitForElement(this.page, '.shop-detail, h1, [data-testid="shop-detail"]', 15000);
  }
}

export class AdminOrdersPage {
  readonly page: Page;
  readonly filters: Locator;
  readonly ordersTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filters = page.locator('.filters, [data-testid="filters"]');
    this.ordersTable = page.locator('tbody tr, .order-row, [data-testid="order-row"]');
  }

  async goto(status?: string) {
    const url = status ? `/admin/orders?status=${status}` : '/admin/orders';
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Orders"), [data-testid="orders-page"]', 15000);
  }

  async filterByStatus(status: string) {
    await this.page.locator(`select[name="status"], [data-testid="status-filter"]`).selectOption(status);
    await this.page.waitForTimeout(500);
  }

  async filterByDateRange(start: string, end: string) {
    await this.page.fill('input[name="startDate"], [data-testid="start-date"]', start);
    await this.page.fill('input[name="endDate"], [data-testid="end-date"]', end);
    await safeClick(this.page, 'button:has-text("Apply"), [data-testid="apply-filters"]');
    await this.page.waitForTimeout(500);
  }

  async getOrderCount(): Promise<number> {
    return await this.ordersTable.count();
  }

  async getOrderDetails(rowIndex: number) {
    const row = this.ordersTable.nth(rowIndex);
    const id = await row.locator('td:first-child, .order-id, [data-testid="order-id"]').textContent();
    const customer = await row.locator('.customer-name, td:nth-child(2), [data-testid="customer-name"]').textContent();
    const shop = await row.locator('.shop-name, td:nth-child(3), [data-testid="shop-name"]').textContent();
    const status = await row.locator('.status-badge, .badge, [data-testid="order-status"]').textContent();
    const total = await row.locator('.order-total, td:last-child, [data-testid="order-total"]').textContent();
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
    await safeClick(row, 'a:has-text("View"), button:has-text("View"), [data-testid="view-order"]');
    await waitForElement(this.page, '.order-detail, h1, [data-testid="order-detail"]', 15000);
  }

  async assignRider(rowIndex: number, riderName: string) {
    const row = this.ordersTable.nth(rowIndex);
    await safeClick(row, 'button:has-text("Assign"), button:has-text("Dispatch"), [data-testid="assign-rider"]');
    await this.page.locator(`option:has-text("${riderName}"), [data-testid="rider-option"]:has-text("${riderName}")`).click();
    await safeClick(this.page, 'button:has-text("Confirm"), [data-testid="confirm-assign"]');
    await waitForElement(this.page, '[role="status"]:has-text("assigned"), .toast-success', 15000);
  }
}

export class AdminRidersPage {
  readonly page: Page;
  readonly tabs: Locator;
  readonly ridersList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.locator('[role="tablist"] button, [data-testid="tab"]');
    this.ridersList = page.locator('tbody tr, .rider-card, [data-testid="rider-row"]');
  }

  async goto(tab = 'all') {
    await this.page.goto(`/admin/riders?tab=${tab}`, { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Riders"), [data-testid="riders-page"]', 15000);
  }

  async clickTab(tabName: string) {
    await safeClick(this.page, `button:has-text("${tabName}"), [data-testid="tab-${tabName.toLowerCase()}"]`);
    await this.page.waitForTimeout(500);
  }

  async getRiderCount(): Promise<number> {
    return await this.ridersList.count();
  }

  async getRiderDetails(rowIndex: number) {
    const row = this.ridersList.nth(rowIndex);
    const name = await row.locator('.rider-name, td:first-child, [data-testid="rider-name"]').textContent();
    const status = await row.locator('.status-badge, .badge, [data-testid="rider-status"]').textContent();
    const vehicle = await row.locator('.vehicle-type, td:nth-child(3), [data-testid="vehicle-type"]').textContent();
    return {
      name: name?.trim() || '',
      status: status?.trim() || '',
      vehicle: vehicle?.trim() || '',
    };
  }

  async approveRider(rowIndex: number) {
    const row = this.ridersList.nth(rowIndex);
    await safeClick(row, 'button:has-text("Approve"), button:has-text("Accept"), [data-testid="approve-rider"]');
    await waitForElement(this.page, '[role="status"]:has-text("approved"), .toast-success', 15000);
  }

  async rejectRider(rowIndex: number) {
    const row = this.ridersList.nth(rowIndex);
    await safeClick(row, 'button:has-text("Reject"), button:has-text("Decline"), [data-testid="reject-rider"]');
    await waitForElement(this.page, '[role="status"]:has-text("rejected"), .toast-success', 15000);
  }
}

export class AdminPaymentsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/admin/payments', { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Payments"), h1:has-text("Payouts"), [data-testid="payments-page"]', 15000);
  }

  async getCommissionStats() {
    const stats = this.page.locator('.stat-card, .metric-card, [data-testid="stat-card"]');
    const count = await stats.count();
    const result: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      const label = await stats.nth(i).locator('.label, .text-gray-500, [data-testid="stat-label"]').textContent();
      const value = await stats.nth(i).locator('.value, .text-2xl, [data-testid="stat-value"]').textContent();
      if (label && value) result[label.trim()] = value.trim();
    }
    return result;
  }

  async recordPayout(type: 'vendor' | 'rider', id: string, amount: string) {
    await safeClick(this.page, 'button:has-text("Record Payout"), button:has-text("New Payout"), [data-testid="record-payout"]');
    await this.page.selectOption('select[name="type"], [data-testid="payout-type"]', type);
    await this.page.fill('input[name="recipient"], [data-testid="payout-recipient"]', id);
    await this.page.fill('input[name="amount"], [data-testid="payout-amount"]', amount);
    await safeClick(this.page, 'button:has-text("Submit"), [data-testid="submit-payout"]');
    await waitForElement(this.page, '[role="status"]:has-text("recorded"), .toast-success', 15000);
  }
}
