import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, safeClick } from '../utils/test-helpers';

export class RiderDashboard {
  readonly page: Page;
  readonly statusPill: Locator;
  readonly onlineToggle: Locator;
  readonly deliveryCard: Locator;
  readonly emptyState: Locator;
  readonly historySection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statusPill = page.locator('.rider-status-pill, [data-testid="rider-status"]');
    this.onlineToggle = page.locator('.rider-online-card button, [data-testid="online-toggle"]');
    this.deliveryCard = page.locator('.rider-delivery-card, [data-testid="delivery-card"]');
    this.emptyState = page.locator('.rider-empty, [data-testid="empty-state"]');
    this.historySection = page.locator('.rider-history, [data-testid="delivery-history"]');
  }

  async goto() {
    await this.page.goto('/rider', { waitUntil: 'networkidle' });
    await waitForElement(this.page, '.rider-page, [data-testid="rider-dashboard"]', 15000);
  }

  async getStatus(): Promise<string> {
    return await this.statusPill.textContent() || '';
  }

  async isOnline(): Promise<boolean> {
    const status = await this.getStatus();
    return status.toLowerCase().includes('available') || status.toLowerCase().includes('busy');
  }

  async toggleOnline() {
    await safeClick(this.page, '.rider-online-card button, [data-testid="online-toggle"]');
    await waitForElement(this.page, '[role="status"], .toast', 15000);
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
    
    const orderId = await this.deliveryCard.locator('h2, [data-testid="order-id"]').textContent();
    const status = await this.deliveryCard.locator('.vendor-order-status, [data-testid="delivery-status"]').textContent();
    const total = await this.deliveryCard.locator('strong, [data-testid="order-total"]').first().textContent();
    const shopName = await this.deliveryCard.locator('section:has-text("Pickup from") strong, [data-testid="shop-name"]').textContent();
    const customerName = await this.deliveryCard.locator('section:has-text("Deliver to") strong, [data-testid="customer-name"]').textContent();
    const items = await this.deliveryCard.locator('.rider-item-line, [data-testid="item"]').allTextContents();
    
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
    await safeClick(this.deliveryCard, 'button:has-text("Accept delivery"), [data-testid="accept-delivery"]');
    await waitForElement(this.page, '[role="status"]:has-text("accepted"), .toast-success', 15000);
  }

  async declineDelivery() {
    await safeClick(this.deliveryCard, 'button:has-text("Decline offer"), [data-testid="decline-delivery"]');
    await waitForElement(this.page, '[role="status"]:has-text("declined"), .toast-success', 15000);
  }

  async confirmPickup() {
    await safeClick(this.deliveryCard, 'button:has-text("Confirm pickup"), [data-testid="confirm-pickup"]');
    await waitForElement(this.page, '[role="status"]:has-text("pickup"), .toast-success', 15000);
  }

  async confirmDelivery() {
    await safeClick(this.deliveryCard, 'button:has-text("Confirm cash received"), button:has-text("Confirm delivery"), [data-testid="confirm-delivery"]');
    await waitForElement(this.page, '[role="status"]:has-text("completed"), .toast-success', 15000);
  }

  async getDeliveryDistance(): Promise<string | null> {
    const distanceText = await this.deliveryCard.locator('.rider-distance, [data-testid="distance"]').textContent();
    return distanceText?.trim() || null;
  }

  async navigateToShop() {
    const link = this.deliveryCard.locator('a:has-text("Navigate to shop"), [data-testid="navigate-shop"]');
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
    }
  }

  async navigateToCustomer() {
    const link = this.deliveryCard.locator('a:has-text("Navigate to customer"), [data-testid="navigate-customer"]');
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
    }
  }

  async getCompletedDeliveries(): Promise<Array<{ orderId: string; total: string; date: string }>> {
    const items = this.historySection.locator('> div, [data-testid="history-item"]');
    const count = await items.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const orderId = await item.locator('span, [data-testid="history-order-id"]').first().textContent();
      const total = await item.locator('strong, [data-testid="history-total"]').textContent();
      const date = await item.locator('span, [data-testid="history-date"]').last().textContent();
      result.push({
        orderId: orderId?.trim() || '',
        total: total?.trim() || '',
        date: date?.trim() || '',
      });
    }
    return result;
  }

  async getErrorMessage(): Promise<string | null> {
    const error = this.page.locator('.vendor-page-error, .rider-message, [data-testid="error"]');
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
    await waitForElement(this.page, '.rider-apply-card, [data-testid="rider-application"]', 15000);
  }

  async submitApplication(vehicleType: 'motorcycle' | 'scooter' | 'bicycle' | 'car' | 'other' = 'motorcycle') {
    await this.page.selectOption('select[name="vehicleType"], select, [data-testid="vehicle-type"]', vehicleType);
    await safeClick(this.page, 'button:has-text("Submit rider application"), [data-testid="submit-application"]');
    await waitForElement(this.page, '[role="status"]:has-text("under review"), [role="status"]:has-text("submitted"), .toast', 15000);
  }

  async getApplicationStatus(): Promise<string> {
    const statusCard = this.page.locator('.rider-state-card, [data-testid="application-status"]');
    if (await statusCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      return await statusCard.textContent() || '';
    }
    return '';
  }
}
