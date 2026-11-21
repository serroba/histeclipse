import { describe, expect, it } from 'vitest';

import routes from '../../public/data/humans/routes.json';
import {
  loadHumanRoutes,
  middleOf,
  routeCard,
  routesAt,
  unwrapPath,
  type HumanRoutes,
} from './humanRoutes';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

async function load(): Promise<HumanRoutes> {
  return loadHumanRoutes('routes.json', serve(routes));
}

describe('the routes people are argued to have taken', () => {
  it('load, each question with rival routes', async () => {
    const data = await load();
    expect(data.routes.length).toBeGreaterThan(5);
    for (const question of data.questions)
      expect(data.routes.filter((route) => route.question === question.id).length).toBeGreaterThan(
        1,
      );
  });

  it('refuse a question with one route, a span backwards, or an unlisted question', async () => {
    const [first, second] = routes.routes;
    if (first === undefined || second === undefined) throw new Error('no routes');
    const lonely = { ...routes, routes: [first] };
    await expect(loadHumanRoutes('x', serve(lonely))).rejects.toThrow();
    const backwards = { ...routes, routes: [{ ...first, fromKa: 1, toKa: 2 }, second] };
    await expect(loadHumanRoutes('x', serve(backwards))).rejects.toThrow();
    const unlisted = {
      ...routes,
      routes: [...routes.routes, { ...first, id: 'x', question: 'no' }],
    };
    await expect(loadHumanRoutes('x', serve(unlisted))).rejects.toThrow();
  });

  it('draw each route while people are said to take it, rivals in one colour, the second dashed', async () => {
    const data = await load();
    const at60 = routesAt(data, 60);
    const south = at60.find((route) => route.id === 'southern-route');
    const north = at60.find((route) => route.id === 'northern-route');
    expect(south?.label).toBe('Southern route?');
    expect(south?.citation).toBe('Macaulay et al. 2005, Science');
    expect(south?.colour).toBe(north?.colour);
    expect([south?.dashed, north?.dashed]).toEqual([false, true]);
    expect(at60.some((route) => route.id === 'pacific-coast')).toBe(false);
    // The coast and the corridor are both drawn as the corridor opens.
    const at13 = routesAt(data, 13.2).map((route) => route.id);
    expect(at13).toEqual(expect.arrayContaining(['pacific-coast', 'ice-free-corridor']));
    expect(routesAt(data, 5)).toEqual([]);
  });

  it('carry a way across the date line on, the short way round, with its name halfway', async () => {
    expect(
      unwrapPath([
        [172, 66],
        [-172, 65],
        [-160, 64],
      ]),
    ).toEqual([
      [172, 66],
      [188, 65],
      [200, 64],
    ]);
    const beringia = routesAt(await load(), 20).find((route) => route.id === 'beringia');
    expect(beringia?.middle.longitude).toBeGreaterThan(100);
    expect(beringia?.middle.longitude).toBeLessThanOrEqual(180);
  });

  it('find the middle of a way, even one that does not move, or of one point', () => {
    expect(
      middleOf([
        [0, 0],
        [10, 0],
      ]),
    ).toEqual({ latitude: 0, longitude: 5 });
    expect(
      middleOf([
        [3, 4],
        [3, 4],
      ]),
    ).toEqual({ latitude: 4, longitude: 3 });
    expect(middleOf([[3, 4]])).toEqual({ latitude: 4, longitude: 3 });
    expect(middleOf([])).toEqual({ latitude: 0, longitude: 0 });
  });

  it('give a route its card: the question, whose argument, the way, when, the evidence each side, and its rivals', async () => {
    const card = routeCard(await load(), 'ice-free-corridor');
    expect(card?.title).toBe('Ice-free corridor');
    const labels = card?.facts.map(([label]) => label) ?? [];
    expect(labels.slice(0, 4)).toEqual(['Question', 'Argued by', 'The way', 'When']);
    expect(labels.at(-1)).toBe('Other answers');
    expect(card?.facts.at(-1)?.[1]).toBe('Pacific coast (Braje et al. 2017, Science)');
    // Every study for it and against it, each with its paper.
    const against = card?.facts.filter(([label]) => label === 'Against') ?? [];
    expect(against.length).toBeGreaterThan(0);
    expect(against.every(([, text]) => /\(.+ \d{4}.*\)$/.test(text))).toBe(true);
    expect(labels).toContain('Genetic evidence');
    // Each paper linked once.
    const hrefs = card?.links.map((link) => link.href) ?? [];
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain('https://doi.org/10.1073/pnas.1601077113');
    expect(card?.note).toMatch(/^Drawn approximately/);
  });

  it('give every route at least two studies for it and one against, each a checked DOI', async () => {
    for (const route of (await load()).routes) {
      expect(route.evidence.length).toBeGreaterThanOrEqual(2);
      expect(route.against.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('give a route with no rival no question, and no card for an unknown route', async () => {
    const data = await load();
    const labels = routeCard(data, 'beringia')?.facts.map(([label]) => label) ?? [];
    expect(labels).not.toContain('Question');
    expect(labels).not.toContain('Other answers');
    expect(routeCard(data, 'nowhere')).toBeNull();
  });
});
