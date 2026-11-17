import { Page, Locator, expect, APIRequestContext, APIRequest } from '@playwright/test';

export const TEST_USERS = {
  customer: { email: 'customer@test.com', password: 'TestPass123!' },
  vendor: { email: 'vendor@test.com', password: 'TestPass123!' },
  admin: { email: 'admin@test.com', password: 'TestPass123!' },
  rider: { email: 'rider@test.com', password: 'TestPass123!' },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

const BASE_URL = 'http://localhost:3000';

async function getSessionViaAPI(request: APIRequestContext, role: TestUserRole) {
  const user = TEST_USERS[role];
  
  // Try login via mobile API
  const loginResponse = await request.post(`${BASE_URL}/api/mobile/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  
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
  
  const signupData = await signupResponse.json();
  if (!signupData.success) {
    throw new Error(`Failed to authenticate ${role}: ${signupData.error || loginData.error}`);
  }
  
  return signupData.data.session;
}

async function authenticateViaAPI(page: Page, role: TestUserRole) {
  // Create a temporary request context if not provided
  const request = await page.context().request.fetch('about:blank').catch(() => null);
  // Actually, we can use page.request which is available
  const apiRequest = page.request;
  
  const session = await getSessionViaAPI(apiRequest as any, role);
  
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
  
  return session;
}

export async function login(page: Page, role: TestUserRole, request?: APIRequestContext) {
  const user = TEST_USERS[role];
  
  // If we have request context, use API to get session
  if (request) {
    const session = await getSessionViaAPI(request, role);
    
    await page.context().addCookies([
      { name: 'sb-access-token', value: session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      { name: 'sb-refresh-token', value: session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
    ]);
    
    // Navigate to verify
    const possibleUrls = ['/account', '/vendor', '/admin', '/rider'];
    for (const url of possibleUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        if (!page.url().includes('/login')) {
          return;
        }
      } catch {}
    }
  } else {
    // Use page's built-in request context for API auth
    try {
      await authenticateViaAPI(page, role);
      // Verify by navigating to a protected page
      const possibleUrls = ['/account', '/vendor', '/admin', '/rider'];
      for (const url of possibleUrls) {
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
          if (!page.url().includes('/login')) {
            return;
          }
        } catch {}
      }
    } catch (e) {
      console.warn('API auth failed, falling back to web form:', e);
    }
  }
  
  // Fallback to web login (magic link form) - for cases where API isn't available
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Check if it's the magic link form (email only)
  const emailInput = page.locator('input[type="email"], input[name="email"]#sign-in-email, input[id="sign-in-email"]').first();
  
  if (await emailInput.isVisible({ timeout: 5000 })) {
    // Magic link form - we can't use this in tests without email access
    console.warn('Magic link form detected - tests should use API authentication');
    throw new Error('Magic link authentication not supported in automated tests. Use API login.');
  }
  
  // Traditional password form (fallback)
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();
  
  if (await passwordInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);
    await submitButton.click();
    
    const possibleUrls = ['/account', '/vendor', '/admin', '/rider'];
    let redirected = false;
    for (const url of possibleUrls) {
      try {
        await page.waitForURL(new RegExp(url), { timeout: 15000 });
        redirected = true;
        break;
      } catch {}
    }
    
    if (!redirected) {
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error(`Login failed for ${role} - still on login page`);
      }
    }
  } else {
    throw new Error('No recognized login form found');
  }
  
  await page.waitForTimeout(1000);
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
    
    const data = await response.json();
    if (data.success && data.data.session) {
      await page.context().addCookies([
        { name: 'sb-access-token', value: data.data.session.access_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
        { name: 'sb-refresh-token', value: data.data.session.refresh_token, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      ]);
      
      await page.goto('/account', { waitUntil: 'networkidle', timeout: 30000 });
      return;
    }
  } catch (e) {
    console.warn('API signup failed, falling back to web form');
  }
  
  // Fallback to web form (if available)
  await page.goto('/login', { waitUntil: 'networkidle' });
  
  const signupLink = page.locator('a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")').first();
  if (await signupLink.isVisible({ timeout: 5000 })) {
    await signupLink.click();
  } else {
    await page.goto('/signup', { waitUntil: 'networkidle' }).catch(() => {});
  }
  
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);
  await page.fill('input[name="fullName"]', `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`);
  await page.fill('input[name="phone"]', '9800000000');
  await page.click('button[type="submit"]');
  
  await page.waitForURL(/\/account|\/vendor|\/admin|\/rider/, { timeout: 60000 });
  await page.waitForTimeout(1000);
}

export async function waitForToast(page: Page, text: string, timeout = 15000) {
  try {
    await expect(page.locator(`[role="status"]:has-text("${text}"), [role="alert"]:has-text("${text}"), .toast:has-text("${text}")`))
      .toBeVisible({ timeout });
    return true;
  } catch {
    return false;
  }
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
    try {
      await input.waitFor({ state: 'visible', timeout: 5000 });
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await input.selectOption(value);
      } else {
        await input.fill(value);
      }
    } catch {
      console.warn(`Could not fill field: ${name}`);
    }
  }
}

export async function expectSuccessToast(page: Page, message: string) {
  await expect(page.locator('.toast-success, [role="status"]').filter({ hasText: message })).toBeVisible({ timeout: 15000 });
}

export async function expectErrorToast(page: Page, message: string) {
  await expect(page.locator('.toast-error, [role="alert"]').filter({ hasText: message })).toBeVisible({ timeout: 15000 });
}

export async function safeClick(page: Page, selector: string, timeout = 10000) {
  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout });
    await locator.click({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function safeFill(page: Page, selector: string, value: string, timeout = 10000) {
  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout });
    await locator.fill(value);
    return true;
  } catch {
    return false;
  }
}

export const VENDOR_ORDER_STATUSES = [
  'pending', 'confirmed', 'preparing', 'ready_for_pickup',
  'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'
] as const;

export const RIDER_DELIVERY_STATUSES = [
  'offered', 'accepted', 'declined', 'picked_up', 'delivered', 'cancelled'
] as const;

export function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
}
