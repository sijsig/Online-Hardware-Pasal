# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs/end-to-end.spec.ts >> Complete End-to-End Flow >> complete order flow: customer -> vendor -> rider -> admin
- Location: tests/specs/end-to-end.spec.ts:49:7

# Error details

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { HomePage, CartPage, CheckoutPage } from '../page-objects/CustomerPages';
  3   | import { VendorDashboard } from '../page-objects/VendorDashboard';
  4   | import { RiderDashboard } from '../page-objects/RiderDashboard';
  5   | import { AdminDashboard, AdminOrdersPage, AdminShopsPage } from '../page-objects/AdminDashboard';
  6   | import { login, TEST_USERS, waitForToast } from '../utils/test-helpers';
  7   | 
  8   | const BASE_URL = 'http://localhost:3000';
  9   | 
  10  | async function createAuthContext(browser: any, role: string) {
  11  |   const context = await browser.newContext();
  12  |   const page = await context.newPage();
  13  |   
  14  |   // Use API to authenticate
  15  |   const response = await page.request.post(`${BASE_URL}/api/mobile/auth/login`, {
  16  |     data: { email: TEST_USERS[role as keyof typeof TEST_USERS].email, password: TEST_USERS[role as keyof typeof TEST_USERS].password },
  17  |   });
  18  |   
> 19  |   const data = await response.json();
      |                ^ SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
  20  |   if (data.success && data.data.session) {
  21  |     await context.addCookies([
  22  |       { name: 'sb-access-token', value: data.data.session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  23  |       { name: 'sb-refresh-token', value: data.data.session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  24  |     ]);
  25  |   }
  26  |   
  27  |   return { context, page };
  28  | }
  29  | 
  30  | test.describe('Complete End-to-End Flow', () => {
  31  |   let homePage: HomePage;
  32  |   let cartPage: CartPage;
  33  |   let checkoutPage: CheckoutPage;
  34  |   let vendorDashboard: VendorDashboard;
  35  |   let riderDashboard: RiderDashboard;
  36  |   let adminDashboard: AdminDashboard;
  37  |   let adminOrders: AdminOrdersPage;
  38  | 
  39  |   test.beforeEach(async ({ page }) => {
  40  |     homePage = new HomePage(page);
  41  |     cartPage = new CartPage(page);
  42  |     checkoutPage = new CheckoutPage(page);
  43  |     vendorDashboard = new VendorDashboard(page);
  44  |     riderDashboard = new RiderDashboard(page);
  45  |     adminDashboard = new AdminDashboard(page);
  46  |     adminOrders = new AdminOrdersPage(page);
  47  |   });
  48  | 
  49  |   test('complete order flow: customer -> vendor -> rider -> admin', async ({ browser }) => {
  50  |     test.setTimeout(300000);
  51  |     
  52  |     // Step 1: Customer places order
  53  |     const { context: customerContext, page: customerPage } = await createAuthContext(browser, 'customer');
  54  |     const customerHome = new HomePage(customerPage);
  55  |     const customerCart = new CartPage(customerPage);
  56  |     const customerCheckout = new CheckoutPage(customerPage);
  57  |     
  58  |     try {
  59  |       await customerHome.goto();
  60  |       await customerHome.searchProducts('drill');
  61  |       await customerPage.waitForTimeout(1000);
  62  |       
  63  |       const results = await customerHome.getSearchResults();
  64  |       if (results.length === 0) {
  65  |         test.skip('No products available for testing');
  66  |         await customerContext.close();
  67  |         return;
  68  |       }
  69  |       
  70  |       await customerHome.clickProduct(0);
  71  |       
  72  |       const vendorOptions = await customerPage.locator('select[name="vendorId"] option').count();
  73  |       if (vendorOptions > 1) {
  74  |         await customerPage.selectOption('select[name="vendorId"]', { index: 0 });
  75  |       }
  76  |       
  77  |       await customerPage.fill('input[name="quantity"]', '1');
  78  |       await customerPage.click('button:has-text("Add to cart")');
  79  |       await waitForToast(customerPage, 'Added to cart', 15000);
  80  |       
  81  |       await customerCart.goto();
  82  |       await customerCart.proceedToCheckout();
  83  |       
  84  |       await customerCheckout.fillAddress({
  85  |         recipientName: 'E2E Test Customer',
  86  |         phone: '9800000000',
  87  |         addressLine: 'Test Address, Kathmandu',
  88  |         city: 'Kathmandu',
  89  |         district: 'Kathmandu',
  90  |       });
  91  |       await customerCheckout.selectPaymentMethod('cod');
  92  |       await customerCheckout.placeOrder();
  93  |       
  94  |       const confirmation = await customerCheckout.getOrderConfirmation();
  95  |       expect(confirmation).toBeTruthy();
  96  |       
  97  |     } finally {
  98  |       await customerContext.close();
  99  |     }
  100 |     
  101 |     // Step 2: Vendor accepts and processes order
  102 |     const { context: vendorContext, page: vendorPage } = await createAuthContext(browser, 'vendor');
  103 |     const vendorDash = new VendorDashboard(vendorPage);
  104 |     try {
  105 |       await vendorDash.goto();
  106 |       await vendorPage.waitForTimeout(5000);
  107 |       
  108 |       const pendingCount = await vendorDash.getPendingOrderCount();
  109 |       if (pendingCount > 0) {
  110 |         await vendorDash.acceptOrder(0);
  111 |         await waitForToast(vendorPage, 'confirmed', 15000);
  112 |         
  113 |         await vendorDash.advanceOrderStatus(0);
  114 |         await vendorDash.advanceOrderStatus(0);
  115 |       }
  116 |     } finally {
  117 |       await vendorContext.close();
  118 |     }
  119 |     
```