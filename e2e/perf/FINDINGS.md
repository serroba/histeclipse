# Rendering audit: findings

Baseline of 14 November 2026, on main at `2afe0e49` (after #660, the stage sleeping when idle).
Procedure and the scenario matrix: [README.md](README.md).

## Environment

- Chromium 156.0.8078.4 (Playwright 1.64.1), headless, `--use-angle=metal`
- GPU: ANGLE Metal Renderer, Apple M5
- desktop: 1440 × 900 at scale 1, CPU as is
- phone: 412 × 915 at scale 2.625, CPU ×4 throttle, the Mac's GPU
- HTTP cache warm; 60 Hz display; 3 repeats; medians unless marked otherwise

Times are main-thread time from Chromium's metrics. They are comparisons on this machine, not CPU or battery figures.

## Ranked findings

Ranked by measured cost against expected benefit and implementation risk. Each issue holds the measurements, the profile breakdown and its acceptance criteria.

| #   | Finding                                                                                                                                           | Measured cost                                                                                  | Likely cause                                                           | Expected benefit                              | Risk       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- | ---------- |
| 1   | [#667](https://github.com/serroba/histeclipse/issues/667) The air-shower story, paused at its start, draws at 60 fps forever on an upright screen | 180 draws every 3 s, indefinitely; 3/3 phone setups never rest                                 | Story camera and OrbitControls `change` waking each other (unverified) | The paused story rests                        | Low        |
| 2   | [#666](https://github.com/serroba/histeclipse/issues/666) Sky look changes recompute the whole moment                                             | Sky drag script 285 ms (desktop), 619 ms (phone) per 60 frames, 6–12× the globe drag per frame | `sky.render` runs `bodiesSeen` and `setMoment` on any state change     | ~80% of sky drag script                       | Low–medium |
| 3   | [#668](https://github.com/serroba/histeclipse/issues/668) A story chapter turn stalls the main thread                                             | 379–415 ms long frame on desktop, 241–254 ms on the phone profile                              | Little JS, so most likely shader compile/link on first draw            | Most of the stall                             | Medium     |
| 4   | [#339](https://github.com/serroba/histeclipse/issues/339) The globe draws behind the 3D story                                                     | 242 globe frames plus 241 story frames in 4 s                                                  | The globe is not paused while covered                                  | About half the story's draws                  | Low–medium |
| 5   | [#669](https://github.com/serroba/histeclipse/issues/669) Sky → globe hand-off after tapping the Sun                                              | One 152–156 ms frame (desktop), 202–312 ms (phone)                                             | `texSubImage2D`, 287 ms in the phone profile                           | That frame                                    | Medium     |
| 6   | [#670](https://github.com/serroba/histeclipse/issues/670) Deep-time play re-renders unchanged DOM                                                 | 1,014 ms of tasks in 4 s on the phone profile (25%), 586 ms on desktop                         | Milestone cards rebuilt per frame; polarity spans recomputed           | 30–40% of play's script                       | Low        |
| 7   | [#671](https://github.com/serroba/histeclipse/issues/671) Sky resizes the renderer on every look change                                           | 120 same-size canvas resets per 60 drag frames                                                 | `applyLook` calls `stage.resize()`                                     | Drawing buffer churn (GPU side, not measured) | Low        |
| 8   | [#672](https://github.com/serroba/histeclipse/issues/672) Eclipse play evaluates the Moon's ELP series per frame                                  | 227 ms of 370 ms state update (phone profile, 4 s)                                             | `showTime` → `moon.position` once per frame                            | Most of the 227 ms                            | Medium     |

## Where nothing worthwhile was found

| Scenario                          | Result                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| globe idle, sky idle              | 0 animation-frame callbacks in 3 s, under 1 ms of main thread                                                                      |
| rest after every scenario         | 0 callbacks in the 2 s rest, for all 11 scenarios on both profiles (one exception: #667)                                           |
| globe drag                        | 120 frames, one draw each; the damping settles in 1.1 s, then rests. Script 0.4 ms a frame on desktop, 0.8 ms on the phone profile |
| globe flight to the Moon and back | 147 frames for two 2.5 s flights; at rest the moment each lands                                                                    |
| eclipse scrubbed by keyboard      | one frame per key press (60 for 60)                                                                                                |
| globe to sky and back             | the hidden view draws nothing; one draw each on arrival                                                                            |
| heap                              | no growth across repeats beyond normal variation (8–42 MB)                                                                         |

## Limits of this baseline

- One machine, one GPU. The phone profile slows the CPU, not the GPU. Real phones' GPU costs, shader compilation (#668) and texture uploads (#669) are likely worse, and are not measured.
- Interaction inputs come from Playwright at about one move per 16–33 ms. Sky drag's 33 ms gap is the input rate, not dropped frames.
- The `gap` statistics include deliberate waits inside a scenario (flights, the globe-to-sky stay). Read the worst gap against the action.
- Allocation and garbage-collection rates were not profiled: GC was under 1% of each CPU profile.
