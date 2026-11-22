# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate as new vendor
- Location: tests/auth.setup.ts:319:1

# Error details

```
TimeoutError: page.fill: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('textarea[name="address"]')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - link "H hardwarepasal" [ref=e4] [cursor=pointer]:
        - /url: /
        - generic [ref=e5]: H
        - generic [ref=e6]: hardwarepasal
      - link "Your account" [ref=e7] [cursor=pointer]:
        - /url: /account
    - generic [ref=e8]:
      - text: ⌂
      - paragraph [ref=e9]: Vendor workspace
      - heading "Bring your shop online" [level=1] [ref=e10]
      - paragraph [ref=e11]: Apply to list your independent hardware shop. The team will review the shop details before customers can discover it.
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]:
            - text: Shop name
            - textbox "Shop name" [ref=e15]:
              - /placeholder: e.g. New Road Hardware
              - text: E2E Test Hardware
          - generic [ref=e16]:
            - text: Shop phone
            - textbox "Shop phone" [ref=e17]:
              - /placeholder: 98XXXXXXXX
              - text: "9800000003"
          - generic [ref=e18]:
            - text: Contact email Optional
            - textbox "Contact email Optional" [active] [ref=e19]:
              - /placeholder: shop@example.com
              - text: shop@testcorp.com
          - generic [ref=e20]:
            - text: Street address
            - textbox "Street address" [ref=e21]:
              - /placeholder: Tole, road, or landmark
          - generic [ref=e22]:
            - text: City / municipality
            - textbox "City / municipality" [ref=e23]:
              - /placeholder: Kathmandu
          - generic [ref=e24]:
            - text: District Optional
            - textbox "District Optional" [ref=e25]:
              - /placeholder: Kathmandu
          - generic [ref=e26]:
            - text: Province Optional
            - textbox "Province Optional" [ref=e27]:
              - /placeholder: Bagmati
        - generic [ref=e28]:
          - text: About your shop Optional
          - textbox "About your shop Optional" [ref=e29]:
            - /placeholder: What hardware products does your shop carry?
        - region "Shop map location" [ref=e30]:
          - generic [ref=e31]:
            - strong [ref=e32]: Shop location
            - paragraph [ref=e33]: We use the map point to show nearby customers your distance and delivery area.
          - button "Use current location" [ref=e34]
          - generic [ref=e35]:
            - generic [ref=e36]:
              - text: Latitude
              - spinbutton "Latitude" [ref=e37]
            - generic [ref=e38]:
              - text: Longitude
              - spinbutton "Longitude" [ref=e39]
        - button "Submit shop for review" [ref=e40]
        - paragraph [ref=e41]: Your shop will stay pending until the marketplace team reviews it. It won’t appear in customer search before approval.
  - button "Open Next.js Dev Tools" [ref=e47] [cursor=pointer]
  - alert [ref=e51]
```

# Test source

```ts
  280 |       }
  281 |       
  282 |       const session = loginData.data.session;
  283 |       
  284 |       // Use @supabase/ssr compatible cookie format
  285 |       const ssrCookies = createSupabaseSSRCookies({
  286 |         access_token: session.access_token,
  287 |         refresh_token: session.refresh_token,
  288 |         expires_at: session.expires_at,
  289 |         user: loginData.data.user,
  290 |       });
  291 |       await page.context().addCookies(ssrCookies);
  292 |       
  293 |       // Verify auth works
  294 |       const expectedUrls = { customer: '/account', vendor: '/vendor', admin: '/admin', rider: '/rider' };
  295 |       await page.goto(expectedUrls[role], { waitUntil: 'networkidle', timeout: 30000 });
  296 |       await page.waitForTimeout(2000);
  297 |       
  298 |       if (page.url().includes('/login')) {
  299 |         const bodyText = await page.locator('body').innerText().catch(() => '');
  300 |         throw new Error(`Auth failed for ${role} - redirected to login`);
  301 |       }
  302 |       
  303 |       if (role === 'vendor') {
  304 |         await ensureVendorShop(page, user.email);
  305 |         await verifyVendorDashboard(page, user.email);
  306 |       }
  307 |       
  308 |       await page.context().storageState({ path: authFile });
  309 |       console.log(`Auth saved for ${role}`);
  310 |       
  311 |     } catch (error) {
  312 |       console.error(`Failed to setup auth for ${role}:`, error);
  313 |       throw error;
  314 |     }
  315 |   });
  316 | }
  317 | 
  318 | // New vendor setup
  319 | setup('authenticate as new vendor', async ({ page }) => {
  320 |   const authFile = path.join(authDir, 'newvendor.json');
  321 |   
  322 |   if (fs.existsSync(authFile)) {
  323 |     const stat = fs.statSync(authFile);
  324 |     const ageMs = Date.now() - stat.mtimeMs;
  325 |     if (ageMs < 3600000) return;
  326 |   }
  327 |   
  328 |   console.log('Setting up auth for new vendor...');
  329 |   
  330 |   // Capture browser console logs
  331 |   page.on('console', msg => {
  332 |     const text = msg.text();
  333 |     if (text.includes('[VendorApp]') || text.includes('Shop application') || text.includes('RPC')) {
  334 |       console.log('🖥️ BROWSER CONSOLE:', text);
  335 |     }
  336 |   });
  337 |   page.on('pageerror', err => {
  338 |     console.log('🖥️ BROWSER ERROR:', err.message);
  339 |   });
  340 |   
  341 |   try {
  342 |     const email = generateTestEmail('newvendor');
  343 |     
  344 |     // Create via Admin API
  345 |     const createdUser = await ensureUserViaAdmin(email, 'TestPass123!', 'customer', 'New Vendor');
  346 |     await ensureProfileRole(createdUser.id, 'customer', email);
  347 |     
  348 |     // Login to get session
  349 |     const loginResponse = await fetch(`${baseURL}/api/mobile/auth/login`, {
  350 |       method: 'POST',
  351 |       headers: { 'Content-Type': 'application/json' },
  352 |       body: JSON.stringify({ email, password: 'TestPass123!' }),
  353 |     });
  354 |     
  355 |     const loginData = await loginResponse.json();
  356 |     if (!loginData.success) {
  357 |       throw new Error(`Login failed for new vendor: ${loginData.error}`);
  358 |     }
  359 |     
  360 |     const session = loginData.data.session;
  361 |     
  362 |     // Use @supabase/ssr compatible cookie format
  363 |     const ssrCookies = createSupabaseSSRCookies({
  364 |       access_token: session.access_token,
  365 |       refresh_token: session.refresh_token,
  366 |       expires_at: session.expires_at,
  367 |       user: loginData.data.user,
  368 |     });
  369 |     await page.context().addCookies(ssrCookies);
  370 |     await page.goto('/vendor', { waitUntil: 'networkidle' });
  371 |     
  372 |     // Check if application form is visible (user doesn't have a shop yet)
  373 |     const formVisible = await page.locator('input[name="name"]').isVisible({ timeout: 5000 }).catch(() => false);
  374 |     
  375 |     if (formVisible) {
  376 |       // Fill and submit the application form
  377 |       await page.fill('input[name="name"]', 'E2E Test Hardware');
  378 |       await page.fill('input[name="phone"]', '9800000003');
  379 |       await page.fill('input[name="email"]', 'shop@testcorp.com');
> 380 |       await page.fill('textarea[name="address"]', 'Kathmandu, Nepal');
      |                  ^ TimeoutError: page.fill: Timeout 30000ms exceeded.
  381 |       await page.fill('input[name="city"]', 'Kathmandu');
  382 |       await page.fill('input[name="district"]', 'Kathmandu');
  383 |       await page.fill('input[name="province"]', 'Bagmati');
  384 |       await page.fill('textarea[name="description"]', 'Test shop from E2E');
  385 |       await page.locator('input[placeholder="27.7172"]').pressSequentially('27.7172');
  386 |       await page.locator('input[placeholder="85.3240"]').pressSequentially('85.3240');
  387 |       await page.click('button:has-text("Submit shop for review")');
  388 |       
  389 |       // Wait for dashboard to show success state: "Shop dashboard" or "This shop is pending"
  390 |       await page.waitForSelector('text="Shop dashboard", text="This shop is pending"', { timeout: 30000, state: 'visible' });
  391 |     } else {
  392 |       // User already has a shop - verify dashboard loads
  393 |       await page.waitForSelector('text="Shop dashboard"', { timeout: 10000, state: 'visible' });
  394 |       console.log('User already has a shop, skipping application form');
  395 |     }
  396 |     
  397 |     // Also verify we're on the vendor dashboard with the shop listed
  398 |     await page.waitForTimeout(2000);
  399 |     
  400 |     await page.context().storageState({ path: authFile });
  401 |     console.log('Auth saved for new vendor');
  402 |   } catch (error) {
  403 |     console.error('Failed to setup new vendor auth:', error);
  404 |     throw error;
  405 |   }
  406 | });
  407 | 
```