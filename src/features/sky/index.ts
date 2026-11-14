/**
 * The sky view as a part of the page (#448): its code and its 9,000 stars load the first time
 * someone opens it; each culture's figures load the first time someone picks it. It brings its
 * own switches and captions, and says what is in the sky at the moment and place shown.
 */

import { sunPositionJ2000 } from '../../astro/precession';
import { loadSky } from '../../data/sky';
import {
  CULTURE_INFO,
  cultureFigures,
  loadCultureIndex,
  loadHipStars,
  withFigureStars,
  type SkyCulture,
} from '../../data/skyCultures';
import { aimLook, tapLook, type BodiesSeen } from '../../sky/aim';
import { planetNote, skyCaption } from './caption';
import { momentCache, type SkyMoment } from './moment';
import { earthVelocity } from '../../sky/horizon';
import type { Figure } from '../../sky/look';
import type { SkyMark, SkyPlanet, SkyScene, SkyTap } from '../../sky/skyScene';
import type { Vector3 } from '../../astro/matrix';
import { SKY } from '../../state/redraws';
import type { GeoPoint, SkyLook, ViewState } from '../../state/viewState';
import { julianDayNumber, type JulianDay } from '../../time/julianDay';
import { createAimSwitch, type AimTarget } from './aimSwitch';
import { createCultureSwitch } from './cultureSwitch';
import { element } from '../../ui/dom';
import { createFigureSwitch } from './figureSwitch';
import { errorMessage } from '../../util/errors';
import type { MountedPart, PartContext } from '../part';
import './sky.css';

/** How long the sky takes to turn and close in on a tapped body, ms, before going to it. */
const SKY_GLIDE_MS = 900;

/** What the sky asks of the rest of the page. */
export interface SkyContext extends PartContext {
  /** The Sun and the Moon from the observer at the moment shown, or null if it can't be had. */
  bodiesSeen(state: ViewState): BodiesSeen | null;
  /** The planets as the observer sees them, once their theory has loaded. */
  planetsSeen(jdTT: JulianDay, sun: Vector3, observer: Vector3): SkyPlanet[];
  /** Load the planets' theory, if it hasn't been. */
  loadPlanets(): Promise<unknown>;
  /** ΔT's uncertainty at a moment, seconds. */
  deltaTUncertainty(jdUT: JulianDay): number;
  /** A place's name, where it has one. */
  namedPlace(place: GeoPoint): string | null;
  /** Whether the Moon's ephemeris has loaded. */
  moonReady(): boolean;
  /** A tap on open sky clears the panels, or brings them back (#253). */
  togglePanels(): void;
  /** The marks the sky shows at the moment: a tablet record's bodies, if one is being looked at. */
  marks(state: ViewState): readonly SkyMark[];
}

export interface SkyPart extends MountedPart {
  /** Where the sky is drawn. */
  readonly container: HTMLElement;
  /** Its switches: aiming, then the constellations and whose. */
  readonly controls: readonly HTMLElement[];
  /** What it says of the sky shown: the caption, then an eclipse under way. */
  readonly captions: readonly HTMLElement[];
  /** The space the panels leave free, top and bottom, px. */
  readonly setInsets: (top: number, bottom: number) => void;
  readonly setMarks: (marks: readonly SkyMark[]) => void;
  /** A look facing the Sun or the Moon from where the view stands, or null if unknown. */
  readonly aimAt: (state: ViewState, target: AimTarget) => SkyLook | null;
}

export function mountSky(context: SkyContext): SkyPart {
  const { base, fetchJson, store } = context;
  const container = element('div', { class: 'sky', 'data-testid': 'sky', hidden: '' });
  const text = element('p', { class: 'sky-caption' });
  const eclipse = element('p', { class: 'sky-eclipse', 'data-testid': 'sky-eclipse' });
  const aimAt = (state: ViewState, target: AimTarget): SkyLook | null => {
    const seen = context.bodiesSeen(state);
    return seen === null ? null : aimLook(seen, state.look.fov, target);
  };
  const aimSwitch = createAimSwitch((target) => {
    store.set((state) => {
      const look = aimAt(state, target);
      return look === null ? state : { ...state, look };
    });
  });
  const cultureSwitch = createCultureSwitch(base, (culture) => {
    // See the sky from where that culture watched it; the date stays as it is.
    const place = CULTURE_INFO[culture].place;
    store.set((state) => ({
      ...state,
      culture,
      location:
        place === null ? state.location : { latitude: place.latitude, longitude: place.longitude },
    }));
  });
  const figureSwitch = createFigureSwitch((figures) => {
    store.set((state) => ({ ...state, figures }));
  });
  // Which constellations, and whose: folded on phones, where they would cover the sky itself.
  const options = element(
    'details',
    { class: 'sky-options', hidden: '' },
    element('summary', {}, 'Constellations and whose sky ', context.why('sky', 'The night sky')),
    figureSwitch.root,
    cultureSwitch.root,
  );
  options.open = !window.matchMedia('(max-width: 600px)').matches;

  let scene: SkyScene | null = null;
  let loading = false;
  let insets = { top: 0, bottom: 0 };
  function open(): void {
    if (scene !== null || loading) return;
    loading = true;
    Promise.all([
      import('../../sky/skyScene'),
      loadSky(`${base}data/sky.json`, fetchJson),
      loadHipStars(`${base}data/hip-stars.json`, fetchJson),
      context.loadPlanets(),
    ]).then(
      ([{ createSkyScene }, plainSky, hipStars]) => {
        const state = store.get();
        // Other cultures' figures use a few faint stars beyond the catalogue; add them.
        const { sky, index } = withFigureStars(plainSky, hipStars);
        hipIndex = index;
        scene = createSkyScene(container, {
          sky,
          look: state.look,
          figures: state.figures,
          moonTextureUrl: `${base}textures/moon-lroc-1k.jpg`,
        });
        scene.setInsets(insets.top, insets.bottom);
        scene.onTap((tapped) => {
          if (tapped === null) context.togglePanels();
          else zoomToBody(tapped);
        });
        scene.onLookChange((look) => {
          store.set((current) => ({ ...current, look }));
        });
        render(state);
      },
      (error: unknown) => {
        loading = false;
        context.notify(`Could not load the stars: ${errorMessage(error)}`);
      },
    );
  }

  // A body tapped in the sky: the view turns to it and closes in, then goes to it up close. The
  // look is kept, so the way back to the sky faces the body.
  let glides = 0;
  function zoomToBody(tap: SkyTap): void {
    const look = tapLook(tap);
    const glide = (glides += 1);
    store.set((state) => ({ ...state, look }));
    void scene?.glideTo(look, SKY_GLIDE_MS).then(() => {
      // Another tap, a drag or leaving the sky meanwhile cancels the way there.
      if (glide !== glides || store.get().mode !== 'sky') return;
      const { look: now } = store.get();
      if (now.azimuth !== look.azimuth || now.altitude !== look.altitude || now.fov !== look.fov)
        return;
      store.set((state) => ({ ...state, mode: 'globe', focus: tap.body, view: 'free' }));
    });
  }

  let hipIndex: ReadonlyMap<number, number> | null = null;
  const cultureFiles = new Map<SkyCulture, Promise<readonly Figure[]>>();
  function showCulture(state: ViewState): void {
    if (scene === null || hipIndex === null) return;
    const culture = state.culture;
    if (culture === 'modern') {
      scene.setCulture(null);
      return;
    }
    const index = hipIndex;
    let figures = cultureFiles.get(culture);
    if (figures === undefined) {
      const request = loadCultureIndex(`${base}skycultures/${culture}/index.json`, fetchJson).then(
        (file) => cultureFigures(culture, file, index),
      );
      // A failure is reported once per request, however many renders were waiting on it.
      request.catch((error: unknown) => {
        if (cultureFiles.get(culture) !== request) return;
        cultureFiles.delete(culture);
        context.notify(`Could not load the ${culture} sky: ${errorMessage(error)}`);
      });
      cultureFiles.set(culture, request);
      figures = request;
    }
    figures.then(
      (loaded) => {
        if (store.get().culture === culture) scene?.setCulture(loaded);
      },
      () => {
        // Reported above.
      },
    );
  }

  // Kept while only the look, the figures or the marks change: a drag or a glide (#666).
  const momentOf = momentCache(
    (state) => context.bodiesSeen(state),
    () => context.moonReady(),
  );
  // The moment the scene was last given, and the scene.
  let shown: { moment: SkyMoment; scene: SkyScene } | null = null;

  function render(state: ViewState): void {
    const inSky = state.mode === 'sky';
    text.hidden = !inSky;
    options.hidden = !inSky;
    eclipse.hidden = true;
    figureSwitch.render(state.figures, inSky, state.culture === 'modern');
    cultureSwitch.render(state.culture, inSky);
    aimSwitch.render(inSky, context.moonReady());
    const marks = context.marks(state);
    if (!inSky) {
      scene?.setVisible(false);
      return;
    }
    open();
    const now = momentOf(state);
    if (now === null) return;
    const { place, jdUT, jdTT, sun, moon, observer } = now.seen;
    text.textContent = [
      skyCaption({
        place,
        placeName: context.namedPlace(place),
        azimuth: state.look.azimuth,
        uncertaintySeconds: context.deltaTUncertainty(jdUT),
      }),
      planetNote(state.time.date.year),
    ]
      .filter((part) => part !== '')
      .join(' ');
    eclipse.textContent = now.eclipseText;
    eclipse.hidden = now.eclipseText === '';
    if (scene === null) return;
    scene.setLook(state.look);
    scene.setFigures(state.figures);
    scene.setMarks(marks);
    showCulture(state);
    if (shown?.moment !== now || shown.scene !== scene) {
      scene.setMoment({
        horizon: now.horizon,
        jdTT,
        sun,
        moon,
        observer,
        planets: context.planetsSeen(jdTT, sun, observer),
        velocity: earthVelocity((jd) => sunPositionJ2000(julianDayNumber(jd)), jdTT),
      });
      shown = { moment: now, scene };
    }
    scene.setVisible(true);
  }

  return {
    watches: SKY,
    elements: [container],
    container,
    controls: [aimSwitch.root, options],
    captions: [text, eclipse],
    render,
    setInsets: (top, bottom) => {
      insets = { top, bottom };
      scene?.setInsets(top, bottom);
    },
    setMarks: (marks) => {
      scene?.setMarks(marks);
    },
    aimAt,
  };
}
