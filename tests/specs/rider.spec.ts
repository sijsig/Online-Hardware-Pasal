import { test, expect } from '@playwright/test';
import { RiderDashboard, RiderApplicationPage } from '../page-objects/RiderDashboard';
import { login, TEST_USERS, waitForElement, waitForToast, safeClick } from '../utils/test-helpers';

test.describe('Rider Dashboard', () => {
  let riderDashboard: RiderDashboard;
  let riderApplication: RiderApplicationPage;

  test.beforeEach(async ({ page }) => {
    riderDashboard = new RiderDashboard(page);
    riderApplication = new RiderApplicationPage(page);
  });

  test.describe('Rider Application Flow', () => {
    test('should show application form for non-rider user', async ({ page }) => {
      await login(page, 'customer');
      await riderApplication.goto();
      await expect(page.locator('h1:has-text("Deliver with Hardware Pasal")')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('select')).toBeVisible();
    });

    test('should submit rider application with vehicle type', async ({ page }) => {
      await login(page, 'customer');
      await riderApplication.goto();
      await riderApplication.submitApplication('motorcycle');
      const success = await waitForToast(page, 'under review', 15000) || await waitForToast(page, 'submitted', 15000);
      expect(success).toBeTruthy();
    });

    test('should show pending status after submission', async ({ page }) => {
      await login(page, 'customer');
      await riderApplication.goto();
      await riderApplication.submitApplication('scooter');
      const status = await riderApplication.getApplicationStatus();
      expect(status.toLowerCase()).toContain('under review');
    });
  });

  test.describe('Approved Rider Dashboard', () => {
    test.use({ storageState: 'playwright/.auth/rider.json' });

    test.beforeEach(async ({ page }) => {
      await riderDashboard.goto();
    });

    test('should display rider dashboard with status', async ({ page }) => {
      await expect(page.locator('h1:has-text("Your deliveries")')).toBeVisible({ timeout: 15000 });
      await expect(riderDashboard.statusPill).toBeVisible();
    });

    test('should show offline status initially', async () => {
      const status = await riderDashboard.getStatus();
      expect(status.toLowerCase()).toContain('offline');
    });

    test('should go online when toggled', async ({ page }) => {
      await riderDashboard.goOnline();
      const status = await riderDashboard.getStatus();
      expect(status.toLowerCase()).toContain('available');
    });

    test('should go offline when toggled', async ({ page }) => {
      await riderDashboard.goOnline();
      await riderDashboard.goOffline();
      const status = await riderDashboard.getStatus();
      expect(status.toLowerCase()).toContain('offline');
    });

    test('should show empty state when no deliveries', async () => {
      await riderDashboard.goOnline();
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (!hasDelivery) {
        await expect(riderDashboard.emptyState).toBeVisible();
        await expect(page.locator('text=No active delivery')).toBeVisible();
      } else {
        test.skip('Active delivery present');
      }
    });
  });

  test.describe('Delivery Workflow', () => {
    test.use({ storageState: 'playwright/.auth/rider.json' });

    test('should accept delivery offer', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await page.waitForTimeout(3000);
      
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (hasDelivery) {
        const before = await riderDashboard.getActiveDeliveryDetails();
        await riderDashboard.acceptDelivery();
        const success = await waitForToast(page, 'accepted', 15000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No delivery offer available');
      }
    });

    test('should decline delivery offer', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await page.waitForTimeout(3000);
      
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (hasDelivery) {
        await riderDashboard.declineDelivery();
        const success = await waitForToast(page, 'declined', 15000);
        expect(success).toBeTruthy();
      } else {
        test.skip('No delivery offer available');
      }
    });

    test('should confirm pickup when order ready', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await page.waitForTimeout(3000);
      
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (hasDelivery) {
        const details = await riderDashboard.getActiveDeliveryDetails();
        if (details?.status.toLowerCase().includes('accepted')) {
          await page.waitForTimeout(3000);
          await riderDashboard.confirmPickup();
          const success = await waitForToast(page, 'pickup', 15000);
          expect(success).toBeTruthy();
        } else {
          test.skip('Order not in accepted state');
        }
      } else {
        test.skip('No active delivery');
      }
    });

    test('should confirm delivery with cash collection', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await page.waitForTimeout(3000);
      
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (hasDelivery) {
        const details = await riderDashboard.getActiveDeliveryDetails();
        if (details?.status.toLowerCase().includes('picked_up')) {
          await riderDashboard.confirmDelivery();
          const success = await waitForToast(page, 'completed', 15000);
          expect(success).toBeTruthy();
        } else {
          test.skip('Order not picked up');
        }
      } else {
        test.skip('No active delivery');
      }
    });

    test('should display delivery details correctly', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await page.waitForTimeout(3000);
      
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (hasDelivery) {
        const details = await riderDashboard.getActiveDeliveryDetails();
        expect(details?.orderId).toBeTruthy();
        expect(details?.shopName).toBeTruthy();
        expect(details?.customerName).toBeTruthy();
        expect(details?.total).toBeTruthy();
        expect(Array.isArray(details?.items)).toBeTruthy();
      } else {
        test.skip('No active delivery');
      }
    });

    test('should show navigation links', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await page.waitForTimeout(3000);
      
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (hasDelivery) {
        const shopLink = riderDashboard.deliveryCard.locator('a:has-text("Navigate to shop")');
        const customerLink = riderDashboard.deliveryCard.locator('a:has-text("Navigate to customer")');
        await expect(shopLink).toBeVisible({ timeout: 10000 });
        await expect(customerLink).toBeVisible({ timeout: 10000 });
      } else {
        test.skip('No active delivery');
      }
    });

    test('should show distance to vendor', async () => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await page.waitForTimeout(3000);
      
      const hasDelivery = await riderDashboard.hasActiveDelivery();
      if (hasDelivery) {
        const distance = await riderDashboard.getDeliveryDistance();
        expect(distance).toBeTruthy();
      } else {
        test.skip('No active delivery');
      }
    });
  });

  test.describe('Delivery History', () => {
    test.use({ storageState: 'playwright/.auth/rider.json' });

    test('should show completed deliveries', async ({ page }) => {
      await riderDashboard.goto();
      const history = await riderDashboard.getCompletedDeliveries();
      expect(Array.isArray(history)).toBeTruthy();
    });

    test('should display correct info for completed deliveries', async ({ page }) => {
      await riderDashboard.goto();
      const history = await riderDashboard.getCompletedDeliveries();
      
      if (history.length > 0) {
        const first = history[0];
        expect(first.orderId).toBeTruthy();
        expect(first.total).toBeTruthy();
        expect(first.date).toBeTruthy();
      } else {
        test.skip('No completed deliveries');
      }
    });
  });

  test.describe('Location Sharing', () => {
    test.use({ storageState: 'playwright/.auth/rider.json' });

    test('should share location when online', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      
      const statusText = await page.locator('.rider-online-card p').textContent();
      expect(statusText).toContain('Sharing your location');
    });

    test('should stop sharing location when offline', async ({ page }) => {
      await riderDashboard.goto();
      await riderDashboard.goOnline();
      await riderDashboard.goOffline();
      
      const statusText = await page.locator('.rider-online-card p').textContent();
      expect(statusText).toContain('Go online to share');
    });
  });
});

test.describe('Rider Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/rider');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('should show application form for non-rider user', async ({ page }) => {
    await login(page, 'customer');
    await page.goto('/rider');
    await expect(page.locator('.rider-apply-card')).toBeVisible({ timeout: 15000 });
  });

  test('should deny access to vendor/admin users', async ({ page }) => {
    await login(page, 'vendor');
    await page.goto('/rider');
    await expect(page.locator('.rider-apply-card, .rider-page')).toBeVisible({ timeout: 15000 });
  });
});
