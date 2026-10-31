# DE441 test fixtures

Small excerpts of [JPL DE441](https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de441.bsp) (public domain, NASA/JPL). They hold only the targets in `histeclipse_pipeline.ephemeris.TARGETS` and were made with `histeclipse_pipeline.ephemeris.excerpt`.

| File                                      | Julian Days (TDB)     | Covers                                          |
| ----------------------------------------- | --------------------- | ----------------------------------------------- |
| `de441_-620_mar-may.bsp`                  | 1494686.5 – 1494742.5 | -620 (621 BCE) Mar 25 – May 20, Julian calendar |
| `de441_1969_jun_before_split.bsp`         | 2440373.5 – 2440432.5 | 1969 Jun 1 – Jun 28, up to the DE441 split      |
| `de441_1969_jun_1970_mar_after_split.bsp` | 2440432.5 – 2440655.5 | 1969 Jun 28 – 1970 Mar 10, after the split      |
| `de441_2025_mar-sep.bsp`                  | 2460735.5 – 2460938.5 | 2025 Mar 1 – Sep 20                             |

The two 1969 files sit on either side of the point where DE441 switches segment sets. Loading them together tests that `Ephemeris` joins the segments without a gap.
