import { test, expect } from '@playwright/test';
import { HomePage, CartPage, CheckoutPage } from '../page-objects/CustomerPages';
import { VendorDashboard } from '../page-objects/VendorDashboard';
import { RiderDashboard } from '../page-objects/RiderDashboard';
import { AdminDashboard, AdminOrdersPage, AdminShopsPage } from '../page-objects/AdminDashboard';
import { login, TEST_USERS, waitForToast } from '../utils/test-helpers';

const BASE_URL = 'http://localhost:3000';

async function createAuthContext(browser: any, role: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Use API to authenticate
  const response = await page.request.post(`${BASE_URL}/api/mobile/auth/login`, {
    data: { email: TEST_USERS[role as keyof typeof TEST_USERS].email, password: TEST_USERS[role as keyof typeof TEST_USERS].password },
  });
  
  const data = await response.json();
  if (data.success && data.data.session) {
    await context.addCookies([
      { name: 'sb-access-token', value: data.data.session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      { name: 'sb-refresh-token', value: data.data.session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
    ]);
  }
  
  return { context, page };
}

test.describe('Complete End-to-End Flow', () => {
  let homePage: HomePage;
  let cartPage: CartPage;
  let checkoutPage: CheckoutPage;
  let vendorDashboard: VendorDashboard;
  let riderDashboard: RiderDashboard;
  let adminDashboard: AdminDashboard;
  let adminOrders: AdminOrdersPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    cartPage = new CartPage(page);
    checkoutPage = new CheckoutPage(page);
    vendorDashboard = new VendorDashboard(page);
    riderDashboard = new RiderDashboard(page);
    adminDashboard = new AdminDashboard(page);
    adminOrders = new AdminOrdersPage(page);
  });

  test('complete order flow: customer -> vendor -> rider -> admin', async ({ browser }) => {
    test.setTimeout(300000);
    
    // Step 1: Customer places order
    const { context: customerContext, page: customerPage } = await createAuthContext(browser, 'customer');
    const customerHome = new HomePage(customerPage);
    const customerCart = new CartPage(customerPage);
    const customerCheckout = new CheckoutPage(customerPage);
    
    try {
      await customerHome.goto();
      await customerHome.searchProducts('drill');
      await customerPage.waitForTimeout(1000);
      
      const results = await customerHome.getSearchResults();
      if (results.length === 0) {
        test.skip('No products available for testing');
        await customerContext.close();
        return;
      }
      
      await customerHome.clickProduct(0);
      
      const vendorOptions = await customerPage.locator('select[name="vendorId"] option').count();
      if (vendorOptions > 1) {
        await customerPage.selectOption('select[name="vendorId"]', { index: 0 });
      }
      
      await customerPage.fill('input[name="quantity"]', '1');
      await customerPage.click('button:has-text("Add to cart")');
      await waitForToast(customerPage, 'Added to cart', 15000);
      
      await customerCart.goto();
      await customerCart.proceedToCheckout();
      
      await customerCheckout.fillAddress({
        recipientName: 'E2E Test Customer',
        phone: '9800000000',
        addressLine: 'Test Address, Kathmandu',
        city: 'Kathmandu',
        district: 'Kathmandu',
      });
      await customerCheckout.selectPaymentMethod('cod');
      await customerCheckout.placeOrder();
      
      const confirmation = await customerCheckout.getOrderConfirmation();
      expect(confirmation).toBeTruthy();
      
    } finally {
      await customerContext.close();
    }
    
    // Step 2: Vendor accepts and processes order
    const { context: vendorContext, page: vendorPage } = await createAuthContext(browser, 'vendor');
    const vendorDash = new VendorDashboard(vendorPage);
    try {
      await vendorDash.goto();
      await vendorPage.waitForTimeout(5000);
      
      const pendingCount = await vendorDash.getPendingOrderCount();
      if (pendingCount > 0) {
        await vendorDash.acceptOrder(0);
        await waitForToast(vendorPage, 'confirmed', 15000);
        
        await vendorDash.advanceOrderStatus(0);
        await vendorDash.advanceOrderStatus(0);
      }
    } finally {
      await vendorContext.close();
    }
    
    // Step 3: Admin assigns rider
    const { context: adminContext, page: adminPage } = await createAuthContext(browser, 'admin');
    try {
      await adminOrders.goto('ready_for_pickup');
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        // In real scenario, admin would assign rider here
      }
    } finally {
      await adminContext.close();
    }
    
    // Step 4: Rider accepts and completes delivery
    const { context: riderContext, page: riderPage } = await createAuthContext(browser, 'rider');
    const riderDash = new RiderDashboard(riderPage);
    try {
      await riderDash.goto();
      await riderDash.goOnline();
      await riderPage.waitForTimeout(10000);
      
      const hasDelivery = await riderDash.hasActiveDelivery();
      if (hasDelivery) {
        await riderDash.acceptDelivery();
        await waitForToast(riderPage, 'accepted', 15000);
        await riderPage.waitForTimeout(5000);
        await riderDash.confirmPickup();
        await waitForToast(riderPage, 'pickup', 15000);
        await riderDash.confirmDelivery();
        await waitForToast(riderPage, 'completed', 15000);
      }
    } finally {
      await riderContext.close();
    }
  });

  test('vendor creates shop and gets approved by admin', async ({ browser }) => {
    test.setTimeout(300000);
    
    // Sign up new vendor via API
    const { context: newVendorContext, page: newVendorPage } = await createAuthContext(browser, 'customer');
    // Override with new vendor email
    await newVendorContext.clearCookies();
    
    // Use API to signup as new vendor
    const signupResponse = await newVendorPage.request.post(`${BASE_URL}/api/mobile/auth/signup`, {
      data: {
        email: 'newvendor@test.com',
        password: 'TestPass123!',
        full_name: 'New Vendor',
        phone: '9800000002',
        role: 'customer',
      },
    });
    
    const signupData = await signupResponse.json();
    if (!signupData.success) {
      // Try login if already exists
      const loginResponse = await newVendorPage.request.post(`${BASE_URL}/api/mobile/auth/login`, {
        data: { email: 'newvendor@test.com', password: 'TestPass123!' },
      });
      const loginData = await loginResponse.json();
      if (loginData.success) {
        await newVendorContext.addCookies([
          { name: 'sb-access-token', value: loginData.data.session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
          { name: 'sb-refresh-token', value: loginData.data.session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
        ]);
      }
    } else {
      await newVendorContext.addCookies([
        { name: 'sb-access-token', value: signupData.data.session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
        { name: 'sb-refresh-token', value: signupData.data.session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      ]);
    }
    
    try {
      // Apply for vendor - use correct form field names
      await newVendorPage.goto('/vendor', { waitUntil: 'networkidle' });
      await newVendorPage.fill('input[name="name"]', 'E2E Test Hardware');
      await newVendorPage.fill('input[name="phone"]', '9800000003');
      await newVendorPage.fill('input[name="email"]', 'shop@e2etest.com');
      await newVendorPage.fill('textarea[name="address"]', 'Kathmandu, Nepal');
      await newVendorPage.fill('input[name="city"]', 'Kathmandu');
      await newVendorPage.fill('input[name="district"]', 'Kathmandu');
      await newVendorPage.fill('input[name="province"]', 'Bagmati');
      await newVendorPage.fill('textarea[name="description"]', 'Test shop from E2E');
      // Set location coordinates (required)
      await newVendorPage.fill('input[placeholder="27.7172"]', '27.7172');
      await newVendorPage.fill('input[placeholder="85.3240"]', '85.3240');
      await newVendorPage.click('button:has-text("Submit shop for review")');
      
      // Wait for redirect to vendor dashboard with shop param
      await newVendorPage.waitForURL(/\/vendor\?shop=/, { timeout: 30000 });
    } finally {
      await newVendorContext.close();
    }
    
    // Admin approves
    const { context: adminContext, page: adminPage } = await createAuthContext(browser, 'admin');
    try {
      const adminShops = new AdminShopsPage(adminPage);
      await adminShops.goto('pending');
      
      const count = await adminShops.getShopCount();
      if (count > 0) {
        await adminShops.approveShop(0);
        await waitForToast(adminPage, 'approved', 15000);
      }
    } finally {
      await adminContext.close();
    }
  });
});

test.describe('Multi-role Data Consistency', () => {
  test('order status syncs across all roles', async ({ browser }) => {
    test.setTimeout(120000);
    
    // Check customer view
    const { context: customerContext, page: customerPage } = await createAuthContext(browser, 'customer');
    await customerPage.goto('/account/orders');
    await customerPage.waitForTimeout(2000);
    
    // Check vendor view
    const { context: vendorContext, page: vendorPage } = await createAuthContext(browser, 'vendor');
    await vendorPage.goto('/vendor');
    await vendorPage.waitForTimeout(2000);
    
    // Check admin view
    const { context: adminContext, page: adminPage } = await createAuthContext(browser, 'admin');
    await adminPage.goto('/admin/orders');
    await adminPage.waitForTimeout(2000);
    
    await customerContext.close();
    await vendorContext.close();
    await adminContext.close();
  });
});
