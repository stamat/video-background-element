import { RE_YOUTUBE, RE_VIMEO, RE_VIDEO, stringToType, isMobile } from 'book-of-spells';
import { YouTube } from './lib/youtube.mjs';
import { Vimeo, getVimeoUnlistedHash } from './lib/vimeo.mjs';
import { Video } from './lib/video.mjs';

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
  'always-play': false,
  'start-at': 0,
  'end-at': 0,
  'volume': 1,
  'poster': null,
  'load-background': false,
  'resolution': '16:9',
  'fit-box': false,
  'offset': 100,
  'no-cookie': true,
  'lazyloading': false,
  'force-on-low-battery': false,
  'title': 'Video background'
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
  if (!('IntersectionObserver' in window)) params['always-play'] = true;

  return params;
}

const STYLE_ID = 'video-background-style';

// :where() keeps every rule at zero specificity, so a plain type selector on the
// page overrides any of these without !important
const STYLE = `
:where(video-background) { display: block; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; overflow: hidden; pointer-events: none; background-size: cover; background-repeat: no-repeat; background-position: center; }
:where(video-background > iframe), :where(video-background > video) { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 0; }
:where(video-background > img) { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
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
 * instance - its playback API and state live on it, and every event carries it in
 * `event.detail`.
 *
 * Options are read from attributes when the element builds, which is when it connects with
 * a `src`. Only `src`, `start-at` and `end-at` are watched afterwards; the rest take effect
 * on the next build, which removing and re-adding `src` forces.
 *
 * @summary A cover-fit video background from a YouTube, Vimeo or video file link.
 * @customElement video-background
 *
 * @attr {string} src - A YouTube, Vimeo or video file url. Removing it tears the player down, setting it again rebuilds; a url of the same type swaps the video in place.
 * @attr {boolean} [autoplay=true] - Start as soon as the element is in view.
 * @attr {boolean} [muted=true] - Start muted - which is what lets autoplay through.
 * @attr {boolean} [loop=true] - Restart when the video ends.
 * @attr {boolean} [mobile=true] - Build the player on touch devices too. Off, the element keeps only its poster there.
 * @attr {boolean} [always-play=false] - Keep playing off-screen instead of pausing.
 * @attr {number} [start-at=0] - Seconds to start from.
 * @attr {number} [end-at=0] - Seconds to stop at, `0` for the full duration.
 * @attr {number} [volume=1] - `0` to `1`, applied on the first unmute.
 * @attr {string} poster - Image url shown behind the player until the first frame.
 * @attr {boolean} [load-background=false] - Use the platform's own thumbnail as the poster. YouTube and Vimeo only.
 * @attr {string} [resolution=16:9] - Aspect ratio the player is sized by to cover the box.
 * @attr {boolean} [fit-box=false] - Stretch to the box instead of covering it.
 * @attr {number} [offset=100] - Pixels of overscan past the box, hiding the platform's edge chrome.
 * @attr {boolean} [no-cookie=true] - Embed from the privacy-preserving domains.
 * @attr {boolean} [lazyloading=false] - `loading="lazy"` on the iframe. YouTube and Vimeo only.
 * @attr {boolean} [force-on-low-battery=false] - On a touch device, start a muted autoplay on the first touch, for the low power modes that block autoplay.
 * @attr {string} [title=Video background] - Accessible name of the player frame.
 *
 * @fires video-background-ready - The player can play. A video file is ready at once.
 * @fires video-background-play - Playback started.
 * @fires video-background-pause - Playback paused.
 * @fires video-background-ended - The video reached its end, or `end-at`. With `loop` on it restarts right after.
 * @fires video-background-seeked - The position moved, through `seek`, `seekTo` or a seek bar.
 * @fires video-background-time-update - The position advanced while playing, about four times a second.
 * @fires video-background-state-change - `currentState` changed: `notstarted`, `playing`, `paused`, `buffering` or `ended`.
 * @fires video-background-mute - Sound off.
 * @fires video-background-unmute - Sound on.
 * @fires video-background-volume-change - `volume` changed.
 * @fires video-background-resize - The player was re-sized to the box.
 * @fires video-background-destroyed - The player was torn down: `src` removed, or the element disconnected.
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

    // only a statically positioned parent needs a containing block, and only
    // the computed value can tell us that - the parent may be positioned by CSS
    const parent = this.parentElement;
    const position = parent && window.getComputedStyle(parent).position;
    if (parent && (!position || position === 'static')) {
      parent.style.position = 'relative';
    }
  }

  observe() {
    if ('IntersectionObserver' in window && !this.params['always-play']) {
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
    this.dispatchEvent(new CustomEvent('video-background-destroyed', { bubbles: true, detail: this }));
  }

  /* ===== state, proxied from the provider ===== */

  /** @type {string | undefined} `youtube`, `vimeo` or `video` */
  get type() { return this.provider ? this.provider.type : undefined; }
  /** @type {object | null} The YouTube or Vimeo player object, or the `<video>` element */
  get player() { return this.provider ? this.provider.player : null; }
  /** @type {HTMLIFrameElement | HTMLVideoElement | null} The iframe or `<video>` inside the element */
  get playerElement() { return this.provider ? this.provider.playerElement : null; }
  /** @type {boolean} True after `pause()` - a pause the visitor asked for, which scrolling and tab switches never override */
  get paused() { return this.provider ? this.provider.paused : false; }
  /** @type {boolean} */
  get muted() { return this.provider ? this.provider.muted : false; }
  /** @type {number} `0` to `1` */
  get volume() { return this.provider ? this.provider.volume : 0; }
  /** @type {string} `notstarted`, `playing`, `paused`, `buffering` or `ended` */
  get currentState() { return this.provider ? this.provider.currentState : 'notstarted'; }
  /** @type {number} Seconds */
  get currentTime() { return this.provider ? this.provider.currentTime : 0; }
  /** @type {number} Seconds, capped by `end-at` */
  get duration() { return this.provider ? this.provider.duration : 0; }
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
