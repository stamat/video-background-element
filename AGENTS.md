# video-background-element — agent notes

`<video-background src>`: a cover-fit, muted, looping video background from a YouTube, Vimeo
or video file link, as a custom element. The element is the instance.

My standing conventions — principles, boundaries, the feature checklist, commit and
changelog rules — live in `~/.claude/CLAUDE.md` and apply here without being repeated. This
file carries only what is specific to this repo.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for what belongs in the project and what a pull
request needs.

## Commands

```bash
script/bootstrap # npm ci
script/server    # poops dev server on :4040 with live reload, serves _site/
script/build     # the manifest, the bundles, the controls css and _site/
script/test      # jest over src/__tests__, in jsdom
script/lint      # eslint (the authority; CI runs it)
npm run manifest # regenerate dist/custom-elements.json from the JSDoc
```

## Layout

- **`src/video-background.mjs` is the element** and the main entry: source detection,
  attribute reading, the stylesheet, the observers, and the API proxied onto the provider.
- **`src/lib/`** is the playback: `provider.mjs` holds the state and the arithmetic every
  source shares, `youtube.mjs`, `vimeo.mjs` and `video.mjs` are the three providers over it,
  `load.mjs` loads each platform API once per document.
- **`src/controls.mjs` is a separate bundle and must not import the element.** It finds
  `<video-background>` members by tag name through the registry; an import would put a
  second copy of the element inside it.
- **`src/styles/controls.scss`** becomes `dist/video-background-controls.css`, the only
  stylesheet the package ships.
- **`dist/` is the committed build output:** `video-background*.js` and `.map`,
  `video-background-controls*.{js,css}`, `custom-elements.json`. CI fails if they are
  stale, and `npm publish` ships what is committed - it does not build. `_site/` is
  generated and ignored.
- **`site/` is the demo page and nothing else:** `index.md`, `prose.scss` - the page's one
  stylesheet, which pulls the theme and `src/styles/controls.scss` - and `preview.css`,
  loaded *inside* the preview frames rather than by the page. A new file a frame loads must
  go in `poops.json`'s copy list.
- **Tests:** `src/__tests__/regressions.test.mjs`. Its header says what jsdom cannot cover.

## Documentation

- The README is the reference for people: the attribute table, the API, the events. The
  JSDoc block on `VideoBackground` and `VideoBackgroundGroup` is the same reference for
  machines, and `cem analyze` turns it into `custom-elements.json`. The two must agree; the
  JSON is never edited.
- The demo page is markdown in `site/`, built by poops on the `poops-docs-theme` prose
  layout and deployed by `pages.yml`. Every ` ```html preview ` fence becomes a live
  `<code-preview>` sample through `script/preview.mjs`, after the markup renders.
- **Document in the same change as the code.** A behavior change that ships undocumented
  is unfinished — the README section, the JSDoc, the demo page, whichever covers it.
- **Edit the page that already covers it.** No new pages, README sections, or summary and
  migration files nobody asked for.
- **Write for the person using it**, not the person who wrote it: what it does, one example
  that runs, and the part that would otherwise surprise them.

## Principles

- **Test-driven.** The test is the spec; write it first. A failing test means the code is
  wrong — never weaken, skip, or delete a test to make it pass. If the test itself is
  wrong, say so and let review decide.
- **YAGNI.** Build only what the task needs — no speculative options, abstractions, or
  "for later" scaffolding.
- **Native / stdlib first.** In order: what's already in this repo → the platform → the
  standard library → new code. A new dependency is a last resort and needs a reason.
- **Root cause over symptom.** Fix where all callers route through, not the one path the
  bug report names.
- **Delete dead code.** No commented-out blocks, no "for later" exports — git remembers.

## Boundaries

- **Always:** run `script/lint` and `script/test` before calling work done; pair every fix
  or feature with a test; run `script/build` so the committed output matches; document
  anything user-visible where it is already documented; add a changelog entry under
  `## [Unreleased]`.
- **Ask first:** an attribute name or default; an event name; a rule in the element's
  stylesheet, which pages override by name; a dependency.
- **Never:** edit anything in `dist/` or `_site/` by hand; weaken, skip, or delete a
  test to make it pass; bump the version or publish — a tag does that.

## Before adding a feature

Run this checklist before writing any code; stop at the first "no".

1. **Does the platform or standard library already do it?** If so, there is no feature.
2. **Search for prior art.** How do similar projects do it? What interface do they expose?
   Cite what you found — a URL per fact, no guesses. How can we improve on it? If the
   answer is "we can't", would we benefit from having it here at all?
3. **Does it fit the project?** CONTRIBUTING.md says what this project is for and what it
   refuses to become — a background, not a player; no chrome inside the element; no shadow
   root; no options object. Check before building, not after.
4. **Still yes?** Build the smallest version that works.

## Non-obvious rules

- **`YT.Player` has no methods until `onReady`.** The YouTube provider keeps the object in
  `pending` and sets `player` only from the ready event's `target`, so every
  `if (!this.player)` guard means "not ready". A scroll-in during that gap once threw
  `playVideo is not a function`; keep the guards, never call into `pending`.
- **One promise per platform API per document** (`load.mjs`). A second element never
  installs a second `onYouTubeIframeAPIReady`. The hook is not trusted alone: another
  library on the page — media-elements does this — overwrites it without chaining, and the
  API calls it once, so `YT.loaded` is watched after the script loads too, for ten seconds,
  then the promise rejects loudly. Tests share it too: `window.YT` is stubbed
  once in `beforeAll` and never deleted mid-file, or a later element's `initPlayer` rejects
  unseen.
- **`attributeChangedCallback` runs before `connectedCallback` on upgrade, with
  `isConnected` already true.** `build()` is therefore idempotent and `connectedCallback`
  only builds when nothing has.
- **The player's `opacity: 0` is inline state**, flipped by `reveal()` on the first play.
  The stylesheet never sets it; a seek bar reads it to reveal on a seek before play.
- **A group reads its members on `DOMContentLoaded`** when the parser upgraded it, because
  the children do not exist yet in `connectedCallback`. Members inserted later are not seen.
- **Two `paused`s.** `element.paused` is HTML's — `true` unless `currentState` is
  `playing` or `buffering` — because the element speaks the `<video>` API. `provider.paused`
  is the held pause `pause()` sets and scroll-in never overrides. Nothing public reads the
  second; `shouldPlay()` is how a caller asks it.
- **`loadedmetadata` and `durationchange` come from `setDuration`, on change only.** No
  provider announces readiness itself: YouTube knows the duration at player-ready, Vimeo
  over a promise after it, a file on its own metadata event, so the first known duration is
  the one honest *metadata* moment. Vimeo repeats the same duration four times a second;
  an event per tick would be noise. `playing` and `waiting` come from `announceState()`;
  `play`, `pause` and `ended` from the handlers that reach them, `play` before `playing`.
- **`npm run manifest` runs twice per build on purpose.** poops runs `exec` last, but the
  copy of the manifest into `_site/` runs before that; `package.json` runs it ahead of
  poops, and `poops.json`'s `exec.scripts` runs it again so a watch rebuild picks up a JSDoc
  edit.
- **Scripts inside a preview frame are deferred.** An inline `<script>` in a sample runs
  before them, so a sample that uses `VideoBackgroundControls` waits for `DOMContentLoaded`.
- **jsdom has no playback and no observers.** `IntersectionObserver` missing forces
  `pause-offscreen` off, which is also what the element does in an old browser; playback
  decisions are tested by calling provider prototypes on stubs.
