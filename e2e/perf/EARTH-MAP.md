# Earth intermediate-map comparison (#689)

**Decision: retain the 8192 map.** A 4096 intermediate map reduces upload time and texture memory,
but visibly softens terrain and coastlines before close-up tiles take over. It does not meet the
proposed condition of negligible visual loss. This experiment makes no production map change.

## Procedure

The same production application, camera (30° N, 31° E), date (8 April 2024 at 12:00 UTC),
1440 × 900 viewport and close-up tiles; replace only the intermediate-map response. Three
interleaved first-use trials per map in fresh browser contexts. See `earthMap.perf.ts`.

Chromium 156.0.8078.4, ANGLE Metal, Apple Paravirtual device on a hosted macOS runner. These are
synchronous `texSubImage2D` call times, not total navigation latency or hardware-independent
CPU/GPU figures. Hosted runner variability is substantial; compare variants within each run.

| Run                                                                                          | 8192 upload trials (ms) | Median | 4096 upload trials (ms) | Median |
| -------------------------------------------------------------------------------------------- | ----------------------- | -----: | ----------------------- | -----: |
| [First](https://github.com/serroba/histeclipse/actions/runs/43566827975)                     | 1051.5, 775.3, 530.9    |  775.3 | 161.4, 137.9, 180.0     |  161.4 |
| [With retained screenshots](https://github.com/serroba/histeclipse/actions/runs/43567120131) | 630.9, 264.3, 244.4     |  264.3 | 63.5, 57.3, 65.9        |   63.5 |

The smaller texture uses 75% less RGBA texture memory, including mipmaps: approximately 42.7 MiB
instead of 170.7 MiB. Both variants still have the existing tile cache and other scene resources.

## Visual result

The second run's artifact contains both screenshots and differences amplified fourfold. Numeric
metrics include the entire canvas (including background and overlaid controls), so they are not
perceptual quality scores. Differences are candidate versus baseline, channels on a 0–255 scale.

| Camera distance (Earth radii) | Mean absolute channel difference | Pixels with a channel difference > 8 | Result                                  |
| ----------------------------: | -------------------------------: | -----------------------------------: | --------------------------------------- |
|                           2.4 |                            1.148 |                               3.461% | Some detail lost                        |
|                           1.6 |                            3.024 |                              13.947% | Noticeable softening before tiles begin |
|                           1.3 |                            0.054 |                               0.203% | Tiles preserve most detail              |
|                         1.008 |                                0 |                                   0% | Pixel-identical close-up                |

Visual inspection of the 1.6-radii pair confirms the loss around coastlines, mountain ridges and
the Nile delta. The close-up success alone would have missed the intermediate-range regression.
This is one region and one viewport, sufficient to reject the cap but not to certify global
visual equivalence of another approach.

## Next investigation

Keep #689 open. Prefer a method that retains detail: evaluate incremental uploads, or tiled
coverage starting earlier with an explicit visible-tile/memory budget. Idle pre-uploading can
move the interruption but does not itself bound the synchronous copy. Each approach needs the
same screenshots and upload/frame-time comparison before shipping. The Sun upload remains a
separate part of #689.
