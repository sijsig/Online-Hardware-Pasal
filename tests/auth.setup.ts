import { test as setup, expect } from '@playwright/test';
import { test as testBase, TestUserRole } from './utils/test-helpers';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load test environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hhavjnfgedskwomdbpsj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Admin API calls will fail.");
}

// Use project root's playwright/.auth directory
const authDir = path.join(__dirname, '..', 'playwright', '.auth');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Get Supabase cookie names (for SSR)
function getSupabaseCookiePrefix(): string {
  const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hhavjnfgedskwomdbpsj.supabase.co';
  const match = supabaseUrlEnv.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : 'hhavjnfgedskwomdbpsj';
  return `sb-${projectRef}`;
}

function getAuthCookieNames() {
  const prefix = getSupabaseCookiePrefix();
  return {
    accessToken: `${prefix}-auth-token`,
    refreshToken: `${prefix}-refresh-token`,
  };
}

// Admin client for user management
function getAdminSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Create or get user via Admin API (bypasses magic link)
async function ensureUserViaAdmin(email: string, password: string, role: string, fullName: string) {
  const adminSupabase = getAdminSupabase();
  
  // Check if user exists
  const { data: users } = await adminSupabase.auth.admin.listUsers();
  const existingUser = users.users.find(u => u.email === email);
  
  if (existingUser) {
    // Update password and ensure email confirmed
    const { data, error } = await adminSupabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role }
    });
    if (error) throw error;
    return data.user;
  }
  
  // Create new user with confirmed email
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role }
  });
  if (error) throw error;
  return data.user;
}

// Ensure profile exists with correct role
async function ensureProfileRole(userEmail: string, expectedRole: string) {
  const adminSupabase = getAdminSupabase();
  
  // Find user by email
  const { data: users } = await adminSupabase.auth.admin.listUsers();
  const targetUser = users.users.find(u => u.email === userEmail);
  if (!targetUser) {
    console.error(`User ${userEmail} not found in auth`);
    return;
  }
  
  // Upsert profile with correct role
  const { error } = await adminSupabase
    .from('profiles')
    .upsert({ 
      id: targetUser.id, 
      email: userEmail, 
      role: expectedRole,
      full_name: `Test ${expectedRole.charAt(0).toUpperCase() + expectedRole.slice(1)}`,
      phone: '9800000000'
    });
  if (error) {
    console.error(`Failed to update profile role for ${userEmail}: ${error.message}`);
  } else {
    console.log(`Profile role set to ${expectedRole} for ${userEmail}`);
  }
}

// Ensure vendor shop exists and is active
async function ensureVendorShop(page: any, userEmail: string) {
  console.log(`Navigating to /vendor for ${userEmail}...`);
  await page.goto('/vendor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const pageTitle = await page.title();
  const pageUrl = page.url();
  const bodyText = await page.locator('body').innerText().catch(() => 'ERROR');
  console.log(`DEBUG: Page title: ${pageTitle}`);
  console.log(`DEBUG: Page URL: ${pageUrl}`);
  console.log(`DEBUG: Body text preview: ${bodyText.substring(0, 500)}`);
  
  if (pageUrl.includes('/login')) {
    console.log(`WARNING: Redirected to login page - auth may have failed`);
    throw new Error('Redirected to login');
  }
  
  const hasDashboard = await page.locator('h1:has-text("Shop dashboard")').isVisible({ timeout: 5000 }).catch(() => false);
  const hasShopSwitcher = await page.locator('.vendor-shop-switcher').isVisible({ timeout: 3000 }).catch(() => false);
  const hasApplicationForm = await page.locator('h1:has-text("Bring your shop online")').isVisible({ timeout: 3000 }).catch(() => false);
  const hasOrdersSection = await page.locator('#orders, [id*="order"]').first().isVisible({ timeout: 3000 }).catch(() => false);
  const hasVendorWorkspace = await page.locator('p.section-kicker:has-text("Vendor workspace")').isVisible({ timeout: 3000 }).catch(() => false);
  const hasShopName = await page.locator('.vendor-shop-summary strong, .shop-name, [class*="shop"]').first().isVisible({ timeout: 3000 }).catch(() => false);
  
  const hasShop = hasDashboard || hasShopSwitcher || hasOrdersSection || hasVendorWorkspace || hasShopName;
  
  console.log(`Shop check for ${userEmail}:`);
  console.log(`  dashboard=${hasDashboard}, switcher=${hasShopSwitcher}, orders=${hasOrdersSection}`);
  console.log(`  form=${hasApplicationForm}, workspace=${hasVendorWorkspace}, shopName=${hasShopName}`);
  
  if (!hasShop && hasApplicationForm) {
    console.log(`User ${userEmail} has no shop, creating one...`);
    await page.fill('input[name="name"]', 'Test Vendor Shop');
    await page.fill('input[name="phone"]', '9801000000');
    await page.fill('input[name="email"]', 'shop@testcorp.com');
    await page.fill('textarea[name="address"]', 'Test Address, Kathmandu');
    await page.fill('input[name="city"]', 'Kathmandu');
    await page.fill('input[name="district"]', 'Kathmandu');
    await page.fill('input[name="province"]', 'Bagmati');
    await page.fill('textarea[name="description"]', 'Test vendor shop for E2E tests');
    await page.locator('input[placeholder="27.7172"]').pressSequentially('27.7172');
    await page.locator('input[placeholder="85.3240"]').pressSequentially('85.3240');
    await page.click('button:has-text("Submit shop for review")');
    
    try {
      const redirectPromise = page.waitForURL(/\/vendor\?shop=/, { timeout: 30000 }).catch(() => null);
      const messagePromise = page.locator('.vendor-application-message, [role="status"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => null);
      const [redirectUrl, message] = await Promise.all([redirectPromise, messagePromise]);

      let shopId = null;
      if (redirectUrl) {
        const url = page.url();
        const shopIdMatch = url.match(/\/vendor\?shop=([^&]+)/);
        if (shopIdMatch) shopId = shopIdMatch[1];
      } else if (message) {
        const messageText = await message.textContent();
        const shopIdMatch = messageText?.match(/shop[\s:]+([a-f0-9-]+)/i);
        if (shopIdMatch) shopId = shopIdMatch[1];
      }

      if (!shopId) {
        throw new Error("Application submission did not redirect or show message with shop ID");
      }

      console.log(`Created shop ${shopId} for ${userEmail}, approving...`);
      
      const adminSupabase = getAdminSupabase();
      const { error } = await adminSupabase.rpc("review_vendor_application", {
        p_vendor_id: shopId,
        p_decision: "active",
        p_commission_rate: 0.1,
      });
      
      if (error) {
        console.error("Failed to approve shop:", error.message);
      } else {
        console.log("Shop approved successfully");
      }
      
    } catch (e) {
      console.error('Error waiting for shop creation redirect:', e);
      throw e;
    }
    
    await page.goto('/vendor', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
  } else if (hasShop) {
    console.log(`User ${userEmail} already has an active shop`);
  } else {
    console.log(`User ${userEmail} - unclear state, no shop found and no application form`);
    await page.waitForTimeout(5000);
    const bodyText2 = await page.locator('body').innerText().catch(() => 'ERROR');
    console.log(`DEBUG after wait: ${bodyText2.substring(0, 500)}`);
    throw new Error('Could not determine vendor shop state');
  }
}

// Verify vendor dashboard loads correctly
async function verifyVendorDashboard(page: any, userEmail: string): Promise<boolean> {
  await page.goto('/vendor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const hasDashboard = await page.locator('h1:has-text("Shop dashboard")').isVisible({ timeout: 10000 }).catch(() => false);
  const hasShopSwitcher = await page.locator('.vendor-shop-switcher').isVisible({ timeout: 5000 }).catch(() => false);
  const hasOrdersSection = await page.locator('#orders').isVisible({ timeout: 5000 }).catch(() => false);
  const hasInventorySection = await page.locator('#inventory').isVisible({ timeout: 5000 }).catch(() => false);
  const hasKpiGrid = await page.locator('.vendor-kpi-grid').isVisible({ timeout: 5000 }).catch(() => false);
  
  const isLoaded = hasDashboard || hasShopSwitcher || hasOrdersSection || hasInventorySection || hasKpiGrid;
  
  if (!isLoaded) {
    const pageUrl = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => 'ERROR');
    console.log(`ERROR: Vendor dashboard not loaded for ${userEmail}. URL: ${pageUrl}`);
    console.log(`Body preview: ${bodyText.substring(0, 500)}`);
    if (pageUrl.includes('/login')) {
      throw new Error('Redirected to login - auth failed');
    }
    return false;
  }
  
  console.log(`Vendor dashboard verified for ${userEmail}`);
  return true;
}

// Create unique test email to avoid rate limits
function generateTestEmail(prefix: string): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}@testcorp.com`;
}

// Setup for each role using Admin API (bypasses magic link)
const setupRoles: TestUserRole[] = ['admin', 'customer', 'vendor', 'rider'];

for (const role of setupRoles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const authFile = path.join(authDir, `${role}.json`);
    
    // Skip if auth file exists and is recent (< 1 hour)
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
      const testUsers = {
        customer: { email: 'customer@test.com', password: 'TestPass123!' },
        vendor: { email: 'vendor@test.com', password: 'TestPass123!' },
        admin: { email: 'admin@test.com', password: 'TestPass123!' },
        rider: { email: 'rider@test.com', password: 'TestPass123!' },
      };
      
      const user = testUsers[role];
      
      // Create/ensure user via Admin API (bypasses magic link)
      await ensureUserViaAdmin(user.email, user.password, role, `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`);
      await ensureProfileRole(user.email, role === 'vendor' ? 'vendor_owner' : role);
      
      // For vendor, also ensure shop exists
      if (role === 'vendor') {
        const adminSupabase = getAdminSupabase();
        const { data: users } = await adminSupabase.auth.admin.listUsers();
        const targetUser = users.users.find(u => u.email === 'vendor@test.com');
        if (targetUser) {
          const { data: vendors } = await adminSupabase.from('vendors').select('id').eq('owner_id', targetUser.id);
          if (!vendors || vendors.length === 0) {
            await adminSupabase.from('vendors').insert({
              name: 'Test Hardware',
              slug: 'test-hardware',
              phone: '9800000000',
              email: 'vendor@test.com',
              address_line: 'Test Address, Kathmandu',
              city: 'Kathmandu',
              district: 'Kathmandu',
              province: 'Bagmati',
              status: 'active',
              owner_id: targetUser.id
            });
          }
        }
      }
      
      // Get session via password login (now works because email is confirmed)
      const loginResponse = await fetch(`${baseURL}/api/mobile/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });
      
      const loginData = await loginResponse.json();
      if (!loginData.success) {
        throw new Error(`Login failed for ${role}: ${loginData.error}`);
      }
      
      const session = loginData.data.session;
      
      // Add cookies with url (not domain) for localhost
      const cookieNames = getAuthCookieNames();
      
      await page.context().addCookies([
        {
          name: cookieNames.accessToken,
          value: session.access_token,
          url: baseURL,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
          maxAge: 60 * 60 * 24 * 365,
        },
        {
          name: cookieNames.refreshToken,
          value: session.refresh_token,
          url: baseURL,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
          maxAge: 60 * 60 * 24 * 365,
        },
      ]);
      
      // Verify auth works
      const expectedUrls = { customer: '/account', vendor: '/vendor', admin: '/admin', rider: '/rider' };
      await page.goto(expectedUrls[role], { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      if (page.url().includes('/login')) {
        const bodyText = await page.locator('body').innerText().catch(() => '');
        throw new Error(`Auth failed for ${role} - redirected to login`);
      }
      
      if (role === 'vendor') {
        await ensureVendorShop(page, user.email);
        await verifyVendorDashboard(page, user.email);
      }
      
      await page.context().storageState({ path: authFile });
      console.log(`Auth saved for ${role}`);
      
    } catch (error) {
      console.error(`Failed to setup auth for ${role}:`, error);
      throw error;
    }
  });
}

// New vendor setup
setup('authenticate as new vendor', async ({ page }) => {
  const authFile = path.join(authDir, 'newvendor.json');
  
  if (fs.existsSync(authFile)) {
    const stat = fs.statSync(authFile);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 3600000) return;
  }
  
  console.log('Setting up auth for new vendor...');
  
  try {
    const email = generateTestEmail('newvendor');
    
    // Create via Admin API
    await ensureUserViaAdmin(email, 'TestPass123!', 'customer', 'New Vendor');
    await ensureProfileRole(email, 'customer');
    
    // Login to get session
    const loginResponse = await fetch(`${baseURL}/api/mobile/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'TestPass123!' }),
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error(`Login failed for new vendor: ${loginData.error}`);
    }
    
    const session = loginData.data.session;
    
    const cookieNames = getAuthCookieNames();
  
    // Add cookies with url (not domain) for localhost
    await page.context().addCookies([
      {
        name: cookieNames.accessToken,
        value: session.access_token,
        url: baseURL,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 365,
      },
      {
        name: cookieNames.refreshToken,
        value: session.refresh_token,
        url: baseURL,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 365,
      },
    ]);
    await page.goto('/vendor', { waitUntil: 'networkidle' });
    await page.fill('input[name="name"]', 'E2E Test Hardware');
    await page.fill('input[name="phone"]', '9800000003');
    await page.fill('input[name="email"]', 'shop@testcorp.com');
    await page.fill('textarea[name="address"]', 'Kathmandu, Nepal');
    await page.fill('input[name="city"]', 'Kathmandu');
    await page.fill('input[name="district"]', 'Kathmandu');
    await page.fill('input[name="province"]', 'Bagmati');
    await page.fill('textarea[name="description"]', 'Test shop from E2E');
    await page.locator('input[placeholder="27.7172"]').pressSequentially('27.7172');
    await page.locator('input[placeholder="85.3240"]').pressSequentially('85.3240');
    await page.click('button:has-text("Submit shop for review")');
    
    const redirectPromise = page.waitForURL(/\/vendor\?shop=/, { timeout: 30000 }).catch(() => null);
    const messagePromise = page.locator(".vendor-application-message, [role=\"status\"]").waitFor({ state: "visible", timeout: 30000 }).catch(() => null);
    const [redirectUrl, message] = await Promise.all([redirectPromise, messagePromise]);

    if (!redirectUrl && !message) {
      throw new Error("Application submission did not redirect or show message");
    }
    
    await page.context().storageState({ path: authFile });
    console.log('Auth saved for new vendor');
  } catch (error) {
    console.error('Failed to setup new vendor auth:', error);
    throw error;
  }
});
