/**
 * The Telescopes layer (#848, epic #852), on the feature contract (#380): the most significant
 * telescopes, loaded with the layer. On the globe in the years, a marker at each ground
 * telescope's site from its first light to its closing, those being built drawn hollow; a tap
 * opens its card, the others on its site a step away. The space telescopes come with #849.
 */

import { loadTelescopes, type Telescope, type Telescopes } from '../../data/telescopes';
import { siteOn } from '../../state/viewState';
import { loadOnce } from '../../state/loadOnce';
import { feature, type FeatureContext } from '../feature';
import { groundModel } from './groundModelLayer';
import { goToSite, heldSite } from './groundSites';
import { telescopeLayer } from './telescopeLayer';
import { groundMarks, telescopeCard, telescopesText, type TelescopeMark } from './telescopeMarks';
import './telescopes.css';

export { mountTelescopeList } from './listPart';

/** A telescope's card, with the others on its site a step away. */
function showTelescope(
  context: Pick<FeatureContext<'cards'>, 'cards' | 'change'>,
  telescope: Telescope,
  siteMates: readonly Telescope[],
): void {
  const others = siteMates.filter((other) => other.id !== telescope.id);
  context.cards.show({
    ...telescopeCard(telescope),
    ...goToSite(telescope, context),
    related: others.map((other) => ({
      label: other.name,
      explain: 'on the same site',
      run: () => {
        showTelescope(context, other, siteMates);
      },
    })),
  });
}

export const telescopesFeature = feature({
  id: 'telescopes',
  needs: ['cards'],
  picks: 'telescope',
  // On or off with its layer, and only on the globe, in historical time.
  watches: (state) => [state.layers, state.mode, state.ma, state.on],
  mount(context) {
    const marksOnGlobe = context.globe.addLayer(telescopeLayer);
    const modelOnGlobe = context.globe.addLayer(groundModel);
    const recordLoad = loadOnce<Telescopes>({
      fetch: () => loadTelescopes(`${context.base}data/telescopes.json`, context.fetchJson),
      what: 'the telescopes',
      context,
    });
    let loadOn = false;
    let said: string | null = null;
    let marks: readonly TelescopeMark[] = [];
    // What was last drawn, so the moments of one year cost nothing.
    let drawnFor = '';

    return {
      show(state) {
        const on = state.layers.has('telescopes') && state.mode === 'globe' && state.ma === null;
        loadOn = on;
        const loaded = recordLoad.value();
        modelOnGlobe.update(on && loaded !== null ? heldSite(loaded, siteOn(state)) : null);
        const year = state.time.date.year;
        const key = `${String(on)}:${recordLoad.status()}:${String(year)}`;
        if (key === drawnFor) return;
        drawnFor = key;
        if (!on) {
          said = null;
          marks = [];
          marksOnGlobe.update(null);
          return;
        }
        const record = recordLoad.value();
        if (record === null) {
          recordLoad.want();
          said =
            recordLoad.status() === 'failed'
              ? 'Could not load the telescopes.'
              : 'Loading the telescopes…';
          return;
        }
        marks = groundMarks(record, year);
        marksOnGlobe.update(marks);
        said = telescopesText(marks, year);
      },
      pick(key) {
        const mark = marks.find((each) => each.key === key);
        const [first] = mark?.telescopes ?? [];
        if (mark === undefined || first === undefined) return;
        showTelescope(context, first, mark.telescopes);
      },
      said: () => said,
      load: () => recordLoad.report(loadOn),
    };
  },
});
