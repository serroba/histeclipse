/**
 * Feature: Why this? Everything on screen can say where it comes from: a book beside it opens
 * what it shows, its sources with their kind, links and licences, and how the site used them;
 * the Sources list names what is on screen now.
 */

import {
  collectProblems,
  expect,
  globeRendered,
  openLayers,
  openSources,
  showDeepDetails,
  test,
} from './support';

test('the Sources list names what is on screen now, and each book opens why @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const list = page.getByTestId('sources-list');
  const sheet = page.getByRole('dialog', { name: 'Ways of life' });
  await test.step('Given 500 BCE with states and ways of life on', async () => {
    await page.goto('./?t=-499-06-01T12:00&layers=lunar,solar,empires,ways');
    await globeRendered(page);
  });
  await test.step('When they open Sources', async () => {
    await openSources(page);
  });
  await test.step('Then it lists the ground, the sky’s bodies and each layer drawn', async () => {
    await expect(list.locator('.why-row-title')).toHaveText([
      'Earth today',
      'Sun, Moon and planets',
      'States and empires (Cliopatria)',
      'Ways of life',
    ]);
  });
  await test.step('When they ask why the ways of life are there', async () => {
    await list.getByRole('button', { name: 'Why: Ways of life' }).click();
  });
  await test.step('Then the panel says what it shows, its source and licence, and how it was used', async () => {
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('How people lived in each region');
    const link = sheet.getByRole('link', { name: 'ArchaeoGLOBE', exact: true });
    await expect(link).toHaveAttribute('href', 'https://doi.org/10.1126/science.aax1192');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(sheet.locator('.why-licence')).toHaveText('CC0 1.0');
    await expect(sheet).toContainText('How this site used it');
  });
  await test.step('When they ask for all the sources', async () => {
    await sheet.getByRole('button', { name: 'All sources the site uses' }).click();
  });
  await test.step('Then every source is listed by kind', async () => {
    const all = page.getByRole('dialog', { name: 'All sources' });
    await expect(all.getByRole('heading', { name: 'Papers' })).toBeVisible();
    await expect(all.getByRole('heading', { name: 'Datasets' })).toBeVisible();
    await expect(all.locator('.why-source')).not.toHaveCount(0);
    expect(await all.locator('.why-source').count()).toBeGreaterThan(30);
  });
  expect(problems).toEqual([]);
});

test('every layer in the panel has its book, and non-commercial terms are flagged', async ({
  page,
}) => {
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await test.step('Given the Layers panel open', async () => {
    await page.goto('./?t=1815-04-10T12:00');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then each layer row has a book', async () => {
    const rows = await panel.locator('.layer-item').count();
    await expect(panel.locator('.layer-item .why-mark')).toHaveCount(rows);
  });
  await test.step('When they ask why the volcanic eruptions are there', async () => {
    await panel.getByRole('button', { name: 'Why: Volcanic eruptions' }).click();
  });
  await test.step('Then the source’s non-commercial terms stand out', async () => {
    const sheet = page.getByRole('dialog', { name: 'Volcanic eruptions' });
    await expect(
      sheet.getByRole('link', { name: 'Global Volcanism Program', exact: true }),
    ).toBeVisible();
    await expect(sheet.locator('.why-licence.is-nc')).toHaveText('Non-commercial use with credit');
  });
});

test('in deep time, the Sources list follows the span and the layers drawn there', async ({
  page,
}) => {
  const list = page.getByTestId('sources-list');
  await test.step('Given 250 million years ago with temperature on, and states left on', async () => {
    await page.goto('./?ma=250&scale=all&layers=temperature,empires');
    await globeRendered(page);
    await openSources(page);
  });
  await test.step('Then it names the Earth then and the temperature, not the resting states', async () => {
    await expect(list.locator('.why-row-title')).toHaveText([
      'The Earth then',
      'How do we know what Earth looked like?',
      'Temperature',
    ]);
    await expect(list.getByRole('link', { name: 'PALEOMAP PaleoDEMs', exact: true })).toBeVisible();
  });
});

test('the numbers say where they come from: ΔT and an eclipse’s figures', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given the eclipse of Thales', async () => {
    await page.goto('./?t=-584-05-28T14:26&sel=solar:-0584-05-28');
    await globeRendered(page);
  });
  await test.step('When they ask why ΔT is what it is', async () => {
    await page.getByRole('button', { name: 'Why: ΔT' }).click();
  });
  await test.step('Then the papers behind it, and its uncertainty, are named', async () => {
    const sheet = page.getByRole('dialog', { name: 'ΔT' });
    await expect(
      sheet.getByRole('link', { name: 'Morrison et al. 2021', exact: true }),
    ).toHaveAttribute('href', 'https://doi.org/10.1098/rspa.2020.0776');
    await expect(
      sheet.getByRole('link', { name: 'Morrison & Stephenson 2004', exact: true }),
    ).toBeVisible();
    await expect(sheet).toContainText('standard error');
    await sheet.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('When they ask why the eclipse card says what it says', async () => {
    await page.locator('.eclipse-card').getByRole('button', { name: 'Why: Eclipse' }).click();
  });
  await test.step('Then the ephemeris and the computation are named', async () => {
    const sheet = page.getByRole('dialog', { name: 'Eclipses' });
    await expect(sheet.getByRole('link', { name: 'JPL DE441', exact: true })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Skyfield', exact: true })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('deep time’s notes and facts each have their book', async ({ page }) => {
  await test.step('Given 250 million years ago with temperature on, details open', async () => {
    await page.goto('./?ma=250&scale=all&layers=temperature');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('Then the temperature’s book opens both models', async () => {
    await page.getByRole('button', { name: 'Why: Temperature' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Temperature' });
    await expect(sheet.getByRole('link', { name: 'Scotese 2022', exact: true })).toBeVisible();
    await expect(
      sheet.getByRole('link', { name: 'CESM, Li et al. 2023', exact: true }),
    ).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('And the Earth facts’ book opens the papers they cite', async () => {
    await page
      .getByRole('button', { name: 'Why: Poles, magnetic field, tilt, day and Sun' })
      .click();
    const sheet = page.getByRole('dialog', { name: 'Poles, magnetic field, tilt, day and Sun' });
    await expect(sheet.getByRole('link', { name: 'Wells 1963', exact: true })).toBeVisible();
    await expect(
      sheet.getByRole('link', { name: 'Laskar et al. 2004', exact: true }),
    ).toBeVisible();
  });
});

test('in deep time, the map says how we know what Earth looked like', async ({ page }) => {
  const problems = collectProblems(page);
  const sheet = page.getByRole('dialog', { name: 'How do we know what Earth looked like?' });
  await test.step('Given the Carboniferous, 359 million years ago', async () => {
    await page.goto('./?ma=358.9&scale=all');
    await globeRendered(page);
  });
  await test.step('When they ask how we know', async () => {
    await page.getByRole('button', { name: 'How do we know?' }).click();
  });
  await test.step('Then the evidence is named, each with its paper, and how sure each part is', async () => {
    await expect(sheet).toContainText('a reconstruction');
    await expect(sheet.locator('.why-evidence li')).toHaveCount(5);
    await expect(sheet.locator('.why-evidence')).toContainText('Rock magnetism');
    await expect(
      sheet.getByRole('link', { name: 'Torsvik et al. 2012', exact: true }).first(),
    ).toHaveAttribute('href', 'https://doi.org/10.1016/j.earscirev.2012.06.007');
    await expect(sheet.locator('.why-certainty li')).toHaveCount(3);
    await expect(sheet).toContainText('Illustrative: mountain heights');
  });
  await test.step('And other reconstructions and a reading path are offered', async () => {
    await expect(sheet).toContainText('turn on Plates');
    await expect(sheet.locator('.why-reading li').first()).toContainText(
      'Earth History and Palaeogeography',
    );
  });
  await test.step('And in the ice ages, on today’s land, the chip is not offered', async () => {
    await page.goto('./?ma=0.021&scale=ice');
    await globeRendered(page);
    await expect(page.getByRole('button', { name: 'How do we know?' })).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('a source can be cited, and a why shared by its link @acceptance', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'desktop-120hz', 'not about frames');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const sheet = page.getByRole('dialog', { name: 'Ways of life' });
  await test.step('Given a link to why the ways of life are shown', async () => {
    await page.goto('./?t=-499-06-01T12:00&layers=lunar,solar,ways&why=ways');
    await globeRendered(page);
  });
  await test.step('Then the panel opens on it', async () => {
    await expect(sheet).toBeVisible();
  });
  await test.step('When they copy ArchaeoGLOBE’s reference', async () => {
    await sheet.getByRole('button', { name: 'Copy the reference to ArchaeoGLOBE' }).click();
  });
  await test.step('Then the full reference, its link and licence are on the clipboard', async () => {
    await expect(
      sheet.getByRole('button', { name: 'Copy the reference to ArchaeoGLOBE' }),
    ).toHaveText('Copied');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('ArchaeoGLOBE Project (2019)');
    expect(copied).toContain('https://doi.org/10.1126/science.aax1192');
    expect(copied).toContain('Licence: CC0 1.0');
  });
  await test.step('And its BibTeX comes from Crossref', async () => {
    await expect(
      sheet.getByRole('link', { name: 'BibTeX for ArchaeoGLOBE, from Crossref', exact: true }),
    ).toHaveAttribute(
      'href',
      'https://api.crossref.org/works/10.1126/science.aax1192/transform/application/x-bibtex',
    );
  });
  await test.step('When they copy a link to this', async () => {
    await sheet.getByRole('button', { name: 'Copy a link to this' }).click();
  });
  await test.step('Then the link opens this why again', async () => {
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/[?&]why=ways(&|$)/);
  });
  await test.step('When they close the panel, the link lets go of it', async () => {
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/why=/);
  });
});

test('why here: each layer says what it has at a place, and where that comes from', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const here = page.getByRole('dialog', { name: /^Here: / });
  await test.step('Given a link to a place in Persia in 500 BCE, with states and ways of life on', async () => {
    await page.goto('./?t=-499-06-01T12:00&loc=32.5,51.7&layers=lunar,solar,empires,ways&why=here');
    await globeRendered(page);
  });
  await test.step('Then "Here" names the state drawn there, its page, and the way of life rated', async () => {
    await expect(here).toHaveAccessibleName('Here: 32.5°N 51.7°E');
    await expect(here).toContainText('Cliopatria draws Achaemenid Empire here in 500 BCE.');
    await expect(
      here.getByRole('link', { name: 'Achaemenid Empire on Wikipedia' }),
    ).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Achaemenid_Empire');
    await expect(here).toContainText('as archaeologists rated it for');
  });
  await test.step('When they ask where the state comes from', async () => {
    await here.getByRole('button', { name: 'Why: States' }).click();
  });
  await test.step('Then its source opens', async () => {
    await expect(
      page.getByRole('dialog', { name: 'States and empires (Cliopatria)' }),
    ).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('"Why here?" on the rail asks for a tap, and a tap says what is there', async ({ page }) => {
  const rail = page.getByRole('group', { name: 'Zoom' });
  await test.step('Given 500 BCE with states on, and no place picked', async () => {
    await page.goto('./?t=-499-06-01T12:00&layers=lunar,solar,empires&cam=50,32,3');
    await globeRendered(page);
  });
  await test.step('When they turn on "Why here?"', async () => {
    await rail.getByRole('button', { name: 'Why here?' }).click();
  });
  await test.step('Then it asks for a place', async () => {
    await expect(rail.getByRole('button', { name: 'Why here?' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('dialog', { name: 'Why here?' })).toContainText('Tap the globe');
  });
  await test.step('When they tap the globe', async () => {
    const box = await page.getByTestId('globe').boundingBox();
    const hud = await page.locator('.hud').boundingBox();
    const bottom = await page.locator('.bottom').boundingBox();
    if (box === null || hud === null || bottom === null) throw new Error('no layout');
    await page.mouse.click(box.x + box.width * 0.45, (hud.y + hud.height + bottom.y) / 2);
  });
  await test.step('Then "Here" says what the states layer has at that place', async () => {
    const here = page.getByRole('dialog', { name: /^Here: / });
    await expect(here).toBeVisible();
    await expect(here).toContainText(/Cliopatria draws/);
    await expect(page).toHaveURL(/why=here/);
    await expect(page).toHaveURL(/loc=/);
  });
});

test('"How do we know?" speaks of the period shown, and changes with it', async ({ page }) => {
  const sheet = page.getByRole('dialog', { name: 'How do we know what Earth looked like?' });
  await test.step('Given the Carboniferous, with "How do we know?" open from its link', async () => {
    await page.goto('./?ma=320&scale=all&why=deep-evidence');
    await globeRendered(page);
  });
  await test.step('Then it names the period, what the map shows, and its evidence and papers', async () => {
    await expect(sheet.getByRole('heading', { name: 'Then: the Carboniferous' })).toBeVisible();
    await expect(sheet).toContainText('Pangaea is gathering');
    await expect(sheet).toContainText('late Palaeozoic ice age');
    await expect(
      sheet
        .locator('.why-then-sources')
        .getByRole('link', { name: 'Montañez & Poulsen 2013', exact: true }),
    ).toHaveAttribute('href', 'https://doi.org/10.1146/annurev.earth.031208.100118');
  });
  await test.step('When the moment moves into the Triassic', async () => {
    await page.getByRole('slider', { name: 'Millions of years ago' }).fill('-240');
  });
  await test.step('Then the panel speaks of the Triassic', async () => {
    await expect(sheet.getByRole('heading', { name: 'Then: the Triassic' })).toBeVisible();
    await expect(sheet).toContainText('Lystrosaurus');
  });
});

test('on the 4.6 Gyr span, "How do we know?" says what each eon’s globe rests on', async ({
  page,
}) => {
  const sheet = page.getByRole('dialog', { name: 'How do we know what Earth looked like?' });
  await test.step('Given 2.4 billion years ago, with "How do we know?" open', async () => {
    await page.goto('./?ma=2400&scale=eons&why=deep-evidence');
    await globeRendered(page);
  });
  await test.step('Then it names the Siderian, says the globe is a sketch, and gives its evidence', async () => {
    await expect(sheet.getByRole('heading', { name: 'Then: the Siderian' })).toBeVisible();
    await expect(sheet).toContainText('sketches what competing hypotheses say');
    await expect(sheet).toContainText('Great Oxidation Event');
    await expect(
      sheet
        .locator('.why-then-sources')
        .getByRole('link', { name: 'Farquhar, Bao & Thiemens 2000', exact: true }),
    ).toHaveAttribute('href', 'https://doi.org/10.1126/science.289.5480.756');
  });
  await test.step('When the moment moves to the Hadean', async () => {
    await page.goto('./?ma=4400&scale=eons&why=deep-evidence');
    await globeRendered(page);
  });
  await test.step('Then it speaks of the oldest zircons', async () => {
    await expect(sheet.getByRole('heading', { name: 'Then: the Hadean' })).toBeVisible();
    await expect(sheet).toContainText('Jack Hills');
  });
});
