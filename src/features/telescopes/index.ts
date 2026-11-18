/**
 * The Telescopes layer (#848, epic #852), on the feature contract (#380): the most significant
 * telescopes, loaded with the layer. On the globe in the years, a marker at each ground
 * telescope's site from its first light to its closing, those being built drawn hollow; a tap
 * opens its card, the others on its site a step away. The space telescopes come with #849.
 */

import { loadTelescopes, type Telescope, type Telescopes } from '../../data/telescopes';
import { errorMessage } from '../../util/errors';
import type { Feature, FeatureContext } from '../feature';
import { telescopeLayer } from './telescopeLayer';
import { groundMarks, telescopeCard, telescopesText, type TelescopeMark } from './telescopeMarks';
import './telescopes.css';

export { mountTelescopeList } from './listPart';

/** A telescope's card, with the others on its site a step away. */
function showTelescope(
  context: Pick<FeatureContext, 'showCard'>,
  telescope: Telescope,
  siteMates: readonly Telescope[],
): void {
  const others = siteMates.filter((other) => other.id !== telescope.id);
  context.showCard({
    ...telescopeCard(telescope),
    related: others.map((other) => ({
      label: other.name,
      explain: 'on the same site',
      run: () => {
        showTelescope(context, other, siteMates);
      },
    })),
  });
}

export const telescopesFeature: Feature = {
  id: 'telescopes',
  picks: 'telescope',
  // On or off with its layer, and only on the globe, in historical time.
  watches: (state) => [state.layers, state.mode, state.ma],
  mount(context) {
    const marksOnGlobe = context.globe.addLayer(telescopeLayer);
    let record: Telescopes | null = null;
    let loading = false;
    let said: string | null = null;
    let marks: readonly TelescopeMark[] = [];
    // What was last drawn, so the moments of one year cost nothing.
    let drawnFor = '';

    return {
      show(state) {
        const on = state.layers.has('telescopes') && state.mode === 'globe' && state.ma === null;
        const year = state.time.date.year;
        const key = `${String(on)}:${String(record !== null)}:${String(year)}`;
        if (key === drawnFor) return;
        drawnFor = key;
        if (!on) {
          said = null;
          marks = [];
          marksOnGlobe.update(null);
          return;
        }
        if (record === null) {
          said = 'Loading the telescopes…';
          if (loading) return;
          loading = true;
          loadTelescopes(`${context.base}data/telescopes.json`, context.fetchJson).then(
            (loaded) => {
              record = loaded;
              context.refresh();
            },
            (error: unknown) => {
              loading = false;
              drawnFor = '';
              context.notify(`Could not load the telescopes: ${errorMessage(error)}`);
            },
          );
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
    };
  },
};
