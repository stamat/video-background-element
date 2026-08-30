# Changelog

All notable changes to video-background-element are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Contributing an entry

Write your change under `## [Unreleased]`, grouped under `### Added`,
`### Changed`, `### Fixed`, `### Deprecated`, `### Removed` or `### Security`.
Give the heading a short title after an em dash and open with one paragraph
saying what was wrong before:

```markdown
## [Unreleased] — timeouts are configurable

Every request used the same hardcoded thirty seconds, which is too long for a
health check and too short for an upload.

### Added

- ...
```

Write it for the person upgrading, not for the person who wrote the code. What
they need is what changed for them: a renamed option, a different default, an
error that is now thrown, output that moved.

On `script/publish`, `script/changelog` cuts this section into a released entry
in the same commit as the version bump, and the entry becomes the body of the
GitHub release verbatim.

## [Unreleased] — playback speed

The element speaks the `<video>` API, and `playbackRate` was the one part of the playback
half missing from it: a hero at half speed meant reaching past the element for
`player.playbackRate`, `player.setPlaybackRate()` or `player.setPlaybackRate().then()`,
written three ways for the three sources, and only after the player had answered.

### Added

- **`playback-rate` attribute**, default `1`, applied when the player is built:
  `<video-background src="…" playback-rate="0.5">`. `0.25` to `2` is what all three take,
  and a value that is not a positive number is normal speed rather than an error.
- **`playbackRate`** on the element, assignable, with **`setPlaybackRate(rate)`** and
  **`getPlaybackRate()`** — a promise on Vimeo, like `getVolume()`.
- **`RateSelect`** in the controls bundle, over a `<select>` of your own whose options
  carry the speeds as their values — `new RateSelect(select)`, or
  `VideoBackgroundControls.RateSelect` from a script tag. It sets the rate on `change` and
  follows `ratechange` back, so a rate the player rounded to something none of the options
  names leaves the select with nothing chosen rather than naming the wrong speed. The
  options are never written by it, and it has a `destroy()` like every other control.
- **`ratechange`**, the `<video>`'s event name. It fires for the rate that was asked for,
  and again if the player answered with another one: `playbackRate` reads back what is
  playing, not what was requested. YouTube rounds an unsupported rate toward `1`, and
  Vimeo lists the feature as PRO and Business only — a refusal there is a rejected promise,
  warned on the console as `video-background: …`.

Picture-in-picture and AirPlay were considered with it and left out. Both take the video out
from behind the page, which is a player's job and not this element's; both are already one
line away through `element.player` where they work at all; and YouTube's iframe API offers
neither, so the element would have carried two methods that do nothing on one of its three
sources.

## [1.1.0] - 2026-08-30 — `always-play` is `pause-offscreen`

**This is a breaking change in a minor release, deliberately.** 1.0.0 was five hours old
when the rename landed, so the version it breaks is one nobody had time to depend on, and a
2.0.0 that close behind would say less than this entry does. 1.0.0 is deprecated on npm with
a notice pointing here. If you did install it, the one-line fix is below.

`always-play` named the exception rather than the behaviour: it read as *play always*, and
what it actually turned off — the pause when the element scrolls out of view — had no name
at all. Every other default-on option here is written off with `="false"`, so the odd one
out was also the one that needed a footnote.

### Changed

- **`always-play` is now `pause-offscreen`, defaulting to `true`.** The same scroll gate,
  named after what it does and inverted to match `autoplay`, `muted`, `loop` and
  `no-cookie`: leave it alone to pause off-screen, write `pause-offscreen="false"` to keep
  playing there. As before, off it also lets an `autoplay` video *start* off-screen, and a
  browser without `IntersectionObserver` forces it off, having no gate to run.

  **The old name is not read at all, and nothing warns.** A page left on `always-play` gets
  the default — it pauses off-screen — and the attribute sits there inert. Replace
  `always-play` with `pause-offscreen="false"`; there is nothing else to change. The
  README's youtube-background map has the row, `data-vbg-always-play` included.

## [1.0.0] - 2026-08-30 — `<video-background>`, out of youtube-background

[youtube-background](https://github.com/stamat/youtube-background) grew from a jQuery
plugin into a factory that found the elements, indexed them by uid, watched for new ones
and tore them down — all of it API a page had to call in the right order, and all of it
what a custom element does by itself. This is that library as one tag,
`<video-background src="…">`, under a name that admits it plays Vimeo and files too: it
builds when it connects, tears down when it leaves, and the element is the instance.
`youtube-background` stays published at 1.x. Against its 1.2.0, the options keep their
names and the events take the `<video>`'s; the page markup and the calls around it go.

### Added

- **`<video-background>`.** One attribute, `src`, and the options as attributes with the
  names they had after `data-vbg-`. `src` is live: removing it tears the player down,
  setting it rebuilds, a url of the same type swaps the video in place; `start-at` and
  `end-at` are live too. A bare boolean attribute is `true`, `="false"` turns a default off.
- **The element is the instance.** `play()`, `pause()`, `seek()`, `currentState`,
  `player` and the rest are on the element, and `event.detail` is the element.
- **`<video-background-group>`**, replacing `VideoBackgroundGroup` and the
  `VideoBackgroundGroups` factory: the backgrounds inside it are the playlist.
- **`video-background-element/controls.css`** — `video-background-controls.css` — the look
  of the seek bar, the row `.seek-bars` lays one bar per group member out in, and the
  stacking a group needs, optional and themed by `--seek-bar-*`.
- **`custom-elements.json`**, generated from the JSDoc on the two element classes, as the
  package's `customElements` key and a `video-background-element/custom-elements.json`
  export, for editors and for the options panel the demo page builds from it.
- **The demo page is live.** Every sample is rendered from the code under it by
  [`<code-preview>`](https://github.com/stamat/code-preview-element) and editable in place,
  with an Options tab read from the manifest.
- **The element speaks the `<video>` API.** `paused`, `currentTime`, `duration`, `volume`,
  `muted`, `readyState` and `buffered` read the way they read on a `<video>`; `currentTime`,
  `volume` and `muted` assign; and the events are the `<video>`'s — below, under Changed.
  Anything driving a media element by its standard names —
  [media-player](https://github.com/stamat/media-player), with
  `class="media-player-media"` on this element — drives a YouTube, Vimeo or file background
  without a provider of its own. `controls`, `seekable`, `textTracks` and `playbackRate`
  are not spoken, and the README says so.
- **`unstyled`.** The element's own rules — the absolute cover over the parent,
  `pointer-events: none`, the parent made a containing block — off, for the element in a
  page's flow rather than behind one: under a player, in a grid. Pair with `fit-box`, which
  now also makes the player a block so an inline iframe leaves no gap under itself; the box
  is yours to size. The iframe itself is built borderless, so the browser's 2px inset does
  not appear around it once the stylesheet is off.

### Changed

- **The events are the `<video>`'s: `video-background-*` is gone.** One vocabulary
  instead of two names per event, and it is the one every media chrome already listens
  for. `ready` → `loadedmetadata`, and it moves: the duration known, not the API answering
  — which on Vimeo and files is when `unmute()` and `seekTo()` first work anyway. `play`,
  `pause`, `ended`, `seeked`, `timeupdate` lose the prefix; `mute`, `unmute` and
  `volume-change` are `volumechange`, with `muted` to tell which; `state-change` is
  `playing` and `waiting`, and `currentState` stays a property; `destroyed` is `emptied`;
  `resize` is gone, a `ResizeObserver` on the element being the platform's own. None of
  them bubble and there is no `event.detail` — `event.target` is the element, as on a
  `<video>`. `paused` changes meaning with them: *not playing*, not *a pause the visitor
  holds*. The README's map from youtube-background has every pair.
- **The bundles are `video-background.js` and `video-background-controls.js`**, in place
  of `jquery.youtube-background.js` and `youtube-background-experimental.js`. The first
  exposes nothing on `window` — the class is `customElements.get("video-background")`; the
  second puts `SeekBar`, `PlayToggle` and `MuteToggle` on `window.VideoBackgroundControls`
  instead of three globals.
- **The element's styles are a stylesheet, not inline.** One `<style>` in `<head>`, every
  rule in `:where()`, so a rule of yours overrides it without `!important`; the computed
  size on the player stays inline because it is state. This is what `inline-styles` was
  for, and why it is gone.
- **Controls take the element, and find it by `data-target` or as their second argument.**
  `data-target-uid` is no longer written, and a group finds the seek bars of a member
  through the `SeekBar` instances rather than a uid selector.
- **The YouTube player is only usable once it has answered.** `player` is set from the
  ready event; a scroll-in before that no longer calls `playVideo` on an object that has
  no such method yet.
- **The floor is Chrome 88, Firefox 78, Safari 14**, for `:where()`. youtube-background
  ran on ES2019 alone; custom elements and the observers were already inside that range.

### Removed

- **`VideoBackgrounds`** and all of it: `get`, `add`, `destroy`, `destroyAll`,
  `disconnect`, `pauseAll`, `playAll`, `muteAll`, `unmuteAll`, `setVolumeAll`, `index`,
  `intersectionObserver`, `resizeObserver`, `data-vbg-uid`. Each element observes itself
  and tears itself down; `document.querySelectorAll("video-background")` is the index.
- **The jQuery plugin**, deprecated in youtube-background 1.2.0.
- **`play-button`, `mute-button` and `pause`**, the buttons the plugin injected: they
  depended on Font Awesome being on the page and were a second way to do what `PlayToggle`
  and `MuteToggle` do over a button of yours.
- **`data-vbg`, `data-ytbg`, `data-youtube` and the `data-vbg-*` / `data-ytbg-*`
  prefixes**: the attribute is `src`, the options are bare.
- **The `params` argument.** Options are attributes; there is no constructor to pass an
  object to.

### Fixed

- **A page that also loads media-elements no longer leaves YouTube backgrounds dead.**
  Both libraries load the YouTube API and both claim `window.onYouTubeIframeAPIReady`; this
  one chained whatever was there, theirs overwrites, and the API calls the hook once — so
  with theirs assigned last, the promise here never resolved, no player was built, and
  `play()` was a no-op with nothing in the console. `YT.loaded` is now watched beside the
  hook for ten seconds after the script loads, and a load that never comes up rejects with
  a message instead of waiting forever. Same code shipped in youtube-background 1.x.
- **A source swap keeps the state it was handed.** Swapping the video assigned the frame's
  `src`, which navigates away from the document the YouTube and Vimeo APIs shook hands with:
  the new video came back muted after the visitor had unmuted, and with no state changes
  left to hear, it never looped. The swap goes through the player now — `loadVideoById`, or
  `cueVideoById` for a video neither playing nor due to start, and Vimeo's `loadVideo` — and
  a file is reloaded rather than relabelled, `autoplay` taken off it first when it is to
  wait, which is what it took for one to change at all. Carried in from youtube-background
  1.x, fixed there too.
- **`always-play` no longer starts a video `autoplay="false"` said not to.** Coming back to
  the tab resumed anything pinned with `always-play` whether or not the visitor had ever
  pressed play; keeping a video going off-screen and starting one are different decisions,
  and the second is autoplay's.
- **A Vimeo background with `muted="false"` has sound.** Vimeo's `background=1` — what
  hides its chrome — autoplays, loops and mutes by definition; the loop and the autoplay
  were already undone from the API, the mute never was, so `muted` read `false` over a
  silent player. Sound is put back at ready. The other half of the same rule: the first
  `play` used to be taken for background mode's own autoplay and paused, which swallowed a
  visitor's first press whenever the browser had blocked that autoplay; a play this element
  asked for is now told apart.
