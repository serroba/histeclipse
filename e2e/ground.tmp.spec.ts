import { expect, test } from '@playwright/test';

for (const [id, t] of [['lovell', '2026'], ['arecibo', '1990'], ['keck', '2026'], ['vla', '2026']] as const) {
  test(`at ${id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`./?layers=telescopes&t=${t}-06-01T18:00Z&craft=${id}`);
    const globe = page.getByTestId('globe');
    await expect(globe).toHaveAttribute('data-ground-model', id, { timeout: 30_000 });
    await expect(globe).toHaveAttribute('data-framed', `craft:${id}`, { timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/private/tmp/claude-501/-Users-sebastian-projects-histeclipse/30aa3b22-f357-4993-92bc-61e13ea80830/scratchpad/shots/ground-${id}.png` });
    expect(errors).toEqual([]);
  });
}
