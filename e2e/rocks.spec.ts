/**
 * Feature: Rocks at the surface. Today's rocks by how old they are, from Macrostrat; pick a
 * place to see its rock, then go to deep time to see the Earth when it formed.
 */

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

test('the rock at the place picked says when it formed, and goes there in deep time @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const note = page.getByTestId('layer-note-rocks');
  await test.step('Given a place picked in northern Canada', async () => {
    await page.goto('./?t=2024-04-08T18:17&loc=60,-100');
    await globeRendered(page);
  });
  await test.step('When they turn on Rocks at the surface', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Rocks at the surface' }).check();
  });
  await test.step('Then the rocks are shaded, and the note names the rock and its age', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*rocks/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-rocks', 'on');
    await expect(note).toHaveText(
      /^At the place picked: Paleoproterozoic .*, formed [\d,.]+–[\d,.]+ million years ago\.$/,
    );
    await openSources(page);
    await expect(page.getByRole('link', { name: 'Macrostrat' })).toBeVisible();
  });
  await test.step('When they go to see the Earth as it was then', async () => {
    await openLayers(page);
    await page.getByRole('button', { name: /^See the Earth as it was then, / }).click();
  });
  await test.step('Then deep time opens at the rock’s age, on the span that reaches it', async () => {
    await expect(page).toHaveURL(/[?&]ma=\d+/);
    await expect(page).toHaveURL(/scale=eons/);
    await expect(page.locator('.hud-date')).toHaveText(/million years ago$/);
  });
  expect(problems).toEqual([]);
});
