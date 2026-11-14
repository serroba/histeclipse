# Rendering efficiency audit

The shared Stage previously skipped unchanged draws but still scheduled a callback and ran every
part's `step()` on every display frame. A deterministic regression test gives it 600 display
opportunities after its initial draw: the previous implementation performs 601 update passes and
one draw. The demand-driven implementation performs one update pass and one draw.

A clean, still Stage now sleeps. Invalidations coalesce into a single pending frame; moving parts
request subsequent frames until they settle. Camera flights and damping, playback, controls,
resize, and resource arrivals retain their wake-up paths. A container with `hidden` set defers
updates and drawing; its resize observer or a later update resumes it when shown. This does not
attempt to detect arbitrary occlusion or offscreen canvases.

The existing five production GPU scene probes also check that paused scenes reach a 500 ms window
with no RAF callbacks, resume on input, and return to rest. The Earth probe additionally hides the
container during a flight and verifies wake-up when shown. These run on the real GPU CI runner,
without adding browser scenarios. `test-results/timings-idle-*.json` records observed callbacks
and Chromium main-thread TaskDuration for each successful idle sample; the existing timing
artifact upload retains the files. TaskDuration includes probe overhead and is diagnostic, not
a portable CPU percentage or a performance threshold.

The unit tests cover coalescing, movement, hidden containers, render-time invalidation and
late notifications after disposal. Browser checks cover the production scene wiring so a missed
wake-up cannot be hidden by testing only the scheduler.

Further optimisation should follow measurements. Most application redraw watchers already gate
unchanged state. Sky look changes currently call resize as well as invalidate; measuring repeated
renderer sizing during glides is a sensible next candidate if active navigation is still costly.
