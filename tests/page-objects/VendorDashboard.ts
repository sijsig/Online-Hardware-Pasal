import { Page, Locator, expect } from '@playwright/test';
import { fillForm, waitForElement, safeClick, safeFill, waitForPageLoad } from '../utils/test-helpers';

export class VendorDashboard {
  readonly page: Page;
  readonly shopSwitcher: Locator;
  readonly ordersSection: Locator;
  readonly inventorySection: Locator;
  readonly orderCards: Locator;
  readonly inventoryRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.shopSwitcher = page.locator('.vendor-shop-switcher a');
    this.ordersSection = page.locator('#orders');
    this.inventorySection = page.locator('#inventory');
    this.orderCards = page.locator('.vendor-order-card');
    this.inventoryRows = page.locator('.inventory-row');
  }

  async goto(shopId?: string) {
    const url = shopId ? `/vendor?shop=${shopId}` : '/vendor';
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    // Wait for vendor dashboard to load - look for the vendor page marker
    await waitForElement(this.page, '.vendor-page', 20000);
  }

  async getShopName(): Promise<string> {
    return await this.page.locator('.vendor-shop-summary strong').textContent() || '';
  }

  async getShopStatus(): Promise<string> {
    return await this.page.locator('.vendor-shop-status').textContent() || '';
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
      has: this.page.locator('.vendor-order-status.status-confirmed, .vendor-order-status.status-preparing, .vendor-order-status.status-ready_for_pickup') 
    });
    return await activeCards.count();
  }

  async acceptOrder(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    await safeClick(card, 'button:has-text("Accept order")');
    await waitForElement(this.page, '[role="status"], .vendor-action-message', 20000);
  }

  async rejectOrder(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    await safeClick(card, 'button:has-text("Reject order")');
    await waitForElement(this.page, '[role="status"], .vendor-action-message', 20000);
  }

  async advanceOrderStatus(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    const nextButton = card.locator('.vendor-primary-button:has-text("Start preparing"), .vendor-primary-button:has-text("Ready for pickup")');
    if (await nextButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextButton.click();
      await waitForElement(this.page, '[role="status"], .vendor-action-message', 20000);
    }
  }

  async getOrderDetails(orderIndex = 0) {
    const card = this.orderCards.nth(orderIndex);
    const reference = await card.locator('.vendor-order-reference').textContent();
    const status = await card.locator('.vendor-order-status').textContent();
    const total = await card.locator('.vendor-order-total strong').textContent();
    const items = await card.locator('.vendor-order-line').allTextContents();
    return { reference, status, total, items };
  }

  // Inventory methods
  async getInventoryCount(): Promise<number> {
    return await this.inventoryRows.count();
  }

  async searchCatalog(query: string) {
    const searchInput = this.page.locator('input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500); // debounce
    }
  }

  async getSearchResults(): Promise<string[]> {
    return await this.page.locator('.inventory-search-results button').allTextContents();
  }

  async selectCatalogProduct(productName: string) {
    await this.page.locator(`.inventory-search-results button:has-text("${productName}")`).click();
  }

  async fillInventoryForm(fields: { price: string; stock: string; sku?: string }) {
    await safeFill(this.page, 'input[aria-label*="price"]', fields.price);
    await safeFill(this.page, 'input[aria-label*="stock"]', fields.stock);
    if (fields.sku) {
      await safeFill(this.page, 'input[aria-label*="SKU"]', fields.sku);
    }
  }

  async submitInventory() {
    await safeClick(this.page, 'button:has-text("Submit for admin approval")');
    await waitForElement(this.page, '[role="status"]:has-text("submitted"), .vendor-action-message', 20000);
  }

  async saveInventoryChanges(rowIndex = 0) {
    const row = this.inventoryRows.nth(rowIndex);
    await safeClick(row, 'button:has-text("Save changes")');
    await waitForElement(this.page, '.inventory-row-message.is-success, .vendor-action-message', 20000);
  }

  async toggleInventoryActive(rowIndex = 0, active: boolean) {
    const row = this.inventoryRows.nth(rowIndex);
    const checkbox = row.locator('input[type="checkbox"]').first();
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (isChecked !== active) {
      await checkbox.click();
      await waitForElement(this.page, '.inventory-row-message.is-success, .vendor-action-message', 20000);
    }
  }

  async getInventoryItemDetails(rowIndex = 0) {
    const row = this.inventoryRows.nth(rowIndex);
    const name = await row.locator('.inventory-product-heading strong').textContent();
    const price = await row.locator('input[aria-label*="price"]').inputValue().catch(() => '');
    const stock = await row.locator('input[aria-label*="stock"]').inputValue().catch(() => '');
    const status = await row.locator('.inventory-availability').textContent();
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
    await safeFill(this.page, 'input[name="name"]', fields.name);
    await safeFill(this.page, 'select[name="category"]', fields.category);
    if (fields.brand) await safeFill(this.page, 'input[name="brand"]', fields.brand);
    if (fields.model) await safeFill(this.page, 'input[name="model"]', fields.model);
    await safeFill(this.page, 'input[name="unit"]', fields.unit);
    await safeFill(this.page, 'input[name="price"]', fields.price);
    await safeFill(this.page, 'input[name="stock"]', fields.stock);
    
    await safeClick(this.page, 'button:has-text("Submit new product for approval")');
    await waitForElement(this.page, '[role="status"]:has-text("submitted"), .vendor-action-message', 20000);
  }

  async getSubmissions(): Promise<Array<{ name: string; status: string }>> {
    const submissions = this.page.locator('.vendor-submissions article');
    const count = await submissions.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const sub = submissions.nth(i);
      const name = await sub.locator('strong').textContent();
      const status = await sub.locator('.vendor-approval-status').textContent();
      result.push({ name: name || '', status: status || '' });
    }
    return result;
  }

  async switchShop(shopIndex: number) {
    const links = this.shopSwitcher;
    await links.nth(shopIndex).click();
    await waitForElement(this.page, '.vendor-page', 20000);
  }

  async getKPIs() {
    const kpiCards = this.page.locator('.vendor-kpi-grid article');
    const counts = await kpiCards.allTextContents();
    return {
      totalOrders: counts[0] || '',
      awaitingResponse: counts[1] || '',
      inProgress: counts[2] || '',
    };
  }
}
