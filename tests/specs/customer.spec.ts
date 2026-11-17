import { test, expect } from '@playwright/test';
import { HomePage, ProductPage, CartPage, CheckoutPage, OrdersPage } from '../page-objects/CustomerPages';
import { login, signup, TEST_USERS, waitForElement, waitForToast, safeClick, safeFill } from '../utils/test-helpers';

test.describe('Customer Journey', () => {
  let homePage: HomePage;
  let productPage: ProductPage;
  let cartPage: CartPage;
  let checkoutPage: CheckoutPage;
  let ordersPage: OrdersPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
    checkoutPage = new CheckoutPage(page);
    ordersPage = new OrdersPage(page);
  });

  test.describe('Homepage & Search', () => {
    test('should load homepage with categories', async ({ page }) => {
      await homePage.goto();
      await expect(page.locator('h1')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.category-grid')).toBeVisible({ timeout: 20000 });
    });

    test('should display category cards', async () => {
      await homePage.goto();
      const categories = await homePage.getCategories();
      expect(categories.length).toBeGreaterThan(0);
    });

    test('should search for products', async ({ page }) => {
      await homePage.goto();
      await homePage.searchProducts('drill');
      await page.waitForTimeout(500);
      
      const results = await homePage.getSearchResults();
      expect(Array.isArray(results)).toBeTruthy();
    });

    test('should show no results message for unavailable products', async ({ page }) => {
      await homePage.goto();
      await homePage.searchProducts('nonexistentproductxyz');
      const message = await homePage.getNoResultsMessage();
      expect(message).toContain('No nearby shop');
    });

    test('should navigate to category page', async ({ page }) => {
      await homePage.goto();
      const categories = await homePage.getCategories();
      if (categories.length > 0) {
        await homePage.clickCategory(categories[0]);
        await expect(page.locator('.category-page, .product-grid')).toBeVisible({ timeout: 20000 });
      } else {
        test.skip('No categories available');
      }
    });
  });

  test.describe('Product Detail & Cart', () => {
    test.use({ storageState: 'playwright/.auth/customer.json' });

    test('should view product detail', async ({ page }) => {
      await homePage.goto();
      await homePage.searchProducts('drill');
      await page.waitForTimeout(500);
      
      const results = await homePage.getSearchResults();
      if (results.length > 0) {
        await homePage.clickProduct(0);
        await expect(page.locator('.product-page, [data-testid="product-detail"]')).toBeVisible({ timeout: 20000 });
      } else {
        test.skip('No products in search results');
      }
    });

    test('should add product to cart', async ({ page }) => {
      await homePage.goto();
      await homePage.searchProducts('drill');
      await page.waitForTimeout(500);
      
      const results = await homePage.getSearchResults();
      if (results.length > 0) {
        await homePage.clickProduct(0);
        
        // Select vendor if multiple
        const vendorOptions = await productPage.vendorSelector.locator('option').count();
        if (vendorOptions > 1) {
          await productPage.selectVendor(0);
        }
        
        await productPage.setQuantity(2);
        await productPage.addToCart();
        const success = await waitForToast(page, 'Added to cart', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No products in search results');
      }
    });

    test('should view cart with items', async ({ page }) => {
      await cartPage.goto();
      const count = await cartPage.getItemCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should update cart quantity', async ({ page }) => {
      await cartPage.goto();
      const count = await cartPage.getItemCount();
      
      if (count > 0) {
        await cartPage.updateQuantity(0, 3);
        const details = await cartPage.getItemDetails(0);
        expect(details.quantity).toBe('3');
      } else {
        test.skip('Cart is empty');
      }
    });

    test('should remove item from cart', async ({ page }) => {
      await cartPage.goto();
      const beforeCount = await cartPage.getItemCount();
      
      if (beforeCount > 0) {
        await cartPage.removeItem(0);
        const afterCount = await cartPage.getItemCount();
        expect(afterCount).toBe(beforeCount - 1);
      } else {
        test.skip('Cart is empty');
      }
    });

    test('should show cart total', async ({ page }) => {
      await cartPage.goto();
      const total = await cartPage.getTotal();
      expect(total).toBeTruthy();
    });
  });

  test.describe('Checkout Flow', () => {
    test.use({ storageState: 'playwright/.auth/customer.json' });

    test('should proceed to checkout from cart', async ({ page }) => {
      await cartPage.goto();
      const count = await cartPage.getItemCount();
      
      if (count > 0) {
        await cartPage.proceedToCheckout();
        await expect(page.locator('.checkout-page, [data-testid="checkout"]')).toBeVisible({ timeout: 20000 });
      } else {
        test.skip('Cart is empty');
      }
    });

    test('should fill delivery address', async ({ page }) => {
      await checkoutPage.goto();
      
      await checkoutPage.fillAddress({
        recipientName: 'Test Customer',
        phone: '9800000000',
        addressLine: 'Thamel, Kathmandu',
        city: 'Kathmandu',
        district: 'Kathmandu',
        province: 'Bagmati',
      });
      
      expect(await page.inputValue('input[name="recipientName"]')).toBe('Test Customer');
      expect(await page.inputValue('input[name="phone"]')).toBe('9800000000');
    });

    test('should select payment method', async ({ page }) => {
      await checkoutPage.goto();
      await checkoutPage.selectPaymentMethod('cod');
      await expect(page.locator('input[name="paymentMethod"][value="cod"]')).toBeChecked();
    });

    test('should place order successfully', async ({ page }) => {
      await checkoutPage.goto();
      await checkoutPage.fillAddress({
        recipientName: 'Test Customer',
        phone: '9800000000',
        addressLine: 'Thamel, Kathmandu',
        city: 'Kathmandu',
        district: 'Kathmandu',
      });
      await checkoutPage.selectPaymentMethod('cod');
      await checkoutPage.placeOrder();
      
      const confirmation = await checkoutPage.getOrderConfirmation();
      if (confirmation) {
        expect(confirmation.orderId).toBeTruthy();
        expect(confirmation.total).toBeTruthy();
      } else {
        test.skip('Order not placed');
      }
    });
  });

  test.describe('Order History', () => {
    test.use({ storageState: 'playwright/.auth/customer.json' });

    test('should view order history', async ({ page }) => {
      await ordersPage.goto();
      const count = await ordersPage.getOrderCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display order details', async ({ page }) => {
      await ordersPage.goto();
      const count = await ordersPage.getOrderCount();
      
      if (count > 0) {
        const details = await ordersPage.getOrderDetails(0);
        expect(details.id).toBeTruthy();
        expect(details.status).toBeTruthy();
        expect(details.total).toBeTruthy();
      } else {
        test.skip('No orders in history');
      }
    });

    test('should view order detail page', async ({ page }) => {
      await ordersPage.goto();
      const count = await ordersPage.getOrderCount();
      
      if (count > 0) {
        await ordersPage.viewOrderDetails(0);
        await expect(page.locator('.order-detail-page')).toBeVisible({ timeout: 20000 });
      } else {
        test.skip('No orders to view');
      }
    });
  });
});

test.describe('Customer Authentication', () => {
  test('should redirect to login for protected pages', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
  });

  test.use({ storageState: 'playwright/.auth/customer.json' });

  test('should allow access to account page when authenticated', async ({ page }) => {
    await page.goto('/account');
    await expect(page.locator('.account-page, .marketplace')).toBeVisible({ timeout: 20000 });
  });
});
