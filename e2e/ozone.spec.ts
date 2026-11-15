/** The ozone hole (#722): each spring's hole on the globe, and the record beside it. */

import { collectProblems, expect, globeRendered, test } from './support';

test('the ozone hole shows each spring on the globe, with its record beside it, and says when a year is missing @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const panel = page.getByRole('region', { name: 'The ozone hole and the gases' });
  await test.step('Given the spring of 2006 with the ozone hole on', async () => {
    await page.goto('./?t=2006-10-01T12:00Z&layers=ozone&cam=-70,40,3');
    await globeRendered(page);
  });
  await test.step('Then its cap is drawn at its area, and the record is beside the globe', async () => {
    await expect(globe).toHaveAttribute('data-ozone', '26.6');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('NASA Ozone Watch');
  });
  await test.step('When they go to 1995, Then nothing is drawn: no satellite measured it', async () => {
    await page.locator('.hud-date-button').click();
    await page.getByRole('textbox', { name: 'A year or an age' }).fill('1995');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(globe).toHaveAttribute('data-ozone', 'off');
  });
  await test.step('Then its chip says so in words, and takes them to the next year measured (#751)', async () => {
    const phone = (page.viewportSize()?.width ?? 1000) < 600;
    if (phone) await page.getByRole('button', { name: 'Layers' }).click();
    const chip = page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="ozone"]');
    await expect(chip).toHaveAttribute('data-coverage', 'gap');
    await expect(chip).toContainText('none in 1995 CE');
    await chip.getByRole('button', { name: /go to 1996 CE/ }).click();
    await expect(globe).not.toHaveAttribute('data-ozone', 'off');
  });
  expect(problems).toEqual([]);
});
