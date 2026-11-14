# Ice-age feature tests

`index.test.ts` mounts the real feature in Node. It supplies small synthetic catalogs through
controlled fetch promises, so the real loaders, runtime schemas, sea-level calculations and
frame selection run together. The globe records commands; it never invokes a layer factory,
creates a DOM or starts WebGL. Completion is drained on the next event-loop turn, without
sleeping, polling or playing an animation in real time.

The existing context already provides this boundary. It now requests only the shared services
it uses (`base`, `fetchJson`, `notify`), rather than all of `PartContext`. A separate controller
factory is unnecessary for these tests.

| Behaviour                      | Feature test                                                  | Browser assurance retained               |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------- |
| First use and repeated renders | Lazy loading, in-flight and completed request reuse           | Real production catalogs are reachable   |
| Failed or invalid catalogs     | Failure notification, retry and validation recovery           | App-level error presentation             |
| Moment and source changes      | Frame interpolation, coastline source and model selection     | Controls update the mounted feature      |
| Pending requests on navigation | Redraw reads current state; leaving deep time clears overlays | Navigation connects to the real globe    |
| Batchelor outlines             | Time slice selection, gaps and clearing on exit               | Actual painting and explanatory DOM text |
| Historical travel              | Historical ice, shelves, sea ice and clearing on stop         | Visible travel/playback journey          |

No E2E scenario is removed by this pilot. In particular, `e2e/ice.spec.ts` still checks actual
outlines and their explanation, gaps between slices, and the plate-motion note. The gap test
also checks DOM visibility, which this feature test does not replace; move that assertion into
an isolated UI test before retiring the scenario. Keep the real ice-age journey in
`e2e/journeys.spec.ts` and the shader check on macOS.

For a new behavioural regression, start with the narrowest boundary that reproduces it.
Reserve another full-application scenario for browser behaviour or wiring not covered here.
