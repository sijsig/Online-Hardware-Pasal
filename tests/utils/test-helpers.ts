import { Page, Locator, expect, APIRequestContext } from '@playwright/test';
import { createSupabaseSSRCookies } from './supabase-cookie-helper';

export const TEST_USERS = {
  customer: { email: 'customer@test.com', password: 'TestPass123!' },
  vendor: { email: 'vendor@test.com', password: 'TestPass123!' },
  admin: { email: 'admin@test.com', password: 'TestPass123!' },
  rider: { email: 'rider@test.com', password: 'TestPass123!' },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

// Admin client for user management
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hhavjnfgedskwomdbpsj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function getSessionViaAPI(request: APIRequestContext, role: TestUserRole) {
  const user = TEST_USERS[role];
  
  // Try login via mobile API
  const loginResponse = await request.post(`${BASE_URL}/api/mobile/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  
  // Check if response is JSON
  const contentType = loginResponse.headers()['content-type'] || '';
  if (!contentType.includes('application/json')) {
    const text = await loginResponse.text();
    throw new Error(`Expected JSON response from login, got HTML: ${text.substring(0, 200)}`);
  }
  
  const loginData = await loginResponse.json();
  
  if (loginData.success) {
    return loginData.data.session;
  }
  
  // Try signup if login fails
  const signupResponse = await request.post(`${BASE_URL}/api/mobile/auth/signup`, {
    data: {
      email: user.email,
      password: user.password,
      full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      phone: '9800000000',
      role,
    },
  });
  
  const signupContentType = signupResponse.headers()['content-type'] || '';
  if (!signupContentType.includes('application/json')) {
    const text = await signupResponse.text();
    throw new Error(`Expected JSON response from signup, got HTML: ${text.substring(0, 200)}`);
  }
  
  const signupData = await signupResponse.json();
  if (!signupData.success) {
    throw new Error(`Failed to authenticate ${role}: ${signupData.error || loginData.error}`);
  }
  
  return signupData.data.session;
}

async function authenticateViaAPI(page: Page, role: TestUserRole) {
  const apiRequest = page.request;
  
  const session = await getSessionViaAPI(apiRequest, role);
  
  // Set cookies with correct Supabase SSR cookie format
  const ssrCookies = createSupabaseSSRCookies({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: { id: session.user.id, email: session.user.email }, // minimal user object
  });
  await page.context().addCookies(ssrCookies);
  
  return session;
}

export async function login(page: Page, role: TestUserRole, request?: APIRequestContext) {
  const user = TEST_USERS[role];
  
  // Use API to get session - this is the ONLY supported method for automated tests
  const apiRequest = request || page.request;
  
  try {
    // Get session via API
    const loginResponse = await apiRequest.post(`${BASE_URL}/api/mobile/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error(`Login failed for ${role}: ${loginData.error}`);
    }
    
    const session = loginData.data.session;
    
    const ssrCookies = createSupabaseSSRCookies({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: loginData.data.user,
    });
    await page.context().addCookies(ssrCookies);
    
    // Navigate to verify session works
    const possibleUrls = ['/account', '/vendor', '/admin', '/rider'];
    for (const url of possibleUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        if (!page.url().includes('/login')) {
          return;
        }
      } catch {}
    }
    
    throw new Error(`API auth succeeded but session not valid for ${role}`);
  } catch (e) {
    console.error(`API authentication failed for ${role}:`, e);
    throw new Error(`API authentication required for ${role}. Magic link authentication is not supported in automated tests.`);
  }
}

export async function signup(page: Page, role: TestUserRole) {
  const user = TEST_USERS[role];
  
  // Try API signup first
  try {
    const response = await page.request.post(`${BASE_URL}/api/mobile/auth/signup`, {
      data: {
        email: user.email,
        password: user.password,
        full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        phone: '9800000000',
        role,
      },
    });
    
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Signup API did not return JSON');
    }
    
    const data = await response.json();
    if (data.success && data.data.session) {
      const ssrCookies = createSupabaseSSRCookies({
        access_token: data.data.session.access_token,
        refresh_token: data.data.session.refresh_token,
        expires_at: data.data.session.expires_at,
        user: data.data.user,
      });
      await page.context().addCookies(ssrCookies);
      
      await page.goto('/account', { waitUntil: 'networkidle', timeout: 30000 });
      return;
    }
  } catch (e) {
    console.warn('API signup failed:', e);
  }
  
  throw new Error('API signup required. Magic link authentication is not supported in automated tests.');
}

export async function waitForElement(page: Page, selector: string, timeout = 15000) {
  try {
    await expect(page.locator(selector)).toBeVisible({ timeout });
    return true;
  } catch {
    return false;
  }
}

export function getByTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]`);
}

export async function fillForm(page: Page, fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) {
    const input = page.locator(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`).first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill(value);
    }
  }
}

export async function safeFill(page: Page, selector: string, value: string, options: { timeout?: number; force?: boolean } = {}) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: options.timeout || 20000 });
  await locator.fill(value, { force: options.force });
}

export async function safeClick(page: Page, selector: string, options: { timeout?: number; force?: boolean } = {}) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: options.timeout || 20000 });
  await locator.click({ force: options.force });
}

export async function waitForToast(page: Page, messageFragment: string, timeout = 15000): Promise<boolean> {
  try {
    await expect(page.locator(`[role="status"]:has-text("${messageFragment}"), .toast:has-text("${messageFragment}"), .vendor-action-message:has-text("${messageFragment}"), .inventory-row-message:has-text("${messageFragment}"), .rider-message:has-text("${messageFragment}")`)).toBeVisible({ timeout });
    return true;
  } catch {
    return false;
  }
}

// Helper to wait for page to fully load after navigation
export async function waitForPageLoad(page: Page, timeout = 30000) {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(1000); // Additional buffer for hydration
}

// Helper to wait for authentication to settle
export async function waitForAuth(page: Page, timeout = 30000) {
  // Wait for any redirects to complete
  await page.waitForLoadState('networkidle', { timeout });
  // Check if we're on a login page (auth failed)
  if (page.url().includes('/login')) {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`WARNING: Redirected to login page. Body: ${bodyText.substring(0, 500)}`);
  }
}
