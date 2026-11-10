/**
 * What is known of each moon drawn (#335), for the bar when it is in view: who found it and
 * when, and what it is known for, at the length its story deserves. Europa's and Enceladus's
 * hidden oceans and Titan's seas of methane get the most; a small grey moon a line or two.
 * Every claim comes from the public record (NASA, ESA and JAXA, and the papers behind the
 * findings); what is not settled is said to be so.
 */

import type { MoonName, MoonOrbit } from '../astro/moonOrbits';
import { MOON_NAMES, MOON_RADIUS_KM, moonPlanet } from '../globe/moonLook';
import { PLANET_NAMES } from '../globe/planetLook';

export interface MoonFacts {
  /** Who first saw it, and when. */
  readonly found: string;
  /** What it is known for, a sentence or several. */
  readonly about: string;
  /** Where to read more: the registry's keys (`sources/registry.ts`). */
  readonly sources: readonly string[];
}

export const MOON_FACTS: Readonly<Record<MoonName, MoonFacts>> = {
  phobos: {
    found: 'Asaph Hall, August 1877',
    about:
      'The larger of Mars’s two moons, a lumpy body some 27 km long, scarred by the 9 km crater Stickney. It is closer to its planet than any other moon, about 6,000 km above Mars, and goes round in 7 hours 39 minutes, faster than Mars turns: seen from Mars it rises in the west and sets in the east. Tides are drawing it in by about 1.8 m a century; in some 50 million years it will crash into Mars or break up into a ring. Whether it and Deimos are captured asteroids or the debris of a great impact on Mars is still argued. JAXA’s MMX, launched in October 2026, is to bring a sample of it back to Earth in 2031.',
    sources: ['nasaPhobos', 'jaxaMmx'],
  },
  deimos: {
    found: 'Asaph Hall, August 1877',
    about:
      'Mars’s smaller, outer moon, some 15 km long, smoothed by a blanket of dust. It goes round in 30 hours, so from Mars it hangs in the sky for days at a time, a bright star.',
    sources: ['nasaDeimos'],
  },
  io: {
    found: 'Galileo Galilei, January 1610',
    about:
      'The most volcanic body in the solar system, with hundreds of active volcanoes, some throwing plumes hundreds of kilometres high; its yellows and reds are sulphur. Jupiter’s tides knead it from within: its orbit is kept out of round by a resonance with Europa and Ganymede (four turns of Io to two of Europa and one of Ganymede), so it is squeezed and released every 42 hours. Its volcanoes were found in Voyager 1’s images in 1979, by Linda Morabito.',
    sources: ['nasaIo'],
  },
  europa: {
    found: 'Galileo Galilei, January 1610',
    about:
      'Under a shell of ice lies an ocean of salt water, holding perhaps twice the water of all Earth’s oceans: Galileo’s magnetometer found the field such an ocean would carry. With water, the chemistry its rocky floor could supply, and the energy of Jupiter’s tides, it is among the most promising places to look for life beyond Earth. Its surface is young, few craters, criss-crossed by cracks and ridges. Hubble has seen what may be plumes of water vapour, not yet confirmed. NASA’s Europa Clipper, launched in October 2024, is to arrive in 2030 and fly past it dozens of times.',
    sources: ['nasaEuropa', 'kivelson2000', 'nasaEuropaClipper'],
  },
  ganymede: {
    found: 'Galileo Galilei, January 1610',
    about:
      'The largest moon in the solar system, larger than Mercury, and the only moon known to make its own magnetic field (Galileo, 1996). Hubble watched its aurorae rock less than they would over solid ground, a sign of a salty ocean beneath the ice. ESA’s JUICE, launched in 2023, is to orbit it from 2034: the first spacecraft to orbit a moon other than our own.',
    sources: ['nasaGanymede', 'saur2015', 'esaJuice'],
  },
  callisto: {
    found: 'Galileo Galilei, January 1610',
    about:
      'The most heavily cratered body known: its surface has hardly changed in some four billion years. Its largest scar, the Valhalla basin, is a bright centre some 600 km across, ringed out to some 1,500 km from it. Galileo’s magnetometer hinted at an ocean deep below its ice, as at Europa and Ganymede, less certainly.',
    sources: ['nasaCallisto'],
  },
  mimas: {
    found: 'William Herschel, 1789',
    about:
      'The smallest and innermost of Saturn’s major moons, its face marked by the 130 km crater Herschel, a third of its width across, which makes it look like the Death Star. Its pull sets the inner edge of the Cassini Division, the widest gap in Saturn’s rings. In 2024 its slight wobble and orbit were found to fit a young ocean under its ice, likely less than 25 million years old: a surprise on a moon that looks long dead.',
    sources: ['nasaMimas', 'lainey2024'],
  },
  enceladus: {
    found: 'William Herschel, 1789',
    about:
      'The whitest body in the solar system. In 2005 Cassini found jets of water vapour and ice shooting from four long cracks near its south pole, the “tiger stripes”, from a global ocean under the ice; they feed Saturn’s E ring. Flying through the jets, Cassini tasted salts, organic molecules, molecular hydrogen, a sign of hot water reacting with rock at the ocean floor as at Earth’s hydrothermal vents, and phosphates. With liquid water, energy and these ingredients, it is one of the best places in the solar system to look for life.',
    sources: ['nasaEnceladus', 'waite2017', 'postberg2023'],
  },
  tethys: {
    found: 'Giovanni Domenico Cassini, 1684',
    about:
      'Almost all water ice. The crater Odysseus spans some 400 km, nearly two fifths of its width, and the canyon Ithaca Chasma runs some 2,000 km, from near one pole to the other.',
    sources: ['nasaTethys'],
  },
  dione: {
    found: 'Giovanni Domenico Cassini, 1684',
    about:
      'Ice over rock, its trailing side streaked by bright cliffs of ice hundreds of metres high, cracks in its crust. Cassini found a trace of an oxygen atmosphere, and its shape and gravity suggest an ocean deep beneath the ice, less certainly than at Enceladus.',
    sources: ['nasaDione'],
  },
  rhea: {
    found: 'Giovanni Domenico Cassini, 1672',
    about:
      'Saturn’s second-largest moon, a cold ball of ice and some rock. In 2010 Cassini found a tenuous atmosphere of oxygen and carbon dioxide around it.',
    sources: ['nasaRhea'],
  },
  titan: {
    found: 'Christiaan Huygens, March 1655',
    about:
      'Larger than Mercury, and the only moon with a thick atmosphere: mostly nitrogen, its pressure at the ground half again Earth’s, hazy orange with hydrocarbons. Methane plays the part water does on Earth: it rains, carves rivers, and fills lakes and seas of liquid methane and ethane near the poles, Kraken Mare and Ligeia Mare the largest. Titan is the only place besides Earth known to have standing liquid on its surface. Its dunes are grains of hydrocarbons; beneath its ice crust is likely an ocean of water. ESA’s Huygens probe landed there on 14 January 2005, the farthest landing yet; NASA’s Dragonfly, a rotorcraft, is to launch in 2028 and fly from place to place studying its chemistry, the kind that may have led to life on Earth.',
    sources: ['nasaTitan', 'stofan2007', 'nasaDragonfly'],
  },
  hyperion: {
    found: 'William and George Bond, and William Lassell, September 1848',
    about:
      'Not round but a tumbling, sponge-like lump some 410 km long, so porous that much of it is empty space; it turns chaotically, with no steady day.',
    sources: ['nasaHyperion'],
  },
  iapetus: {
    found: 'Giovanni Domenico Cassini, October 1671',
    about:
      'Two-faced: the side it leads with is as dark as coal, the other as bright as snow. Cassini, who found it, could see it on one side of Saturn but not the other, and guessed as much. Around its middle runs a ridge of mountains some 10 km high, giving it the look of a walnut.',
    sources: ['nasaIapetus'],
  },
};

const AU_KM = 149_597_870.7;

/**
 * The bar's line for a moon: whose it is, its size, how it goes round, and how far it is:
 * "A moon of Jupiter · 3,122 km across · goes round every 3.55 days, 671,000 km out · 4.28 AU
 * from Earth".
 */
export function moonLine(moon: MoonName, orbit: MoonOrbit, fromEarthKm: number): string {
  const across = Math.round(2 * MOON_RADIUS_KM[moon]).toLocaleString('en');
  const days = 360 / orbit.longitude[1];
  const period =
    days < 2 ? `${String(Math.round(days * 24 * 10) / 10)} hours` : `${days.toFixed(2)} days`;
  const out = (Math.round(orbit.axisKm / 1000) * 1000).toLocaleString('en');
  return [
    `A moon of ${PLANET_NAMES[moonPlanet(moon)]}`,
    `${across} km across`,
    `goes round every ${period}, ${out} km out`,
    `${(fromEarthKm / AU_KM).toFixed(2)} AU from Earth`,
  ].join(' · ');
}

/** What the bar says of where a moon's story comes from: "Found by …". */
export function moonAbout(moon: MoonName): string {
  const { found, about } = MOON_FACTS[moon];
  return `${MOON_NAMES[moon]} was found by ${found}. ${about}`;
}
