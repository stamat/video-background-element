---
layout: poops-docs-theme/prose
description: <video-background> — a video background from a YouTube, Vimeo or video file link, as one tag. Every sample on this page is live.
---

<link rel="stylesheet" href="{{ relativePathPrefix }}code-preview.min.css">

# 📺 &lt;video-background&gt;
[![npm version](https://img.shields.io/npm/v/video-background-element)](https://www.npmjs.com/package/video-background-element)
[![CI](https://img.shields.io/github/actions/workflow/status/stamat/video-background-element/ci.yml?branch=main&label=CI)](https://github.com/stamat/video-background-element/actions/workflows/ci.yml)
[![gzip size](https://img.badgesize.io/stamat/video-background-element/main/dist/video-background.min.js?compression=gzip&label=gzip%20size)](https://github.com/stamat/video-background-element/blob/main/dist/video-background.js)

A video behind a hero costs more than an iframe: it has to cover the box at the video's
own ratio, start muted so autoplay is allowed, loop, and stop when it scrolls away or the
tab goes idle — or it plays into the void at full bandwidth. `<video-background>` is that
list as one tag: put it inside the box, give it a YouTube, Vimeo or video file link, done.
No CSS, no init call, no cookies from the platforms by default.

```bash
npm install video-background-element
```

```html
<script src="https://unpkg.com/video-background-element/dist/video-background.min.js"></script>

<div class="hero">
  <video-background src="https://www.youtube.com/watch?v=eEpEeyqGlxA"></video-background>
  <h1>Above the video</h1>
</div>
```

The element fills whatever it sits in — `.hero` here — and sits under its siblings. If the
box is not positioned the element positions it. The frames below load that script, the
controls script and stylesheet, and [`preview.css`](preview.css), which is only the
`.hero` box and the look of the buttons; nothing in it is needed by the element.

> This element's predecessor is
> [youtube-background](https://github.com/stamat/youtube-background) — the same providers
> behind a `[data-vbg]` factory a page had to call. It stays maintained for that API and
> keeps its own [page](https://stamat.github.io/youtube-background/); new features land here.
> The map from its options to these attributes is in the
> [README](https://github.com/stamat/video-background-element#coming-from-youtube-background).

## Live

Every sample is rendered from the code under it — edit the code and the frame follows. The
**Options** tab lists every attribute, generated from the element's own
[manifest](custom-elements.json), and the events as they fire.

```html preview
<div class="hero">
  <video-background src="https://www.youtube.com/watch?v=eEpEeyqGlxA" load-background></video-background>
  <div class="inner">
    <h2>YouTube</h2>
    <p>Autoplaying, muted, looping, and paused whenever it scrolls out of view.</p>
  </div>
</div>
```

`start-at` skips the intro, `end-at` keeps the loop short. Open the Options tab and move
them.

```html preview tab=options
<div class="hero">
  <video-background src="https://www.youtube.com/watch?v=MgDZBqTuUuE" start-at="10" end-at="16" load-background></video-background>
  <div class="inner">
    <h2>A slice of a video</h2>
  </div>
</div>
```

Sound is yours to switch on — a background starts muted or the browser will not start it.
The controls are markup you write, wired by the second script; the toggles keep the name
you gave them and carry the state in `aria-pressed`, and the speeds in the `<select>` are
yours too — `RateSelect` reads them and never writes one.

```html preview
<div class="hero">
  <video-background id="sound" src="https://www.youtube.com/watch?v=DLzxrzFCyOs" resolution="4:3" volume="0.15"></video-background>
  <div class="inner">
    <h2>Sound, and your own controls</h2>
    <button class="js-play" data-target="#sound">Play</button>
    <button class="js-mute" data-target="#sound">Mute</button>
    <select class="js-rate" data-target="#sound" aria-label="Speed">
      <option value="0.5">0.5×</option>
      <option value="1">1×</option>
      <option value="2">2×</option>
    </select>
    <button onclick="document.querySelector('#sound').setAttribute('src', 'https://www.youtube.com/watch?v=UIyoNvInzCI')">Change source</button>
  </div>
  <div class="seek-bar-wrapper js-seek-bar-wrap" data-target="#sound">
    <progress class="seek-bar-progress js-seek-bar-progress" value="0" max="100" aria-hidden="true"></progress>
    <input class="seek-bar js-seek-bar" type="range" value="0" min="0" max="100" step="any" aria-label="Seek">
  </div>
</div>
<script>
  // after the scripts, which load deferred
  addEventListener('DOMContentLoaded', () => {
    const { PlayToggle, MuteToggle, RateSelect, SeekBar } = VideoBackgroundControls;
    new PlayToggle(document.querySelector('.js-play'));
    new MuteToggle(document.querySelector('.js-mute'));
    new RateSelect(document.querySelector('.js-rate'));
    new SeekBar(document.querySelector('.js-seek-bar-wrap'));
  });
</script>
```

Same attributes on Vimeo. An unlisted link keeps its hash.

```html preview
<div class="hero">
  <video-background id="vimeo" src="https://vimeo.com/137250145"></video-background>
  <div class="inner">
    <h2>Vimeo</h2>
    <button onclick="document.querySelector('#vimeo').setAttribute('src', 'https://vimeo.com/64289386')">Change source</button>
  </div>
</div>
<!-- unlisted -->
<!-- <video-background src="https://vimeo.com/304887422/34c51f7a09"></video-background> -->
```

Any `.mp4`, `.webm`, `.ogg`, `.avi`, `.mov`, `.m4v` or `.qt` url plays in a native
`<video>`. `poster` is your own image; on YouTube and Vimeo `load-background` fetches the
platform's thumbnail instead. `playback-rate` is half speed here, which a file plays
exactly — YouTube rounds a rate it does not have to the nearest one it does, and Vimeo
lists the feature as PRO and Business only.

```html preview tab=options
<div class="hero">
  <video-background src="https://media.w3.org/2010/05/sintel/trailer.mp4" poster="https://media.w3.org/2010/05/sintel/poster.png" start-at="10" end-at="25" playback-rate="0.5"></video-background>
  <div class="inner">
    <h2>A plain video file, at half speed</h2>
  </div>
</div>
```

`<video-background-group>` plays the backgrounds inside it as one playlist, stepping when
the current one ends. It only toggles `display` between them — the stacking over one box
comes from the controls stylesheet. `loop="false"` is what makes a member end, and an
ended member is what advances the group, so a looping member holds the playlist forever.
One seek bar per member: the group fills the bars of the members already played and
empties the ones still to come, and a seek on any bar jumps the group to that member.

```html preview
<div class="hero">
  <video-background-group id="stack">
    <video-background id="stack-1" src="https://www.youtube.com/watch?v=LC5rEhxGqT4" loop="false" load-background></video-background>
    <video-background id="stack-2" src="https://vimeo.com/137250145" loop="false" autoplay="false" load-background></video-background>
    <video-background id="stack-3" src="https://media.w3.org/2010/05/bunny/trailer.mp4" loop="false" autoplay="false" start-at="5" end-at="20" poster="https://media.w3.org/2010/05/bunny/poster.png"></video-background>
  </video-background-group>
  <div class="inner">
    <h2>A group</h2>
    <p>Three backgrounds across all three source types, played as one playlist.</p>
    <button onclick="stack.prev()">Prev</button>
    <button onclick="stack.play()">Play</button>
    <button onclick="stack.pause()">Pause</button>
    <button onclick="stack.next()">Next</button>
    <button onclick="stack.mute()">Mute</button>
    <button onclick="stack.unmute()">Unmute</button>
  </div>
  <div class="seek-bars">
    <div class="seek-bar-wrapper js-seek-bar-wrap" data-target="#stack-1">
      <progress class="seek-bar-progress js-seek-bar-progress" value="0" max="100" aria-hidden="true"></progress>
      <input class="seek-bar js-seek-bar" type="range" value="0" min="0" max="100" step="any" aria-label="Seek the first video">
    </div>
    <div class="seek-bar-wrapper js-seek-bar-wrap" data-target="#stack-2">
      <progress class="seek-bar-progress js-seek-bar-progress" value="0" max="100" aria-hidden="true"></progress>
      <input class="seek-bar js-seek-bar" type="range" value="0" min="0" max="100" step="any" aria-label="Seek the second video">
    </div>
    <div class="seek-bar-wrapper js-seek-bar-wrap" data-target="#stack-3">
      <progress class="seek-bar-progress js-seek-bar-progress" value="0" max="100" aria-hidden="true"></progress>
      <input class="seek-bar js-seek-bar" type="range" value="0" min="0" max="100" step="any" aria-label="Seek the third video">
    </div>
  </div>
</div>
<script>
  addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.js-seek-bar-wrap').forEach((wrap) => new VideoBackgroundControls.SeekBar(wrap));
  });
</script>
```

The video files are the Blender Foundation's [Sintel](https://durian.blender.org/) and
[Big Buck Bunny](https://peach.blender.org/) trailers, CC-BY 3.0, served from
`media.w3.org`.

## From a bundler

Importing defines the element; there is nothing to call. The controls are a second entry,
so a page without them does not carry them.

```javascript
import "video-background-element";
import { PlayToggle, MuteToggle, RateSelect, SeekBar } from "video-background-element/controls";
import "video-background-element/controls.css"; // optional: the seek bar's look, the group's stacking
```

From a script tag the controls bundle exposes the same four as
`VideoBackgroundControls`, and defines `<video-background-group>`; the stylesheet is
`video-background-controls.min.css` beside it.

## The element is the instance

Whatever you would have asked an instance, ask the element: `play()`, `pause()`, `mute()`,
`unmute()`, `setVolume(0.4)`, `setPlaybackRate(0.5)`, `seek(50)` in percent, `seekTo(12)`
in seconds, and `currentState`, `currentTime`, `duration`, `paused`, `muted`,
`playbackRate`, `player`, `playerElement`, `type` on it. The events are the `<video>`'s names, dispatched on the element and, like a
`<video>`'s, not bubbling:

```javascript
document.querySelector("#hero").addEventListener("loadedmetadata", (event) => {
  console.log(event.target.type, event.target.currentState);
});
```

Attributes are read when the element builds. `src` is live — remove it and the player is
torn down, set it and it is rebuilt, set one of the same type and the video is swapped in
place — and so are `start-at` and `end-at`. Anything else takes effect on the next build.
The full attribute table, the API and the events are in the
[README](https://github.com/stamat/video-background-element#readme); the Options tab on any sample
above is the same list, read from the manifest.

## Limits

Since **May 2026** ([#77](https://github.com/stamat/youtube-background/issues/77)),
YouTube's player flashes its own round play/pause icon in the middle of the frame on every
playback toggle — `.ytp-bezel`, drawn inside the iframe, which the embed's `controls=0`
does not cover. The frame is cross-origin, so neither your CSS nor your script reaches it.
There is no attribute that turns it off, here or upstream.

**Cosmetic filtering** hides it — an element-hiding rule in Adblock Plus / uBlock Origin
syntax, where `##` means *hide this selector on these domains*:

```text
www.youtube-nocookie.com,www.youtube.com##.html5-video-player .ytp-bezel
```

Both domains, because `no-cookie` defaults on and puts the player on
`www.youtube-nocookie.com`.

> [!WARNING]
> That fixes the browser it is typed into and nothing further. A content blocker is an
> extension, and injecting a stylesheet into a cross-origin frame is a permission
> extensions have and pages do not — your CSS never enters the frame,
> `iframe.contentDocument` throws. So it is a development comfort on `localhost`, and every
> visitor without that filter still sees the bezel.

<script src="{{ relativePathPrefix }}code-preview-hljs.min.js"></script>
<script src="{{ relativePathPrefix }}code-preview-options.min.js"></script>
