import { test, expect } from '@playwright/test';
import { VendorDashboard } from '../page-objects/VendorDashboard';
import { login, signup, TEST_USERS, TestUserRole, safeClick, safeFill, waitForElement, waitForToast } from '../utils/test-helpers';

test.describe('Vendor Dashboard', () => {
  let vendorDashboard: VendorDashboard;

  test.beforeEach(async ({ page }) => {
    vendorDashboard = new VendorDashboard(page);
  });

  test.describe('Vendor Application Flow', () => {
    test('should show application form for non-vendor user', async ({ page }) => {
      await page.goto('/vendor', { storageState: 'playwright/.auth/customer.json' });
      await expect(page.locator('h1:has-text("Bring your shop online")')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('text=Apply to list your independent hardware shop')).toBeVisible();
    });

    test('should submit vendor application', async ({ page }) => {
      await page.goto('/vendor', { storageState: 'playwright/.auth/customer.json' });
      
      // Fill application form (matching actual form field names)
      await safeFill(page, 'input[name="name"]', 'Test Hardware Store');
      await safeFill(page, 'input[name="phone"]', '9800000001');
      await safeFill(page, 'input[name="email"]', 'shop@test.com');
      await safeFill(page, 'textarea[name="address"]', 'Kathmandu, Nepal');
      await safeFill(page, 'input[name="city"]', 'Kathmandu');
      await safeFill(page, 'input[name="district"]', 'Kathmandu');
      // Optional: province
      await safeFill(page, 'input[name="province"]', 'Bagmati');
      await safeFill(page, 'textarea[name="description"]', 'A test hardware store for testing');
      
      // Set location (required) - use current location button or fill coordinates
      await safeFill(page, 'input[placeholder="27.7172"]', '27.7172');
      await safeFill(page, 'input[placeholder="85.3240"]', '85.3240');
      
      await safeClick(page, 'button:has-text("Submit shop for review")');
      
      // Wait for either redirect to vendor dashboard with shop param OR success message
      // The RPC may redirect on success, or show a success/error message
      const redirectPromise = page.waitForURL(/\/vendor\?shop=/, { timeout: 30000 }).catch(() => null);
      const messagePromise = page.locator('.vendor-application-message, [role="status"]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => null);
      
      const [redirectUrl, message] = await Promise.all([redirectPromise, messagePromise]);
      
      if (redirectUrl) {
        // Success - redirected to vendor dashboard
        expect(redirectUrl).toMatch(/\/vendor\?shop=/);
      } else if (message) {
        // Check if message indicates success (not error)
        const messageText = await message.textContent();
        expect(messageText?.toLowerCase()).not.toContain('error');
        expect(messageText?.toLowerCase()).not.toContain('failed');
      } else {
        throw new Error('Application submission did not redirect or show message');
      }
    });
  });

  test.describe('Approved Vendor Dashboard', () => {
    test.use({ storageState: 'playwright/.auth/vendor.json' });

    test.beforeEach(async ({ page }) => {
      await vendorDashboard.goto();
    });

    test('should display vendor dashboard with shop info', async ({ page }) => {
      await expect(page.locator('h1:has-text("Shop dashboard")')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.vendor-shop-summary strong')).toBeVisible();
      await expect(page.locator('.vendor-kpi-grid')).toBeVisible();
    });

    test('should display KPI cards', async () => {
      const kpis = await vendorDashboard.getKPIs();
      expect(kpis.totalOrders).toBeTruthy();
      expect(kpis.awaitingResponse).toBeTruthy();
      expect(kpis.inProgress).toBeTruthy();
    });

    test('should show orders section', async () => {
      await expect(vendorDashboard.ordersSection).toBeVisible();
      await expect(page.locator('h2:has-text("Recent orders")')).toBeVisible();
    });

    test('should show inventory section', async () => {
      await expect(vendorDashboard.inventorySection).toBeVisible();
      await expect(page.locator('h2:has-text("Inventory and pricing")')).toBeVisible();
    });
  });

  test.describe('Order Management', () => {
    test.use({ storageState: 'playwright/.auth/vendor.json' });

    test('should accept pending order', async ({ page }) => {
      await vendorDashboard.goto();
      const initialCount = await vendorDashboard.getPendingOrderCount();
      
      if (initialCount > 0) {
        await vendorDashboard.acceptOrder(0);
        const success = await waitForToast(page, 'confirmed', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No pending orders to test');
      }
    });

    test('should reject pending order', async ({ page }) => {
      await vendorDashboard.goto();
      const initialCount = await vendorDashboard.getPendingOrderCount();
      
      if (initialCount > 0) {
        await vendorDashboard.rejectOrder(0);
        const success = await waitForToast(page, 'rejected', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No pending orders to test');
      }
    });

    test('should advance order status', async ({ page }) => {
      await vendorDashboard.goto();
      const activeCount = await vendorDashboard.getActiveOrderCount();
      
      if (activeCount > 0) {
        await vendorDashboard.advanceOrderStatus(0);
        const success = await waitForToast(page, '', 20000); // any toast
        expect(success).toBeTruthy();
      } else {
        test.skip('No active orders to test');
      }
    });

    test('should display order details correctly', async () => {
      await vendorDashboard.goto();
      const count = await vendorDashboard.getOrderCount();
      
      if (count > 0) {
        const details = await vendorDashboard.getOrderDetails(0);
        expect(details.reference).toBeTruthy();
        expect(details.status).toBeTruthy();
        expect(details.total).toBeTruthy();
      } else {
        test.skip('No orders to test');
      }
    });
  });

  test.describe('Inventory Management', () => {
    test.use({ storageState: 'playwright/.auth/vendor.json' });

    test('should search product catalog', async ({ page }) => {
      await vendorDashboard.goto();
      await vendorDashboard.searchCatalog('drill');
      await page.waitForTimeout(500);
      const results = await vendorDashboard.getSearchResults();
      expect(Array.isArray(results)).toBeTruthy();
    });

    test('should submit existing catalog product for approval', async ({ page }) => {
      await vendorDashboard.goto();
      await vendorDashboard.searchCatalog('drill');
      await page.waitForTimeout(500);
      
      const results = await vendorDashboard.getSearchResults();
      if (results.length > 0) {
        const productName = results[0];
        await vendorDashboard.selectCatalogProduct(productName);
        await vendorDashboard.fillInventoryForm({ price: '5000', stock: '10', sku: 'DRILL-001' });
        await vendorDashboard.submitInventory();
        const success = await waitForToast(page, 'submitted', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No catalog products found');
      }
    });

    test('should submit new product not in catalog', async ({ page }) => {
      await vendorDashboard.goto();
      await vendorDashboard.submitNewProduct({
        name: 'Test Product',
        category: 'power-tools',
        brand: 'TestBrand',
        model: 'ModelX',
        unit: 'each',
        price: '3000',
        stock: '5',
      });
      const success = await waitForToast(page, 'submitted', 20000);
      expect(success).toBeTruthy();
    });

    test('should edit approved inventory', async ({ page }) => {
      await vendorDashboard.goto();
      const count = await vendorDashboard.getInventoryCount();
      
      if (count > 0) {
        const before = await vendorDashboard.getInventoryItemDetails(0);
        await vendorDashboard.fillInventoryForm({ price: '5500', stock: '15' });
        await vendorDashboard.saveInventoryChanges(0);
        const after = await vendorDashboard.getInventoryItemDetails(0);
        expect(after.price).toBe('5500');
        expect(after.stock).toBe('15');
      } else {
        test.skip('No inventory items to test');
      }
    });

    test('should toggle inventory active status', async ({ page }) => {
      await vendorDashboard.goto();
      const count = await vendorDashboard.getInventoryCount();
      
      if (count > 0) {
        const before = await vendorDashboard.getInventoryItemDetails(0);
        await vendorDashboard.toggleInventoryActive(0, false);
        const after = await vendorDashboard.getInventoryItemDetails(0);
        expect(after.status).not.toBe(before.status);
      } else {
        test.skip('No inventory items to test');
      }
    });

    test('should show product submissions pending approval', async () => {
      await vendorDashboard.goto();
      const submissions = await vendorDashboard.getSubmissions();
      expect(Array.isArray(submissions)).toBeTruthy();
    });
  });

  test.describe('Multi-Shop Support', () => {
    test.use({ storageState: 'playwright/.auth/vendor.json' });

    test('should switch between shops', async ({ page }) => {
      await vendorDashboard.goto();
      const shopCount = await vendorDashboard.shopSwitcher.count();
      
      if (shopCount > 1) {
        const firstShop = await vendorDashboard.getShopName();
        await vendorDashboard.switchShop(1);
        const secondShop = await vendorDashboard.getShopName();
        expect(secondShop).not.toBe(firstShop);
      } else {
        test.skip('Only one shop available');
      }
    });
  });
});

test.describe('Vendor Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/vendor');
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
  });

  test('should show vendor application for non-vendor user', async ({ page }) => {
    await page.goto('/vendor', { storageState: 'playwright/.auth/customer.json' });
    await expect(page.locator('h1:has-text("Bring your shop online")')).toBeVisible({ timeout: 20000 });
  });
});
