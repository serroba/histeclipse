/** Real bar/CSS and native touch events, without application or globe startup. */
import { collectProblems, expect, test } from './support';
import { press, swipe } from './touch';

test('the mounted sheet follows a finger and settles after slow drags and flicks @mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout');
  test.skip(
    process.env['BASE_URL'] !== undefined,
    'local component fixture; live wiring stays in sheet.spec.ts',
  );
  const problems = collectProblems(page);
  const applicationRequests: string[] = [];
  page.on('request', (request) => {
    if (/^\/(data|textures|models)\//.test(new URL(request.url()).pathname))
      applicationRequests.push(request.url());
  });
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const details = page.getByTestId('deep-details');
  const height = async (): Promise<number> => (await details.boundingBox())?.height ?? 0;
  let x = 0;
  let y = 0;
  await test.step('Given the ice ages on a phone, the details folded', async () => {
    await page.goto('http://127.0.0.1:4174/e2e/components/sheet.html');
    await expect(details).toBeHidden();
    await expect(page.locator('canvas')).toHaveCount(0);
    const label = await bar.getByTestId('deep-period').boundingBox();
    if (label === null) throw new Error('no label');
    x = label.x + label.width / 2;
    y = label.y + label.height / 2;
  });
  await test.step('When a finger drags the bar up a little, and holds', async () => {
    const finger = await press(page, x, y);
    await finger.move(-50);
    await test.step('Then the details have come up with it, about as far', async () => {
      await expect(details).toBeVisible();
      expect(await height()).toBeGreaterThan(30);
      expect(await height()).toBeLessThan(70);
    });
    await test.step('And let go so soon, they fold back', async () => {
      await finger.lift();
      await expect(details).toBeHidden();
    });
  });
  await test.step('When a finger drags them up most of the way, slowly, and lets go', async () => {
    const finger = await press(page, x, y);
    await finger.move(-260, 12);
    await finger.lift();
  });
  await test.step('Then they settle open', async () => {
    await expect(bar).toHaveAttribute('data-sheet', 'open');
    await expect(details).toBeVisible();
  });
  await test.step('When a quick flick goes down, not far', async () => {
    const label = await bar.getByTestId('deep-period').boundingBox();
    if (label === null) throw new Error('no label');
    await swipe(page, label.x + label.width / 2, label.y + label.height / 2, 80, 2);
  });
  await test.step('Then they fold, the way the flick went', async () => {
    await expect(bar).toHaveAttribute('data-sheet', 'folded');
  });
  expect(problems).toEqual([]);
  expect(applicationRequests).toEqual([]);
});
