import { test, expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

const ENABLED_TENANTS = (process.env.E2E_WORKSPACE_TENANTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ACME_EMAIL = process.env.E2E_ACME_ADMIN_EMAIL || 'admin@acme.test';
const ACME_PASSWORD = process.env.E2E_ACME_ADMIN_PASSWORD || 'Password123!';
const STAFF_EMAIL = process.env.E2E_ACME_STAFF_EMAIL || 'staff@acme.test';
const STAFF_PASSWORD = process.env.E2E_ACME_STAFF_PASSWORD || 'Password123!';
const ACME_BASE = process.env.E2E_ACME_URL || 'http://acme.localhost:3000';

function isKnownNoise(text: string, url = ''): boolean {
  if (/download the react devtools/i.test(text)) return true;
  if (/failed to load resource/i.test(text) && /favicon|\.ico/i.test(text)) {
    return true;
  }
  // The provider aborts (or rate-limits) the notification stream when the
  // route unmounts; Chrome reports the status without the URL in the text.
  return (
    /failed to load resource/i.test(text) &&
    (/notifications\/stream/i.test(text) || /notifications\/stream/i.test(url))
  );
}

function attachConsoleGuards(page: Page, errors: string[]) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isKnownNoise(text, msg.location()?.url)) return;
    errors.push(`console.error: ${text}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message || String(err)}`);
  });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${ACME_BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|account-locked|settings\/billing)/, {
    timeout: 60_000,
  });
  await expect(page.getByTestId('mobile-nav-trigger')).toBeAttached({
    timeout: 30_000,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

function cardFor(page: Page, title: string): Locator {
  return page
    .getByText(title, { exact: true })
    .first()
    .locator('xpath=ancestor::article');
}

test.describe('Responsive shell', () => {
  // Dev-mode route compilation plus SSE reconnects can push a single viewport
  // past the 90s default.
  test.describe.configure({ timeout: 180_000 });
  test.skip(
    !ENABLED_TENANTS.includes('acme'),
    'E2E_WORKSPACE_TENANTS not set (e.g. acme)',
  );

  test('mobile 390: drawer navigation, table scrolling and touch Kanban', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    attachConsoleGuards(page, errors);

    await signIn(page, STAFF_EMAIL, STAFF_PASSWORD);

    const sidebar = page.locator('#app-sidebar');
    const trigger = page.getByTestId('mobile-nav-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-controls', 'app-sidebar');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar).toHaveAttribute('data-open', 'false');
    await expectNoHorizontalOverflow(page);

    // The drawer slides in from the left, stays inside the viewport and can be
    // dismissed with Escape.
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar).toHaveAttribute('data-open', 'true');
    // The drawer animates for 200ms; wait for it to settle fully on-screen.
    await expect
      .poll(async () => (await sidebar.boundingBox())?.x ?? -999)
      .toBe(0);
    const drawerBox = await sidebar.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.width).toBeLessThanOrEqual(332);
    await expect(
      page.getByRole('button', { name: 'Close navigation' }).first(),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sidebar).toHaveAttribute('data-open', 'false');

    // Staff navigation keeps the dashboard and their modules but never admin
    // destinations.
    await trigger.click();
    await expect(
      sidebar.getByRole('link', { name: 'Dashboard', exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('link', { name: 'Settings', exact: true }),
    ).toHaveCount(0);
    await expect(
      sidebar.getByRole('link', { name: 'User Management' }),
    ).toHaveCount(0);

    // Following a route closes the drawer.
    await sidebar.getByRole('link', { name: 'Contacts' }).click();
    await page.waitForURL(/\/dept\/sales\/contacts/, { timeout: 30_000 });
    await expect(sidebar).toHaveAttribute('data-open', 'false');

    // Tables stay inside an internal horizontal scroller with a sticky
    // identifier column; optional columns fold away below `sm`.
    const tableContainer = page.locator('[data-slot="table-container"]');
    await expect(tableContainer).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('table')).toHaveClass(/min-w-\[720px\]/);
    const tableMetrics = await tableContainer.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(tableMetrics.scrollWidth).toBeGreaterThan(tableMetrics.clientWidth);

    const identifierHeader = page.getByRole('columnheader', {
      name: 'First name',
    });
    await expect(identifierHeader).toBeVisible();
    expect(
      await identifierHeader.evaluate((el) => getComputedStyle(el).position),
    ).toBe('sticky');
    await expect(
      page.getByRole('columnheader', { name: 'Status' }),
    ).toBeHidden();
    await expectNoHorizontalOverflow(page);

    // Kanban: drag is disabled on touch and each card gets an explicit Move
    // action with a radio list of columns.
    await page.goto(`${ACME_BASE}/dept/sales/sales-pipeline`);
    const region = page.getByRole('region', { name: /Sales Pipeline/i });
    await expect(region).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('Tap Move on a card to change its column.'),
    ).toBeVisible();

    const card = cardFor(page, 'Pied Piper proof of concept');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toHaveAttribute('draggable', 'false');

    const moveButton = card.getByRole('button', {
      name: /Move Pied Piper proof of concept to another column/,
    });
    await expect(moveButton).toBeVisible();
    await expect(moveButton).toHaveClass(/min-h-11/);
    await moveButton.click();

    const sheet = page.getByRole('dialog', {
      name: /Move .*Pied Piper proof of concept/,
    });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('radio').first()).toBeVisible();

    const radios = sheet.getByRole('radio');
    const radioCount = await radios.count();
    let targetLabel = '';
    let target: Locator | null = null;
    for (let index = 0; index < radioCount; index += 1) {
      const radio = radios.nth(index);
      if ((await radio.getAttribute('aria-checked')) === 'false') {
        targetLabel = (await radio.innerText()).trim();
        target = radio;
        break;
      }
    }
    expect(target).not.toBeNull();

    await target!.click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText(
      'Pied Piper proof of concept',
      { timeout: 15_000 },
    );
    await expect(
      page
        .locator(`[aria-label="${targetLabel} column"]`)
        .getByRole('heading', { name: 'Pied Piper proof of concept' }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page);

    // A long press on the card opens the same move sheet. Escape dismisses it
    // (clicking Cancel is unsafe here because Next's dev overlay sits on the
    // bottom sheet at 390px).
    await card.dispatchEvent('touchstart', { touches: [] });
    await expect(sheet).toBeVisible({ timeout: 2_000 });
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // Staff cannot reach the admin settings; the guard explains and redirects.
    // Assert the toast before the route settles: Next's dev compile can make
    // the `/dashboard` navigation slower than the toast's lifetime.
    await page.goto(`${ACME_BASE}/settings`);
    await expect(
      page
        .getByText('Settings are only available to tenant administrators.')
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Legacy `/profile` links land on the account section.
    await page.goto(`${ACME_BASE}/profile`);
    await page.waitForURL(/\/account\/profile/, { timeout: 60_000 });
    await expect(
      page.getByRole('heading', { name: 'Account settings' }),
    ).toBeVisible({ timeout: 20_000 });

    // The bottom account menu is the mobile entry point for account settings.
    await trigger.click();
    await sidebar.getByRole('button', { name: 'Account menu' }).click();
    // Radix portals the menu content to `body`, outside the sidebar.
    await page.getByRole('menuitem', { name: 'Account settings' }).click();
    await page.waitForURL(/\/account\/profile/, { timeout: 60_000 });
    await expect(sidebar).toHaveAttribute('data-open', 'false');
    await expectNoHorizontalOverflow(page);

    expect(errors, `Console/page errors: ${errors.join('\n')}`).toEqual([]);
    await context.close();
  });

  test('tablet 768: persistent sidebar, full table columns and mouse drag', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    attachConsoleGuards(page, errors);

    await signIn(page, ACME_EMAIL, ACME_PASSWORD);

    const sidebar = page.locator('#app-sidebar');
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(box!.width).toBeGreaterThanOrEqual(250);
    expect(
      await sidebar.evaluate((el) => getComputedStyle(el).position),
    ).toBe('sticky');
    await expect(page.getByTestId('mobile-nav-trigger')).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Open command palette' }),
    ).toBeVisible();

    // Tenant admins see the admin destinations (the seeded ACL lists them
    // under Workspace, so the pinned `Administration` copies are deduped).
    await expect(
      sidebar.getByRole('link', { name: 'Departments', exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('link', { name: 'User Management' }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('link', { name: 'Settings', exact: true }),
    ).toBeVisible();

    await page.goto(`${ACME_BASE}/settings`);
    await expect(
      page.getByRole('heading', { name: 'Settings', exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    const settingsNav = page.getByRole('navigation', {
      name: 'Settings sections',
    });
    for (const tab of [
      'General',
      'Departments',
      'Roles & Permissions',
      'Billing',
    ]) {
      await expect(
        settingsNav.getByRole('link', { name: tab }),
      ).toBeVisible();
    }

    // At `sm` and above the optional table columns return.
    await page.goto(`${ACME_BASE}/dept/sales/contacts`);
    await expect(
      page.getByRole('heading', { name: /Contacts/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('columnheader', { name: 'Company' }),
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Status' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Fine pointers keep native drag and drop.
    await page.goto(`${ACME_BASE}/dept/sales/sales-pipeline`);
    await expect(
      page.getByRole('region', { name: /Sales Pipeline/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(
        'Drag a card, press M, or use Ctrl/Cmd + ← / → to move it.',
      ),
    ).toBeVisible();

    const card = cardFor(page, 'Pied Piper proof of concept');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toHaveAttribute('draggable', 'true');

    const currentColumn =
      (await card.evaluate((el) =>
        el.closest('[aria-label$=" column"]')?.getAttribute('aria-label'),
      )) ?? '';
    const targetLabel = ['Lead', 'Qualified', 'Proposal', 'Negotiation'].find(
      (label) => `${label} column` !== currentColumn,
    );
    expect(targetLabel).toBeTruthy();

    await card.dragTo(page.locator(`[aria-label="${targetLabel} column"]`));
    await expect(page.locator('[data-sonner-toast]').first()).toContainText(
      'Pied Piper proof of concept',
      { timeout: 15_000 },
    );
    await expect(
      page
        .locator(`[aria-label="${targetLabel} column"]`)
        .getByRole('heading', { name: 'Pied Piper proof of concept' }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page);

    expect(errors, `Console/page errors: ${errors.join('\n')}`).toEqual([]);
    await context.close();
  });

  test('desktop 1440: sticky sidebar, independent scroll and account routing', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    attachConsoleGuards(page, errors);

    await signIn(page, ACME_EMAIL, ACME_PASSWORD);

    await expect(
      page.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(page);

    const sidebar = page.locator('#app-sidebar');
    expect(
      await sidebar.evaluate((el) => getComputedStyle(el).position),
    ).toBe('sticky');
    const initialBox = await sidebar.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(initialBox!.x).toBe(0);

    // Scrolling the content leaves the sidebar and header pinned.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    const scrolledBox = await sidebar.boundingBox();
    expect(scrolledBox).not.toBeNull();
    expect(scrolledBox!.x).toBe(0);
    expect(scrolledBox!.y).toBe(0);
    await expect(
      page.locator('header:visible').first(),
    ).toBeVisible();

    // The sidebar bottom menu exposes the account section.
    await sidebar.getByRole('button', { name: 'Account menu' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Account settings' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Notifications' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto(`${ACME_BASE}/profile`);
    await page.waitForURL(/\/account\/profile/, { timeout: 60_000 });
    await expect(
      page.getByRole('heading', { name: 'Account settings' }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('link', { name: 'Security', exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(errors, `Console/page errors: ${errors.join('\n')}`).toEqual([]);
    await context.close();
  });
});
