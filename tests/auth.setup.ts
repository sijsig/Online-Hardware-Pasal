import { test as setup, expect } from '@playwright/test';
import { TEST_USERS, TestUserRole } from './utils/test-helpers';
import fs from 'fs';
import path from 'path';

const roles: TestUserRole[] = ['customer', 'vendor', 'admin', 'rider'];
const baseURL = 'http://localhost:3000';

// Use project root's playwright/.auth directory (where tests expect it)
const authDir = path.join(__dirname, '..', 'playwright', '.auth');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

async function authenticateViaAPI(role: TestUserRole) {
  const user = TEST_USERS[role];
  
  // Try login via mobile API
  const loginResponse = await fetch(`${baseURL}/api/mobile/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  
  const loginData = await loginResponse.json();
  
  if (!loginData.success) {
    // Try signup if login fails
    const signupResponse = await fetch(`${baseURL}/api/mobile/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        phone: '9800000000',
        role,
      }),
    });
    
    const signupData = await signupResponse.json();
    if (!signupData.success) {
      throw new Error(`Failed to authenticate ${role}: ${signupData.error || loginData.error}`);
    }
    return signupData.data.session;
  }
  
  return loginData.data.session;
}

for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const user = TEST_USERS[role];
    const authFile = path.join(authDir, `${role}.json`);
    
    // Skip if auth file already exists and is recent (< 1 hour)
    if (fs.existsSync(authFile)) {
      const stat = fs.statSync(authFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 3600000) {
        console.log(`Using cached auth for ${role}`);
        return;
      }
    }
    
    console.log(`Setting up auth for ${role}...`);
    
    try {
      const session = await authenticateViaAPI(role);
      
      // Set cookies in browser context
      await page.context().addCookies([
        {
          name: 'sb-access-token',
          value: session.access_token,
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
        {
          name: 'sb-refresh-token',
          value: session.refresh_token,
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ]);
      
      // Navigate to verify session works
      const expectedUrls: Record<TestUserRole, string> = {
        customer: '/account',
        vendor: '/vendor',
        admin: '/admin',
        rider: '/rider',
      };
      
      await page.goto(expectedUrls[role], { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for any redirects to settle
      await page.waitForTimeout(2000);
      
      // Save storage state
      await page.context().storageState({ path: authFile });
      console.log(`Auth saved for ${role}`);
      
    } catch (error) {
      console.error(`Failed to setup auth for ${role}:`, error);
      // Don't throw - let tests handle missing auth
    }
  });
}

// Additional setup for new vendor (for e2e test)
setup('authenticate as new vendor', async ({ page }) => {
  const authFile = path.join(authDir, 'newvendor.json');
  
  if (fs.existsSync(authFile)) {
    const stat = fs.statSync(authFile);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 3600000) return;
  }
  
  console.log('Setting up auth for new vendor...');
  
  try {
    // Signup new vendor
    const signupResponse = await fetch(`${baseURL}/api/mobile/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newvendor@test.com',
        password: 'TestPass123!',
        full_name: 'New Vendor',
        phone: '9800000002',
        role: 'customer', // Start as customer, then apply for vendor
      }),
    });
    
    const signupData = await signupResponse.json();
    if (!signupData.success) {
      throw new Error(`Failed to signup new vendor: ${signupData.error}`);
    }
    
    const session = signupData.data.session;
    
    // Set cookies
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: session.access_token,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'sb-refresh-token',
        value: session.refresh_token,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    
    // Apply for vendor - use correct form field names
    await page.goto('/vendor', { waitUntil: 'networkidle' });
    await page.fill('input[name="name"]', 'E2E Test Hardware');
    await page.fill('input[name="phone"]', '9800000003');
    await page.fill('input[name="email"]', 'shop@e2etest.com');
    await page.fill('textarea[name="address"]', 'Kathmandu, Nepal');
    await page.fill('input[name="city"]', 'Kathmandu');
    await page.fill('input[name="district"]', 'Kathmandu');
    await page.fill('input[name="province"]', 'Bagmati');
    await page.fill('textarea[name="description"]', 'Test shop from E2E');
    // Set location coordinates (required)
    await page.fill('input[placeholder="27.7172"]', '27.7172');
    await page.fill('input[placeholder="85.3240"]', '85.3240');
    await page.click('button:has-text("Submit shop for review")');
    
    // Wait for redirect to vendor dashboard with shop param
    await page.waitForURL(/\/vendor\?shop=/, { timeout: 30000 });
    
    await page.context().storageState({ path: authFile });
    console.log('Auth saved for new vendor');
  } catch (error) {
    console.error('Failed to setup new vendor auth:', error);
  }
});
