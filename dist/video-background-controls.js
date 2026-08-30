/* video-background v1.0.0 | https://github.com/stamat/video-background | MIT License */
var VideoBackgroundControls = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/controls.mjs
  var controls_exports = {};
  __export(controls_exports, {
    MuteToggle: () => MuteToggle,
    PlayToggle: () => PlayToggle,
    SeekBar: () => SeekBar,
    VideoBackgroundGroup: () => VideoBackgroundGroup,
    seekBarsFor: () => seekBarsFor
  });
  function attach(listeners) {
    for (const [element, eventName, handler] of listeners) element.addEventListener(eventName, handler);
  }
  function detach(listeners) {
    for (const [element, eventName, handler] of listeners) element.removeEventListener(eventName, handler);
  }
  function resolveTarget(element, target) {
    if (target) return target;
    const selector = element.getAttribute("data-target");
    return selector ? document.querySelector(selector) : null;
  }
  function initToggle(element) {
    if (!element.hasAttribute("type")) element.setAttribute("type", "button");
    if (!element.hasAttribute("aria-pressed")) element.setAttribute("aria-pressed", "false");
    return element.getAttribute("aria-pressed") === "true";
  }
  function nameInput(input, name) {
    if (input.hasAttribute("aria-label") || input.hasAttribute("aria-labelledby")) return;
    if (input.labels && input.labels.length) return;
    input.setAttribute("aria-label", name);
  }
  var seekBars = /* @__PURE__ */ new WeakMap();
  var boundWrappers = /* @__PURE__ */ new WeakSet();
  function seekBarsFor(target) {
    return seekBars.get(target) || /* @__PURE__ */ new Set();
  }
  function emit(element, name) {
    element.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: element }));
  }
  var SeekBar = class {
    constructor(element, target) {
      this.lock = false;
      this.frame = null;
      this.shownTime = 0;
      this.tick = this.tick.bind(this);
      if (!element || boundWrappers.has(element)) return;
      this.element = element;
      this.progressElem = element.querySelector(".js-seek-bar-progress");
      this.inputElem = element.querySelector(".js-seek-bar");
      this.target = resolveTarget(element, target);
      if (!this.target || !this.inputElem) return;
      boundWrappers.add(element);
      if (!seekBars.has(this.target)) seekBars.set(this.target, /* @__PURE__ */ new Set());
      seekBars.get(this.target).add(this);
      nameInput(this.inputElem, "Seek");
      this.listeners = [
        [this.target, "timeupdate", this.onTimeUpdate.bind(this)],
        [this.target, "seeked", this.onSeeked.bind(this)],
        [this.target, "emptied", this.onDestroyed.bind(this)],
        [this.inputElem, "input", this.onInput.bind(this)],
        [this.inputElem, "change", this.onChange.bind(this)]
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
      const playing = this.target.currentState === "playing";
      const time = playing ? this.anchorTime + (performance.now() - this.anchorStamp) / 1e3 : this.anchorTime;
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
      const playerElement = this.target.playerElement;
      if (playerElement && parseFloat(playerElement.style.opacity) === 0) playerElement.style.opacity = 1;
    }
    setProgress(value) {
      if (this.progressElem) this.progressElem.value = value;
      if (this.inputElem) this.inputElem.value = value;
    }
  };
  var PlayToggle = class {
    constructor(element, target) {
      if (!element) return;
      this.element = element;
      this.target = resolveTarget(element, target);
      if (!this.target) return;
      this.active = initToggle(element);
      this.listeners = [
        [this.target, "playing", this.onStateChange.bind(this)],
        [this.target, "waiting", this.onStateChange.bind(this)],
        [this.target, "play", this.onPlay.bind(this)],
        [this.target, "pause", this.onPause.bind(this)],
        [this.target, "ended", this.onPause.bind(this)],
        [this.target, "emptied", this.onPause.bind(this)],
        [this.element, "click", this.onClick.bind(this)]
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
      this.element.setAttribute("aria-pressed", active);
    }
    onStateChange() {
      this.setActive(this.target.currentState === "playing" || this.target.currentState === "buffering");
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
  };
  var MuteToggle = class {
    constructor(element, target) {
      if (!element) return;
      this.element = element;
      this.target = resolveTarget(element, target);
      if (!this.target) return;
      this.active = initToggle(element);
      this.listeners = [
        [this.target, "loadedmetadata", this.onLoaded.bind(this)],
        [this.target, "volumechange", this.onVolumeChange.bind(this)],
        [this.target, "emptied", this.onEmptied.bind(this)],
        [this.element, "click", this.onClick.bind(this)]
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
      this.element.setAttribute("aria-pressed", active);
    }
    onLoaded() {
      if (this.target.muted) this.setActive(true);
    }
    onVolumeChange() {
      this.setActive(Boolean(this.target.muted));
    }
    onEmptied() {
      this.setActive(false);
    }
    onClick() {
      if (this.active) {
        this.target.unmute();
      } else {
        this.target.mute();
      }
    }
  };
  var VideoBackgroundGroup = class extends HTMLElement {
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
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", this.init, { once: true });
      } else {
        this.init();
      }
    }
    disconnectedCallback() {
      document.removeEventListener("DOMContentLoaded", this.init);
      this.destroy();
    }
    init() {
      if (this.listeners || !this.isConnected) return;
      this.stack = Array.from(this.querySelectorAll("video-background"));
      if (!this.stack.length) return;
      this.map = new Map(this.stack.map((element, index) => [element, index]));
      this.current = 0;
      this.listeners = [
        ["ended", this.onVideoEnded.bind(this)],
        ["seeked", this.onVideoSeeked.bind(this)],
        ["loadedmetadata", this.onVideoReady.bind(this)]
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
      const video = event.target;
      if (video !== this.currentElement) return;
      if (video.params.muted) this.muted = true;
      if (!video.isIntersecting || !video.params.autoplay) return;
      this.playing = true;
      if (video.currentState === "playing") return;
      video.softPlay();
    }
    levelSeekBars() {
      for (let i = 0; i < this.stack.length; i++) {
        if (i === this.current) continue;
        for (const bar of seekBarsFor(this.stack[i])) bar.setProgress(i < this.current ? 100 : 0);
      }
    }
    onVideoSeeked(event) {
      const index = this.map.get(event.target);
      if (this.current !== index) this.setCurrent(index, true);
    }
    setCurrent(index, seek) {
      const previous = this.currentElement;
      const forwardRewind = index >= this.stack.length;
      const backwardRewind = index < 0;
      if (forwardRewind) index = 0;
      if (backwardRewind) index = this.stack.length - 1;
      this.current = index;
      const current = this.currentElement;
      previous.style.display = "none";
      current.style.display = "block";
      if (!seek) {
        for (const bar of seekBarsFor(current)) bar.setProgress(0);
        current.seek(0);
      }
      setTimeout(() => {
        if (current.currentState !== "playing") current.play();
      }, 100);
      if (previous !== current && previous.currentState !== "paused") previous.pause();
      setTimeout(() => this.levelSeekBars(), 100);
      if (forwardRewind) emit(this, "video-background-group-forward-rewind");
      if (backwardRewind) emit(this, "video-background-group-backward-rewind");
    }
    onVideoEnded(event) {
      if (event.target !== this.currentElement) return;
      this.next();
    }
    next() {
      this.setCurrent(this.current + 1);
      emit(this, "video-background-group-next");
    }
    prev() {
      this.setCurrent(this.current - 1);
      emit(this, "video-background-group-previous");
    }
    unmute() {
      for (const element of this.stack) element.unmute();
      this.muted = false;
      emit(this, "video-background-group-unmute");
    }
    mute() {
      for (const element of this.stack) element.mute();
      this.muted = true;
      emit(this, "video-background-group-mute");
    }
    pause() {
      this.currentElement.pause();
      this.playing = false;
      emit(this, "video-background-group-pause");
    }
    play() {
      this.currentElement.play();
      this.playing = true;
      emit(this, "video-background-group-play");
    }
  };
  if (!customElements.get("video-background-group")) customElements.define("video-background-group", VideoBackgroundGroup);
  return __toCommonJS(controls_exports);
})();
//# sourceMappingURL=video-background-controls.js.map
