import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, safeClick, safeFill } from '../utils/test-helpers';

export class HomePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly locationButton: Locator;
  readonly categoryCards: Locator;
  readonly productCards: Locator;
  readonly resultsSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('#product-search, input[placeholder*="Search"], [data-testid="search-input"]');
    this.searchButton = page.locator('button:has-text("Find hardware"), [data-testid="search-button"]');
    this.locationButton = page.locator('.location-button, [data-testid="location-button"]');
    this.categoryCards = page.locator('.category-card, [data-testid="category-card"]');
    this.productCards = page.locator('.product-card, [data-testid="product-card"]');
    this.resultsSection = page.locator('#shops, [data-testid="results-section"]');
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'networkidle' });
    await waitForElement(this.page, '.marketplace, [data-testid="homepage"]', 15000);
  }

  async setLocation() {
    await safeClick(this.page, '.location-button, [data-testid="location-button"]');
  }

  async searchProducts(query: string) {
    await safeFill(this.page, '#product-search, input[placeholder*="Search"], [data-testid="search-input"]', query);
    await safeClick(this.page, 'button:has-text("Find hardware"), [data-testid="search-button"]');
    await waitForElement(this.page, '#shops .product-grid, #shops .nearby-placeholder, [data-testid="results"]', 15000);
  }

  async getSearchResults(): Promise<Array<{ name: string; vendor: string; price: string; distance: string }>> {
    const cards = this.productCards;
    const count = await cards.count();
    const results = [];
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const name = await card.locator('.product-title-button, [data-testid="product-name"]').textContent();
      const vendor = await card.locator('.vendor-line, [data-testid="vendor-name"]').textContent();
      const price = await card.locator('.product-card-bottom strong, [data-testid="product-price"]').textContent();
      const distance = await card.locator('.product-card-bottom span, [data-testid="distance"]').textContent();
      results.push({
        name: name?.trim() || '',
        vendor: vendor?.trim() || '',
        price: price?.trim() || '',
        distance: distance?.trim() || '',
      });
    }
    return results;
  }

  async clickProduct(index: number) {
    await this.productCards.nth(index).locator('.product-title-button, [data-testid="product-name"]').click();
    await waitForElement(this.page, '.product-page, [data-testid="product-detail"]', 15000);
  }

  async getCategories(): Promise<string[]> {
    return await this.categoryCards.locator('.category-name, [data-testid="category-name"]').allTextContents();
  }

  async clickCategory(categoryName: string) {
    await safeClick(this.page, `.category-card:has-text("${categoryName}"), [data-testid="category-card"]:has-text("${categoryName}")`);
    await waitForElement(this.page, '.category-page, .product-grid, [data-testid="category-page"]', 15000);
  }

  async getNoResultsMessage(): Promise<string | null> {
    const placeholder = this.page.locator('.nearby-placeholder, [data-testid="no-results"]');
    if (await placeholder.isVisible({ timeout: 5000 }).catch(() => false)) {
      return await placeholder.textContent();
    }
    return null;
  }
}

export class ProductPage {
  readonly page: Page;
  readonly addToCartButton: Locator;
  readonly quantityInput: Locator;
  readonly vendorSelector: Locator;
  readonly priceDisplay: Locator;
  readonly stockDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addToCartButton = page.locator('button:has-text("Add to cart"), [data-testid="add-to-cart"]');
    this.quantityInput = page.locator('input[name="quantity"], [data-testid="quantity"]');
    this.vendorSelector = page.locator('select[name="vendorId"], [data-testid="vendor-select"]');
    this.priceDisplay = page.locator('.price-display, [data-testid="price"]');
    this.stockDisplay = page.locator('.stock-display, [data-testid="stock"]');
  }

  async goto(slug: string) {
    await this.page.goto(`/product/${slug}`, { waitUntil: 'networkidle' });
    await waitForElement(this.page, '.product-page, [data-testid="product-detail"]', 15000);
  }

  async selectVendor(vendorIndex: number) {
    await this.vendorSelector.selectOption({ index: vendorIndex });
    await this.page.waitForTimeout(500);
  }

  async setQuantity(qty: number) {
    await safeFill(this.page, 'input[name="quantity"], [data-testid="quantity"]', String(qty));
  }

  async addToCart() {
    await safeClick(this.page, 'button:has-text("Add to cart"), [data-testid="add-to-cart"]');
    await waitForElement(this.page, '[role="status"]:has-text("Added to cart"), .toast-success', 15000);
  }

  async getPrice(): Promise<string> {
    return await this.priceDisplay.textContent() || '';
  }

  async getAvailableStock(): Promise<string> {
    return await this.stockDisplay.textContent() || '';
  }
}

export class CartPage {
  readonly page: Page;
  readonly cartItems: Locator;
  readonly checkoutButton: Locator;
  readonly totalAmount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('.cart-item, [data-testid="cart-item"]');
    this.checkoutButton = page.locator('a:has-text("Checkout"), button:has-text("Checkout"), [data-testid="checkout-button"]');
    this.totalAmount = page.locator('.cart-total, [data-testid="cart-total"]');
  }

  async goto() {
    await this.page.goto('/cart', { waitUntil: 'networkidle' });
    await waitForElement(this.page, '.cart-page, [data-testid="cart"]', 15000);
  }

  async getItemCount(): Promise<number> {
    return await this.cartItems.count();
  }

  async getItemDetails(index: number) {
    const item = this.cartItems.nth(index);
    const name = await item.locator('.item-name, [data-testid="item-name"]').textContent();
    const qty = await item.locator('input[name="quantity"], [data-testid="item-quantity"]').inputValue();
    const price = await item.locator('.item-price, [data-testid="item-price"]').textContent();
    const vendor = await item.locator('.item-vendor, [data-testid="item-vendor"]').textContent();
    return {
      name: name?.trim() || '',
      quantity: qty,
      price: price?.trim() || '',
      vendor: vendor?.trim() || '',
    };
  }

  async updateQuantity(index: number, qty: number) {
    const item = this.cartItems.nth(index);
    await safeFill(item, 'input[name="quantity"], [data-testid="item-quantity"]', String(qty));
    await this.page.waitForTimeout(500);
  }

  async removeItem(index: number) {
    const item = this.cartItems.nth(index);
    await safeClick(item, 'button:has-text("Remove"), [data-testid="remove-item"]');
    await this.page.waitForTimeout(500);
  }

  async getTotal(): Promise<string> {
    return await this.totalAmount.textContent() || '';
  }

  async proceedToCheckout() {
    await safeClick(this.page, 'a:has-text("Checkout"), button:has-text("Checkout"), [data-testid="checkout-button"]');
    await waitForElement(this.page, '.checkout-page, [data-testid="checkout"]', 15000);
  }
}

export class CheckoutPage {
  readonly page: Page;
  readonly addressForm: Locator;
  readonly paymentMethod: Locator;
  readonly placeOrderButton: Locator;
  readonly orderSummary: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addressForm = page.locator('form[data-testid="address-form"], .address-form, [data-testid="checkout-form"]');
    this.paymentMethod = page.locator('input[name="paymentMethod"], [data-testid="payment-method"]');
    this.placeOrderButton = page.locator('button:has-text("Place order"), [data-testid="place-order"]');
    this.orderSummary = page.locator('.order-summary, [data-testid="order-summary"]');
  }

  async goto() {
    await this.page.goto('/checkout', { waitUntil: 'networkidle' });
    await waitForElement(this.page, '.checkout-page, [data-testid="checkout"]', 15000);
  }

  async fillAddress(fields: {
    recipientName: string;
    phone: string;
    addressLine: string;
    city: string;
    district?: string;
    province?: string;
  }) {
    await safeFill(this.page, 'input[name="recipientName"], [data-testid="recipient-name"]', fields.recipientName);
    await safeFill(this.page, 'input[name="phone"], [data-testid="phone"]', fields.phone);
    await safeFill(this.page, 'input[name="addressLine"], [data-testid="address-line"]', fields.addressLine);
    await safeFill(this.page, 'input[name="city"], [data-testid="city"]', fields.city);
    if (fields.district) await safeFill(this.page, 'input[name="district"], [data-testid="district"]', fields.district);
    if (fields.province) await safeFill(this.page, 'input[name="province"], [data-testid="province"]', fields.province);
  }

  async selectPaymentMethod(method: 'cod' | 'online') {
    await this.page.check(`input[name="paymentMethod"][value="${method}"], [data-testid="payment-${method}"]`);
  }

  async placeOrder() {
    await safeClick(this.page, 'button:has-text("Place order"), [data-testid="place-order"]');
    await waitForElement(this.page, '.order-confirmation, [data-testid="order-success"]', 15000);
  }

  async getOrderConfirmation(): Promise<{ orderId: string; total: string } | null> {
    const confirmation = this.page.locator('.order-confirmation, [data-testid="order-success"]');
    if (await confirmation.isVisible({ timeout: 10000 }).catch(() => false)) {
      const orderId = await confirmation.locator('.order-id, [data-testid="order-id"]').textContent();
      const total = await confirmation.locator('.order-total, [data-testid="order-total"]').textContent();
      return { orderId: orderId?.trim() || '', total: total?.trim() || '' };
    }
    return null;
  }

  async getOrderSummary(): Promise<string> {
    return await this.orderSummary.textContent() || '';
  }
}

export class OrdersPage {
  readonly page: Page;
  readonly orderCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.orderCards = page.locator('.order-card, [data-testid="order-card"]');
  }

  async goto() {
    await this.page.goto('/account/orders', { waitUntil: 'networkidle' });
    await waitForElement(this.page, '.orders-page, [data-testid="orders-page"]', 15000);
  }

  async getOrderCount(): Promise<number> {
    return await this.orderCards.count();
  }

  async getOrderDetails(index: number) {
    const card = this.orderCards.nth(index);
    const id = await card.locator('.order-id, [data-testid="order-id"]').textContent();
    const status = await card.locator('.order-status, [data-testid="order-status"]').textContent();
    const total = await card.locator('.order-total, [data-testid="order-total"]').textContent();
    const date = await card.locator('.order-date, [data-testid="order-date"]').textContent();
    return {
      id: id?.trim() || '',
      status: status?.trim() || '',
      total: total?.trim() || '',
      date: date?.trim() || '',
    };
  }

  async viewOrderDetails(index: number) {
    const card = this.orderCards.nth(index);
    await safeClick(card, 'a:has-text("View"), button:has-text("View"), [data-testid="view-order"]');
    await waitForElement(this.page, '.order-detail-page, [data-testid="order-detail"]', 15000);
  }
}
