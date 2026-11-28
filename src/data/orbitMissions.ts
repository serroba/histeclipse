/**
 * Missions that stay about Earth (#800), the Hubble Space Telescope the first: the moments the
 * record of where a craft went cannot give, for its phases name only Earth. Each moment is dated
 * from a credited source: Hubble's launch, its release and its five servicing flights from NASA's
 * page on the missions to Hubble. Keyed by the craft's GCAT id.
 *
 * Pure.
 */

/** A moment of a mission about Earth: what happened, in a sentence, and its day (UT). */
interface OrbitMoment {
  readonly name: string;
  readonly meaning: string;
  /** "1990-04-24". */
  readonly date: string;
}

export interface OrbitMission {
  readonly moments: readonly OrbitMoment[];
  /** Whose dates they are: an id in the sources' registry. */
  readonly source: 'nasaHubbleMissions';
}

export const ORBIT_MISSIONS: Readonly<Record<string, OrbitMission>> = {
  S20580: {
    source: 'nasaHubbleMissions',
    moments: [
      {
        name: 'Launched on Discovery',
        meaning: 'Space Shuttle Discovery carries Hubble into orbit on STS-31.',
        date: '1990-04-24',
      },
      {
        name: 'Set free',
        meaning:
          'Discovery’s robotic arm releases Hubble. Its first pictures soon show a flaw in its main mirror.',
        date: '1990-04-25',
      },
      {
        name: 'First servicing: its sight corrected',
        meaning:
          'Astronauts on Endeavour (STS-61) install new instruments, with equipment that counters the flaw in its mirror.',
        date: '1993-12-02',
      },
      {
        name: 'Second servicing: new instruments',
        meaning:
          'Astronauts on Discovery (STS-82) install two new instruments, widening the range of wavelengths Hubble sees.',
        date: '1997-02-11',
      },
      {
        name: 'Servicing 3A: new gyroscopes',
        meaning:
          'With four of its six gyroscopes failed and Hubble asleep in safe mode, astronauts on Discovery (STS-103) replace them.',
        date: '1999-12-19',
      },
      {
        name: 'Servicing 3B: new solar panels and camera',
        meaning:
          'Astronauts on Columbia (STS-109) replace its solar panels and install the Advanced Camera for Surveys, in place of its last original instrument.',
        date: '2002-03-01',
      },
      {
        name: 'Last servicing',
        meaning:
          'Astronauts on Atlantis (STS-125), the fifth and last flight to Hubble, leave it at the peak of its powers for many more years.',
        date: '2009-05-11',
      },
    ],
  },
};
