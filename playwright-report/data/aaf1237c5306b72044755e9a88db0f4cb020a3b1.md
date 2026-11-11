# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs/end-to-end.spec.ts >> Complete End-to-End Flow >> vendor creates shop and gets approved by admin
- Location: tests/specs/end-to-end.spec.ts:156:7

# Error details

```
TimeoutError: page.fill: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('input[name="name"]')

```

# Test source

```ts
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
  120 |     // Step 3: Admin assigns rider
  121 |     const { context: adminContext, page: adminPage } = await createAuthContext(browser, 'admin');
  122 |     try {
  123 |       await adminOrders.goto('ready_for_pickup');
  124 |       const orderCount = await adminOrders.getOrderCount();
  125 |       
  126 |       if (orderCount > 0) {
  127 |         // In real scenario, admin would assign rider here
  128 |       }
  129 |     } finally {
  130 |       await adminContext.close();
  131 |     }
  132 |     
  133 |     // Step 4: Rider accepts and completes delivery
  134 |     const { context: riderContext, page: riderPage } = await createAuthContext(browser, 'rider');
  135 |     const riderDash = new RiderDashboard(riderPage);
  136 |     try {
  137 |       await riderDash.goto();
  138 |       await riderDash.goOnline();
  139 |       await riderPage.waitForTimeout(10000);
  140 |       
  141 |       const hasDelivery = await riderDash.hasActiveDelivery();
  142 |       if (hasDelivery) {
  143 |         await riderDash.acceptDelivery();
  144 |         await waitForToast(riderPage, 'accepted', 15000);
  145 |         await riderPage.waitForTimeout(5000);
  146 |         await riderDash.confirmPickup();
  147 |         await waitForToast(riderPage, 'pickup', 15000);
  148 |         await riderDash.confirmDelivery();
  149 |         await waitForToast(riderPage, 'completed', 15000);
  150 |       }
  151 |     } finally {
  152 |       await riderContext.close();
  153 |     }
  154 |   });
  155 | 
  156 |   test('vendor creates shop and gets approved by admin', async ({ browser }) => {
  157 |     test.setTimeout(300000);
  158 |     
  159 |     // Sign up new vendor via API
  160 |     const { context: newVendorContext, page: newVendorPage } = await createAuthContext(browser, 'customer');
  161 |     // Override with new vendor email
  162 |     await newVendorContext.clearCookies();
  163 |     
  164 |     // Use API to signup as new vendor
  165 |     const signupResponse = await newVendorPage.request.post(`${BASE_URL}/api/mobile/auth/signup`, {
  166 |       data: {
  167 |         email: 'newvendor@test.com',
  168 |         password: 'TestPass123!',
  169 |         full_name: 'New Vendor',
  170 |         phone: '9800000002',
  171 |         role: 'customer',
  172 |       },
  173 |     });
  174 |     
  175 |     const signupData = await signupResponse.json();
  176 |     if (!signupData.success) {
  177 |       // Try login if already exists
  178 |       const loginResponse = await newVendorPage.request.post(`${BASE_URL}/api/mobile/auth/login`, {
  179 |         data: { email: 'newvendor@test.com', password: 'TestPass123!' },
  180 |       });
  181 |       const loginData = await loginResponse.json();
  182 |       if (loginData.success) {
  183 |         await newVendorContext.addCookies([
  184 |           { name: 'sb-access-token', value: loginData.data.session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  185 |           { name: 'sb-refresh-token', value: loginData.data.session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  186 |         ]);
  187 |       }
  188 |     } else {
  189 |       await newVendorContext.addCookies([
  190 |         { name: 'sb-access-token', value: signupData.data.session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  191 |         { name: 'sb-refresh-token', value: signupData.data.session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  192 |       ]);
  193 |     }
  194 |     
  195 |     try {
  196 |       // Apply for vendor - use correct form field names
  197 |       await newVendorPage.goto('/vendor', { waitUntil: 'networkidle' });
> 198 |       await newVendorPage.fill('input[name="name"]', 'E2E Test Hardware');
      |                           ^ TimeoutError: page.fill: Timeout 30000ms exceeded.
  199 |       await newVendorPage.fill('input[name="phone"]', '9800000003');
  200 |       await newVendorPage.fill('input[name="email"]', 'shop@e2etest.com');
  201 |       await newVendorPage.fill('textarea[name="address"]', 'Kathmandu, Nepal');
  202 |       await newVendorPage.fill('input[name="city"]', 'Kathmandu');
  203 |       await newVendorPage.fill('input[name="district"]', 'Kathmandu');
  204 |       await newVendorPage.fill('input[name="province"]', 'Bagmati');
  205 |       await newVendorPage.fill('textarea[name="description"]', 'Test shop from E2E');
  206 |       // Set location coordinates (required)
  207 |       await newVendorPage.fill('input[placeholder="27.7172"]', '27.7172');
  208 |       await newVendorPage.fill('input[placeholder="85.3240"]', '85.3240');
  209 |       await newVendorPage.click('button:has-text("Submit shop for review")');
  210 |       
  211 |       // Wait for redirect to vendor dashboard with shop param
  212 |       await newVendorPage.waitForURL(/\/vendor\?shop=/, { timeout: 30000 });
  213 |     } finally {
  214 |       await newVendorContext.close();
  215 |     }
  216 |     
  217 |     // Admin approves
  218 |     const { context: adminContext, page: adminPage } = await createAuthContext(browser, 'admin');
  219 |     try {
  220 |       const adminShops = new AdminShopsPage(adminPage);
  221 |       await adminShops.goto('pending');
  222 |       
  223 |       const count = await adminShops.getShopCount();
  224 |       if (count > 0) {
  225 |         await adminShops.approveShop(0);
  226 |         await waitForToast(adminPage, 'approved', 15000);
  227 |       }
  228 |     } finally {
  229 |       await adminContext.close();
  230 |     }
  231 |   });
  232 | });
  233 | 
  234 | test.describe('Multi-role Data Consistency', () => {
  235 |   test('order status syncs across all roles', async ({ browser }) => {
  236 |     test.setTimeout(120000);
  237 |     
  238 |     // Check customer view
  239 |     const { context: customerContext, page: customerPage } = await createAuthContext(browser, 'customer');
  240 |     await customerPage.goto('/account/orders');
  241 |     await customerPage.waitForTimeout(2000);
  242 |     
  243 |     // Check vendor view
  244 |     const { context: vendorContext, page: vendorPage } = await createAuthContext(browser, 'vendor');
  245 |     await vendorPage.goto('/vendor');
  246 |     await vendorPage.waitForTimeout(2000);
  247 |     
  248 |     // Check admin view
  249 |     const { context: adminContext, page: adminPage } = await createAuthContext(browser, 'admin');
  250 |     await adminPage.goto('/admin/orders');
  251 |     await adminPage.waitForTimeout(2000);
  252 |     
  253 |     await customerContext.close();
  254 |     await vendorContext.close();
  255 |     await adminContext.close();
  256 |   });
  257 | });
  258 | 
```