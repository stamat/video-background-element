/* video-background-element v1.1.0 | https://github.com/stamat/video-background-element | MIT License */
(() => {
  // node_modules/book-of-spells/src/helpers.mjs
  var objProto = Object.prototype;
  var foldF64 = new Float64Array(1);
  var foldU32 = new Uint32Array(foldF64.buffer);
  function stringToBoolean(str) {
    if (/^\s*(true|false)\s*$/i.test(str)) return str.trim().toLowerCase() === "true";
  }
  function stringToNumber(str) {
    if (/^\s*-?\d+\s*$/.test(str)) return parseInt(str);
    if (/^\s*-?\d+\.\d+\s*$/.test(str)) return parseFloat(str);
  }
  function stringToArray(str) {
    if (!/^\s*\[.*\]\s*$/.test(str)) return;
    try {
      return JSON.parse(str);
    } catch (e) {
    }
  }
  function stringToObject(str) {
    if (!/^\s*\{.*\}\s*$/.test(str)) return;
    try {
      return JSON.parse(str);
    } catch (e) {
    }
  }
  function stringToRegex(str) {
    if (typeof str !== "string") return;
    const match = str.match(/^\s*\/(.*?)\/([gimsuy]*)\s*$/);
    if (!match) return;
    try {
      return new RegExp(match[1], match[2]);
    } catch (e) {
    }
  }
  function stringToType(str) {
    var _a, _b, _c, _d;
    if (/^\s*null\s*$/.test(str)) return null;
    const bool = stringToBoolean(str);
    if (bool !== void 0) return bool;
    return (_d = (_c = (_b = (_a = stringToNumber(str)) != null ? _a : stringToArray(str)) != null ? _b : stringToObject(str)) != null ? _c : stringToRegex(str)) != null ? _d : str;
  }
  function isString(o) {
    return typeof o === "string";
  }
  var PLAIN = {
    \u00C6: "AE",
    \u00E6: "ae",
    \u0152: "OE",
    \u0153: "oe",
    \u00DF: "ss",
    "\u1E9E": "SS",
    \u00DE: "TH",
    \u00FE: "th",
    \u0110: "D",
    \u0111: "d",
    \u00D0: "D",
    \u00F0: "d",
    \u00D8: "O",
    \u00F8: "o",
    \u0141: "L",
    \u0142: "l",
    \u013F: "L",
    \u0140: "l",
    \u0126: "H",
    \u0127: "h",
    \u0166: "T",
    \u0167: "t",
    \u01E4: "G",
    \u01E5: "g",
    \u014A: "N",
    \u014B: "n",
    \u0131: "i"
  };
  var PLAIN_RE = new RegExp(`[${Object.keys(PLAIN).join("")}]`, "g");
  function fixed(number, digits) {
    if (!digits) return parseInt(number);
    return parseFloat(number.toFixed(digits));
  }
  function percentage(num, total) {
    if (Number.isNaN(num) || Number.isNaN(total) || total === 0) return 0;
    return num / total * 100;
  }

  // node_modules/book-of-spells/src/dom.mjs
  function query(selector, from = document) {
    if (selector instanceof Array || selector instanceof NodeList) return selector;
    if (selector instanceof Element) return [selector];
    if (from instanceof Element || from instanceof Document) return from.querySelectorAll(selector);
    if (isString(from)) from = query(from);
    if (!(from instanceof Array || from instanceof NodeList)) return [];
    const res = [];
    for (const element of from) {
      res.push(...element.querySelectorAll(selector));
    }
    return res;
  }
  function proportionalParentCoverResize(elements, ratio = 1, offset = 0) {
    if (elements instanceof Element) elements = [elements];
    if (typeof elements === "string") elements = query(elements);
    for (const element of elements) {
      const h = element.parentNode.offsetHeight + offset;
      const w = element.parentNode.offsetWidth + offset;
      if (ratio > w / h) {
        element.style.width = h * ratio + "px";
        element.style.height = h + "px";
      } else {
        element.style.width = w + "px";
        element.style.height = w / ratio + "px";
      }
    }
  }

  // node_modules/book-of-spells/src/regex.mjs
  var RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;
  var RE_VIMEO = /(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i;
  var RE_VIDEO = /\/([^\/?#]+\.(?:mp4|m4v|ogg|ogv|ogm|webm|avi|mov|qt))(?:[?#][^\/]*)?\s*$/i;

  // node_modules/book-of-spells/src/parsers.mjs
  function parseResolutionString(res) {
    const DEFAULT_RESOLUTION = 1.7777777778;
    if (!res || !res.length || /16[\:x\-\/]{1}9/i.test(res)) return DEFAULT_RESOLUTION;
    const pts = res.split(/\s?[\:x\-\/]{1}\s?/i);
    if (pts.length < 2) return DEFAULT_RESOLUTION;
    const w = parseInt(pts[0]);
    const h = parseInt(pts[1]);
    if (w === 0 || h === 0) return DEFAULT_RESOLUTION;
    if (isNaN(w) || isNaN(h)) return DEFAULT_RESOLUTION;
    return w / h;
  }

  // node_modules/book-of-spells/src/browser.mjs
  function isUserAgentMobile(str) {
    return /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(str) || /\b(Android|Windows Phone|iPad|iPod)\b/i.test(str);
  }
  function isMobile() {
    if ("maxTouchPoints" in navigator) return navigator.maxTouchPoints > 0;
    if ("matchMedia" in window) return !!matchMedia("(pointer:coarse)").matches;
    if ("orientation" in window) return true;
    return isUserAgentMobile(navigator.userAgent);
  }

  // node_modules/book-of-spells/src/keyboard.mjs
  var MODIFIERS = ["Meta", "Control", "Alt", "Shift"];
  var MODIFIER_KEYS = new Set(MODIFIERS);

  // src/lib/provider.mjs
  var EMPTY_RANGES = { length: 0 };
  var Provider = class {
    constructor(host, source, type) {
      this.host = host;
      this.params = host.params;
      this.type = type;
      this.id = source.id;
      this.is_mobile = isMobile();
      this.player = null;
      this.playerElement = null;
      this.pending = null;
      this.destroyed = false;
      this.isIntersecting = false;
      this.paused = false;
      this.muted = this.params.muted;
      this.volume = this.params.volume;
      this.currentState = "notstarted";
      this.initialPlay = false;
      this.initialVolume = false;
      this.currentTime = this.params["start-at"] || 0;
      this.duration = this.params["end-at"] || 0;
      this.percentComplete = 0;
      this.params.resolution_mod = parseResolutionString(this.params.resolution);
    }
    // the <video> event names, and like a <video>'s they do not bubble
    emit(name) {
      this.host.dispatchEvent(new Event(name));
    }
    get buffered() {
      return EMPTY_RANGES;
    }
    updateState(state) {
      this.currentState = state;
      this.announceState();
    }
    // only two states have a <video> name of their own; play, pause and ended are announced
    // by the handlers that reach them
    announceState() {
      if (this.currentState === "buffering") this.emit("waiting");
      if (this.currentState === "playing") this.emit("playing");
    }
    // autoplay=1 goes into the embed URL only when the video would start anyway,
    // otherwise an off-screen lazy video plays into the void until scrolled to
    autoplayNow() {
      if (this.paused) return false;
      return this.params.autoplay && (!this.params["pause-offscreen"] || this.isIntersecting);
    }
    // playback the visitor did not stop - buffering is playing that is still catching up
    isPlaying() {
      return !this.paused && (this.currentState === "playing" || this.currentState === "buffering");
    }
    // what a swapped-in video does: plays on if the old one was, starts if a fresh build
    // would - autoplay on and in view - and waits otherwise; a held pause stops both
    startsAfterSwap() {
      return this.isPlaying() || this.autoplayNow();
    }
    // duration and progress describe the video being replaced, and a stale duration ends the
    // new one early - every setSource clears them, so the new duration arrives as metadata
    resetProgress() {
      this.duration = 0;
      this.currentTime = this.params["start-at"] || 0;
      this.percentComplete = 0;
    }
    timeToPercentage(time) {
      if (time <= this.params["start-at"]) return 0;
      if (!this.duration) return 0;
      if (time >= this.duration) return 100;
      if (time <= 0) return 0;
      time -= this.params["start-at"];
      const duration = this.duration - this.params["start-at"];
      return percentage(time, duration);
    }
    percentageToTime(percentage2) {
      if (!this.duration) return this.params["start-at"] || 0;
      if (percentage2 > 100) return this.duration;
      if (percentage2 <= 0) return this.params["start-at"] || 0;
      const duration = this.duration - this.params["start-at"];
      let time = percentage2 * duration / 100;
      time = fixed(time, 3);
      if (time > duration) time = duration;
      if (this.params["start-at"]) time += this.params["start-at"];
      return time;
    }
    resize() {
      if (!this.playerElement) return;
      if (!this.params["fit-box"]) proportionalParentCoverResize(this.playerElement, this.params.resolution_mod, this.params.offset);
    }
    // The one place metadata is announced: a file's duration arrives with its metadata,
    // YouTube's with the player, Vimeo's over a promise after it - so the first known
    // duration is `loadedmetadata`, and only a number that moved is `durationchange`, since
    // Vimeo repeats the same one on every timeupdate.
    setDuration(duration) {
      const capped = this.params["end-at"] ? Math.min(duration, this.params["end-at"]) : duration;
      if (capped === this.duration) return;
      const first = !this.duration;
      this.duration = capped;
      this.emit("durationchange");
      if (first) this.emit("loadedmetadata");
    }
    setStartAt(startAt) {
      this.params["start-at"] = startAt;
    }
    setEndAt(endAt) {
      this.params["end-at"] = endAt;
      if (this.duration > endAt) this.setDuration(endAt);
      if (this.currentTime > endAt) this.onVideoEnded();
    }
    shouldPlay() {
      if (this.paused) return false;
      if (this.currentState === "ended" && !this.params.loop) return false;
      if (!this.params["pause-offscreen"] && this.params.autoplay && this.currentState !== "playing") return true;
      if (this.isIntersecting && this.params.autoplay && this.currentState !== "playing") return true;
      return false;
    }
    // the first frame stays hidden until the first play, so the visitor never sees
    // the platform's own poster and controls flash before the video takes over
    reveal() {
      if (this.initialPlay) return;
      this.initialPlay = true;
      this.playerElement.style.opacity = 1;
    }
    mobileLowBatteryAutoplayHack() {
      if (!this.params["force-on-low-battery"]) return;
      if (!this.is_mobile && this.params.mobile) return;
      const forceAutoplay = () => {
        if (!this.initialPlay && this.params.autoplay && this.params.muted) {
          this.softPlay();
          if (!this.isIntersecting && this.params["pause-offscreen"]) {
            this.softPause();
          }
        }
      };
      document.addEventListener("touchstart", forceAutoplay, { once: true });
    }
    createFrame() {
      const frame = document.createElement("iframe");
      frame.style.border = "0";
      if (this.params.title) frame.setAttribute("title", this.params.title);
      frame.setAttribute("allow", "autoplay; mute");
      if (this.params.lazyloading) frame.setAttribute("loading", "lazy");
      return frame;
    }
    mount(playerElement) {
      this.playerElement = playerElement;
      playerElement.style.opacity = 0;
      if (this.params["fit-box"]) {
        playerElement.style.display = "block";
        playerElement.style.width = "100%";
        playerElement.style.height = "100%";
      }
      this.host.appendChild(playerElement);
      this.resize();
    }
    destroy() {
      this.destroyed = true;
      if (this.timeUpdateTimer) clearInterval(this.timeUpdateTimer);
      const player = this.player || this.pending;
      if (player && typeof player.destroy === "function") player.destroy();
      if (this.playerElement) this.playerElement.remove();
      this.player = null;
      this.pending = null;
      this.playerElement = null;
    }
  };

  // src/lib/load.mjs
  var scripts = /* @__PURE__ */ new Map();
  function loadScript(src) {
    if (scripts.has(src)) return scripts.get(src);
    const promise = new Promise((resolve, reject) => {
      let tag = document.querySelector(`script[src="${src}"]`);
      if (!tag) {
        tag = document.createElement("script");
        tag.async = true;
        tag.src = src;
        document.head.appendChild(tag);
      }
      tag.addEventListener("load", () => resolve(), { once: true });
      tag.addEventListener("error", () => reject(new Error(`video-background: failed to load ${src}`)), { once: true });
    });
    scripts.set(src, promise);
    return promise;
  }
  var youtubeReady = null;
  var YOUTUBE_READY_INTERVAL = 100;
  var YOUTUBE_READY_TRIES = 100;
  function loadYouTubeAPI() {
    if (youtubeReady) return youtubeReady;
    youtubeReady = new Promise((resolve, reject) => {
      if (window.YT && window.YT.loaded) return resolve();
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function() {
        if (typeof previous === "function") previous();
        resolve();
      };
      loadScript("https://www.youtube.com/player_api").then(() => {
        let tries = YOUTUBE_READY_TRIES;
        const timer = setInterval(() => {
          if (window.YT && window.YT.loaded) {
            clearInterval(timer);
            resolve();
          } else if (--tries <= 0) {
            clearInterval(timer);
            reject(new Error("video-background: the YouTube API loaded but never became ready"));
          }
        }, YOUTUBE_READY_INTERVAL);
      }).catch(reject);
    });
    return youtubeReady;
  }
  var vimeoReady = null;
  function loadVimeoAPI() {
    if (vimeoReady) return vimeoReady;
    vimeoReady = window.Vimeo && window.Vimeo.Player ? Promise.resolve() : loadScript("https://player.vimeo.com/api/player.js");
    return vimeoReady;
  }

  // src/lib/youtube.mjs
  var STATES = {
    "-1": "notstarted",
    "0": "ended",
    "1": "playing",
    "2": "paused",
    "3": "buffering",
    "5": "cued"
  };
  var YouTube = class extends Provider {
    constructor(host, source) {
      super(host, source, "youtube");
      this.timeUpdateTimer = null;
      this.timeUpdateInterval = 250;
    }
    connect() {
      const frame = this.createFrame();
      frame.src = this.generateSrcURL(this.id);
      this.mount(frame);
      loadYouTubeAPI().then(() => this.initPlayer()).catch((error) => console.warn(`video-background: ${error.message}`));
    }
    // `player` stays null until onReady: the object YT.Player hands back has none of its
    // methods before the iframe answers, and a scroll-in during that gap called playVideo
    // on it. A null player is what every guard below already checks for.
    initPlayer() {
      if (this.destroyed || this.player || this.pending) return;
      this.pending = new YT.Player(this.playerElement, {
        events: {
          "onReady": this.onVideoPlayerReady.bind(this),
          "onStateChange": this.onVideoStateChange.bind(this)
        }
      });
    }
    generateSrcURL(id) {
      const site = this.params["no-cookie"] ? "https://www.youtube-nocookie.com/embed/" : "https://www.youtube.com/embed/";
      let src = `${site}${id}?&enablejsapi=1&disablekb=1&controls=0&rel=0&iv_load_policy=3&cc_load_policy=0&playsinline=1&showinfo=0&modestbranding=1&fs=0`;
      if (this.muted) src += "&mute=1";
      if (this.autoplayNow()) src += "&autoplay=1";
      return src;
    }
    startTimeUpdateTimer() {
      if (this.timeUpdateTimer) return;
      this.timeUpdateTimer = setInterval(this.onVideoTimeUpdate.bind(this), this.timeUpdateInterval);
    }
    stopTimeUpdateTimer() {
      clearInterval(this.timeUpdateTimer);
      this.timeUpdateTimer = null;
    }
    // A new frame `src` navigates away from the document the API shook hands with: no more
    // state changes, so no more loop, and the fresh embed reads mute and autoplay off the
    // URL rather than off the player. Only a swap before the player answers pays that.
    setSource(source) {
      const start = this.startsAfterSwap();
      this.id = source.id;
      this.resetProgress();
      if (!this.player) {
        this.playerElement.src = this.generateSrcURL(this.id);
        return;
      }
      const request = { videoId: this.id, startSeconds: this.params["start-at"] || 0 };
      if (start) {
        this.player.loadVideoById(request);
      } else {
        this.player.cueVideoById(request);
      }
    }
    onVideoTimeUpdate() {
      const ctime = this.player.getCurrentTime();
      if (ctime === this.currentTime) return;
      this.currentTime = ctime;
      this.percentComplete = this.timeToPercentage(this.currentTime);
      if (this.params["end-at"] && this.duration && this.currentTime >= this.duration) {
        this.updateState("ended");
        this.onVideoEnded();
        this.stopTimeUpdateTimer();
        return;
      }
      this.emit("timeupdate");
    }
    onVideoPlayerReady(event) {
      if (this.destroyed) return;
      this.player = event.target;
      this.pending = null;
      if (this.volume !== 1 && !this.muted) this.setVolume(this.volume);
      this.mobileLowBatteryAutoplayHack();
      if (this.autoplayNow()) {
        if (this.params["start-at"]) this.seekTo(this.params["start-at"]);
        this.player.playVideo();
      }
      this.setDuration(this.player.getDuration());
    }
    onVideoStateChange(event) {
      this.currentState = STATES[event.data];
      if (this.currentState === "ended") this.onVideoEnded();
      if (this.currentState === "notstarted" && this.autoplayNow()) {
        this.seekTo(this.params["start-at"]);
        this.player.playVideo();
      }
      if (this.currentState === "playing") this.onVideoPlay();
      if (this.currentState === "paused") this.onVideoPause();
      this.announceState();
    }
    onVideoPlay() {
      this.reveal();
      const seconds = this.player.getCurrentTime();
      if (this.params["start-at"] && seconds < this.params["start-at"]) {
        this.seekTo(this.params["start-at"]);
      }
      if (this.duration && seconds >= this.duration) {
        this.seekTo(this.params["start-at"]);
      }
      if (!this.duration) {
        this.setDuration(this.player.getDuration());
      }
      this.emit("play");
      this.startTimeUpdateTimer();
    }
    onVideoPause() {
      this.stopTimeUpdateTimer();
      this.emit("pause");
    }
    onVideoEnded() {
      this.emit("ended");
      if (this.paused || !this.params.loop) return this.pause();
      this.seekTo(this.params["start-at"]);
      this.player.playVideo();
    }
    // the player reports one fraction from the start, which is one range
    get buffered() {
      if (!this.player) return super.buffered;
      const loaded = this.player.getVideoLoadedFraction() * this.player.getDuration();
      if (!(loaded > 0)) return super.buffered;
      return { length: 1, start: () => 0, end: () => loaded };
    }
    seek(percentage2) {
      this.seekTo(this.percentageToTime(percentage2), true);
    }
    seekTo(seconds, allowSeekAhead = true) {
      if (!this.player) return;
      this.player.seekTo(seconds, allowSeekAhead);
      this.emit("seeked");
    }
    softPause() {
      if (!this.player || this.currentState === "paused") return;
      this.stopTimeUpdateTimer();
      this.player.pauseVideo();
    }
    softPlay() {
      if (!this.player || this.currentState === "playing") return;
      this.player.playVideo();
    }
    play() {
      if (!this.player) return;
      this.paused = false;
      this.player.playVideo();
    }
    pause() {
      if (!this.player) return;
      this.paused = true;
      this.stopTimeUpdateTimer();
      this.player.pauseVideo();
    }
    unmute() {
      if (!this.player) return;
      this.muted = false;
      if (!this.initialVolume) {
        this.initialVolume = true;
        this.setVolume(this.params.volume);
      }
      this.player.unMute();
      this.emit("volumechange");
    }
    mute() {
      if (!this.player) return;
      this.muted = true;
      this.player.mute();
      this.emit("volumechange");
    }
    getVolume() {
      if (!this.player) return;
      return this.player.getVolume() / 100;
    }
    setVolume(volume) {
      if (!this.player) return;
      this.volume = volume;
      this.player.setVolume(volume * 100);
      this.emit("volumechange");
    }
  };

  // src/lib/vimeo.mjs
  var RE_VIMEO_UNLISTED_PATH = /\/\d+\/([^/?#\s]+)\/?\s*$/;
  var RE_VIMEO_UNLISTED_QUERY = /[?&]h=([^&#]+)/;
  function getVimeoUnlistedHash(url) {
    if (!url) return;
    const pts = url.match(RE_VIMEO_UNLISTED_PATH) || url.match(RE_VIMEO_UNLISTED_QUERY);
    if (pts) return pts[1];
  }
  var Vimeo = class extends Provider {
    constructor(host, source) {
      super(host, source, "vimeo");
      this.unlisted = source.unlisted;
      this.requested = false;
    }
    connect() {
      const frame = this.createFrame();
      frame.src = this.generateSrcURL(this.id, this.unlisted);
      this.mount(frame);
      loadVimeoAPI().then(() => this.initPlayer()).catch((error) => console.warn(`video-background: ${error.message}`));
    }
    initPlayer() {
      if (this.destroyed || this.player) return;
      this.player = new window.Vimeo.Player(this.playerElement);
      this.player.on("loaded", this.onVideoPlayerReady.bind(this));
      this.player.on("ended", this.onVideoEnded.bind(this));
      this.player.on("play", this.onVideoPlay.bind(this));
      this.player.on("pause", this.onVideoPause.bind(this));
      this.player.on("bufferstart", this.onVideoBuffering.bind(this));
      this.player.on("timeupdate", this.onVideoTimeUpdate.bind(this));
      if (this.volume !== 1 && !this.muted) this.setVolume(this.volume);
    }
    generateSrcURL(id, unlisted) {
      unlisted = unlisted ? `h=${unlisted}&` : "";
      let src = `https://player.vimeo.com/video/${id}?${unlisted}background=1&controls=0`;
      if (this.muted) src += "&muted=1";
      if (this.autoplayNow()) src += "&autoplay=1";
      if (this.params.loop) src += "&loop=1&autopause=0";
      if (this.params["no-cookie"]) src += "&dnt=1";
      if (this.params["start-at"]) src += "#t=" + this.params["start-at"] + "s";
      return src;
    }
    // A new frame `src` navigates away from the document player.js registered its handlers
    // with, so 'ended' and 'timeupdate' stop arriving and the loop with them. loadVideo keeps
    // the player; the frame swap is what is left when there is no player, or when player.js
    // could not load the video.
    setSource(source) {
      const start = this.startsAfterSwap();
      this.id = source.id;
      this.unlisted = source.unlisted;
      this.resetProgress();
      if (!this.player) {
        this.playerElement.src = this.generateSrcURL(this.id, this.unlisted);
        return;
      }
      const url = `https://vimeo.com/${this.id}` + (this.unlisted ? `?h=${this.unlisted}` : "");
      this.player.loadVideo({ url }).then(() => {
        this.player.setLoop(this.params.loop);
        this.player.setMuted(this.muted);
        if (start) {
          this.player.play();
        } else {
          this.player.pause();
        }
      }).catch(() => {
        this.playerElement.src = this.generateSrcURL(this.id, this.unlisted);
      });
    }
    onVideoPlayerReady() {
      this.mobileLowBatteryAutoplayHack();
      if (!this.muted) this.player.setMuted(false);
      if (this.params["start-at"]) this.seekTo(this.params["start-at"]);
      if (this.autoplayNow()) this.player.play();
      this.player.getDuration().then((duration) => {
        this.setDuration(duration);
      });
    }
    onVideoEnded() {
      this.updateState("ended");
      this.emit("ended");
      if (this.paused || !this.params.loop) return this.pause();
      this.seekTo(this.params["start-at"]);
      this.emit("play");
      this.updateState("playing");
    }
    onVideoTimeUpdate(event) {
      this.currentTime = event.seconds;
      this.percentComplete = this.timeToPercentage(event.seconds);
      this.emit("timeupdate");
      this.setDuration(event.duration);
      if (this.params["end-at"] && this.duration && event.seconds >= this.duration) {
        this.onVideoEnded();
      }
    }
    onVideoBuffering() {
      this.updateState("buffering");
    }
    onVideoPlay(event) {
      this.setDuration(event.duration);
      if (!this.initialPlay) {
        this.reveal();
        this.player.setLoop(this.params.loop);
        if (!this.autoplayNow() && !this.requested) return this.player.pause();
      }
      const seconds = event.seconds;
      if (this.params["start-at"] && seconds < this.params["start-at"]) {
        this.seekTo(this.params["start-at"]);
      }
      if (this.duration && seconds >= this.duration) {
        this.seekTo(this.params["start-at"]);
      }
      this.emit("play");
      this.updateState("playing");
    }
    onVideoPause() {
      this.updateState("paused");
      this.emit("pause");
    }
    seek(percentage2) {
      this.seekTo(this.percentageToTime(percentage2));
    }
    seekTo(time) {
      if (!this.player) return;
      this.player.setCurrentTime(time);
      this.emit("seeked");
    }
    softPause() {
      if (!this.player || this.currentState === "paused") return;
      this.player.pause();
    }
    softPlay() {
      if (!this.player || this.currentState === "playing") return;
      this.requested = true;
      this.player.play();
    }
    play() {
      if (!this.player) return;
      this.paused = false;
      this.requested = true;
      this.player.play();
    }
    pause() {
      if (!this.player) return;
      this.paused = true;
      this.player.pause();
    }
    unmute() {
      if (!this.player) return;
      this.muted = false;
      if (!this.initialVolume) {
        this.initialVolume = true;
        this.setVolume(this.params.volume);
      }
      this.player.setMuted(false);
      this.emit("volumechange");
    }
    mute() {
      if (!this.player) return;
      this.muted = true;
      this.player.setMuted(true);
      this.emit("volumechange");
    }
    // a promise, the player reports asynchronously
    getVolume() {
      if (!this.player) return;
      return this.player.getVolume();
    }
    setVolume(volume) {
      if (!this.player) return;
      this.volume = volume;
      this.player.setVolume(volume);
      this.emit("volumechange");
    }
  };

  // src/lib/video.mjs
  var MIME_MAP = {
    "ogv": "video/ogg",
    "ogm": "video/ogg",
    "ogg": "video/ogg",
    "avi": "video/x-msvideo",
    "mp4": "video/mp4",
    "webm": "video/webm",
    "m4v": "video/x-m4v",
    "mov": "video/quicktime",
    "qt": "video/quicktime"
  };
  function mimeType(filename) {
    const ext = /(?:\.([^.]+))?$/.exec(filename)[1];
    return ext ? MIME_MAP[ext.toLowerCase()] : void 0;
  }
  var Video = class extends Provider {
    constructor(host, source) {
      super(host, source, "video");
      this.src = source.link;
    }
    connect() {
      const video = document.createElement("video");
      if (this.params.title) video.setAttribute("title", this.params.title);
      video.setAttribute("playsinline", "");
      if (this.autoplayNow()) {
        video.setAttribute("autoplay", "");
        video.autoplay = true;
      }
      if (this.muted) {
        video.setAttribute("muted", "");
        video.muted = true;
      }
      this.player = video;
      this.syncNativeLoop();
      if (this.volume !== 1 && !this.muted) this.setVolume(this.volume);
      video.addEventListener("loadedmetadata", this.onVideoLoadedMetadata.bind(this));
      video.addEventListener("durationchange", this.onVideoLoadedMetadata.bind(this));
      video.addEventListener("canplay", this.onVideoLoadedMetadata.bind(this));
      video.addEventListener("timeupdate", this.onVideoTimeUpdate.bind(this));
      video.addEventListener("play", this.onVideoPlay.bind(this));
      video.addEventListener("pause", this.onVideoPause.bind(this));
      video.addEventListener("waiting", this.onVideoBuffering.bind(this));
      video.addEventListener("ended", this.onVideoEnded.bind(this));
      this.setSource({ id: this.id, link: this.src });
      this.mount(video);
      this.mobileLowBatteryAutoplayHack();
    }
    // native loop wraps to 0:00 and never fires 'ended', which would skip start-at
    // - with start-at the loop is driven from onVideoEnded instead. Re-run on every
    // start-at change, the attribute outlives the value it was decided from.
    syncNativeLoop() {
      if (!this.player) return;
      if (this.params.loop && !this.params["start-at"]) {
        this.player.setAttribute("loop", "");
      } else {
        this.player.removeAttribute("loop");
      }
    }
    setStartAt(startAt) {
      super.setStartAt(startAt);
      this.syncNativeLoop();
    }
    setSource(source) {
      const start = this.startsAfterSwap();
      this.id = source.id;
      this.src = source.link;
      this.player.innerHTML = "";
      const element = document.createElement("source");
      element.setAttribute("src", this.src);
      const mime = mimeType(this.id);
      if (mime) element.setAttribute("type", mime);
      this.player.appendChild(element);
      if (!this.playerElement) return;
      this.resetProgress();
      this.player.autoplay = start;
      this.player.load();
      if (start) this.player.play();
    }
    onVideoLoadedMetadata() {
      this.setDuration(this.player.duration);
    }
    get buffered() {
      return this.player ? this.player.buffered : super.buffered;
    }
    onVideoTimeUpdate() {
      this.currentTime = this.player.currentTime;
      this.percentComplete = this.timeToPercentage(this.player.currentTime);
      this.emit("timeupdate");
      if (this.params["end-at"] && this.currentTime >= this.duration) {
        this.onVideoEnded();
      }
    }
    onVideoPlay() {
      this.reveal();
      const seconds = this.player.currentTime;
      if (this.params["start-at"] && seconds <= this.params["start-at"]) {
        this.seekTo(this.params["start-at"]);
      }
      if (this.duration && seconds >= this.duration) {
        this.seekTo(this.params["start-at"]);
      }
      this.emit("play");
      this.updateState("playing");
    }
    onVideoPause() {
      this.updateState("paused");
      this.emit("pause");
    }
    onVideoEnded() {
      this.updateState("ended");
      this.emit("ended");
      if (this.paused || !this.params.loop) return this.pause();
      this.seekTo(this.params["start-at"]);
      if (this.player.paused) {
        this.player.play();
      } else {
        this.onVideoPlay();
      }
    }
    onVideoBuffering() {
      this.updateState("buffering");
    }
    seek(percentage2) {
      this.seekTo(this.percentageToTime(percentage2));
    }
    seekTo(seconds) {
      if (!this.player) return;
      if (typeof this.player.fastSeek === "function") {
        this.player.fastSeek(seconds);
      } else {
        this.player.currentTime = seconds;
      }
      this.emit("seeked");
    }
    softPause() {
      if (!this.player || this.currentState === "paused") return;
      this.player.pause();
    }
    softPlay() {
      if (!this.player || this.currentState === "playing") return;
      this.player.play();
    }
    play() {
      if (!this.player) return;
      this.paused = false;
      this.player.play();
    }
    pause() {
      if (!this.player) return;
      this.paused = true;
      this.player.pause();
    }
    unmute() {
      if (!this.player) return;
      this.muted = false;
      this.player.muted = false;
      if (!this.initialVolume) {
        this.initialVolume = true;
        this.setVolume(this.params.volume);
      }
      this.emit("volumechange");
    }
    mute() {
      if (!this.player) return;
      this.muted = true;
      this.player.muted = true;
      this.emit("volumechange");
    }
    getVolume() {
      if (!this.player) return;
      return this.player.volume;
    }
    setVolume(volume) {
      if (!this.player) return;
      this.volume = volume;
      this.player.volume = volume;
      this.emit("volumechange");
    }
    // a <video> has no API object to destroy, removing it is the teardown
    destroy() {
      this.player = null;
      super.destroy();
    }
  };

  // src/video-background.mjs
  var PROVIDERS = [
    ["youtube", RE_YOUTUBE, YouTube],
    ["vimeo", RE_VIMEO, Vimeo],
    ["video", RE_VIDEO, Video]
  ];
  function parseSource(link) {
    if (!link) return;
    for (const [type, pattern, Provider2] of PROVIDERS) {
      const pts = link.match(pattern);
      if (!pts) continue;
      const source = { type, id: pts[1], link, Provider: Provider2 };
      if (type === "vimeo") {
        const unlisted = getVimeoUnlistedHash(link);
        if (unlisted) source.unlisted = unlisted;
      }
      return source;
    }
  }
  var DEFAULTS = {
    "autoplay": true,
    "muted": true,
    "loop": true,
    "mobile": true,
    "pause-offscreen": true,
    "start-at": 0,
    "end-at": 0,
    "volume": 1,
    "poster": null,
    "load-background": false,
    "resolution": "16:9",
    "fit-box": false,
    "offset": 100,
    "no-cookie": true,
    "lazyloading": false,
    "force-on-low-battery": false,
    "title": "Video background",
    "unstyled": false
  };
  function readParams(element, defaults = DEFAULTS) {
    const params = {};
    for (const key in defaults) {
      const value = element.getAttribute(key);
      if (value === null) {
        params[key] = defaults[key];
      } else if (value === "") {
        params[key] = typeof defaults[key] === "boolean" ? true : defaults[key];
      } else {
        params[key] = stringToType(value);
      }
    }
    if (!("IntersectionObserver" in window)) params["pause-offscreen"] = false;
    return params;
  }
  var STYLE_ID = "video-background-style";
  var STYLE = `
:where(video-background:not([unstyled])) { display: block; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; overflow: hidden; pointer-events: none; background-size: cover; background-repeat: no-repeat; background-position: center; }
:where(video-background:not([unstyled]) > iframe), :where(video-background:not([unstyled]) > video) { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 0; }
:where(video-background:not([unstyled]) > img) { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
`;
  function adoptStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }
  function cssURL(url) {
    return `url("${String(url).replace(/["\\]/g, "\\$&")}")`;
  }
  var VideoBackground = class extends HTMLElement {
    static get observedAttributes() {
      return ["src", "start-at", "end-at"];
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
      if (previous === value || !this.isConnected) return;
      if (name === "src") return this.rebuild(value);
      if (!this.provider) return;
      if (name === "start-at") this.provider.setStartAt(stringToType(value) || 0);
      if (name === "end-at") this.provider.setEndAt(stringToType(value) || 0);
    }
    build() {
      adoptStyle();
      const source = parseSource(this.getAttribute("src"));
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
      } else if (this.params["load-background"] && source.type === "youtube") {
        this.style.backgroundImage = cssURL(`https://img.youtube.com/vi/${source.id}/hqdefault.jpg`);
      } else if (this.params["load-background"] && source.type === "vimeo") {
        this.style.backgroundImage = cssURL(`https://vumbnail.com/${source.id}.jpg`);
      }
      if (this.params.unstyled) return;
      const parent = this.parentElement;
      const position = parent && window.getComputedStyle(parent).position;
      if (parent && (!position || position === "static")) {
        parent.style.position = "relative";
      }
    }
    observe() {
      if ("IntersectionObserver" in window && this.params["pause-offscreen"]) {
        this.intersectionObserver = new IntersectionObserver((entries) => this.onIntersect(entries[entries.length - 1]));
        this.intersectionObserver.observe(this);
      }
      if ("ResizeObserver" in window) {
        this.resizeObserver = new ResizeObserver(this.onWindowResize);
        this.resizeObserver.observe(this);
      } else {
        window.addEventListener("resize", this.onWindowResize);
      }
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
    onIntersect(entry) {
      const provider = this.provider;
      if (!provider) return;
      provider.isIntersecting = entry.isIntersecting;
      if (!provider.player) return;
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
      window.removeEventListener("resize", this.onWindowResize);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      if (!this.provider) return;
      this.provider.destroy();
      this.provider = null;
      this.style.backgroundImage = "";
      this.dispatchEvent(new Event("emptied"));
    }
    /* ===== state, proxied from the provider ===== */
    /** @type {string | undefined} `youtube`, `vimeo` or `video` */
    get type() {
      return this.provider ? this.provider.type : void 0;
    }
    /** @type {object | null} The YouTube or Vimeo player object, or the `<video>` element */
    get player() {
      return this.provider ? this.provider.player : null;
    }
    /** @type {HTMLIFrameElement | HTMLVideoElement | null} The iframe or `<video>` inside the element */
    get playerElement() {
      return this.provider ? this.provider.playerElement : null;
    }
    /** @type {boolean} What it means on a `<video>`: true unless playing or buffering. A held pause is `provider.paused` */
    get paused() {
      return !this.provider || !["playing", "buffering"].includes(this.provider.currentState);
    }
    /** @type {boolean} Assignable - the same as `mute()` / `unmute()` */
    get muted() {
      return this.provider ? this.provider.muted : false;
    }
    set muted(value) {
      if (value) this.mute();
      else this.unmute();
    }
    /** @type {number} `0` to `1`, assignable - the same as `setVolume` */
    get volume() {
      return this.provider ? this.provider.volume : 0;
    }
    set volume(value) {
      this.setVolume(value);
    }
    /** @type {string} `notstarted`, `playing`, `paused`, `buffering` or `ended` */
    get currentState() {
      return this.provider ? this.provider.currentState : "notstarted";
    }
    /** @type {number} Seconds, assignable - the same as `seekTo` */
    get currentTime() {
      return this.provider ? this.provider.currentTime : 0;
    }
    set currentTime(value) {
      this.seekTo(value);
    }
    /** @type {number} Seconds, capped by `end-at` */
    get duration() {
      return this.provider ? this.provider.duration : 0;
    }
    /** @type {number} `0` until the duration is known, `1` after - the `<video>` scale, stopping at metadata */
    get readyState() {
      return this.duration > 0 ? 1 : 0;
    }
    /** @type {TimeRanges | {length: number}} The `<video>`'s own for a file, YouTube's loaded fraction as one range, empty on Vimeo */
    get buffered() {
      return this.provider ? this.provider.buffered : EMPTY_RANGES;
    }
    /** @type {number} `0` to `100` */
    get percentComplete() {
      return this.provider ? this.provider.percentComplete : 0;
    }
    /** @type {boolean} Whether the element is in the viewport */
    get isIntersecting() {
      return this.provider ? this.provider.isIntersecting : false;
    }
    /* ===== API ===== */
    play() {
      if (this.provider) this.provider.play();
    }
    pause() {
      if (this.provider) this.provider.pause();
    }
    /** Play without clearing `paused`, the way scrolling into view does */
    softPlay() {
      if (this.provider) this.provider.softPlay();
    }
    /** Pause without setting `paused`, the way scrolling out of view does */
    softPause() {
      if (this.provider) this.provider.softPause();
    }
    mute() {
      if (this.provider) this.provider.mute();
    }
    unmute() {
      if (this.provider) this.provider.unmute();
    }
    /** @returns {number | Promise<number> | undefined} `0` to `1`; a promise on Vimeo */
    getVolume() {
      if (this.provider) return this.provider.getVolume();
    }
    /** @param {number} volume `0` to `1` */
    setVolume(volume) {
      if (this.provider) this.provider.setVolume(volume);
    }
    /** @param {number} percentage `0` to `100` */
    seek(percentage2) {
      if (this.provider) this.provider.seek(percentage2);
    }
    /** @param {number} seconds */
    seekTo(seconds) {
      if (this.provider) this.provider.seekTo(seconds);
    }
    /** @param {number} seconds */
    setStartAt(seconds) {
      this.setAttribute("start-at", seconds);
    }
    /** @param {number} seconds */
    setEndAt(seconds) {
      this.setAttribute("end-at", seconds);
    }
    /** The same as setting `src` @param {string} url */
    setSource(url) {
      this.setAttribute("src", url);
    }
    /** Re-fit the player to the box; the element does this itself on resize */
    resize() {
      if (this.provider) this.provider.resize();
    }
    /** @param {number} time seconds @returns {number} `0` to `100` within `start-at`..`end-at` */
    timeToPercentage(time) {
      return this.provider ? this.provider.timeToPercentage(time) : 0;
    }
    /** @param {number} percentage `0` to `100` @returns {number} seconds within `start-at`..`end-at` */
    percentageToTime(percentage2) {
      return this.provider ? this.provider.percentageToTime(percentage2) : 0;
    }
    /** @returns {boolean} Whether the video would start now - on scroll-in, on a tab switch */
    shouldPlay() {
      return this.provider ? this.provider.shouldPlay() : false;
    }
  };
  if (!customElements.get("video-background")) customElements.define("video-background", VideoBackground);
})();
//# sourceMappingURL=video-background.js.map
