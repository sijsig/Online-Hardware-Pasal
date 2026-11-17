import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, safeClick, waitForPageLoad } from '../utils/test-helpers';

export class RiderDashboard {
  readonly page: Page;
  readonly statusPill: Locator;
  readonly onlineToggle: Locator;
  readonly deliveryCard: Locator;
  readonly emptyState: Locator;
  readonly historySection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statusPill = page.locator('.rider-status-pill');
    this.onlineToggle = page.locator('.rider-online-card button');
    this.deliveryCard = page.locator('.rider-delivery-card');
    this.emptyState = page.locator('.rider-empty');
    this.historySection = page.locator('.rider-history');
  }

  async goto() {
    await this.page.goto('/rider', { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    await waitForElement(this.page, '.rider-page', 20000);
  }

  async getStatus(): Promise<string> {
    return await this.statusPill.textContent() || '';
  }

  async isOnline(): Promise<boolean> {
    const status = await this.getStatus();
    return status.toLowerCase().includes('available') || status.toLowerCase().includes('busy');
  }

  async toggleOnline() {
    await safeClick(this.page, '.rider-online-card button');
    await waitForElement(this.page, '[role="status"], .rider-message', 20000);
    await this.page.waitForTimeout(1000);
  }

  async goOnline() {
    if (!(await this.isOnline())) {
      await this.toggleOnline();
    }
  }

  async goOffline() {
    if (await this.isOnline()) {
      await this.toggleOnline();
    }
  }

  async hasActiveDelivery(): Promise<boolean> {
    return await this.deliveryCard.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getActiveDeliveryDetails() {
    if (!(await this.hasActiveDelivery())) return null;
    
    const orderId = await this.deliveryCard.locator('h2').textContent();
    const status = await this.deliveryCard.locator('.vendor-order-status').textContent();
    const total = await this.deliveryCard.locator('strong').first().textContent();
    const shopName = await this.deliveryCard.locator('section:has-text("Pickup from") strong').textContent();
    const customerName = await this.deliveryCard.locator('section:has-text("Deliver to") strong').textContent();
    const items = await this.deliveryCard.locator('.rider-item-line').allTextContents();
    
    return {
      orderId: orderId?.trim() || '',
      status: status?.trim() || '',
      total: total?.trim() || '',
      shopName: shopName?.trim() || '',
      customerName: customerName?.trim() || '',
      items,
    };
  }

  async acceptDelivery() {
    await safeClick(this.deliveryCard, 'button:has-text("Accept delivery")');
    await waitForElement(this.page, '[role="status"]:has-text("accepted"), .rider-message', 20000);
  }

  async declineDelivery() {
    await safeClick(this.deliveryCard, 'button:has-text("Decline offer")');
    await waitForElement(this.page, '[role="status"]:has-text("declined"), .rider-message', 20000);
  }

  async confirmPickup() {
    await safeClick(this.deliveryCard, 'button:has-text("Confirm pickup")');
    await waitForElement(this.page, '[role="status"]:has-text("pickup"), .rider-message', 20000);
  }

  async confirmDelivery() {
    await safeClick(this.deliveryCard, 'button:has-text("Confirm cash received")');
    await waitForElement(this.page, '[role="status"]:has-text("completed"), .rider-message', 20000);
  }

  async getDeliveryDistance(): Promise<string | null> {
    const distanceText = await this.deliveryCard.locator('.rider-distance').textContent();
    return distanceText?.trim() || null;
  }

  async navigateToShop() {
    const link = this.deliveryCard.locator('a:has-text("Navigate to shop")');
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
    }
  }

  async navigateToCustomer() {
    const link = this.deliveryCard.locator('a:has-text("Navigate to customer")');
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
    }
  }

  async getCompletedDeliveries(): Promise<Array<{ orderId: string; total: string; date: string }>> {
    const items = this.historySection.locator('> div');
    const count = await items.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const orderId = await item.locator('span').first().textContent();
      const total = await item.locator('strong').textContent();
      const date = await item.locator('span').last().textContent();
      result.push({
        orderId: orderId?.trim() || '',
        total: total?.trim() || '',
        date: date?.trim() || '',
      });
    }
    return result;
  }

  async getErrorMessage(): Promise<string | null> {
    const error = this.page.locator('.vendor-page-error, .rider-message');
    if (await error.isVisible({ timeout: 5000 }).catch(() => false)) {
      return await error.textContent();
    }
    return null;
  }
}

export class RiderApplicationPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/rider', { waitUntil: 'networkidle' });
    await waitForPageLoad(this.page);
    await waitForElement(this.page, '.rider-apply-card', 20000);
  }

  async submitApplication(vehicleType: 'motorcycle' | 'scooter' | 'bicycle' | 'car' | 'other' = 'motorcycle') {
    await this.page.selectOption('select', vehicleType);
    await safeClick(this.page, 'button:has-text("Submit rider application")');
    await waitForElement(this.page, '[role="status"]:has-text("under review"), [role="status"]:has-text("submitted"), .rider-message', 20000);
  }

  async getApplicationStatus(): Promise<string> {
    const statusCard = this.page.locator('.rider-state-card');
    if (await statusCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      return await statusCard.textContent() || '';
    }
    return '';
  }
}
