import { isMobile, parseResolutionString, proportionalParentCoverResize, percentage, fixed } from 'book-of-spells';

// TimeRanges with nothing in it - what `buffered` reads until a source type reports better
export const EMPTY_RANGES = { length: 0 };

// Playback state and the arithmetic shared by every source type. The element proxies its
// public API onto this, so `event.target.currentState` and `provider.currentState` are
// the same field - the element is the address, this is the state.
export class Provider {
  constructor(host, source, type) {
    this.host = host;
    this.params = host.params;
    this.type = type;
    this.id = source.id;
    this.is_mobile = isMobile();

    this.player = null;
    this.playerElement = null;
    this.pending = null; // a platform player object that has not answered yet
    this.destroyed = false;

    this.isIntersecting = false;
    this.paused = false; // a pause the visitor asked for - the scroll-in path never overrides it
    this.muted = this.params.muted;
    this.volume = this.params.volume;
    this.currentState = 'notstarted';

    this.initialPlay = false;
    this.initialVolume = false;

    this.currentTime = this.params['start-at'] || 0;
    this.duration = this.params['end-at'] || 0;
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
    if (this.currentState === 'buffering') this.emit('waiting');
    if (this.currentState === 'playing') this.emit('playing');
  }

  // autoplay=1 goes into the embed URL only when the video would start anyway,
  // otherwise an off-screen lazy video plays into the void until scrolled to
  autoplayNow() {
    if (this.paused) return false; // a held pause outlives a source swap
    return this.params.autoplay && (!this.params['pause-offscreen'] || this.isIntersecting);
  }

  // playback the visitor did not stop - buffering is playing that is still catching up
  isPlaying() {
    return !this.paused && (this.currentState === 'playing' || this.currentState === 'buffering');
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
    this.currentTime = this.params['start-at'] || 0;
    this.percentComplete = 0;
  }

  timeToPercentage(time) {
    if (time <= this.params['start-at']) return 0;
    if (!this.duration) return 0; // duration unknown yet - not "100% done"
    if (time >= this.duration) return 100;
    if (time <= 0) return 0;
    time -= this.params['start-at'];
    const duration = this.duration - this.params['start-at'];
    return percentage(time, duration);
  }

  percentageToTime(percentage) {
    if (!this.duration) return this.params['start-at'] || 0;
    if (percentage > 100) return this.duration;
    if (percentage <= 0) return this.params['start-at'] || 0;
    const duration = this.duration - this.params['start-at'];
    let time = percentage * duration / 100;
    time = fixed(time, 3);
    if (time > duration) time = duration;
    if (this.params['start-at']) time += this.params['start-at'];
    return time;
  }

  resize() {
    if (!this.playerElement) return;
    if (!this.params['fit-box']) proportionalParentCoverResize(this.playerElement, this.params.resolution_mod, this.params.offset);
  }

  // The one place metadata is announced: a file's duration arrives with its metadata,
  // YouTube's with the player, Vimeo's over a promise after it - so the first known
  // duration is `loadedmetadata`, and only a number that moved is `durationchange`, since
  // Vimeo repeats the same one on every timeupdate.
  setDuration(duration) {
    // end-at caps the playable range, a shorter video caps end-at
    const capped = this.params['end-at'] ? Math.min(duration, this.params['end-at']) : duration;
    if (capped === this.duration) return;
    const first = !this.duration;
    this.duration = capped;
    this.emit('durationchange');
    if (first) this.emit('loadedmetadata');
  }

  setStartAt(startAt) {
    this.params['start-at'] = startAt;
  }

  setEndAt(endAt) {
    this.params['end-at'] = endAt;
    if (this.duration > endAt) this.setDuration(endAt);
    if (this.currentTime > endAt) this.onVideoEnded();
  }

  shouldPlay() {
    if (this.paused) return false;
    if (this.currentState === 'ended' && !this.params.loop) return false;
    // off-screen playback keeps a video going; starting one is still autoplay's call,
    // or a tab switch would start a video the visitor never pressed play on
    if (!this.params['pause-offscreen'] && this.params.autoplay && this.currentState !== 'playing') return true;
    if (this.isIntersecting && this.params.autoplay && this.currentState !== 'playing') return true;
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
    if (!this.params['force-on-low-battery']) return;
    if (!this.is_mobile && this.params.mobile) return;

    const forceAutoplay = () => {
      if (!this.initialPlay && this.params.autoplay && this.params.muted) {
        this.softPlay();

        if (!this.isIntersecting && this.params['pause-offscreen']) {
          this.softPause();
        }
      }
    };

    document.addEventListener('touchstart', forceAutoplay, { once: true });
  }

  createFrame() {
    const frame = document.createElement('iframe');
    // inline, not in the stylesheet: the browser's 2px inset is the frame's, not the page's,
    // and `unstyled` takes the stylesheet off without wanting it back
    frame.style.border = '0';
    if (this.params.title) frame.setAttribute('title', this.params.title);
    frame.setAttribute('allow', 'autoplay; mute');
    if (this.params.lazyloading) frame.setAttribute('loading', 'lazy');
    return frame;
  }

  mount(playerElement) {
    this.playerElement = playerElement;
    // inline, not in the stylesheet: it is state that reveal() flips, not a style to override
    playerElement.style.opacity = 0;
    if (this.params['fit-box']) {
      // block, or an inline iframe leaves a line-height gap under itself in an unstyled box
      playerElement.style.display = 'block';
      playerElement.style.width = '100%';
      playerElement.style.height = '100%';
    }
    this.host.appendChild(playerElement);
    this.resize();
  }

  destroy() {
    this.destroyed = true;
    if (this.timeUpdateTimer) clearInterval(this.timeUpdateTimer);
    const player = this.player || this.pending;
    if (player && typeof player.destroy === 'function') player.destroy();
    if (this.playerElement) this.playerElement.remove();
    this.player = null;
    this.pending = null;
    this.playerElement = null;
  }
}
