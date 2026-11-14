# Navigation: discover by topic, explore through time

The interaction model for epic #724, agreed in #725 before any broad UI change. Later issues
(#726–#732) build to this document; when one of them changes a decision, it changes this file in
the same pull request.

## 1. Where we start

### Entry points today

| Where                                                       | What it does                                                                                                         | Moves time / camera?                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Header: **Years · Ice ages · 540 Myr · 4.6 Gyr**            | Picks the span; deep spans swap the time bar and the renderer                                                        | Time, yes; camera stays                       |
| Header: **Layers**                                          | One panel for every layer, in four groups (People; Earth and life; Climate and air; Sky and events), each with reach | Only its "Go to …" buttons, which change span |
| Deep-time bar: **chips**                                    | Plates, Fossils, Humans, Temperature, Sea level, Impacts, Air: the same layers as the panel, toggled from the bar    | No                                            |
| Header: **Search**                                          | Passages, missions, landings, records; a result opens its anchor                                                     | Yes: body, place and time of the anchor       |
| Header: **Orbit · Moon from Earth · Earth from Moon · Sky** | Perspective                                                                                                          | Camera only                                   |
| Zoom rail                                                   | Distance, and bodies to fly to (Earth, Moon, planets, Saturn), spacecraft and asteroid belt toggles                  | Camera; the toggles are layers                |
| Welcome: **Start with a famous eclipse**                    | A curated list of eclipses (first visit only)                                                                        | Yes                                           |
| Header: **Boundaries**                                      | Which border source draws                                                                                            | No                                            |
| Picking a place / object                                    | Cards (`About here`, mission card, rock, fossil counts); some offer a jump (a rock to "the Earth when it formed")    | Some cards' links do                          |
| First visit                                                 | Opens over the reader's region (time zone), today                                                                    | Camera                                        |

Screenshots of these (desktop 1440×900, phone 390×844) were taken from `main` at 224e2400 while
writing this; they are not committed.

### Friction

1. **The span comes first.** The first choice offered after the date is _how far back the bar
   reaches_. A visitor who wants human origins must know that finds live under "Ice ages", fossils
   under "540 Myr", ancient genomes under "Years".
2. **Two places switch the same layers.** The Layers panel and the deep-time chips toggle the same
   `Layer` ids, with different labels and grouping, and the chips exist only in deep time.
3. **Layers mixes discovery and display.** "Humans" in the panel is greyed with an "Ice ages ›"
   button: a layer toggle is being used as the way to _find_ a subject, and it moves time.
4. **The subject's own interval is not offered.** Only missions (#712–#720) fit time to the
   subject; everything else keeps whatever the span's bar shows.
5. **Curated entry is eclipse-only.** "Start with a famous eclipse" is the only invitation, and it
   disappears after a first visit.
6. **Deep time's bar is a second page.** In 540 Myr and Ice ages the bar carries the time, the
   chips, notes and the layer's long explanation, and takes half the screen on desktop and most of
   it on phones.
7. **Phones stack everything.** Header, switches and bar are all open at once; the globe gets the
   space between them.

### What already works and is kept

- The **mission view** (#712–#720): search finds a mission, opening it fits time to the journey,
  landings are places in it, the play bar plays its interval. Journey 1 is mostly this.
- **URL state** (`src/state/url.ts`, `slices/`): every view is a link; `urlSync.step()` makes a
  history entry for a step worth going back from.
- **Layer metadata** (`src/state/layerCatalog.ts`): spans, reach, the note outside reach, and
  `arrive` (where to land, used by one layer today).
- **Search anchors** (`src/text/passages.ts`, `anchors.ts`): body, place, interval and label of a
  view to open.
- **Out-of-reach notes**: a layer outside its data says so and offers to go there; nothing is
  hidden silently.

## 2. The model: five controls, one job each

| Control     | Answers                        | Finds / changes                                        | May move time? | May move camera? |
| ----------- | ------------------------------ | ------------------------------------------------------ | -------------- | ---------------- |
| **Explore** | "What can I see here?"         | Destinations, by topic, and suggested questions        | Yes            | Yes              |
| **Search**  | "Where is _this_ named thing?" | Missions, places, records, passages                    | Yes            | Yes              |
| **Layers**  | "What is drawn?"               | Toggles and sources of drawings                        | **No**         | **No**           |
| **View**    | "From where do I look?"        | Body in focus, Orbit / from the Moon / Sky, distance   | No             | Yes              |
| **Time**    | "When, and how much of it?"    | The moment, the visible range, presets, Fit this topic | Yes            | No               |

Rules:

- **Only Explore, Search, related links and Time move time.** A layer toggle never moves time or
  camera. A layer outside its reach says so and offers an explicit **Go to available data** button
  (that button is navigation, and may move time).
- **Spans become range presets inside Time** (Years · Ice ages · 540 Myr · 4.6 Gyr), not the first
  thing in the header. The renderer each needs (historical vs deep) stays; picking a destination
  selects it.
- **Active layers are always visible** as small removable chips near the time control, in every
  span. They replace the deep-time chips; the full catalogue stays in Layers.
- **Destinations and layers are different things.** A destination may turn layers on; turning a
  layer on is never how a subject is found.
- One **detail sheet** at a time (mission, rock, fossil counts, about here): it owns the side on
  desktop and the bottom on phones, and carries Related links (#731) and Sources/Why.

## 3. Destinations

A destination is a named view worth arriving at. It is data, not code:

```ts
interface Destination {
  readonly id: string; // stable, used in links: 'moon-landings', 'human-origins', 'ancient-australia'
  readonly label: string;
  readonly topics: readonly Topic[]; // may be several
  readonly description: string; // one or two sentences
  readonly questions?: readonly string[]; // suggested questions it answers
  readonly arrive: Arrival; // body, place, time or age, span, layers, camera distance, selection
  readonly fit?: TimeFrame; // the interval "Fit this topic" restores, with precision
  readonly needs: readonly Layer[]; // data that will load on arrival, never on import
}
type Topic = 'space' | 'earth' | 'life' | 'people' | 'climate';
```

Decisions:

- **Topics and layer groups are separate on purpose.** Topics (Space, Earth, Life, People,
  Climate) organise _destinations_ in Explore. The Layers panel keeps grouping by what is drawn,
  but its group names are aligned with the topic words so the two read as one vocabulary:
  People → **People**; Earth and life → **Earth** and **Life**; Climate and air → **Climate**; Sky
  and events → **Space**. (Renaming is part of #728.)
- **The registry is built from what exists, not beside it.** `arrive` reuses the layer catalogue's
  `arrive` and search anchors' shape; a layer's "Go to available data" becomes a destination
  lookup. Missions and landings stay search results; a "Moon landings" destination opens the
  mission list rather than duplicating it.
- **Where it lives.** Features may not import each other, and destinations point across many
  features, so the registry lives in `src/explore/` (a new top-level folder in the `text` tier,
  importing only `state/` types and `text/` anchors) and holds ids and descriptions only. Each feature still
  loads its data lazily when its layer turns on.
- **Arrival replaces, it does not merge.** Selecting a destination replaces: time (or age) and
  span, body in focus, camera, selection, and the destination's layers. It **preserves**: display
  settings (calendar, figures, culture, borders source), and layers the reader turned on that
  draw in the new span. Layers that cannot draw there stay on, shown as out-of-reach chips —
  never silently dropped.
- **Coverage is stated, never invented.** A destination only offers a view its data supports; its
  arrival shows each active layer's reach (see §6).

## 4. Links and history

- A link keeps describing the **resulting state**, as today; old links read exactly as before.
- Arriving at a destination adds `explore=<id>`, so the line under the date ("Exploring Human
  origins") and Fit this topic survive reload and sharing. It stays while the reader explores
  from there, by hand, in time or space: it says where they arrived from, and Fit this topic
  shows whenever the view has left the destination's time. Opening a search result or another
  destination replaces it. (As built in #729; this replaces dropping it on a change of span.)
- Arriving is a **step** (`urlSync.step()`): Back returns to the view before, including time and
  selection. Scrubbing and layer toggles keep replacing the current entry, as now.

## 5. Time

- **One Time control**: the moment (date or age, with BCE/CE and ka/Ma/Ga), the visible range, the
  presets, play, and **Fit this topic** when a destination or selection has a frame.
- **Fitting**: a destination or selected object (mission, dated find, geological age) proposes a
  frame with padding and a precision (days for a mission, thousands of years for a find, millions
  for an age). Fitting picks the preset whose renderer can show it and says so in one line
  ("Showing 70–40 thousand years ago").
- **Manual exploration is respected**: once the reader scrubs or zooms the range, nothing refits it
  until they press Fit this topic or pick another destination.
- **No single slider** from 4.6 Ga to today; the presets keep their own scales and the boundaries
  between them never imply a continuous reconstruction across them.

## 6. Coverage states

Every active layer chip and every destination shows one of:

| State             | Shown as                                     | Action                   |
| ----------------- | -------------------------------------------- | ------------------------ |
| Draws here        | Chip in colour                               | Remove; open its Why     |
| Outside its time  | Chip outlined, "from 10,000 years ago"       | **Go to available data** |
| Outside its place | The layer's note ("no finds near here")      | None (the map says so)   |
| Loading / failed  | Chip with spinner / "could not load" + retry | Retry                    |

## 7. The three journeys

| Step        | Moon landing                                                | Human origins                                                             | Ancient Australia                                                                 |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Today**   | Search "Apollo 11" → result → mission view. Works.          | Know to pick Ice ages, then Humans; genomes are under Years, separately   | Pick 540 Myr, turn the globe, Fossils chip; rocks only in Years                   |
| Entry       | Explore → Space → _Moon landings_, or Search                | Explore → People → _Human origins_ ("Where were the first Homo sapiens?") | Explore → Earth → _Ancient Australia_ ("What did Australia look like 100 Ma?")    |
| Arrival     | Mission list; picking one opens the mission view (exists)   | Ice ages preset, ~315 ka (Jebel Irhoud), Humans on, Africa in view        | 540 Myr preset at 100 Ma, Australia centred, plates and fossils on                |
| Time change | Mission interval, fitted (exists); Fit restores it          | Fit spans 315–40 ka; scrub to dispersal; preset to Years for genomes      | Age entry (e.g. 250 Ma); presets; Fit returns to the destination's age            |
| Related     | Landing → the place on the Moon; mission → destination body | Find → dispersal model; Years → ancient genomes in the region             | Fossil count → lineage (tree); rock (Years) → "the Earth when it formed" (exists) |
| Return      | Back → the list / view before                               | Back → previous range and selection                                       | Back → previous age; Explore keeps the topic open                                 |

Each journey must work by keyboard and touch (#732).

## 8. Wireframes

### Desktop

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ HISTECLIPSE  [◎ Explore]  [⌕ Search]               [▤ Layers]  [◐ View ▾]   [⛶ Full view] │
│ 60,000 years ago · Quaternary                                                              │
├───────────────────────┐                                                ┌─────────────────┤
│ EXPLORE        ✕      │                                                │ JEBEL IRHOUD  ✕ │
│ Space Earth Life      │                  ( globe )                     │ 281–349 ka      │
│ [People] Climate      │                                                │ Sources · Why   │
│                       │                                                │ Related         │
│ Human origins       › │                                                │ › Dispersal     │
│  Where were the first │                                                │   from Africa   │
│  Homo sapiens?        │                                                │ › Ancient DNA   │
│ Ancient DNA         › │                                                │   in the region │
│ Ways of life        › │                                                └─────────────────┤
│ States and empires  › │                                                                  │
├───────────────────────┘                                                                  │
│      ┌────────────────────────────────────────────────────────────────────────────────┐  │
│      │ ▶  ‹  [ 60 ka ▾ ]  ─────────●──────────────  315 ka … 40 ka   [Fit this topic]   │  │
│      │ Years · [Ice ages] · 540 Myr · 4.6 Gyr        speed 50 kyr/s                     │  │
│      │ (Humans ×) (Ice sheets ×) (Ancient DNA: from 10,000 years ago → Go)              │  │
│      └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- Explore and Layers take the same side (the right, as Layers does today) and only one of them
  is open at a time; the detail sheet takes the left. The globe keeps the centre. (As built in
  #727: in the header's tools Explore keeps its word; Boundaries and Full view show their icons
  alone, so the row leaves the site's name clear.)
- The span switch moves into Time as presets; layer chips sit under the time bar in every span.
- Layer explanations move to each chip's Why, not under the bar.

### Phone

```
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ HISTECLIPSE   ◎  ⌕  ▤  ◐ │   │ HISTECLIPSE   ◎  ⌕  ▤  ◐ │   │ HISTECLIPSE   ◎  ⌕  ▤  ◐ │
│ 60,000 years ago         │   │                          │   │                          │
│                          │   │        ( globe )         │   │        ( globe )         │
│        ( globe )         │   │                          │   ├──────────────────────────┤
│                          │   ├──────────────────────────┤   │ ═══  JEBEL IRHOUD     ✕  │
│                          │   │ ═══  EXPLORE          ✕  │   │ 281–349 ka               │
│                          │   │ Space Earth Life People… │   │ Related                  │
├──────────────────────────┤   │ Human origins          › │   │ › Dispersal from Africa  │
│ ▶ [60 ka ▾] ───●───  Fit │   │ Ancient DNA            › │   │ › Ancient DNA here       │
│ (Humans ×)(Ice sheets ×) │   │ Ways of life           › │   │ Sources · Why            │
└──────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
      at rest: time only            Explore sheet                 detail sheet
```

- **One bottom sheet at a time** on phones: Explore, Search, Layers, View options or detail.
  Opening one closes the other; the time strip collapses to one line under a sheet.
- The header shrinks to icons with labels for screen readers; the date sits under it.
- Sheets have a grab handle and fold to a peek (existing `foldingSheet`), so the globe stays
  usable.

## 9. Keyboard and focus

- Header order: Explore, Search, Layers, View, Full view; then the sheet that is open; then Time.
- Opening a sheet moves focus to its heading; Escape closes it and returns focus to the button
  that opened it.
- Explore: arrow keys move between topics (a tablist); Enter opens a destination. Arriving closes
  Explore on phones and keeps it open on desktop, with the destination marked current.
- Time: the moment is a text field accepting "1969", "44 BCE", "60 ka", "100 Ma"; arrow keys step
  it; presets are a radio group.
- Every chip is a button with its state in its label ("Humans, drawing; remove").

## 10. Changes to the epic's plan

- **#726** builds `src/explore/` from the layer catalogue's `arrive` and search anchors; it does
  not add a second state model. It adds `explore=<id>` to links (§4).
- **#728** can start before #727 for its chip part: active-layer chips in every span replace the
  deep-time chips (friction 2), independent of Explore. Renaming the layer groups (§3) is part of
  it.
- **#729** can start with missions right after #726: the mission view already fits its interval;
  generalise it to dated finds and ages.
- **#727/#728** add parts outside `app.ts` (which is near its line limit); #606 (a parts registry)
  would help but is not a prerequisite.
- Journey 3 (Ancient Australia) is the hardest test of §5 and should be checked first in #729/#730,
  not last.

## 11. Open questions

1. Should Explore replace the first-visit "Start with a famous eclipse" invitation (eclipses
   becoming a Space destination with its list), or sit beside it? _Default: Explore replaces it;
   famous eclipses become a Space destination._
2. On desktop, should arriving at a destination keep Explore open (to compare destinations) or close
   it for the globe? _Default: keep it open, marked current._
3. Do suggested questions show inside each topic only, or also as a short rotating line on the
   first visit? _Default: inside topics only._
