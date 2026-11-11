# Hardware Online Pasal - Automated Testing Suite

This project includes a comprehensive Playwright test suite for testing Vendor, Admin, and Rider functionality.

## 📁 Test Structure

```
tests/
├── auth-setup.ts              # Authentication setup for all roles
├── global-setup.ts            # Global test setup
├── global-teardown.ts         # Global test teardown
├── utils/
│   └── test-helpers.ts        # Shared test utilities
├── page-objects/
│   ├── VendorDashboard.ts     # Vendor page object
│   ├── AdminDashboard.ts      # Admin page objects (Dashboard, Shops, Orders, Riders, Payments)
│   ├── RiderDashboard.ts      # Rider page objects
│   └── CustomerPages.ts       # Customer page objects (Home, Product, Cart, Checkout, Orders)
└── specs/
    ├── vendor.spec.ts         # Vendor tests
    ├── admin.spec.ts          # Admin tests
    ├── rider.spec.ts          # Rider tests
    ├── customer.spec.ts       # Customer tests
    └── end-to-end.spec.ts     # Cross-role E2E tests
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /Users/sijansigdel/Documents/Codex/OHP/OHP
npm install
npm run test:install        # Install Playwright browsers
npm run test:install-deps   # Install system dependencies (Linux only)
```

### 2. Start Development Server

```bash
npm run dev
# Server runs at http://localhost:3000
```

### 3. Run Tests

```bash
# Run all tests
npm test

# Run specific role tests
npm run test:vendor
npm run test:admin
npm run test:rider
npm run test:customer

# Run E2E flow tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:ui

# Run headed (see browser)
npm run test:headed

# Debug specific test
npm run test:debug tests/specs/vendor.spec.ts

# View HTML report
npm run test:report
```

## 👥 Test Accounts

Create these test users in Supabase Auth or via signup flow:

| Role | Email | Password |
|------|-------|----------|
| Customer | `customer@test.com` | `TestPass123!` |
| Vendor | `vendor@test.com` | `TestPass123!` |
| Admin | `admin@test.com` | `TestPass123!` |
| Rider | `rider@test.com` | `TestPass123!` |

### Admin Setup

After creating the admin user, run in Supabase SQL Editor:
```sql
UPDATE profiles SET role='admin' WHERE email='admin@test.com';
```

### Vendor Setup

1. Login as `vendor@test.com`
2. Go to `/vendor` and submit shop application
2. Login as `admin@test.com`
3. Go to `/admin/shops?tab=pending` and approve the shop

### Rider Setup

1. Login as `rider@test.com`
2. Go to `/rider` and submit rider application
3. Login as `admin@test.com`
4. Go to `/admin/riders?tab=pending` and approve the rider

## 🎯 Test Coverage

### Vendor Tests (`vendor.spec.ts`)
- ✅ Vendor application submission
- ✅ Dashboard loading with KPIs
- ✅ Order management (accept, reject, advance status)
- ✅ Inventory management (search catalog, submit products, edit inventory)
- ✅ New product submission
- ✅ Multi-shop switching

### Admin Tests (`admin.spec.ts`)
- ✅ Dashboard metrics and charts
- ✅ Shop management (list, filter, approve, reject, view details)
- ✅ Order management (list, filter, view, assign rider)
- ✅ Rider management (list, filter, approve, reject)
- ✅ Payments & payouts (view stats, record payouts)

### Rider Tests (`rider.spec.ts`)
- ✅ Rider application submission
- ✅ Dashboard with status pill
- ✅ Online/offline toggle
- ✅ Delivery workflow (accept, decline, pickup, deliver)
- ✅ Delivery details display
- ✅ Navigation links
- ✅ Delivery history
- ✅ Location sharing

### Customer Tests (`customer.spec.ts`)
- ✅ Homepage categories and search
- ✅ Product detail view
- ✅ Cart operations (add, update, remove)
- ✅ Checkout flow (address, payment, place order)
- ✅ Order history

### E2E Tests (`end-to-end.spec.ts`)
- ✅ Complete order flow: Customer → Vendor → Rider → Admin
- ✅ Vendor application → Admin approval → Vendor dashboard access
- ✅ Multi-role data consistency

## 🔧 Configuration

### Environment Variables

```bash
# .env.test (optional)
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### Playwright Config (`playwright.config.ts`)

Key settings:
- **Base URL**: `http://localhost:3000` (configurable via `PLAYWRIGHT_BASE_URL`)
- **Retries**: 2 in CI, 0 locally
- **Workers**: Auto (1 in CI)
- **Reporters**: HTML + List
- **Trace**: On first retry
- **Screenshots**: On failure
- **Video**: On failure

## 📊 Test Reports

After running tests:
```bash
npm run test:report
```

Reports are saved to `playwright-report/` with:
- Test results summary
- Screenshots on failure
- Traces for debugging
- Videos of failed tests

## 🐛 Debugging Tests

### Run Single Test in Debug Mode
```bash
npx playwright test tests/specs/vendor.spec.ts -g "should accept pending order" --debug
```

### View Trace
```bash
npx playwright show-trace trace.zip
```

### Run with Console Logs
```bash
DEBUG=pw:api npx playwright test
```

## 📝 Adding New Tests

1. **Create page object** in `tests/page-objects/`
2. **Add test helpers** in `tests/utils/test-helpers.ts`
3. **Write spec** in `tests/specs/`
4. **Follow Page Object Model** pattern
5. **Use data-testid** attributes in components for stable selectors

## ⚠️ Known Limitations

1. **Geolocation tests** - Require browser permission grants
2. **Realtime tests** - Need Supabase Realtime enabled
3. **Payment tests** - COD only (no payment gateway in test)
4. **Email/SMS** - Not tested (requires external services)

## 🔗 CI/CD Integration

For GitHub Actions, add:
```yaml
- name: Run Playwright tests
  run: npm test
  env:
    PLAYWRIGHT_BASE_URL: ${{ secrets.PREVIEW_URL }}
```

## 📚 Resources

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Test Authentication](https://playwright.dev/docs/auth)
- [Supabase Testing](https://supabase.com/docs/guides/platform/testing)
