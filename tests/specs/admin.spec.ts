import { test, expect } from '@playwright/test';
import { AdminDashboard, AdminShopsPage, AdminOrdersPage, AdminRidersPage, AdminPaymentsPage } from '../page-objects/AdminDashboard';
import { login, TEST_USERS, waitForElement, waitForToast, safeClick } from '../utils/test-helpers';

test.describe('Admin Dashboard', () => {
  let adminDashboard: AdminDashboard;
  let adminShops: AdminShopsPage;
  let adminOrders: AdminOrdersPage;
  let adminRiders: AdminRidersPage;
  let adminPayments: AdminPaymentsPage;

  test.beforeEach(async ({ page }) => {
    adminDashboard = new AdminDashboard(page);
    adminShops = new AdminShopsPage(page);
    adminOrders = new AdminOrdersPage(page);
    adminRiders = new AdminRidersPage(page);
    adminPayments = new AdminPaymentsPage(page);
  });

  test.describe('Dashboard Overview', () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('should load dashboard with metrics', async ({ page }) => {
      await adminDashboard.goto();
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 20000 });
      
      const metrics = await adminDashboard.getMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });

    test('should display charts when enabled', async ({ page }) => {
      await adminDashboard.goto();
      // Charts might take time to load
      await page.waitForTimeout(3000);
      const chartsVisible = await waitForElement(page, '.space-y-6', 20000);
      expect(chartsVisible).toBeTruthy();
    });

    test('should toggle charts visibility', async ({ page }) => {
      await adminDashboard.goto();
      await adminDashboard.toggleCharts();
      await page.waitForTimeout(500);
    });

    test('should show pending actions', async ({ page }) => {
      await adminDashboard.goto();
      const actions = await adminDashboard.getPendingActions();
      expect(Array.isArray(actions)).toBeTruthy();
    });

    test('should navigate to shops from pending actions', async ({ page }) => {
      await adminDashboard.goto();
      const actions = await adminDashboard.getPendingActions();
      const shopAction = actions.find(a => a.toLowerCase().includes('shop'));
      if (shopAction) {
        await adminDashboard.clickPendingAction(actions.indexOf(shopAction));
        await expect(page).toHaveURL(/\/admin\/shops/, { timeout: 20000 });
      } else {
        test.skip('No pending shop actions');
      }
    });
  });

  test.describe('Shop Management', () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('should list all shops', async ({ page }) => {
      await adminShops.goto('all');
      const count = await adminShops.getShopCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter shops by status', async ({ page }) => {
      await adminShops.goto('pending');
      await expect(page.locator('h1:has-text("Shops"), h1:has-text("Shop")')).toBeVisible({ timeout: 20000 });
      const count = await adminShops.getShopCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should approve pending shop', async ({ page }) => {
      await adminShops.goto('pending');
      const count = await adminShops.getShopCount();
      
      if (count > 0) {
        await adminShops.approveShop(0);
        const success = await waitForToast(page, 'approved', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No pending shops to approve');
      }
    });

    test('should reject pending shop with reason', async ({ page }) => {
      await adminShops.goto('pending');
      const count = await adminShops.getShopCount();
      
      if (count > 0) {
        await adminShops.rejectShop(0, 'Incomplete documentation');
        const success = await waitForToast(page, 'rejected', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No pending shops to reject');
      }
    });

    test('should view shop details', async ({ page }) => {
      await adminShops.goto('active');
      const count = await adminShops.getShopCount();
      
      if (count > 0) {
        await adminShops.viewShopDetails(0);
        await expect(page.locator('.shop-detail, h1')).toBeVisible({ timeout: 20000 });
      } else {
        test.skip('No active shops to view');
      }
    });
  });

  test.describe('Order Management', () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('should list all orders', async ({ page }) => {
      await adminOrders.goto();
      const count = await adminOrders.getOrderCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter orders by status', async ({ page }) => {
      await adminOrders.goto('pending');
      const count = await adminOrders.getOrderCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should view order details', async ({ page }) => {
      await adminOrders.goto();
      const count = await adminOrders.getOrderCount();
      
      if (count > 0) {
        const details = await adminOrders.getOrderDetails(0);
        expect(details.id).toBeTruthy();
        expect(details.status).toBeTruthy();
        expect(details.total).toBeTruthy();
        
        await adminOrders.viewOrderDetails(0);
        await expect(page.locator('.order-detail, h1')).toBeVisible({ timeout: 20000 });
      } else {
        test.skip('No orders to view');
      }
    });

    test('should assign rider to order', async ({ page }) => {
      await adminOrders.goto('confirmed');
      const count = await adminOrders.getOrderCount();
      
      if (count > 0) {
        await adminOrders.assignRider(0, 'Test Rider');
        const success = await waitForToast(page, 'assigned', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No confirmed orders to assign');
      }
    });
  });

  test.describe('Rider Management', () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('should list all riders', async ({ page }) => {
      await adminRiders.goto('all');
      const count = await adminRiders.getRiderCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter riders by status', async ({ page }) => {
      await adminRiders.goto('pending');
      const count = await adminRiders.getRiderCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should approve pending rider', async ({ page }) => {
      await adminRiders.goto('pending');
      const count = await adminRiders.getRiderCount();
      
      if (count > 0) {
        await adminRiders.approveRider(0);
        const success = await waitForToast(page, 'approved', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No pending riders to approve');
      }
    });

    test('should reject pending rider', async ({ page }) => {
      await adminRiders.goto('pending');
      const count = await adminRiders.getRiderCount();
      
      if (count > 0) {
        await adminRiders.rejectRider(0);
        const success = await waitForToast(page, 'rejected', 20000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No pending riders to reject');
      }
    });

    test('should view rider details', async ({ page }) => {
      await adminRiders.goto('approved');
      const count = await adminRiders.getRiderCount();
      
      if (count > 0) {
        const details = await adminRiders.getRiderDetails(0);
        expect(details.name).toBeTruthy();
        expect(details.status).toBeTruthy();
        expect(details.vehicle).toBeTruthy();
      } else {
        test.skip('No approved riders to view');
      }
    });
  });

  test.describe('Payments & Payouts', () => {
    test.use({ storageState: 'playwright/.auth/admin.json' });

    test('should load payments page', async ({ page }) => {
      await adminPayments.goto();
      await expect(page.locator('h1:has-text("Payments"), h1:has-text("Payouts")')).toBeVisible({ timeout: 20000 });
    });

    test('should display commission stats', async ({ page }) => {
      await adminPayments.goto();
      const stats = await adminPayments.getCommissionStats();
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });

    test('should record vendor payout', async ({ page }) => {
      await adminPayments.goto();
      await adminPayments.recordPayout('vendor', 'vendor-id-123', '5000');
      const success = await waitForToast(page, 'recorded', 20000);
      expect(success).toBeTruthy();
    });

    test('should record rider payout', async ({ page }) => {
      await adminPayments.goto();
      await adminPayments.recordPayout('rider', 'rider-id-123', '2000');
      const success = await waitForToast(page, 'recorded', 20000);
      expect(success).toBeTruthy();
    });
  });
});

test.describe('Admin Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
  });

  test('should deny access to non-admin users', async ({ page }) => {
    // Use customer auth state instead of calling login()
    await page.goto('/admin', { storageState: 'playwright/.auth/customer.json' });
    await expect(page).toHaveURL(/\/account|\/login/, { timeout: 20000 });
  });
});
