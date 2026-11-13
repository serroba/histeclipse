/**
 * The eclipses as a part of the page (#447): the year's eclipses on the bar, picking one, and
 * the moment shown of it (the scrubber, the Moon's shadow and path, where the eclipsed Moon is
 * up, the card); which a past state could see is `seen.ts`.
 */

import type { Globe } from '../../globe/globe';
import type { PartContext } from '../part';
import { eclipsePathLayer } from './eclipsePath';
import { lunarOverlayLayer } from './lunarOverlay';
import { moonShadowLayer } from './moonShadow';
import { ECLIPSE_PATH_PART } from './eclipsePathPart';
import { LUNAR_OVERLAY_PART } from './lunarOverlayPart';
import { MOON_SHADOW_PART } from './moonShadowPart';
import type { EarthPart } from '../../globe/earthParts';

/** The parts of the Earth shader the eclipses draw with, built into the globe when it is made. */
export const ECLIPSE_EARTH_PARTS: readonly EarthPart[] = [
  LUNAR_OVERLAY_PART,
  ECLIPSE_PATH_PART,
  MOON_SHADOW_PART,
];

import type { EmpireCentury, Territory } from '../../data/empires';
import { redraws, SELECTION } from '../../state/redraws';
import { createSeen } from './seen';
import { barYear, timeInYear, westernYearsOf } from './years';
import { greatestEclipseUT } from '../../data/catalog';
import { famousFor, type FamousEclipse } from '../../data/famousEclipses';
import type { LunarCatalog } from '../../data/lunarCatalog';
import type { SolarCatalog } from '../../data/solarCatalog';
import { type SolarEclipse } from '../../data/solarCatalog';
import {
  eclipseMomentAt,
  eclipseSelection,
  findSelected,
  isSolar,
  momentAt,
} from '../../eclipses/describe';
import { lunarPhaseAt, SUBLUNAR_DRIFT_DEGREES_PER_HOUR } from '../../eclipses/lunarPhases';
import { shadowAt } from '../../eclipses/solar';
import { longitudeUncertainty, shiftLongitude } from '../../eclipses/visibility';
import { geoToVector } from '../../globe/geo';
import { momentJulianDay, type GeoPoint, type ViewState } from '../../state/viewState';
import type { DeltaT } from '../../time/deltaT';
import { formatTimeOfDay } from '../../time/format';
import { julianDayNumber } from '../../time/julianDay';
import { yearSpan } from '../../time/calendars';
import { astronomicalYear, formatYear } from '../../time/year';
import { createEclipseCard } from './eclipseCard';
import { createScrubber, SCRUB_RANGE_MINUTES } from './scrubber';
import { labelPoint } from '../../data/empires';
import { createTimeline, type Eclipse, type YearEclipses } from '../../ui/timeline';
import { errorMessage } from '../../util/errors';

const MINUTES_PER_DAY = 1440;

/** What the eclipses ask of the rest of the page. */
export interface EclipsesContext extends PartContext {
  readonly globe: Pick<Globe, 'flyTo' | 'addLayer'>;
  /** The catalogues and ΔT, which load before the page shows a moment. */
  readonly catalogs: () => { readonly lunar: LunarCatalog; readonly solar: SolarCatalog };
  readonly deltaT: () => DeltaT;
  readonly famous: () => readonly FamousEclipse[];
  /** The name of where the observer stands: a famous eclipse's place, or a culture's site. */
  readonly placeName: (place: GeoPoint, famousHere: FamousEclipse | undefined) => string | null;
  readonly territoryOf: (name: string, shown: number) => Promise<Territory | null>;
  readonly centuryFor: (year: number) => Promise<EmpireCentury | null>;
  /** The bar's buttons and the tracks' extras beside it. */
  readonly timelineButtons: readonly HTMLElement[];
  readonly timelineExtras: readonly HTMLElement[];
}

export interface EclipsesPart {
  readonly card: HTMLElement;
  readonly timeline: HTMLElement;
  readonly scrubber: HTMLElement;
  /** The eclipse picked, once the year's are listed. */
  readonly selected: (state: ViewState) => Eclipse | undefined;
  /** The bar, the path and the moment, for the eclipse picked. */
  readonly renderSelection: (state: ViewState) => void;
  /** An eclipse was picked elsewhere: the globe turns to it, or to the place given. */
  readonly flyToPicked: (place: GeoPoint | null) => void;
  /** The view changed: the bar's year listed, and the eclipse picked or its moment drawn. */
  readonly render: (state: ViewState, previous: ViewState | null) => void;
}

export function mountEclipses(context: EclipsesContext): EclipsesPart {
  const { store, globe } = context;
  const lunarOverlay = globe.addLayer(lunarOverlayLayer);
  const eclipsePath = globe.addLayer(eclipsePathLayer);
  const moonShadow = globe.addLayer(moonShadowLayer);
  const seen = createSeen({
    store,
    notify: (message) => {
      context.notify(message);
    },
    catalogs: () => context.catalogs(),
    deltaT: () => context.deltaT(),
    territoryOf: (name, shown) => context.territoryOf(name, shown),
    centuryFor: (year) => context.centuryFor(year),
    listing: () => listing,
    selected: (state) => selectedEclipse(state),
    render: (state) => {
      renderSelection(state);
    },
    goTo: (eclipse) => {
      flyToSelection = true;
      store.set((state) => ({
        ...state,
        time: eclipseMomentAt(eclipse, state.location),
        selection: eclipseSelection(eclipse),
      }));
    },
  });
  // Picking an eclipse also turns the globe toward it (or toward a famous eclipse's place);
  // opening a shared link does not, because the link already says where the camera should be.
  let flyToSelection = false;
  let flyTarget: GeoPoint | null = null;

  const card = createEclipseCard(context.why('eclipses', 'Eclipse'));
  const timeline = createTimeline(
    {
      onYear(year) {
        store.set((state) => ({ ...state, time: timeInYear(state, year), selection: null }));
      },
      onCalendar(years) {
        store.set((state) => ({ ...state, years }));
      },
      onSelect(eclipse) {
        flyToSelection = true;
        store.set((state) => ({
          ...state,
          time: eclipseMomentAt(eclipse, state.location),
          selection: eclipseSelection(eclipse),
        }));
      },
      onSeenIn(seenIn) {
        store.set((state) => ({ ...state, seenIn }));
        if (seenIn === null || store.get().mode !== 'globe') return;
        // Turn the globe to the state picked.
        context.territoryOf(seenIn, store.get().time.date.year).then(
          (territory) => {
            if (territory !== null) globe.flyTo(labelPoint(territory));
          },
          () => undefined, // The bar reports load errors.
        );
      },
      onSeenStep(direction) {
        seen.step(direction);
      },
    },
    context.timelineButtons,
    context.timelineExtras,
  );
  const scrubber = createScrubber((offsetMinutes) => {
    const selected = selectedEclipse(store.get());
    if (selected === undefined) return;
    const jd = greatestEclipseUT(selected) + offsetMinutes / MINUTES_PER_DAY;
    store.set((state) => ({ ...state, time: momentAt(julianDayNumber(jd)) }));
  });

  // Eclipses of the year on screen. Loads are tagged with their year so a slow response for a
  // year the user already left is ignored.
  let shownYear: string | null = null;
  let listing: YearEclipses = { status: 'loading' };
  let pathShownFor: SolarEclipse | null = null;

  function selectedEclipse(state: ViewState): Eclipse | undefined {
    return listing.status === 'ready' ? findSelected(listing.eclipses, state.selection) : undefined;
  }

  /** Everything that changes with the moment shown: scrubber, shadow, Moon-up region, card. */
  function renderMoment(state: ViewState): void {
    const selected = selectedEclipse(state);
    if (selected === undefined) {
      moonShadow.update(null);
      lunarOverlay.update(null);
      scrubber.render(null);
      card.render(undefined, 0, null);
      return;
    }
    const universal = momentJulianDay(state.time);
    const offset = Math.round((universal - greatestEclipseUT(selected)) * MINUTES_PER_DAY);
    const uncertainty = context.deltaT().uncertaintySeconds(greatestEclipseUT(selected));
    scrubber.render({
      offsetMinutes: Math.max(-SCRUB_RANGE_MINUTES, Math.min(SCRUB_RANGE_MINUTES, offset)),
      timeLabel: formatTimeOfDay(state.time),
    });

    const showShadow = isSolar(selected) && state.layers.has('solar');
    moonShadow.update(
      showShadow
        ? shadowAt(
            selected.elements,
            julianDayNumber(universal + selected.deltaT / 86_400),
            selected.deltaT,
          )
        : null,
    );

    // Where the eclipsed Moon is up now: the point under the Moon drifts west as Earth turns,
    // and the region only shows while the eclipse is actually happening.
    const phase = isSolar(selected) ? 'none' : lunarPhaseAt(selected, offset);
    if (!isSolar(selected) && phase !== 'none' && state.layers.has('lunar')) {
      const [latitude, longitude] = selected.sublunar;
      const now = shiftLongitude(
        { latitude, longitude },
        -(offset / 60) * SUBLUNAR_DRIFT_DEGREES_PER_HOUR,
      );
      const shift = longitudeUncertainty(uncertainty);
      lunarOverlay.update({
        sublunar: geoToVector(now),
        west: geoToVector(shiftLongitude(now, -shift)),
        east: geoToVector(shiftLongitude(now, shift)),
        strength: phase === 'penumbral' ? 0.5 : 1,
      });
    } else {
      lunarOverlay.update(null);
    }
    const famousHere = famousFor(context.famous(), state.selection);
    card.render(
      selected,
      uncertainty,
      state.location === null
        ? null
        : { point: state.location, name: context.placeName(state.location, famousHere) },
      famousHere,
      offset,
    );
  }

  function renderSelection(state: ViewState): void {
    const selected = selectedEclipse(state);
    seen.refresh(state);
    timeline.render({
      year: barYear(state),
      calendar: state.years,
      eclipses: listing,
      selected,
      seen: { shown: seen.shown(state), options: seen.options(), view: seen.view() },
    });
    const uncertainty =
      selected === undefined ? 0 : context.deltaT().uncertaintySeconds(greatestEclipseUT(selected));

    const solarPath =
      selected !== undefined && isSolar(selected) && state.layers.has('solar') ? selected : null;
    if (solarPath !== pathShownFor) {
      pathShownFor = solarPath;
      eclipsePath.update(
        solarPath === null
          ? null
          : {
              elements: solarPath.elements,
              deltaTSeconds: solarPath.deltaT,
              uncertaintySeconds: uncertainty,
            },
      );
    }

    if (selected !== undefined && flyToSelection) {
      flyToSelection = false;
      const [latitude, longitude] = isSolar(selected) ? selected.greatest : selected.sublunar;
      globe.flyTo(flyTarget ?? { latitude, longitude });
      flyTarget = null;
    }
    renderMoment(state);
  }

  function loadYear(state: ViewState): void {
    const year = barYear(state);
    const key = `${state.years}:${String(year)}`;
    if (key === shownYear) return;
    shownYear = key;
    const westernYears = westernYearsOf(state, year);
    const { lunar: lunarCatalog, solar: solarCatalog } = context.catalogs();
    const covered = (westernYears ?? []).every(
      (each) => lunarCatalog.covers(each) && solarCatalog.covers(each),
    );
    if (westernYears === null || !covered) {
      listing = {
        status: 'error',
        message: `Eclipses are catalogued from ${formatYear(astronomicalYear(lunarCatalog.index.startYear))} to ${formatYear(astronomicalYear(lunarCatalog.index.endYear))}`,
      };
      renderSelection(state);
      return;
    }
    const span = state.years === 'western' ? null : yearSpan(state.years, year);
    listing = { status: 'loading' };
    renderSelection(state);
    Promise.all(
      westernYears.flatMap((each) => [
        lunarCatalog.eclipsesInYear(each),
        solarCatalog.eclipsesInYear(each),
      ]),
    ).then(
      (chunks) => {
        if (shownYear !== key) return;
        const eclipses: Eclipse[] = chunks
          .flat()
          .filter((eclipse) => {
            if (span === null) return true;
            const when = greatestEclipseUT(eclipse);
            return when >= span.start && when < span.end;
          })
          .sort((a, b) => a.jdTT - b.jdTT);
        listing = { status: 'ready', eclipses };
        renderSelection(store.get());
      },
      (error: unknown) => {
        if (shownYear !== key) return;
        listing = { status: 'error', message: `Could not load eclipses: ${errorMessage(error)}` };
        renderSelection(store.get());
      },
    );
  }

  return {
    card: card.root,
    timeline: timeline.root,
    scrubber: scrubber.root,
    selected: selectedEclipse,
    renderSelection,
    flyToPicked: (place) => {
      flyToSelection = true;
      flyTarget = place;
    },
    render(state, previous) {
      loadYear(state);
      if (redraws(SELECTION, state, previous)) renderSelection(state);
      else if (previous !== null && state.time !== previous.time) renderMoment(state);
    },
  };
}
