# Changelog

All notable changes to video-background are recorded here.

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

## [Unreleased] — `<video-background>`, out of youtube-background

[youtube-background](https://github.com/stamat/youtube-background) grew from a jQuery
plugin into a factory that found the elements, indexed them by uid, watched for new ones
and tore them down — all of it API a page had to call in the right order, and all of it
what a custom element does by itself. This is that library as one tag,
`<video-background src="…">`, under a name that admits it plays Vimeo and files too: it
builds when it connects, tears down when it leaves, and the element is the instance.
`youtube-background` stays published at 1.x. Against its 1.2.0, the options and the events
keep their names; the page markup and the calls around it go.

### Added

- **`<video-background>`.** One attribute, `src`, and the options as attributes with the
  names they had after `data-vbg-`. `src` is live: removing it tears the player down,
  setting it rebuilds, a url of the same type swaps the video in place; `start-at` and
  `end-at` are live too. A bare boolean attribute is `true`, `="false"` turns a default off.
- **The element is the instance.** `play()`, `pause()`, `seek()`, `currentState`,
  `player` and the rest are on the element, and `event.detail` is the element.
- **`<video-background-group>`**, replacing `VideoBackgroundGroup` and the
  `VideoBackgroundGroups` factory: the backgrounds inside it are the playlist.
- **`video-background/controls.css`** — `video-background-controls.css` — the look of the
  seek bar, the row `.seek-bars` lays one bar per group member out in, and the stacking a
  group needs, optional and themed by `--seek-bar-*`.
- **`custom-elements.json`**, generated from the JSDoc on the two element classes, as the
  package's `customElements` key and a `video-background/custom-elements.json` export, for
  editors and for the options panel the demo page builds from it.
- **The demo page is live.** Every sample is rendered from the code under it by
  [`<code-preview>`](https://github.com/stamat/code-preview-element) and editable in place,
  with an Options tab read from the manifest.

### Changed

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
