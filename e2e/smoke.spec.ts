import { expect, test } from '@playwright/test';

// Commit SHA the deployment is expected to serve. Empty or unset skips the release check.
const expectedVersion = process.env['EXPECTED_VERSION'] ?? '';

test('home page renders without errors or failed requests', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      problems.push(`HTTP ${String(response.status())}: ${response.url()}`);
    }
  });

  const response = await page.goto('./');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('histeclipse');
  await expect(page.getByRole('heading', { level: 1, name: 'histeclipse' })).toBeVisible();
  await expect(page.getByText('2000 BCE to 3000 CE')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

test('page fits the viewport without horizontal scroll', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('serves the expected release', async ({ page }) => {
  test.skip(expectedVersion === '', 'EXPECTED_VERSION is not set');
  await page.goto('./');
  await expect(page.locator('meta[name="histeclipse-version"]')).toHaveAttribute(
    'content',
    expectedVersion,
  );
});
