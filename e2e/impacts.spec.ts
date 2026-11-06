/**
 * Feature: Impact craters. Craters and deposits from the Impact Earth Database, on today's Earth
 * in historical time and where they lay in deep time; each opens a card with its details.
 */

import {
  collectProblems,
  expect,
  globeRendered,
  openLayers,
  showDeepDetails,
  test,
} from './support';

test('the Impact craters layer marks craters to open, each with its details and source', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  await test.step('Given the globe in 2024', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
  });
  await test.step('When they turn on Impact craters in Layers', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Impact craters' }).check();
  });
  await test.step('Then craters are marked, with what the layer shows and its source', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*impacts/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-impacts', /^[1-9]\d{2}$/);
    await expect(page.getByTestId('layer-note-impacts')).toContainText(
      'impact craters and deposits, from the Impact Earth Database, where they are today.',
    );
  });
  await test.step('When they tap a crater', async () => {
    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.locator('.impact-mark:visible').first().click();
  });
  await test.step('Then its card gives its age as written and a link to read more', async () => {
    await expect(card).toBeVisible();
    await expect(card).toContainText('Age');
    await expect(card.getByRole('link', { name: 'Impact Earth Database' })).toHaveAttribute(
      'href',
      /^https:\/\/impact\.uwo\.ca\/impact-craters\/map\/\?crater_id=\d+$/,
    );
  });
  expect(problems).toEqual([]);
});

test('in deep time, impacts show around their time, or all that had struck by then', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const note = page.getByTestId('impacts-note');
  await test.step('Given deep time 66 million years ago', async () => {
    await page.goto('./?ma=66');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they turn on Impacts', async () => {
    await page.getByRole('button', { name: 'Impacts', exact: true }).click();
  });
  await test.step('Then the impacts of about then are marked, Chicxulub among them', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute('data-impacts', /^[1-9]\d*$/);
    await expect(note).toContainText('Impacts around 66 million years ago:');
    await expect(note).toContainText('within 2.5 million years of then');
    await expect(page.getByRole('button', { name: 'Chicxulub: details' })).toBeAttached();
    await expect(note.getByRole('link', { name: 'the Impact Earth Database' })).toBeVisible();
  });
  await test.step('When they show all that had struck by then, the older craters join them', async () => {
    const around = Number(await page.getByTestId('globe').getAttribute('data-impacts'));
    await page.getByLabel('Show impacts').selectOption('struck');
    await expect(note).toContainText('Impacts by 66 million years ago:');
    await expect(note).toContainText('more may have (their ages span this moment)');
    await expect(page.locator('.impact-mark.is-uncertain').first()).toBeAttached();
    await expect
      .poll(async () => Number(await page.getByTestId('globe').getAttribute('data-impacts')))
      .toBeGreaterThan(around);
  });
  await test.step('When they go back before the maps, the button goes', async () => {
    await page.goto('./?ma=1000&layers=impacts');
    await globeRendered(page);
    await expect(page.getByRole('button', { name: 'Impacts', exact: true })).toBeHidden();
    await expect(page.getByTestId('globe')).toHaveAttribute('data-impacts', 'off');
  });
  expect(problems).toEqual([]);
});

test('as deep time plays, the craters show as they strike, not only once it stops', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const deep = page.getByRole('navigation', { name: 'Deep time' });
  await test.step('Given 120 million years ago with Impacts on', async () => {
    await page.goto('./?ma=120&layers=impacts');
    await globeRendered(page);
  });
  await test.step('When they play deep time towards today', async () => {
    await deep.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(deep.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });
  await test.step('Then, while it plays, craters are on the globe', async () => {
    await expect(page.locator('.impact-mark:visible').first()).toBeVisible();
    await expect(deep.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });
  expect(problems).toEqual([]);
});
