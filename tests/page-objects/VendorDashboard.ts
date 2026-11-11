import { Page, Locator, expect } from '@playwright/test';
import { fillForm, waitForElement, safeClick, safeFill } from '../utils/test-helpers';

export class VendorDashboard {
  readonly page: Page;
  readonly shopSwitcher: Locator;
  readonly ordersSection: Locator;
  readonly inventorySection: Locator;
  readonly orderCards: Locator;
  readonly inventoryRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.shopSwitcher = page.locator('.vendor-shop-switcher a, [data-testid="shop-switcher"] a');
    this.ordersSection = page.locator('#orders, [data-testid="orders-section"]');
    this.inventorySection = page.locator('#inventory, [data-testid="inventory-section"]');
    this.orderCards = page.locator('.vendor-order-card, [data-testid="order-card"]');
    this.inventoryRows = page.locator('.inventory-row, [data-testid="inventory-row"]');
  }

  async goto(shopId?: string) {
    const url = shopId ? `/vendor?shop=${shopId}` : '/vendor';
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await waitForElement(this.page, '.vendor-page, [data-testid="vendor-dashboard"]', 15000);
  }

  async getShopName(): Promise<string> {
    return await this.page.locator('.vendor-shop-summary strong, [data-testid="shop-name"]').textContent() || '';
  }

  async getShopStatus(): Promise<string> {
    return await this.page.locator('.vendor-shop-status, [data-testid="shop-status"]').textContent() || '';
  }

  async getOrderCount(): Promise<number> {
    return await this.orderCards.count();
  }

  async getPendingOrderCount(): Promise<number> {
    const pendingCards = this.orderCards.filter({ hasText: /pending/i });
    return await pendingCards.count();
  }

  async getActiveOrderCount(): Promise<number> {
    const activeCards = this.orderCards.filter({ 
      has: this.page.locator('.vendor-order-status.status-confirmed, .vendor-order-status.status-preparing, .vendor-order-status.status-ready_for_pickup, [data-testid="order-status"][data-status="confirmed"], [data-testid="order-status"][data-status="preparing"], [data-testid="order-status"][data-status="ready_for_pickup"]') 
    });
    return await activeCards.count();
  }

  async acceptOrder(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    await safeClick(card, 'button:has-text("Accept order"), button:has-text("Accept"), [data-testid="accept-order"]');
    await waitForElement(this.page, '[role="status"], .toast', 15000);
  }

  async rejectOrder(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    await safeClick(card, 'button:has-text("Reject order"), button:has-text("Reject"), [data-testid="reject-order"]');
    await waitForElement(this.page, '[role="status"], .toast', 15000);
  }

  async advanceOrderStatus(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    const nextButton = card.locator('.vendor-primary-button:has-text("Start preparing"), .vendor-primary-button:has-text("Ready for pickup"), [data-testid="advance-status"]');
    if (await nextButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextButton.click();
      await waitForElement(this.page, '[role="status"], .toast', 15000);
    }
  }

  async getOrderDetails(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    const reference = await card.locator('.vendor-order-reference, [data-testid="order-ref"]').textContent();
    const status = await card.locator('.vendor-order-status, [data-testid="order-status"]').textContent();
    const total = await card.locator('.vendor-order-total strong, [data-testid="order-total"]').textContent();
    const items = await card.locator('.vendor-order-line, [data-testid="order-item"]').allTextContents();
    return { reference, status, total, items };
  }

  // Inventory methods
  async getInventoryCount(): Promise<number> {
    return await this.inventoryRows.count();
  }

  async searchCatalog(query: string) {
    const searchInput = this.page.locator('input[placeholder*="drill"], input[placeholder*="Search"], [data-testid="catalog-search"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500); // debounce
    }
  }

  async getSearchResults(): Promise<string[]> {
    return await this.page.locator('.inventory-search-results button, [data-testid="search-result"]').allTextContents();
  }

  async selectCatalogProduct(productName: string) {
    await this.page.locator(`.inventory-search-results button:has-text("${productName}"), [data-testid="search-result"]:has-text("${productName}")`).click();
  }

  async fillInventoryForm(fields: { price: string; stock: string; sku?: string }) {
    await safeFill(this.page, 'input[aria-label*="price"], input[name="price"], [data-testid="price-input"]', fields.price);
    await safeFill(this.page, 'input[aria-label*="stock"], input[name="stock"], [data-testid="stock-input"]', fields.stock);
    if (fields.sku) {
      await safeFill(this.page, 'input[aria-label*="SKU"], input[name="sku"], [data-testid="sku-input"]', fields.sku);
    }
  }

  async submitInventory() {
    await safeClick(this.page, 'button:has-text("Submit for admin approval"), button:has-text("Submit"), [data-testid="submit-inventory"]');
    await waitForElement(this.page, '[role="status"]:has-text("submitted"), .toast', 15000);
  }

  async saveInventoryChanges(rowIndex = 0) {
    const row = this.inventoryRows.nth(rowIndex);
    await safeClick(row, 'button:has-text("Save changes"), [data-testid="save-inventory"]');
    await waitForElement(this.page, '.inventory-row-message.is-success, .toast-success', 15000);
  }

  async toggleInventoryActive(rowIndex = 0, active: boolean) {
    const row = this.inventoryRows.nth(rowIndex);
    const checkbox = row.locator('input[type="checkbox"], [data-testid="active-toggle"]').first();
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (isChecked !== active) {
      await checkbox.click();
      await waitForElement(this.page, '.inventory-row-message.is-success, .toast-success', 15000);
    }
  }

  async getInventoryItemDetails(rowIndex = 0) {
    const row = this.inventoryRows.nth(rowIndex);
    const name = await row.locator('.inventory-product-heading strong, [data-testid="product-name"]').textContent();
    const price = await row.locator('input[aria-label*="price"], [data-testid="price-input"]').inputValue().catch(() => '');
    const stock = await row.locator('input[aria-label*="stock"], [data-testid="stock-input"]').inputValue().catch(() => '');
    const status = await row.locator('.inventory-availability, [data-testid="availability"]').textContent();
    return { name, price, stock, status };
  }

  async submitNewProduct(fields: {
    name: string;
    category: string;
    brand?: string;
    model?: string;
    unit: string;
    price: string;
    stock: string;
  }) {
    await safeFill(this.page, 'input[name="name"], [data-testid="new-product-name"]', fields.name);
    await safeFill(this.page, 'select[name="category"], [data-testid="new-product-category"]', fields.category);
    if (fields.brand) await safeFill(this.page, 'input[name="brand"], [data-testid="new-product-brand"]', fields.brand);
    if (fields.model) await safeFill(this.page, 'input[name="model"], [data-testid="new-product-model"]', fields.model);
    await safeFill(this.page, 'input[name="unit"], [data-testid="new-product-unit"]', fields.unit);
    await safeFill(this.page, 'input[name="price"], [data-testid="new-product-price"]', fields.price);
    await safeFill(this.page, 'input[name="stock"], [data-testid="new-product-stock"]', fields.stock);
    
    await safeClick(this.page, 'button:has-text("Submit new product for approval"), [data-testid="submit-new-product"]');
    await waitForElement(this.page, '[role="status"]:has-text("submitted"), .toast', 15000);
  }

  async getSubmissions(): Promise<Array<{ name: string; status: string }>> {
    const submissions = this.page.locator('.vendor-submissions article, [data-testid="submission"]');
    const count = await submissions.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const sub = submissions.nth(i);
      const name = await sub.locator('strong, [data-testid="submission-name"]').textContent();
      const status = await sub.locator('.vendor-approval-status, [data-testid="submission-status"]').textContent();
      result.push({ name: name || '', status: status || '' });
    }
    return result;
  }

  async switchShop(shopIndex: number) {
    const links = this.shopSwitcher;
    await links.nth(shopIndex).click();
    await waitForElement(this.page, '.vendor-page, [data-testid="vendor-dashboard"]', 15000);
  }

  async getKPIs() {
    const kpiCards = this.page.locator('.vendor-kpi-grid article, [data-testid="kpi-card"]');
    const counts = await kpiCards.allTextContents();
    return {
      totalOrders: counts[0] || '',
      awaitingResponse: counts[1] || '',
      inProgress: counts[2] || '',
    };
  }
}
