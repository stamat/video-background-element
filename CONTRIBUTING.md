# Contributing to video-background-element

Issues and pull requests are welcome. Taking part means keeping to the
[Code of Conduct](CODE_OF_CONDUCT.md).

`<video-background>` puts a cover-fit, muted, looping video from a YouTube, Vimeo or video
file link behind the element it sits in, and stops it when it is not being looked at. That
is the whole scope: a background, not a player. It grows no chrome of its own — the
controls are classes over markup you write, and the element never renders a button — it
takes no shadow root, because your CSS and your poster `<img>` are supposed to reach the
player, and it takes no options object, because an attribute is the declarative surface and
a second way to say the same thing is the drift. A source type beyond those three needs a
platform whose embed can be driven muted and headless; a feature that only a player wants
belongs in [media-elements](https://github.com/muxinc/media-elements).

## Getting set up

```bash
git clone https://github.com/stamat/video-background-element.git
cd video-background-element
script/bootstrap
```

```bash
script/server    # run it locally
script/build     # produce the artifacts
script/test      # run the tests
script/lint      # run the linters
```

`src/` is the source. The bundles, `video-background-controls.css` and
`custom-elements.json` in `dist/` are built from it and committed — CI fails when they
are stale, so `script/build` is part of every change — and `_site/` is built and ignored.
`custom-elements.json` comes from the JSDoc on the two element classes; edit the JSDoc,
never the JSON. `script/test` runs jest in jsdom, which has no playback and no observers:
the header of `src/__tests__/regressions.test.mjs` says what that leaves out, and
`script/server` with the demo page is where those things are checked.

## Reporting a bug

[Open an issue](../../issues/new/choose) — the form asks for what you ran, what
you expected, the version and the environment, because those are the four things
every fix starts from. A reproduction is worth more than a description of one.

## Pull requests

- **Add a test.** A bug fix gets a test that fails without the fix.
- **Match the surrounding style.** `script/lint` is the authority, and CI runs it.
- **Add a changelog entry** under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md) — that file explains the format.
- **Keep the diff about one thing.** A rename bundled with a fix is two reviews
  wearing one hat.
- **Agent-written code is welcome — you still own it.** It meets the same bar
  as handwritten code: tests, lint, CI green. You understand every line well
  enough to answer review questions; "the agent wrote it" is not an answer.
  Point your agent at [AGENTS.md](AGENTS.md) before it starts.

Commit messages are freeform, write something that says what changed.

## How a release works

Maintainer flow, recorded here so the automation isn't a mystery:

`script/publish [version]` takes the current version from the last `v*` tag,
writes the new one with `script/version`, runs `script/changelog` to cut
`[Unreleased]` into a released entry, builds, commits, tags and pushes. Pushing
the tag triggers [publish.yml](.github/workflows/publish.yml), which publishes
via trusted publishing — OIDC, no tokens stored anywhere. The changelog entry
becomes the body of the GitHub release verbatim.
