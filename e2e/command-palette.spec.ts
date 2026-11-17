import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

const ENABLED_TENANTS = (process.env.E2E_WORKSPACE_TENANTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ACME_EMAIL = process.env.E2E_ACME_ADMIN_EMAIL || 'admin@acme.test';
const ACME_PASSWORD = process.env.E2E_ACME_ADMIN_PASSWORD || 'Password123!';
const ACME_BASE = process.env.E2E_ACME_URL || 'http://acme.localhost:3000';

function isKnownNoise(text: string): boolean {
  if (/download the react devtools/i.test(text)) return true;
  if (/failed to load resource/i.test(text) && /favicon|\.ico/i.test(text)) {
    return true;
  }
  // The provider aborts the stream when the route unmounts or the page
  // navigates; Chromium reports the cancellation as a network error.
  return (
    /failed to load resource/i.test(text) &&
    /notifications\/stream/i.test(text)
  );
}

function attachConsoleGuards(page: Page, errors: string[]) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isKnownNoise(text)) return;
    const location = msg.location().url;
    errors.push(
      `console.error: ${text}${location ? ` @ ${location}` : ''}`,
    );
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

test.describe('Command palette and notifications', () => {
  test.skip(
    !ENABLED_TENANTS.includes('acme'),
    'E2E_WORKSPACE_TENANTS not set (e.g. acme)',
  );

  test('desktop: palette searches, navigates and the bell opens', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    attachConsoleGuards(page, errors);

    await signIn(page);

    // Clicking the header trigger proves React has hydrated before the
    // keyboard shortcut is exercised; it also covers the desktop button.
    const trigger = page.locator(
      'header button[aria-label="Open command palette"]:visible',
    );
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();

    const input = page.getByTestId('command-palette-input');
    // The backend search is tenant-scoped across several modules; on a cold
    // dev server it can take a few seconds. Wait for the response itself
    // rather than a fixed text deadline, then target the option by role so a
    // re-render cannot swap the result under a bare text locator.
    const searchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/workspace/search') &&
        response.status() === 200,
      { timeout: 30_000 },
    );
    await input.fill('chloe');
    await searchResponse;
    const vendorResult = dialog
      .getByRole('option')
      .filter({ hasText: 'Chloe Dubois' })
      .first();
    await expect(vendorResult).toBeVisible({ timeout: 30_000 });
    await vendorResult.click();
    await expect(page).toHaveURL(
      /\/dept\/administration\/vendor-management\?open=/,
      { timeout: 30_000 },
    );
    await expect(dialog).toBeHidden();

    // The bell is present in the shell and opens a labelled dialog.
    const bell = page.getByRole('button', { name: /Notifications/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(
      page.getByRole('dialog', { name: 'Notifications' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('dialog', { name: 'Notifications' }),
    ).toBeHidden();

    // Notification history and per-type preferences render.
    await page.goto(`${ACME_BASE}/account/notifications`);
    await expect(
      page.getByRole('heading', { name: 'Notifications' }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Delivery preferences')).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: /email notifications/i }).first(),
    ).toBeVisible();

    expect(errors, `Console/page errors: ${errors.join('\n')}`).toEqual([]);
    await context.close();
  });

  test('mobile: palette fits the viewport, closes with Escape and keeps the bell', async ({
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

    await signIn(page);

    // The mobile shell hides the desktop search button; open the palette with
    // the keyboard shortcut instead (see the Stage 9 responsive shell). Wait
    // for hydration so the document keydown listener is attached.
    await expect(
      page.locator('header button[aria-label="Notifications"]:visible').first(),
    ).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');

    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();

    // cmdk's Radix dialog animates into place, so the first bounding box can
    // be a mid-animation frame. Poll until the final geometry settles within
    // the 390px mobile viewport instead of measuring a transient frame.
    await expect
      .poll(
        async () => {
          const box = await dialog.boundingBox();
          if (!box) return Number.POSITIVE_INFINITY;
          return Math.max(0, -box.x, box.width - 390, box.x + box.width - 390);
        },
        {
          timeout: 5_000,
          message: 'command palette fits the 390px mobile viewport',
        },
      )
      .toBe(0);

    const input = page.getByTestId('command-palette-input');
    await input.fill('piper');
    await expect(page.getByText('Pied Piper proof of concept').first()).toBeVisible(
      { timeout: 15_000 },
    );

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await expect(
      page.locator('header button[aria-label*="Notifications"]:visible'),
    ).toHaveCount(1);

    expect(errors, `Console/page errors: ${errors.join('\n')}`).toEqual([]);
    await context.close();
  });
});
