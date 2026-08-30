import { Provider } from './provider.mjs';

export const MIME_MAP = {
  'ogv': 'video/ogg',
  'ogm': 'video/ogg',
  'ogg': 'video/ogg',
  'avi': 'video/x-msvideo',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'm4v': 'video/x-m4v',
  'mov': 'video/quicktime',
  'qt': 'video/quicktime'
};

// an unknown extension is better left to the browser to sniff than mislabelled
export function mimeType(filename) {
  const ext = /(?:\.([^.]+))?$/.exec(filename)[1];
  return ext ? MIME_MAP[ext.toLowerCase()] : undefined;
}

export class Video extends Provider {
  constructor(host, source) {
    super(host, source, 'video');
    this.src = source.link;
  }

  connect() {
    const video = document.createElement('video');
    if (this.params.title) video.setAttribute('title', this.params.title);
    video.setAttribute('playsinline', '');
    if (this.autoplayNow()) {
      video.setAttribute('autoplay', '');
      video.autoplay = true;
    }
    if (this.muted) {
      video.setAttribute('muted', '');
      video.muted = true;
    }

    this.player = video;
    this.syncNativeLoop();

    if (this.volume !== 1 && !this.muted) this.setVolume(this.volume);

    video.addEventListener('loadedmetadata', this.onVideoLoadedMetadata.bind(this));
    video.addEventListener('durationchange', this.onVideoLoadedMetadata.bind(this));
    video.addEventListener('canplay', this.onVideoLoadedMetadata.bind(this));
    video.addEventListener('timeupdate', this.onVideoTimeUpdate.bind(this));
    video.addEventListener('play', this.onVideoPlay.bind(this));
    video.addEventListener('pause', this.onVideoPause.bind(this));
    video.addEventListener('waiting', this.onVideoBuffering.bind(this));
    video.addEventListener('ended', this.onVideoEnded.bind(this));

    this.setSource({ id: this.id, link: this.src });
    this.mount(video);

    this.mobileLowBatteryAutoplayHack();
  }

  // native loop wraps to 0:00 and never fires 'ended', which would skip start-at
  // - with start-at the loop is driven from onVideoEnded instead. Re-run on every
  // start-at change, the attribute outlives the value it was decided from.
  syncNativeLoop() {
    if (!this.player) return;
    if (this.params.loop && !this.params['start-at']) {
      this.player.setAttribute('loop', '');
    } else {
      this.player.removeAttribute('loop');
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
    this.player.innerHTML = '';
    const element = document.createElement('source');
    element.setAttribute('src', this.src);
    const mime = mimeType(this.id);
    if (mime) element.setAttribute('type', mime);
    this.player.appendChild(element);

    // connect() calls this before mount, on an element the browser has not looked at yet -
    // there is nothing to reload then. After that the source children are read by the load
    // algorithm and nowhere else, so without this the old file plays on.
    if (!this.playerElement) return;
    this.resetProgress();
    // load() re-arms the autoplay attribute, so a video that is to wait loses it first
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
    this.emit('timeupdate');

    if (this.params['end-at'] && this.currentTime >= this.duration) {
      this.onVideoEnded();
    }
  }

  onVideoPlay() {
    this.reveal();

    const seconds = this.player.currentTime;
    if (this.params['start-at'] && seconds <= this.params['start-at']) {
      this.seekTo(this.params['start-at']);
    }

    if (this.duration && seconds >= this.duration) {
      this.seekTo(this.params['start-at']);
    }

    this.emit('play');
    this.updateState('playing');
  }

  onVideoPause() {
    this.updateState('paused');
    this.emit('pause');
  }

  onVideoEnded() {
    this.updateState('ended');
    this.emit('ended');
    if (this.paused || !this.params.loop) return this.pause();

    this.seekTo(this.params['start-at']);
    if (this.player.paused) {
      // native 'ended' stopped playback - restart it, the resulting 'play'
      // event drives onVideoPlay
      this.player.play();
    } else {
      // end-at cut in from timeupdate, playback never stopped - just
      // re-announce the state
      this.onVideoPlay();
    }
  }

  onVideoBuffering() {
    this.updateState('buffering');
  }

  seek(percentage) {
    this.seekTo(this.percentageToTime(percentage));
  }

  seekTo(seconds) {
    if (!this.player) return;
    if (typeof this.player.fastSeek === 'function') {
      this.player.fastSeek(seconds);
    } else {
      this.player.currentTime = seconds;
    }
    this.emit('seeked');
  }

  softPause() {
    if (!this.player || this.currentState === 'paused') return;
    this.player.pause();
  }

  softPlay() {
    if (!this.player || this.currentState === 'playing') return;
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
    this.emit('volumechange');
  }

  mute() {
    if (!this.player) return;
    this.muted = true;
    this.player.muted = true;
    this.emit('volumechange');
  }

  getVolume() {
    if (!this.player) return;
    return this.player.volume;
  }

  setVolume(volume) {
    if (!this.player) return;
    this.volume = volume;
    this.player.volume = volume;
    this.emit('volumechange');
  }

  // a <video> has no API object to destroy, removing it is the teardown
  destroy() {
    this.player = null;
    super.destroy();
  }
}
