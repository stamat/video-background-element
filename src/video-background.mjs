import { RE_YOUTUBE, RE_VIMEO, RE_VIDEO, stringToType, isMobile } from 'book-of-spells';
import { YouTube } from './lib/youtube.mjs';
import { Vimeo, getVimeoUnlistedHash } from './lib/vimeo.mjs';
import { Video } from './lib/video.mjs';
import { EMPTY_RANGES } from './lib/provider.mjs';

// probed in order, so the platform patterns get first refusal on a link
const PROVIDERS = [
  ['youtube', RE_YOUTUBE, YouTube],
  ['vimeo', RE_VIMEO, Vimeo],
  ['video', RE_VIDEO, Video]
];

export function parseSource(link) {
  if (!link) return;

  for (const [type, pattern, Provider] of PROVIDERS) {
    const pts = link.match(pattern);
    if (!pts) continue;

    const source = { type, id: pts[1], link, Provider };
    if (type === 'vimeo') {
      const unlisted = getVimeoUnlistedHash(link);
      if (unlisted) source.unlisted = unlisted;
    }
    return source;
  }
}

export const DEFAULTS = {
  'autoplay': true,
  'muted': true,
  'loop': true,
  'mobile': true,
  'pause-offscreen': true,
  'start-at': 0,
  'end-at': 0,
  'volume': 1,
  'playback-rate': 1,
  'poster': null,
  'load-background': false,
  'resolution': '16:9',
  'fit-box': false,
  'offset': 100,
  'no-cookie': true,
  'lazyloading': false,
  'force-on-low-battery': false,
  'title': 'Video background',
  'unstyled': false
};

// A bare attribute is `true` for a boolean option and nothing for the rest, so
// `<video-background muted>` reads like `<video muted>` while `autoplay="false"` still
// turns a default off - html has no way to write a false boolean attribute.
export function readParams(element, defaults = DEFAULTS) {
  const params = {};

  for (const key in defaults) {
    const value = element.getAttribute(key);
    if (value === null) {
      params[key] = defaults[key];
    } else if (value === '') {
      params[key] = typeof defaults[key] === 'boolean' ? true : defaults[key];
    } else {
      params[key] = stringToType(value);
    }
  }

  // no IntersectionObserver, no scroll gate - play regardless rather than never
  if (!('IntersectionObserver' in window)) params['pause-offscreen'] = false;

  return params;
}

const STYLE_ID = 'video-background-style';

// :where() keeps every rule at zero specificity, so a plain type selector on the
// page overrides any of these without !important; `unstyled` takes the whole sheet off one
// element, which one shared <style> can only do by selector
const STYLE = `
:where(video-background:not([unstyled])) { display: block; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; overflow: hidden; pointer-events: none; background-size: cover; background-repeat: no-repeat; background-position: center; }
:where(video-background:not([unstyled]) > iframe), :where(video-background:not([unstyled]) > video) { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 0; }
:where(video-background:not([unstyled]) > img) { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
`;

function adoptStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);
}

function cssURL(url) {
  return `url("${String(url).replace(/["\\]/g, '\\$&')}")`;
}

/**
 * A video background from a YouTube, Vimeo or video file link: a cover-fit, muted,
 * looping player behind the element's parent, paused while off-screen. The element is the
 * instance - its playback API and state live on it, and its events are dispatched on it.
 *
 * It speaks the `<video>` API: `paused`, `currentTime`, `duration`, `volume`, `muted`,
 * `playbackRate`, `readyState`, `buffered`, `play()`, `pause()`, and the `<video>` event
 * names - non-bubbling, like a `<video>`'s - so a media chrome that drives a `<video>`
 * drives this. Not `controls`, `seekable` or `textTracks`, and nothing with the script
 * blocked.
 *
 * Options are read from attributes when the element builds, which is when it connects with
 * a `src`. Only `src`, `start-at` and `end-at` are watched afterwards; the rest take effect
 * on the next build, which removing and re-adding `src` forces.
 *
 * @summary A cover-fit video background from a YouTube, Vimeo or video file link.
 * @customElement video-background
 *
 * @attr {string} src - A YouTube, Vimeo or video file url. Removing it tears the player down, setting it again rebuilds; a url of the same type swaps the video in place, keeping the player and its state - mute, volume, and whether it was playing.
 * @attr {boolean} [autoplay=true] - Start as soon as the element is in view.
 * @attr {boolean} [muted=true] - Start muted - which is what lets autoplay through.
 * @attr {boolean} [loop=true] - Restart when the video ends.
 * @attr {boolean} [mobile=true] - Build the player on touch devices too. Off, the element keeps only its poster there.
 * @attr {boolean} [pause-offscreen=true] - Pause while scrolled out of view. Off, the video keeps playing off-screen, and an autoplaying one starts there.
 * @attr {number} [start-at=0] - Seconds to start from.
 * @attr {number} [end-at=0] - Seconds to stop at, `0` for the full duration.
 * @attr {number} [volume=1] - `0` to `1`, applied on the first unmute.
 * @attr {number} [playback-rate=1] - Playback speed, applied when the player is built. `0.25` to `2` is what all three take; YouTube rounds an unsupported rate toward `1`, Vimeo lists the feature as PRO and Business only, and anything that is not a positive number is normal speed.
 * @attr {string} poster - Image url shown behind the player until the first frame.
 * @attr {boolean} [load-background=false] - Use the platform's own thumbnail as the poster. YouTube and Vimeo only.
 * @attr {string} [resolution=16:9] - Aspect ratio the player is sized by to cover the box.
 * @attr {boolean} [fit-box=false] - Stretch to the box instead of covering it.
 * @attr {number} [offset=100] - Pixels of overscan past the box, hiding the platform's edge chrome.
 * @attr {boolean} [no-cookie=true] - Embed from the privacy-preserving domains.
 * @attr {boolean} [lazyloading=false] - `loading="lazy"` on the iframe. YouTube and Vimeo only.
 * @attr {boolean} [force-on-low-battery=false] - On a touch device, start a muted autoplay on the first touch, for the low power modes that block autoplay.
 * @attr {string} [title=Video background] - Accessible name of the player frame.
 * @attr {boolean} [unstyled=false] - Adopt none of the element's own rules and leave the parent as found, for the element in a page's flow rather than behind one. Pair with `fit-box`.
 *
 * @fires loadedmetadata - The duration is known and the player answers: a file's with its metadata, YouTube's with the player, Vimeo's a promise after it. Non-bubbling, like every event here.
 * @fires durationchange - The duration became known, or `end-at` cut it.
 * @fires play - Playback started.
 * @fires playing - `currentState` became `playing`.
 * @fires pause - Playback paused.
 * @fires waiting - `currentState` became `buffering`.
 * @fires timeupdate - The position advanced while playing, about four times a second.
 * @fires seeked - The position moved, through `seek`, `seekTo`, `currentTime` or a seek bar.
 * @fires volumechange - `volume` or `muted` changed.
 * @fires ratechange - `playbackRate` changed, once for the rate that was asked for and again if the player answered with another one.
 * @fires ended - The video reached its end, or `end-at`. With `loop` on it restarts right after.
 * @fires emptied - The player was torn down: `src` removed, or the element disconnected.
 */
export class VideoBackground extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'start-at', 'end-at'];
  }

  constructor() {
    super();
    this.provider = null;
    this.params = null;
    this.intersectionObserver = null;
    this.resizeObserver = null;
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
  }

  connectedCallback() {
    if (!this.provider) this.build();
  }

  disconnectedCallback() {
    this.teardown();
  }

  attributeChangedCallback(name, previous, value) {
    // the first build reads every attribute itself; an upgrade fires these before connecting
    if (previous === value || !this.isConnected) return;
    if (name === 'src') return this.rebuild(value);
    if (!this.provider) return;
    if (name === 'start-at') this.provider.setStartAt(stringToType(value) || 0);
    if (name === 'end-at') this.provider.setEndAt(stringToType(value) || 0);
  }

  build() {
    adoptStyle();
    const source = parseSource(this.getAttribute('src'));
    if (!source) return;

    this.params = readParams(this);
    this.styleHost(source);

    if (isMobile() && !this.params.mobile) return;

    this.provider = new source.Provider(this, source);
    this.provider.connect();
    this.observe();
  }

  rebuild(src) {
    const source = parseSource(src);
    if (this.provider && source && source.type === this.provider.type) {
      this.provider.setSource(source);
      this.styleHost(source);
      return;
    }
    this.teardown();
    this.build();
  }

  styleHost(source) {
    const { poster } = this.params;
    if (poster) {
      this.style.backgroundImage = cssURL(poster);
    } else if (this.params['load-background'] && source.type === 'youtube') {
      this.style.backgroundImage = cssURL(`https://img.youtube.com/vi/${source.id}/hqdefault.jpg`);
    } else if (this.params['load-background'] && source.type === 'vimeo') {
      this.style.backgroundImage = cssURL(`https://vumbnail.com/${source.id}.jpg`);
    }

    if (this.params.unstyled) return;
    // only a statically positioned parent needs a containing block, and only
    // the computed value can tell us that - the parent may be positioned by CSS
    const parent = this.parentElement;
    const position = parent && window.getComputedStyle(parent).position;
    if (parent && (!position || position === 'static')) {
      parent.style.position = 'relative';
    }
  }

  observe() {
    if ('IntersectionObserver' in window && this.params['pause-offscreen']) {
      this.intersectionObserver = new IntersectionObserver((entries) => this.onIntersect(entries[entries.length - 1]));
      this.intersectionObserver.observe(this);
    }

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.onWindowResize);
      this.resizeObserver.observe(this);
    } else {
      window.addEventListener('resize', this.onWindowResize);
    }

    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  onIntersect(entry) {
    const provider = this.provider;
    if (!provider) return;
    provider.isIntersecting = entry.isIntersecting;
    if (!provider.player) return;

    // The same gate the tab-switch path asks, so autoplay off, a user pause and
    // an ended non-looping video all stay put on scroll-in.
    if (entry.isIntersecting) {
      if (provider.shouldPlay()) provider.softPlay();
    } else {
      provider.softPause();
    }
  }

  onVisibilityChange() {
    if (document.hidden || !this.provider) return;
    if (this.provider.shouldPlay()) this.provider.softPlay();
  }

  onWindowResize() {
    window.requestAnimationFrame(() => this.resize());
  }

  teardown() {
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.intersectionObserver = null;
    this.resizeObserver = null;
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    if (!this.provider) return;
    this.provider.destroy();
    this.provider = null;
    this.style.backgroundImage = '';
    this.dispatchEvent(new Event('emptied'));
  }

  /* ===== state, proxied from the provider ===== */

  /** @type {string | undefined} `youtube`, `vimeo` or `video` */
  get type() { return this.provider ? this.provider.type : undefined; }
  /** @type {object | null} The YouTube or Vimeo player object, or the `<video>` element */
  get player() { return this.provider ? this.provider.player : null; }
  /** @type {HTMLIFrameElement | HTMLVideoElement | null} The iframe or `<video>` inside the element */
  get playerElement() { return this.provider ? this.provider.playerElement : null; }
  /** @type {boolean} What it means on a `<video>`: true unless playing or buffering. A held pause is `provider.paused` */
  get paused() { return !this.provider || !['playing', 'buffering'].includes(this.provider.currentState); }
  /** @type {boolean} Assignable - the same as `mute()` / `unmute()` */
  get muted() { return this.provider ? this.provider.muted : false; }
  set muted(value) { if (value) this.mute(); else this.unmute(); }
  /** @type {number} `0` to `1`, assignable - the same as `setVolume` */
  get volume() { return this.provider ? this.provider.volume : 0; }
  set volume(value) { this.setVolume(value); }
  /** @type {number} Playback speed the player confirmed, assignable - the same as `setPlaybackRate` */
  get playbackRate() { return this.provider ? this.provider.playbackRate : 1; }
  set playbackRate(value) { this.setPlaybackRate(value); }
  /** @type {string} `notstarted`, `playing`, `paused`, `buffering` or `ended` */
  get currentState() { return this.provider ? this.provider.currentState : 'notstarted'; }
  /** @type {number} Seconds, assignable - the same as `seekTo` */
  get currentTime() { return this.provider ? this.provider.currentTime : 0; }
  set currentTime(value) { this.seekTo(value); }
  /** @type {number} Seconds, capped by `end-at` */
  get duration() { return this.provider ? this.provider.duration : 0; }
  /** @type {number} `0` until the duration is known, `1` after - the `<video>` scale, stopping at metadata */
  get readyState() { return this.duration > 0 ? 1 : 0; }
  /** @type {TimeRanges | {length: number}} The `<video>`'s own for a file, YouTube's loaded fraction as one range, empty on Vimeo */
  get buffered() { return this.provider ? this.provider.buffered : EMPTY_RANGES; }
  /** @type {number} `0` to `100` */
  get percentComplete() { return this.provider ? this.provider.percentComplete : 0; }
  /** @type {boolean} Whether the element is in the viewport */
  get isIntersecting() { return this.provider ? this.provider.isIntersecting : false; }

  /* ===== API ===== */

  play() { if (this.provider) this.provider.play(); }
  pause() { if (this.provider) this.provider.pause(); }
  /** Play without clearing `paused`, the way scrolling into view does */
  softPlay() { if (this.provider) this.provider.softPlay(); }
  /** Pause without setting `paused`, the way scrolling out of view does */
  softPause() { if (this.provider) this.provider.softPause(); }
  mute() { if (this.provider) this.provider.mute(); }
  unmute() { if (this.provider) this.provider.unmute(); }
  /** @returns {number | Promise<number> | undefined} `0` to `1`; a promise on Vimeo */
  getVolume() { if (this.provider) return this.provider.getVolume(); }
  /** @param {number} volume `0` to `1` */
  setVolume(volume) { if (this.provider) this.provider.setVolume(volume); }
  /** @returns {number | Promise<number> | undefined} The player's own rate; a promise on Vimeo */
  getPlaybackRate() { if (this.provider) return this.provider.getPlaybackRate(); }
  /** @param {number} rate `0.25` to `2`; YouTube rounds toward `1`, and Vimeo lists the feature as PRO and Business only. A rate that is not a positive number is ignored - a `<select>` with nothing chosen must never reach a player */
  setPlaybackRate(rate) { if (this.provider && Number.isFinite(rate) && rate > 0) this.provider.setPlaybackRate(rate); }
  /** @param {number} percentage `0` to `100` */
  seek(percentage) { if (this.provider) this.provider.seek(percentage); }
  /** @param {number} seconds */
  seekTo(seconds) { if (this.provider) this.provider.seekTo(seconds); }
  /** @param {number} seconds */
  setStartAt(seconds) { this.setAttribute('start-at', seconds); }
  /** @param {number} seconds */
  setEndAt(seconds) { this.setAttribute('end-at', seconds); }
  /** The same as setting `src` @param {string} url */
  setSource(url) { this.setAttribute('src', url); }
  /** Re-fit the player to the box; the element does this itself on resize */
  resize() { if (this.provider) this.provider.resize(); }
  /** @param {number} time seconds @returns {number} `0` to `100` within `start-at`..`end-at` */
  timeToPercentage(time) { return this.provider ? this.provider.timeToPercentage(time) : 0; }
  /** @param {number} percentage `0` to `100` @returns {number} seconds within `start-at`..`end-at` */
  percentageToTime(percentage) { return this.provider ? this.provider.percentageToTime(percentage) : 0; }
  /** @returns {boolean} Whether the video would start now - on scroll-in, on a tab switch */
  shouldPlay() { return this.provider ? this.provider.shouldPlay() : false; }
}

if (!customElements.get('video-background')) customElements.define('video-background', VideoBackground);
