import { test, expect, type Page } from '@playwright/test';

const ENABLED_TENANTS = (process.env.E2E_WORKSPACE_TENANTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ACME_EMAIL = process.env.E2E_ACME_ADMIN_EMAIL || 'admin@acme.test';
const ACME_PASSWORD = process.env.E2E_ACME_ADMIN_PASSWORD || 'Password123!';
const ACME_BASE = process.env.E2E_ACME_URL || 'http://acme.localhost:3000';

async function signIn(page: Page) {
  await page.goto(`${ACME_BASE}/login`);
  await page.fill('input[type="email"]', ACME_EMAIL);
  await page.fill('input[type="password"]', ACME_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|account-locked|settings\/billing)/, {
    timeout: 60_000,
  });
}

test.describe('Stage 11 polish', () => {
  test.skip(
    !ENABLED_TENANTS.includes('acme'),
    'E2E_WORKSPACE_TENANTS must include acme',
  );

  test('skip link is keyboard reachable and focuses main content', async ({
    page,
  }) => {
    await signIn(page);
    // Reload so the focus navigation starting point is the document body,
    // not the login submit button that disappeared after the redirect.
    await page.goto(`${ACME_BASE}/dashboard`);

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /Skip to main content/i });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('theme toggle is labelled, applies dark tokens and persists', async ({
    page,
  }) => {
    await signIn(page);

    const toggle = page.getByRole('button', { name: /Switch to (dark|light) mode/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', /true|false/);

    const initiallyDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(
      initiallyDark ? /^(?!.*\bdark\b)/ : /\bdark\b/,
    );

    const colorScheme = await page.evaluate(() =>
      getComputedStyle(document.documentElement).colorScheme,
    );
    expect(colorScheme).toBe(initiallyDark ? 'light' : 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveClass(
      initiallyDark ? /^(?!.*\bdark\b)/ : /\bdark\b/,
    );
  });

  test('sidebar view toggle exposes pressed state', async ({ page }) => {
    await signIn(page);

    const executive = page.getByRole('button', { name: 'executive' });
    const operator = page.getByRole('button', { name: 'operator' });
    await expect(executive).toHaveAttribute('aria-pressed', /true|false/);
    await expect(operator).toHaveAttribute('aria-pressed', /true|false/);

    await operator.click();
    await expect(operator).toHaveAttribute('aria-pressed', 'true');
  });
});
