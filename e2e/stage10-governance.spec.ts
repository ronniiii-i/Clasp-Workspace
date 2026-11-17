import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

const ENABLED_TENANTS = (process.env.E2E_WORKSPACE_TENANTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ACME_EMAIL = process.env.E2E_ACME_ADMIN_EMAIL || 'admin@acme.test';
const ACME_PASSWORD = process.env.E2E_ACME_ADMIN_PASSWORD || 'Password123!';
const ACME_BASE = process.env.E2E_ACME_URL || 'http://acme.localhost:3000';

function attachConsoleGuards(page: Page, errors: string[]) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/download the react devtools/i.test(text)) return;
    if (/failed to load resource/i.test(text) && /favicon|\.ico/i.test(text)) {
      return;
    }
    errors.push(`console.error: ${text}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message || String(err)}`);
  });
}

async function signIn(page: Page) {
  await page.goto(`${ACME_BASE}/login`);
  await page.fill('input[type="email"]', ACME_EMAIL);
  await page.fill('input[type="password"]', ACME_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|account-locked|settings\/billing)/, {
    timeout: 60_000,
  });
}

test.describe('Stage 10 governance surfaces', () => {
  test.skip(
    !ENABLED_TENANTS.includes('acme'),
    'E2E_WORKSPACE_TENANTS must include acme',
  );

  test('admin: audit log, department detail and trash render without errors', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    attachConsoleGuards(page, errors);

    await signIn(page);
    await expect(page).not.toHaveURL(/\/login/);

    // The audit log is un-deferred and reachable from the sidebar.
    await expect(page.getByRole('link', { name: /Audit Log/i })).toBeVisible();
    await page.goto(`${ACME_BASE}/audit-log`);
    await expect(
      page.getByRole('heading', { name: /Audit Log/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    // `audit_logs` is exportable, so the toolbar exposes the CSV control.
    await expect(
      page.getByRole('button', { name: /Export CSV/i }),
    ).toBeVisible();

    // Department overview links into a real detail page with ACL modules.
    await page.goto(`${ACME_BASE}/departments`);
    await expect(
      page.getByRole('heading', { name: /Department Overviews/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /^Open$/ }).first().click();
    await expect(page).toHaveURL(/\/departments\/[^/]+$/, { timeout: 20_000 });
    await expect(
      page.getByRole('heading', { name: /Provisioned Modules/i }),
    ).toBeVisible();

    // Trash recovery lives under settings and lists all soft-delete entities.
    await page.goto(`${ACME_BASE}/settings/trash`);
    await expect(
      page.getByRole('heading', { name: /^Trash$/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('region', { name: /Trash/i })).toBeVisible();

    expect(errors, `Console/page errors: ${errors.join('\n')}`).toEqual([]);
    await context.close();
  });
});
