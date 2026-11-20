/**
 * The Paleo-CO2 Data Archive (#444), loaded the first time the reader picks its estimates in
 * deep time's bar: the bar asks for it, and the air's layer shows it once it is in.
 */

import { loadCo2Archive, type Co2Archive } from '../../data/co2Archive';
import { errorMessage } from '../../util/errors';
import type { Fetch } from '../../util/fetchJson';

export interface Co2ArchiveFile {
  /** Load the archive, once; a failed load is asked for again the next time. */
  load(): void;
  /** The archive, once it has loaded. */
  loaded(): Co2Archive | null;
}

export function createCo2ArchiveFile(
  base: string,
  fetchJson: Fetch,
  on: {
    /** The archive has arrived: show deep time again. */
    arrived(): void;
    notify(message: string): void;
  },
): Co2ArchiveFile {
  let archive: Co2Archive | null = null;
  let loading: Promise<Co2Archive> | null = null;
  return {
    load() {
      if (archive !== null || loading !== null) return;
      loading = loadCo2Archive(`${base}data/air-co2-archive.json`, fetchJson);
      loading.then(
        (loaded) => {
          archive = loaded;
          on.arrived();
        },
        (error: unknown) => {
          loading = null;
          on.notify(`Could not load the Paleo-CO₂ Data Archive: ${errorMessage(error)}`);
        },
      );
    },
    loaded: () => archive,
  };
}
