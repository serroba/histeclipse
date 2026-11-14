/** Test-only mounting page: production scene factories, explicit chapters, no application startup. */
import { createGlobe } from '../../src/globe/scene';
import { ECLIPSE_EARTH_PARTS } from '../../src/features/eclipses';
import { createSunCore } from '../../src/features/shower/sunCore';
import { createAirShower } from '../../src/features/shower/airShower';
import { createLeafScene } from '../../src/features/shower/leafScene';
import type { StoryScene } from '../../src/story/storyScene';

const container = document.querySelector<HTMLElement>('#scene');
const navigation = document.querySelector<HTMLElement>('#chapters');
if (container === null || navigation === null) throw new Error('Missing probe mount');
const scene = container;
const buttons = navigation;
const earthTextureUrl = '/textures/earth-blue-marble-2048.jpg';

function chapters<Chapter extends string>(
  story: StoryScene<Chapter>,
  names: readonly Chapter[],
): void {
  for (const name of names) {
    const button = document.createElement('button');
    button.textContent = name;
    button.addEventListener('click', () => {
      delete scene.dataset['rendered'];
      story.setChapter(name);
      story.settle();
    });
    buttons.append(button);
  }
  for (const [label, playing] of [
    ['Play', true],
    ['Pause', false],
  ] as const) {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', () => {
      story.setPlaying(playing);
    });
    buttons.append(button);
  }
  story.settle();
}

const kind = new URLSearchParams(location.search).get('scene');
if (kind === 'sun') {
  chapters(createSunCore(scene, { earthTextureUrl }), ['fusion', 'escape', 'journey']);
} else if (kind === 'air') {
  chapters(
    createAirShower(scene, {
      earthTextureUrl,
      place: { latitude: 48, longitude: 10 },
      dipole: 8,
      water: false,
    }),
    ['rays', 'shower', 'capture'],
  );
} else if (kind === 'land' || kind === 'water') {
  chapters(createLeafScene(scene, { water: kind === 'water', fromSun: true }), [
    'dioxide',
    'fall',
    'plant',
  ]);
} else {
  const globe = createGlobe(scene, {
    camera: { target: { latitude: 20, longitude: 0 }, distance: 3 },
    focus: 'earth',
    textureUrl: earthTextureUrl,
    moonTextureUrl: '/textures/moon-lroc-4096.jpg',
    earthParts: ECLIPSE_EARTH_PARTS,
  });
  const move = document.createElement('button');
  move.textContent = 'Move';
  let opposite = false;
  move.addEventListener('click', () => {
    opposite = !opposite;
    globe.flyTo({ latitude: opposite ? 30 : -30, longitude: opposite ? 90 : -90 });
  });
  buttons.append(move);
  globe.setEvenLight(true);
  globe.setC14Glow(Array.from({ length: 19 }, (_, index) => 0.2 + index / 24));
}
