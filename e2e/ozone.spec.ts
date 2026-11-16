/**
 * The ozone hole (#722): each October's ozone over the whole Earth on the globe, the hole an
 * opening in it, and the record beside it.
 */

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
  await test.step('Then that October’s map is drawn, with the key to its colours and the record beside the globe', async () => {
    await expect(globe).toHaveAttribute('data-ozone', 'map:2006');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('NASA Ozone Watch');
    await expect(panel).toContainText('Globe: ozone in October 2006, Dobson units.');
    await expect(panel).toContainText('Under 220: the hole, left open');
    await expect(panel).toContainText('MSR-2 reanalysis (KNMI)');
  });
  await test.step('When they go to 1977, Then nothing is drawn: the early instrument saw too little', async () => {
    await page.locator('.hud-date-button').click();
    await page.getByRole('textbox', { name: 'A year or an age' }).fill('1977');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(globe).toHaveAttribute('data-ozone', 'off');
  });
  await test.step('Then its chip says so in words, and takes them to the next year measured (#751)', async () => {
    const phone = (page.viewportSize()?.width ?? 1000) < 600;
    if (phone) await page.getByRole('button', { name: 'Layers' }).click();
    const chip = page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="ozone"]');
    await expect(chip).toHaveAttribute('data-coverage', 'gap');
    await expect(chip).toContainText('none in 1977 CE');
    await chip.getByRole('button', { name: /go to 1979 CE/ }).click();
    await expect(globe).not.toHaveAttribute('data-ozone', 'off');
  });
  expect(problems).toEqual([]);
});

test('when the ozone record does not load, its chip says so, and Try again draws it (#751) @mobile', async ({
  page,
}) => {
  const globe = page.getByTestId('globe');
  let fail = true;
  await page.route('**/data/ozone/history.json', (route) =>
    fail ? route.fulfill({ status: 503, body: 'down' }) : route.fallback(),
  );
  await test.step('Given the spring of 2006 with the ozone hole on, and its record unreachable', async () => {
    await page.goto('./?t=2006-10-01T12:00Z&layers=ozone&cam=-70,40,3');
    await globeRendered(page);
  });
  const phone = (page.viewportSize()?.width ?? 1000) < 600;
  if (phone) await page.getByRole('button', { name: 'Layers' }).click();
  const chip = page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="ozone"]');
  await test.step('Then its chip says it could not load, in words', async () => {
    await expect(chip).toHaveAttribute('data-coverage', 'failed');
    await expect(chip).toContainText('could not load');
  });
  await test.step('When the record is back and they try again, Then the ozone is drawn', async () => {
    fail = false;
    await chip.getByRole('button', { name: /try again/ }).click();
    await expect(globe).toHaveAttribute('data-ozone', 'map:2006');
    await expect(chip).toHaveAttribute('data-coverage', 'available');
  });
});
