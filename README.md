# 📺 video-background
[![npm version](https://img.shields.io/npm/v/video-background)](https://www.npmjs.com/package/video-background)
[![CI](https://img.shields.io/github/actions/workflow/status/stamat/video-background/ci.yml?branch=main&label=CI)](https://github.com/stamat/video-background/actions/workflows/ci.yml)
[![gzip size](https://img.badgesize.io/stamat/video-background/main/video-background.min.js?compression=gzip&label=gzip%20size)](https://github.com/stamat/video-background/blob/main/video-background.js)

> `<video-background src="…">` — a video background from a YouTube, Vimeo or video file
> link, as one tag.

[DEMO HERE ➡️](https://stamat.github.io/video-background/) — every sample on it is live
and editable.

A video behind a hero costs more than an iframe. It has to cover the box at the video's own
ratio and follow the box when it resizes, start muted because that is the only autoplay a
browser allows, loop, hide the platform's chrome, and stop when it scrolls out of view or
the tab goes idle — get one of those wrong and it plays into the void at full bandwidth, or
never starts at all and nothing says why. This element is that list, done once:

```html
<script src="https://unpkg.com/video-background/video-background.min.js"></script>

<div class="hero">
  <video-background src="https://www.youtube.com/watch?v=eEpEeyqGlxA"></video-background>
  <h1>Above the video</h1>
</div>
```

The element fills whatever it sits in and sits under its siblings. No CSS to write, no init
call, no cookies from YouTube or Vimeo unless you ask for them.

- [What it is not](#what-it-is-not)
- [Install](#install)
- [Use](#use)
- [Attributes](#attributes)
- [The element is the instance](#the-element-is-the-instance) — [API](#api), [State](#state), [Events](#events)
- [Controls](#controls) — [Group](#group)
- [The manifest](#the-manifest)
- [Coming from youtube-background](#coming-from-youtube-background)
- [Known limits](#known-limits)
- [Browser support](#browser-support)
- [Development](#development)

## What it is not

A background, not a player: there is no play button, no scrub bar, no poster-then-click
facade unless you build them from the [controls](#controls). Two well-made elements cover
the player half, and a plain `<video>` covers the file-only case with nothing to install:

| Instead | When |
| --- | --- |
| [`<lite-youtube>`](https://github.com/justinribeiro/lite-youtube) | a YouTube embed that shows a thumbnail and loads the player on click — a video the visitor watches, not one behind the page |
| [`<youtube-video>`](https://github.com/muxinc/media-elements) / `<vimeo-video>` | an element with the `<video>` API over a platform player, for a media chrome of your own |
| `<video autoplay muted loop playsinline>` + `object-fit: cover` | the source is a file you host, and you never need YouTube or Vimeo |

## Install

```sh
npm install video-background
```

Importing defines the element; there is nothing to call. The controls are a second entry
so a page without them does not carry them, and their stylesheet a third:

```javascript
import "video-background";
import { SeekBar, PlayToggle, MuteToggle } from "video-background/controls";
import "video-background/controls.css"; // optional, see Controls
```

Or two script tags and no build step, from the package or a CDN:

```html
<script src="https://unpkg.com/video-background/video-background.min.js"></script>
<script src="https://unpkg.com/video-background/video-background-controls.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/video-background/video-background-controls.min.css">
```

The bundles are IIFEs built for ES2019. The first defines `<video-background>` and
exposes nothing else — the class is `customElements.get("video-background")`. The second
defines `<video-background-group>` and puts the three control classes on
`window.VideoBackgroundControls`.

## Use

The element is the background of the element it sits in. It is absolutely positioned over
that box, at `z-index: 0`, with `pointer-events: none`, and the player inside it is centred
and sized to cover the box at the video's ratio — 16:9 unless `resolution` says otherwise —
plus `offset` pixels of overscan that keep the platform's edge chrome out of view. If the
box is not positioned, the element sets `position: relative` on it, because a background
needs a containing block and there is no other way to get one.

Everything it needs it writes itself: one `<style>` in `<head>`, once per document, every
rule inside `:where()` so it has no specificity and any rule of yours wins without
`!important`; and the computed size on the player, which is state and stays inline.

Children are yours. A poster `<img>` inside the element shows before the first frame and
stays what a crawler and a visitor without script see, which is what `poster` as an
attribute cannot do:

```html
<div class="hero">
  <video-background src="https://vimeo.com/137250145">
    <img src="poster.jpg" alt="" loading="lazy">
  </video-background>
</div>
```

`src` is the whole lifecycle. Remove it and the player is torn down; set it and the player
is built; set a url of the same type and the video is swapped in place. An element added to
the page later builds itself — that is what a custom element is for, and why there is no
`add()` and no MutationObserver to write — and an element removed from the page tears
itself down.

## Attributes

Read when the element builds, which is when it connects with a `src`. Only `src`,
`start-at` and `end-at` are watched afterwards; a change to any other attribute takes effect
on the next build, which removing and re-adding `src` forces.

A bare boolean attribute is `true`, so `<video-background muted>` reads like
`<video muted>`; a default that is on is turned off with `="false"`, because HTML has no
bare way to write a false one.

| Attribute | Default | What it does |
| --- | --- | --- |
| `src` | — | A YouTube, Vimeo or video file url. The type is read off the link: `youtu.be`, `youtube.com/watch`, `vimeo.com`, or a file ending in `.mp4`, `.webm`, `.ogg`, `.ogv`, `.ogm`, `.avi`, `.mov`, `.m4v` or `.qt`. An unlisted Vimeo link keeps its hash. |
| `autoplay` | `true` | Start as soon as the element is in view |
| `muted` | `true` | Start muted — which is what lets autoplay through |
| `loop` | `true` | Restart when the video ends |
| `mobile` | `true` | Build the player on touch devices too. Off, the element keeps only its poster there |
| `always-play` | `false` | Keep playing off-screen instead of pausing |
| `start-at` | `0` | Seconds to start from |
| `end-at` | `0` | Seconds to stop at, `0` for the full duration |
| `volume` | `1` | `0` to `1`, applied on the first unmute. Mobile browsers ignore it |
| `poster` | — | Image url shown behind the player until the first frame |
| `load-background` | `false` | Use the platform's own thumbnail as the poster. YouTube and Vimeo only |
| `resolution` | `16:9` | Aspect ratio the player is sized by to cover the box |
| `fit-box` | `false` | Stretch to the box instead of covering it |
| `offset` | `100` | Pixels of overscan past the box, hiding the platform's edge chrome |
| `no-cookie` | `true` | Embed from `youtube-nocookie.com`, and with `dnt=1` on Vimeo |
| `lazyloading` | `false` | `loading="lazy"` on the iframe. YouTube and Vimeo only |
| `force-on-low-battery` | `false` | On a touch device, start a muted autoplay on the first touch, for the low power modes that block autoplay |
| `title` | `Video background` | Accessible name of the player frame |

## The element is the instance

Whatever you would have asked an instance, ask the element. The API, the state and every
event live on it, and `event.detail` is the element.

```javascript
const hero = document.querySelector("#hero");

hero.addEventListener("video-background-ready", () => {
  hero.unmute();
  hero.setVolume(0.4);
});

document.querySelectorAll("video-background").forEach((element) => element.pause());
```

### API

| Method | Accepts | Does |
| --- | --- | --- |
| `play()` | — | Play, and clear `paused` |
| `pause()` | — | Pause, and set `paused` — nothing but `play()` starts it again |
| `softPlay()` | — | Play without clearing `paused`, the way scrolling into view does |
| `softPause()` | — | Pause without setting `paused`, the way scrolling out does |
| `mute()` / `unmute()` | — | Sound off, sound on |
| `setVolume(volume)` | `0`–`1` | Set the volume |
| `getVolume()` | — | The volume — a promise on Vimeo, which reports asynchronously |
| `seek(percentage)` | `0`–`100` | Seek within `start-at`..`end-at` |
| `seekTo(seconds)` | seconds | Seek to a time |
| `setSource(url)` | url | The same as setting `src` |
| `setStartAt(seconds)` / `setEndAt(seconds)` | seconds | The same as setting `start-at` / `end-at` |
| `resize()` | — | Re-fit the player to the box; the element does this itself |
| `timeToPercentage(seconds)` / `percentageToTime(percentage)` | | The conversion the seek bar uses, within `start-at`..`end-at` |
| `shouldPlay()` | — | Whether the video would start now — the gate scroll-in and a tab switch ask |

Before the element has built — no `src`, a link of no known type, `mobile="false"` on a
touch device — the methods are no-ops and the state below is at rest. Nothing throws.

### State

| Property | |
| --- | --- |
| `type` | `youtube`, `vimeo` or `video` |
| `player` | The YouTube or Vimeo player object, or the `<video>` element |
| `playerElement` | The `<iframe>` or `<video>` inside the element |
| `currentState` | `notstarted`, `playing`, `paused`, `buffering` or `ended` |
| `currentTime` | Seconds |
| `duration` | Seconds, capped by `end-at` |
| `percentComplete` | `0`–`100` |
| `paused` | `true` after `pause()` — a pause the visitor asked for, which scrolling and tab switches never override |
| `muted` | |
| `volume` | `0`–`1` |
| `isIntersecting` | Whether the element is in the viewport |
| `params` | The attributes as read at build |

### Events

Dispatched on the element, bubbling, the element in `event.detail`:

| Event | When |
| --- | --- |
| `video-background-ready` | The player can play. A video file is ready at once |
| `video-background-play` / `video-background-pause` | Playback started, paused |
| `video-background-ended` | The video reached its end, or `end-at`. With `loop` on it restarts right after |
| `video-background-seeked` | The position moved, through `seek`, `seekTo` or a seek bar |
| `video-background-time-update` | The position advanced while playing — about four times a second |
| `video-background-state-change` | `currentState` changed |
| `video-background-mute` / `video-background-unmute` | Sound off, on |
| `video-background-volume-change` | `volume` changed |
| `video-background-resize` | The player was re-sized to the box |
| `video-background-destroyed` | The player was torn down: `src` removed, or the element disconnected |

## Controls

Optional, in a bundle of their own. Each is a class over markup you write, pointed at a
background by `data-target`; it wires the markup and never styles it.

```html
<div data-target="#hero" class="seek-bar-wrapper">
  <progress class="seek-bar-progress js-seek-bar-progress" value="0" max="100" aria-hidden="true"></progress>
  <input class="seek-bar js-seek-bar" type="range" value="0" min="0" max="100" step="any" aria-label="Seek">
</div>
<button data-target="#hero">Play</button>
<button data-target="#hero">Mute</button>
```

```javascript
import { SeekBar, PlayToggle, MuteToggle } from "video-background/controls";

new SeekBar(document.querySelector(".seek-bar-wrapper"));
new PlayToggle(document.querySelector("button:nth-of-type(1)"));
new MuteToggle(document.querySelector("button:nth-of-type(2)"));
```

| Class | Markup it expects | What it does |
| --- | --- | --- |
| `SeekBar` | A wrapper with an `<input type="range">` from 0 to 100 marked `.js-seek-bar`, and optionally a `<progress>` marked `.js-seek-bar-progress` for the played fill | Moves on an animation frame while the video plays — providers report time about four times a second, which is visibly steppy — seeks on `change`, and names the input `Seek` if you gave it no name |
| `PlayToggle` | A `<button>` | Writes `aria-pressed`, `true` while playing or buffering, and `type="button"` if you gave it none; a click plays or pauses |
| `MuteToggle` | A `<button>` | Writes `aria-pressed`, `true` while muted, and `type="button"` if you gave it none; a click mutes or unmutes |

The toggles are [toggle buttons](https://www.w3.org/WAI/ARIA/apg/patterns/button/): the
name you give one never changes, and `aria-pressed` is the state. Pressed means what the
name says is in effect — name them `Play` and `Mute`, and a screen reader says "Play,
toggle button, pressed" while the video plays. Do not name one `Pause` or swap the name
yourself; with `aria-pressed` that says the state twice.

Each takes the target element as an optional second argument — `new SeekBar(element,
hero)` — in which case `data-target` can be left off. **Every control has a `destroy()`**
that removes the listeners it attached. A control is held alive by the element it points at
for as long as that element lives, so a page that re-renders its controls — a framework, a
live editor — calls `destroy()` on the old ones before making new ones, or every seek bar
ever made keeps updating on each tick.

`video-background/controls.css` is the look of the seek bar — the `<progress>` under a
transparent range, the thumb that appears on hover — and the stacking a group needs. It is
optional: the classes work without it, and the `.seek-bar-wrapper`, `.seek-bar-progress`
and `.seek-bar` classes it styles are separate from the `js-` ones the classes read, so
either can be swapped for your own. `--seek-bar-height`, `--seek-bar-thumb-size`,
`--seek-bar-thumb-color`, `--seek-bar-progress-color` and `--seek-bar-color` retheme it.

### Group

`<video-background-group>` plays the `<video-background>` elements inside it as one
playlist: one shown at a time, stepping to the next when the current one ends.

```html
<div class="hero">
  <video-background-group id="stack">
    <video-background src="https://www.youtube.com/watch?v=LC5rEhxGqT4" loop="false"></video-background>
    <video-background src="https://vimeo.com/137250145" loop="false" autoplay="false"></video-background>
  </video-background-group>
</div>
<button onclick="stack.next()">Next</button>
```

`loop="false"` is what makes a member end, and an ended member is what advances the group,
so a looping member holds the playlist forever. The group only toggles `display` between
its members; the controls stylesheet stacks them over the group's box and hides every one
but the first, and without it that is your CSS. It has `next()`, `prev()`, `play()`,
`pause()`, `mute()` and `unmute()`, and dispatches on itself, with the group in
`event.detail`: `video-background-group-play`, `-pause`, `-mute`, `-unmute`, `-next`,
`-previous`, and `-forward-rewind` / `-backward-rewind` when stepping past either end wraps
around.

A group reads its members when the document has finished parsing, so members must be in
the markup by then, or the group inserted whole.

## The manifest

`custom-elements.json` ships in the package, as the `customElements` key and as the
`video-background/custom-elements.json` export — a
[Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
generated from the JSDoc on the two element classes. An editor that reads one gets
completion for the attributes; the demo page feeds it to
[`<code-preview>`](https://github.com/stamat/code-preview-element), which turns it into the
Options tab beside every sample. The attribute table above and that JSDoc block have to
agree; the manifest is never edited by hand.

## Coming from youtube-background

This is [youtube-background](https://github.com/stamat/youtube-background) continued under a
name that admits it plays Vimeo and files too: the same providers, the `[data-vbg]` factory
replaced by the element. The page markup changes, the options keep their names, and the
events keep theirs. That package stays published at 1.x and keeps its own README and
[demo](https://stamat.github.io/youtube-background/); nothing there breaks. The
[changelog](CHANGELOG.md) has every change with its reason; this is the map.

| youtube-background | video-background |
| --- | --- |
| `<div data-vbg="url" data-vbg-start-at="10">` | `<video-background src="url" start-at="10">` |
| `new VideoBackgrounds("[data-vbg]")` | nothing — importing or loading the script defines the element |
| `backgrounds.get(element)` | the element |
| `backgrounds.add(element)` | append the element |
| `backgrounds.destroy(element)` | remove `src`, or the element |
| `destroyAll()`, `disconnect()`, `pauseAll()`, `playAll()`, `muteAll()`, `unmuteAll()`, `setVolumeAll()` | `document.querySelectorAll("video-background").forEach(…)` |
| `data-vbg-uid`, `index`, `intersectionObserver`, `resizeObserver` | gone — the element observes itself |
| `play-button`, `mute-button`, `pause`, and their Font Awesome markup | gone — `PlayToggle` and `MuteToggle` over a button of yours |
| `inline-styles` | gone — the element's styles are a `:where()` stylesheet you override without `!important` |
| `data-ytbg`, `data-youtube`, `data-ytbg-*` | gone — `src` and the attribute names |
| `jQuery("[data-vbg]").youtube_background()` | gone |
| `jquery.youtube-background.js` | `video-background.js` |
| `youtube-background-experimental.js`, `window.SeekBar` | `video-background-controls.js`, `VideoBackgroundControls.SeekBar` |
| `youtube-background` on npm | `video-background` on npm |
| `new VideoBackgroundGroup(el)`, `VideoBackgroundGroups` | `<video-background-group>` |
| `instance.element` | the element |

## Known limits

**The parent is the box.** The element covers the element it sits in, and nothing else:
there is no attribute to make an existing `<section>` the background itself. Put the
element inside the section, first.

**No shadow root.** The player is in the light DOM on purpose — your CSS reaches the
`<iframe>` and `<video>`, your poster `<img>` is a plain child — and the price is that a
page-wide `iframe { … }` rule reaches them too. The element's own rules have no
specificity, so anything of yours wins; if something of yours breaks the player, that is
where to look.

**YouTube's play/pause bezel cannot be removed.** Every playback toggle flashes YouTube's
own big round icon in the middle of the frame — `.ytp-bezel`, drawn by the player inside the
iframe. It started showing on embeds in **May 2026**:
[#77](https://github.com/stamat/youtube-background/issues/77) is the first report here, on
the 5th, a second one followed on the 27th, and nothing on YouTube's side announces it — the
player parameter revision history has had no entry since August 2023. The embed already goes
out with `controls=0`, which takes away the control bar and not that. The iframe is
cross-origin: no stylesheet of yours selects into it, and script that reaches for its
document throws.

The one thing that does remove it is **cosmetic filtering** — an element-hiding rule in
Adblock Plus / uBlock Origin filter syntax, where `##` means *hide what this selector
matches on these domains*:

```text
www.youtube-nocookie.com,www.youtube.com##.html5-video-player .ytp-bezel
```

Both domains are listed because `no-cookie` defaults to `true`, which puts the player on
`www.youtube-nocookie.com`; turn it off and the frame is `www.youtube.com`.

> [!WARNING]
> **It fixes your browser, not your site.** The rule works because a content blocker is an
> extension with host permissions: it injects its stylesheet into every frame it is
> granted, whatever the origin. A page has no such permission. Your CSS stops at the iframe
> boundary and your script gets a `SecurityError` off `iframe.contentDocument`, so there is
> no way to ship that rule from the server, put it in your bundle, or hand it to the frame
> — and a visitor without the filter installed sees the bezel exactly as before. Paste it
> into your own blocker while developing against `localhost` if it bothers you; treat the
> bezel as part of the embed for everyone else.

## Browser support

The floor is `:where()`, the newest thing the element uses — custom elements, the
observers and the ES2019 the bundles are built for are all older:

* Chrome 88+ and Edge 88+
* Firefox 78+
* Safari 14+, iOS 14+

Without `ResizeObserver` the element re-fits on the window's `resize` event instead;
without `IntersectionObserver` there is no scroll gate and every element behaves as
`always-play`. Versions are from [caniuse](https://caniuse.com/css-matches-pseudo).

## Development

Sources are ES modules in `src/`, `.mjs` so the package can stay CommonJS and the IIFE
bundles `require()`-able. `src/video-background.mjs` is the element and the main entry,
`src/controls.mjs` the controls and the group, `src/lib/` the three providers behind the
element — `youtube.mjs`, `vimeo.mjs`, `video.mjs` over the shared `provider.mjs` — and
`src/lib/load.mjs` the one-promise-per-API loading of the YouTube and Vimeo scripts.

[POOPS](https://github.com/stamat/poops) builds the bundles, the controls stylesheet and
the demo page into `_site/`, which is what GitHub Pages deploys:

```sh
script/bootstrap   # npm ci
script/server      # http://localhost:4040, rebuilds and reloads on change
script/build       # the bundles, the css, the manifest and _site/
script/test        # jest over src/__tests__, jsdom
script/lint        # eslint, flat config in eslint.config.mjs
```

Each is a one-line wrapper over the matching `npm` script, so either spelling works.

`npm run build` runs `cem analyze` before poops — poops runs its `exec` hooks last, and
the copy into `_site/` needs the manifest before then; the `scripts` hook runs it again so
a watch rebuild picks up an edited JSDoc block. After the markup renders,
`script/preview.mjs` wraps every `html preview` fence on the demo page in
`<code-preview>`, and takes the `preview` class off the fence so a second run is a no-op.

CI runs lint, tests and the build on every push and pull request, and fails if the
checked-in build output — the bundles, the css, the manifest — is stale.

A user-visible change goes in [CHANGELOG.md](CHANGELOG.md) under `## [Unreleased]` — that
file explains the format, and [CONTRIBUTING.md](CONTRIBUTING.md) how `script/publish` cuts
the entry into a release.
