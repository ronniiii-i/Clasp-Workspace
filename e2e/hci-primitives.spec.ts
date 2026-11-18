import { test, expect, type Locator, type Page } from '@playwright/test';

const ENABLED_TENANTS = (process.env.E2E_WORKSPACE_TENANTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ACME_EMAIL = process.env.E2E_ACME_ADMIN_EMAIL || 'admin@acme.test';
const ACME_PASSWORD = process.env.E2E_ACME_ADMIN_PASSWORD || 'Password123!';
const ACME_BASE = process.env.E2E_ACME_URL || 'http://acme.localhost:3000';

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

async function signIn(page: Page) {
  await page.goto(`${ACME_BASE}/login`);
  await page.fill('input[type="email"]', ACME_EMAIL);
  await page.fill('input[type="password"]', ACME_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|account-locked|settings\/billing)/, {
    timeout: 60_000,
  });
}

/**
 * Assert that a surface shows no UUID-shaped text. The admin metadata panel is
 * intentionally excluded: it is the only surface allowed to show raw ids and
 * it stays collapsed unless a Tenant Admin opens it.
 */
async function expectNoUuidText(scope: Locator, surface: string) {
  const text = await scope.innerText();
  const matches = text.match(UUID_PATTERN) ?? [];
  expect(
    matches,
    `${surface} leaked UUID-shaped text: ${matches.join(', ')}`,
  ).toEqual([]);
}

test.describe('HCI primitives E2E', () => {
  test.skip(
    !ENABLED_TENANTS.includes('acme'),
    'E2E_WORKSPACE_TENANTS does not include acme',
  );

  test('tables and drawers never show raw ids', async ({ page }) => {
    await signIn(page);

    await page.goto(`${ACME_BASE}/dept/sales/contacts`);
    await expect(
      page.getByRole('heading', { name: /Contacts/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const main = page.locator('main');
    await expectNoUuidText(main, 'Contacts table');

    const firstRow = main.locator('[data-testid="record-row"]').first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible({ timeout: 10_000 });
      await expectNoUuidText(drawer, 'Record drawer');
      await page.keyboard.press('Escape');
    }
  });

  test('kanban cards never show raw ids', async ({ page }) => {
    await signIn(page);

    await page.goto(`${ACME_BASE}/dept/sales/sales-pipeline`);
    await expect(
      page.getByRole('region', { name: /Sales Pipeline/i }),
    ).toBeVisible({ timeout: 20_000 });

    await expectNoUuidText(page.locator('main'), 'Sales pipeline board');
  });

  test('relation selects search without exposing ids', async ({ page }) => {
    await signIn(page);

    // Project Management (tasks) has visible writable relations: Project and
    // Assignee. Contacts only exposes its owner as a read-only field.
    await page.goto(`${ACME_BASE}/dept/operations/project-management`);
    await expect(
      page.getByRole('region', { name: /Project Management/i }),
    ).toBeVisible({ timeout: 20_000 });
    const create = page.getByRole('button', { name: /New|Add|Create/i }).first();
    test.skip(
      (await create.count()) === 0,
      'No create action on Project Management',
    );

    await create.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const combobox = dialog.locator('input[role="combobox"]').first();
    test.skip((await combobox.count()) === 0, 'Form has no relation field');

    await combobox.fill('a');
    // The listbox is portalled to document.body, outside the dialog.
    const listbox = page.getByRole('listbox').first();
    await expect(listbox).toBeVisible({ timeout: 10_000 });
    await expect(listbox.getByRole('option').first()).toBeVisible({
      timeout: 10_000,
    });
    await expectNoUuidText(listbox, 'Relation select options');
  });
});
