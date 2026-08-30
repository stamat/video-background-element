// Controls over markup you write, pointed at a <video-background> by `data-target`.
// Nothing here imports the element: a page loads the element bundle and this one, and the
// group finds its members through the tag name, so the element's code ships once.

// Bound once and kept: removeEventListener only matches the very function object
// addEventListener was given, and a fresh .bind() never is.
function attach(listeners) {
  for (const [element, eventName, handler] of listeners) element.addEventListener(eventName, handler);
}

function detach(listeners) {
  for (const [element, eventName, handler] of listeners) element.removeEventListener(eventName, handler);
}

function resolveTarget(element, target) {
  if (target) return target;
  const selector = element.getAttribute('data-target');
  return selector ? document.querySelector(selector) : null;
}

// The name is the author's and never changes; aria-pressed alone is the state, and pressed
// means what the name says is in effect - "Play" pressed is playing, "Mute" pressed is muted.
// Not role="switch", which expects aria-checked, and not a name that swaps with the state,
// which with aria-pressed would say it twice.
function initToggle(element) {
  if (!element.hasAttribute('type')) element.setAttribute('type', 'button');
  if (!element.hasAttribute('aria-pressed')) element.setAttribute('aria-pressed', 'false');
  return element.getAttribute('aria-pressed') === 'true';
}

// A range input with no name is announced as a bare "slider".
function nameInput(input, name) {
  if (input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby')) return;
  if (input.labels && input.labels.length) return;
  input.setAttribute('aria-label', name);
}

// target element -> the seek bars driving it, so a group can level the bars of the
// members that are not playing and therefore report no time
const seekBars = new WeakMap();
const boundWrappers = new WeakSet();

export function seekBarsFor(target) {
  return seekBars.get(target) || new Set();
}

// outside the class on purpose: the manifest analyzer reads a dispatchEvent inside one as
// an event named after the variable
function emit(element, name) {
  element.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: element }));
}

export class SeekBar {
  constructor(element, target) {
    this.lock = false;
    this.frame = null;
    this.shownTime = 0;
    this.tick = this.tick.bind(this);
    if (!element || boundWrappers.has(element)) return;
    this.element = element;
    this.progressElem = element.querySelector('.js-seek-bar-progress');
    this.inputElem = element.querySelector('.js-seek-bar');
    this.target = resolveTarget(element, target);
    if (!this.target || !this.inputElem) return;

    boundWrappers.add(element);
    if (!seekBars.has(this.target)) seekBars.set(this.target, new Set());
    seekBars.get(this.target).add(this);
    nameInput(this.inputElem, 'Seek');

    this.listeners = [
      [this.target, 'video-background-time-update', this.onTimeUpdate.bind(this)],
      [this.target, 'video-background-seeked', this.onSeeked.bind(this)],
      [this.target, 'video-background-destroyed', this.onDestroyed.bind(this)],
      [this.inputElem, 'input', this.onInput.bind(this)],
      [this.inputElem, 'change', this.onChange.bind(this)]
    ];
    attach(this.listeners);
  }

  destroy() {
    if (!this.listeners) return;
    detach(this.listeners);
    this.listeners = null;
    boundWrappers.delete(this.element);
    seekBars.get(this.target).delete(this);
    cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  // A provider reports time about four times a second - YouTube is polled on a 250ms
  // interval, Vimeo and <video> fire timeupdate at about that rate - and a thumb that only
  // moves on those reports visibly steps. So while the video plays the bar moves on an
  // animation frame: the last report plus the wall clock since it. A report a few
  // milliseconds behind that is jitter and the bar holds rather than stepping back; one more
  // than a second behind is a seek or a loop, and the bar snaps to it.
  onTimeUpdate() {
    if (this.lock) return;
    this.anchorTime = this.target.currentTime;
    this.anchorStamp = performance.now();
    if (this.anchorTime < this.shownTime - 1) this.shownTime = 0;
    cancelAnimationFrame(this.frame);
    this.tick();
  }

  tick() {
    this.frame = null;
    if (this.lock) return;
    const playing = this.target.currentState === 'playing';
    const time = playing ? this.anchorTime + (performance.now() - this.anchorStamp) / 1000 : this.anchorTime;
    this.shownTime = Math.max(this.shownTime, time);
    this.setProgress(this.target.timeToPercentage(this.shownTime));
    if (playing) this.frame = requestAnimationFrame(this.tick);
  }

  onSeeked() {
    this.shownTime = 0;
  }

  onDestroyed() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    this.shownTime = 0;
    requestAnimationFrame(() => this.setProgress(0));
  }

  onInput(event) {
    this.lock = true;
    requestAnimationFrame(() => this.setProgress(event.target.value));
  }

  onChange(event) {
    this.lock = false;
    this.shownTime = 0;
    requestAnimationFrame(() => this.setProgress(event.target.value));
    this.target.seek(event.target.value);
    // a seek before the first play is the visitor asking to see the video
    const playerElement = this.target.playerElement;
    if (playerElement && parseFloat(playerElement.style.opacity) === 0) playerElement.style.opacity = 1;
  }

  setProgress(value) {
    if (this.progressElem) this.progressElem.value = value;
    if (this.inputElem) this.inputElem.value = value;
  }
}

export class PlayToggle {
  constructor(element, target) {
    if (!element) return;
    this.element = element;
    this.target = resolveTarget(element, target);
    if (!this.target) return;
    this.active = initToggle(element);

    this.listeners = [
      [this.target, 'video-background-state-change', this.onStateChange.bind(this)],
      [this.target, 'video-background-play', this.onPlay.bind(this)],
      [this.target, 'video-background-pause', this.onPause.bind(this)],
      [this.target, 'video-background-destroyed', this.onPause.bind(this)],
      [this.element, 'click', this.onClick.bind(this)]
    ];
    attach(this.listeners);
  }

  destroy() {
    if (!this.listeners) return;
    detach(this.listeners);
    this.listeners = null;
  }

  setActive(active) {
    this.active = active;
    this.element.setAttribute('aria-pressed', active);
  }

  onStateChange() {
    this.setActive(this.target.currentState === 'playing' || this.target.currentState === 'buffering');
  }

  onPlay() {
    this.setActive(true);
  }

  onPause() {
    this.setActive(false);
  }

  onClick() {
    if (this.active) {
      this.target.pause();
    } else {
      this.target.play();
    }
  }
}

export class MuteToggle {
  constructor(element, target) {
    if (!element) return;
    this.element = element;
    this.target = resolveTarget(element, target);
    if (!this.target) return;
    this.active = initToggle(element);

    this.listeners = [
      [this.target, 'video-background-ready', this.onReady.bind(this)],
      [this.target, 'video-background-mute', this.onMute.bind(this)],
      [this.target, 'video-background-unmute', this.onUnmute.bind(this)],
      [this.target, 'video-background-destroyed', this.onUnmute.bind(this)],
      [this.element, 'click', this.onClick.bind(this)]
    ];
    attach(this.listeners);
  }

  destroy() {
    if (!this.listeners) return;
    detach(this.listeners);
    this.listeners = null;
  }

  setActive(active) {
    this.active = active;
    this.element.setAttribute('aria-pressed', active);
  }

  onReady() {
    if (this.target.muted) this.setActive(true);
  }

  onMute() {
    this.setActive(true);
  }

  onUnmute() {
    this.setActive(false);
  }

  onClick() {
    if (this.active) {
      this.target.unmute();
    } else {
      this.target.mute();
    }
  }
}

/**
 * Plays the `<video-background>` elements inside it as one playlist: one shown at a time,
 * stepping to the next when the current one ends. Only `display` is toggled between the
 * members - stacking them over the same box is your CSS.
 *
 * @summary A playlist of the video backgrounds inside it.
 * @customElement video-background-group
 *
 * @fires video-background-group-play - The current member was started through the group.
 * @fires video-background-group-pause - The current member was paused through the group.
 * @fires video-background-group-mute - Every member was muted.
 * @fires video-background-group-unmute - Every member was unmuted.
 * @fires video-background-group-next - The group stepped forward.
 * @fires video-background-group-previous - The group stepped back.
 * @fires video-background-group-forward-rewind - `next()` ran past the last member and wrapped to the first.
 * @fires video-background-group-backward-rewind - `prev()` ran past the first member and wrapped to the last.
 */
export class VideoBackgroundGroup extends HTMLElement {
  constructor() {
    super();
    this.stack = [];
    this.current = 0;
    this.playing = false;
    this.muted = true;
    this.listeners = null;
    this.init = this.init.bind(this);
  }

  connectedCallback() {
    // the parser upgrades this element before its children exist
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.init, { once: true });
    } else {
      this.init();
    }
  }

  disconnectedCallback() {
    document.removeEventListener('DOMContentLoaded', this.init);
    this.destroy();
  }

  init() {
    if (this.listeners || !this.isConnected) return;
    this.stack = Array.from(this.querySelectorAll('video-background'));
    if (!this.stack.length) return;
    this.map = new Map(this.stack.map((element, index) => [element, index]));
    this.current = 0;

    this.listeners = [
      ['video-background-ended', this.onVideoEnded.bind(this)],
      ['video-background-seeked', this.onVideoSeeked.bind(this)],
      ['video-background-ready', this.onVideoReady.bind(this)]
    ];
    for (const element of this.stack) {
      for (const [eventName, handler] of this.listeners) element.addEventListener(eventName, handler);
    }
  }

  destroy() {
    if (!this.listeners) return;
    for (const element of this.stack) {
      for (const [eventName, handler] of this.listeners) element.removeEventListener(eventName, handler);
    }
    this.listeners = null;
  }

  get currentElement() {
    return this.stack[this.current];
  }

  onVideoReady(event) {
    const video = event.detail;
    if (video !== this.currentElement) return;
    if (video.params.muted) this.muted = true;
    if (!video.isIntersecting || !video.params.autoplay) return;
    this.playing = true;
    if (video.currentState === 'playing') return;
    video.softPlay();
  }

  levelSeekBars() {
    for (let i = 0; i < this.stack.length; i++) {
      if (i === this.current) continue;
      for (const bar of seekBarsFor(this.stack[i])) bar.setProgress(i < this.current ? 100 : 0);
    }
  }

  onVideoSeeked(event) {
    const index = this.map.get(event.detail);
    if (this.current !== index) this.setCurrent(index, true);
  }

  setCurrent(index, seek) {
    const previous = this.currentElement;
    // remember the wrap before clamping - the dispatches below need it
    const forwardRewind = index >= this.stack.length;
    const backwardRewind = index < 0;
    if (forwardRewind) index = 0;
    if (backwardRewind) index = this.stack.length - 1;
    this.current = index;
    const current = this.currentElement;

    previous.style.display = 'none';
    current.style.display = 'block';

    if (!seek) {
      for (const bar of seekBarsFor(current)) bar.setProgress(0);
      current.seek(0);
    }

    setTimeout(() => {
      if (current.currentState !== 'playing') current.play();
    }, 100);
    if (previous !== current && previous.currentState !== 'paused') previous.pause();

    setTimeout(() => this.levelSeekBars(), 100);

    if (forwardRewind) emit(this, 'video-background-group-forward-rewind');
    if (backwardRewind) emit(this, 'video-background-group-backward-rewind');
  }

  onVideoEnded(event) {
    if (event.detail !== this.currentElement) return;
    this.next();
  }

  next() {
    this.setCurrent(this.current + 1);
    emit(this, 'video-background-group-next');
  }

  prev() {
    this.setCurrent(this.current - 1);
    emit(this, 'video-background-group-previous');
  }

  unmute() {
    for (const element of this.stack) element.unmute();
    this.muted = false;
    emit(this, 'video-background-group-unmute');
  }

  mute() {
    for (const element of this.stack) element.mute();
    this.muted = true;
    emit(this, 'video-background-group-mute');
  }

  pause() {
    this.currentElement.pause();
    this.playing = false;
    emit(this, 'video-background-group-pause');
  }

  play() {
    this.currentElement.play();
    this.playing = true;
    emit(this, 'video-background-group-play');
  }
}

if (!customElements.get('video-background-group')) customElements.define('video-background-group', VideoBackgroundGroup);
