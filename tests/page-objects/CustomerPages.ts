import { Page, Locator, expect } from '@playwright/test';
import { waitForElement, safeClick, safeFill } from '../utils/test-helpers';

export class HomePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly categoryCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('#product-search').first();
    this.categoryCards = page.locator('.category-grid a, .category-card');
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1', 15000);
  }

  async searchProducts(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
  }

  async getCategories(): Promise<string[]> {
    return await this.categoryCards.allTextContents();
  }

  async clickCategory(index: number) {
    await this.categoryCards.nth(index).click();
  }

  async getSearchResults(): Promise<string[]> {
    return await this.page.locator('.product-grid article, [data-testid="product-card"]').allTextContents();
  }

  async getNoResultsMessage(): Promise<string> {
    return await this.page.locator('.no-results, .empty-state, :has-text("No nearby shop")').textContent() || '';
  }

  async clickProduct(index: number) {
    await this.page.locator('.product-grid article, [data-testid="product-card"]').nth(index).click();
  }
}

export class ProductPage {
  readonly page: Page;
  readonly vendorSelector: Locator;
  readonly quantityInput: Locator;
  readonly addToCartButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.vendorSelector = page.locator('select[name="vendorId"], [data-testid="vendor-select"]').first();
    this.quantityInput = page.locator('input[name="quantity"], input[type="number"]').first();
    this.addToCartButton = page.locator('button:has-text("Add to cart"), button:has-text("Add to Cart")').first();
  }

  async selectVendor(index: number) {
    await this.vendorSelector.selectOption({ index });
  }

  async setQuantity(qty: number) {
    await this.quantityInput.fill(String(qty));
  }

  async addToCart() {
    await this.addToCartButton.click();
  }
}

export class CartPage {
  readonly page: Page;
  readonly cartItems: Locator;
  readonly proceedToCheckoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('.cart-line');
    this.proceedToCheckoutButton = page.locator('a:has-text("Continue to checkout"), a:has-text("Checkout")').first();
  }

  async goto() {
    await this.page.goto('/cart', { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Your cart")', 15000);
  }

  async getItemCount(): Promise<number> {
    return await this.cartItems.count();
  }

  async getItemDetails(index: number) {
    const item = this.cartItems.nth(index);
    const name = await item.locator('.cart-line-info strong').textContent();
    const quantity = await item.locator('.quantity-control span').textContent();
    const price = await item.locator('.cart-line-total').textContent();
    return { name: name?.trim() || '', quantity: quantity?.trim() || '', price: price?.trim() || '' };
  }

  async updateQuantity(index: number, qty: number) {
    const item = this.cartItems.nth(index);
    const increaseBtn = item.locator('button[aria-label*="Increase"]').first();
    const decreaseBtn = item.locator('button[aria-label*="Decrease"]').first();
    const currentQty = await item.locator('.quantity-control span').textContent();
    const current = parseInt(currentQty || '1', 10);
    
    if (qty > current) {
      for (let i = 0; i < qty - current; i++) {
        await increaseBtn.click();
      }
    } else if (qty < current) {
      for (let i = 0; i < current - qty; i++) {
        await decreaseBtn.click();
      }
    }
  }

  async removeItem(index: number) {
    const item = this.cartItems.nth(index);
    await item.locator('button:has-text("Remove")').click();
  }

  async getTotal(): Promise<string> {
    return await this.page.locator('.cart-summary strong').last().textContent() || '';
  }

  async proceedToCheckout() {
    await this.proceedToCheckoutButton.click();
  }
}

export class CheckoutPage {
  readonly page: Page;
  readonly placeOrderButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.placeOrderButton = page.locator('button:has-text("Place order"), button:has-text("Place Order")').first();
  }

  async goto() {
    await this.page.goto('/checkout', { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Checkout"), h1:has-text("Check out")', 15000);
  }

  async fillAddress(address: {
    recipientName: string;
    phone: string;
    addressLine: string;
    city: string;
    district?: string;
    province?: string;
  }) {
    await safeFill(this.page, 'input[name="recipientName"]', address.recipientName);
    await safeFill(this.page, 'input[name="phone"]', address.phone);
    await safeFill(this.page, 'input[name="addressLine"]', address.addressLine);
    await safeFill(this.page, 'input[name="city"]', address.city);
    if (address.district) await safeFill(this.page, 'input[name="district"]', address.district);
    if (address.province) await safeFill(this.page, 'input[name="province"]', address.province);
  }

  async selectPaymentMethod(method: 'cod' | 'online') {
    await safeClick(this.page, `input[name="paymentMethod"][value="${method}"]`);
  }

  async placeOrder() {
    await this.placeOrderButton.click();
    await this.page.waitForTimeout(3000);
  }

  async getOrderConfirmation(): Promise<{ orderId: string; total: string } | null> {
    try {
      const orderId = await this.page.locator('.order-id, [data-testid="order-id"]').textContent();
      const total = await this.page.locator('.order-total, [data-testid="order-total"]').textContent();
      if (orderId && total) {
        return { orderId: orderId.trim(), total: total.trim() };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export class OrdersPage {
  readonly page: Page;
  readonly orderItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.orderItems = page.locator('.order-item, .order-card, tbody tr').first();
  }

  async goto() {
    await this.page.goto('/orders', { waitUntil: 'networkidle' });
    await waitForElement(this.page, 'h1:has-text("Orders"), h1:has-text("Order history")', 15000);
  }

  async getOrderCount(): Promise<number> {
    return await this.page.locator('.order-item, .order-card, tbody tr').count();
  }

  async getOrderDetails(index: number) {
    const item = this.page.locator('.order-item, .order-card, tbody tr').nth(index);
    const id = await item.locator('.order-id, td:first-child').textContent();
    const status = await item.locator('.status-badge, .badge, .order-status').textContent();
    const total = await item.locator('.order-total, td:last-child').textContent();
    return {
      id: id?.trim() || '',
      status: status?.trim() || '',
      total: total?.trim() || '',
    };
  }

  async viewOrderDetails(index: number) {
    const item = this.page.locator('.order-item, .order-card, tbody tr').nth(index);
    await item.locator('a:has-text("View"), button:has-text("View")').click();
  }
}
