import { isMobile, parseResolutionString, proportionalParentCoverResize, percentage, fixed } from 'book-of-spells';

// Playback state and the arithmetic shared by every source type. The element proxies its
// public API onto this, so `event.detail.currentState` and `provider.currentState` are
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

  emit(name) {
    this.host.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: this.host }));
  }

  updateState(state) {
    this.currentState = state;
    this.emit('video-background-state-change');
  }

  // autoplay=1 goes into the embed URL only when the video would start anyway,
  // otherwise an off-screen lazy video plays into the void until scrolled to
  autoplayNow() {
    return this.params.autoplay && (this.params['always-play'] || this.isIntersecting);
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
    this.emit('video-background-resize');
  }

  setDuration(duration) {
    // end-at caps the playable range, a shorter video caps end-at
    this.duration = this.params['end-at'] ? Math.min(duration, this.params['end-at']) : duration;
  }

  setStartAt(startAt) {
    this.params['start-at'] = startAt;
  }

  setEndAt(endAt) {
    this.params['end-at'] = endAt;
    if (this.duration > endAt) this.duration = endAt;
    if (this.currentTime > endAt) this.onVideoEnded();
  }

  shouldPlay() {
    if (this.paused) return false;
    if (this.currentState === 'ended' && !this.params.loop) return false;
    if (this.params['always-play'] && this.currentState !== 'playing') return true;
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

        if (!this.isIntersecting && !this.params['always-play']) {
          this.softPause();
        }
      }
    };

    document.addEventListener('touchstart', forceAutoplay, { once: true });
  }

  createFrame() {
    const frame = document.createElement('iframe');
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
