import { Provider } from './provider.mjs';
import { loadYouTubeAPI } from './load.mjs';

const STATES = {
  '-1': 'notstarted',
  '0': 'ended',
  '1': 'playing',
  '2': 'paused',
  '3': 'buffering',
  '5': 'cued'
};

export class YouTube extends Provider {
  constructor(host, source) {
    super(host, source, 'youtube');
    this.timeUpdateTimer = null;
    this.timeUpdateInterval = 250;
  }

  connect() {
    const frame = this.createFrame();
    frame.src = this.generateSrcURL(this.id);
    this.mount(frame);
    // one catch for the load and the construction both: a throw inside a then() is an
    // unhandled rejection nobody sees, and the frame is on the page either way
    loadYouTubeAPI().then(() => this.initPlayer()).catch((error) => console.warn(`video-background: ${error.message}`));
  }

  // `player` stays null until onReady: the object YT.Player hands back has none of its
  // methods before the iframe answers, and a scroll-in during that gap called playVideo
  // on it. A null player is what every guard below already checks for.
  initPlayer() {
    if (this.destroyed || this.player || this.pending) return;

    this.pending = new YT.Player(this.playerElement, {
      events: {
        'onReady': this.onVideoPlayerReady.bind(this),
        'onStateChange': this.onVideoStateChange.bind(this),
        'onPlaybackRateChange': (event) => this.onRateChange(event.data)
      }
    });
  }

  generateSrcURL(id) {
    const site = this.params['no-cookie'] ? 'https://www.youtube-nocookie.com/embed/' : 'https://www.youtube.com/embed/';
    let src = `${site}${id}?&enablejsapi=1&disablekb=1&controls=0&rel=0&iv_load_policy=3&cc_load_policy=0&playsinline=1&showinfo=0&modestbranding=1&fs=0`;

    if (this.muted) src += '&mute=1'; // the live state, not the parameter: a swap after an unmute stays unmuted
    if (this.autoplayNow()) src += '&autoplay=1';

    // no &loop=1 here: the embed ignores it unless it is paired with a playlist
    // parameter, and looping is driven from onVideoEnded() anyway so it honours start-at
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

    const request = { videoId: this.id, startSeconds: this.params['start-at'] || 0 };
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
    if (this.params['end-at'] && this.duration && this.currentTime >= this.duration) {
      this.updateState('ended');
      this.onVideoEnded();
      this.stopTimeUpdateTimer();
      return;
    }
    this.emit('timeupdate');
  }

  onVideoPlayerReady(event) {
    if (this.destroyed) return;
    this.player = event.target;
    this.pending = null;

    if (this.volume !== 1 && !this.muted) this.setVolume(this.volume);
    if (this.params['playback-rate'] !== 1) this.setPlaybackRate(this.params['playback-rate']);
    this.mobileLowBatteryAutoplayHack();

    if (this.autoplayNow()) {
      if (this.params['start-at']) this.seekTo(this.params['start-at']);
      this.player.playVideo();
    }

    this.setDuration(this.player.getDuration());
  }

  onVideoStateChange(event) {
    this.currentState = STATES[event.data];

    if (this.currentState === 'ended') this.onVideoEnded();

    // same gate as onVideoPlayerReady: YT fires 'notstarted' on load, and
    // an unconditional play here started lazy videos that were offscreen
    if (this.currentState === 'notstarted' && this.autoplayNow()) {
      this.seekTo(this.params['start-at']);
      this.player.playVideo();
    }

    if (this.currentState === 'playing') this.onVideoPlay();
    if (this.currentState === 'paused') this.onVideoPause();

    this.announceState();
  }

  onVideoPlay() {
    this.reveal();

    const seconds = this.player.getCurrentTime();
    if (this.params['start-at'] && seconds < this.params['start-at']) {
      this.seekTo(this.params['start-at']);
    }

    if (this.duration && seconds >= this.duration) {
      this.seekTo(this.params['start-at']);
    }

    if (!this.duration) {
      this.setDuration(this.player.getDuration());
    }

    this.emit('play');
    this.startTimeUpdateTimer();
  }

  onVideoPause() {
    this.stopTimeUpdateTimer();
    this.emit('pause');
  }

  onVideoEnded() {
    this.emit('ended');

    if (this.paused || !this.params.loop) return this.pause();
    this.seekTo(this.params['start-at']);
    this.player.playVideo();
  }

  // the player reports one fraction from the start, which is one range
  get buffered() {
    if (!this.player) return super.buffered;
    const loaded = this.player.getVideoLoadedFraction() * this.player.getDuration();
    if (!(loaded > 0)) return super.buffered;
    return { length: 1, start: () => 0, end: () => loaded };
  }

  seek(percentage) {
    this.seekTo(this.percentageToTime(percentage), true);
  }

  seekTo(seconds, allowSeekAhead = true) {
    if (!this.player) return;
    this.player.seekTo(seconds, allowSeekAhead);
    this.emit('seeked');
  }

  softPause() {
    if (!this.player || this.currentState === 'paused') return;
    this.stopTimeUpdateTimer();
    this.player.pauseVideo();
  }

  softPlay() {
    if (!this.player || this.currentState === 'playing') return;
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
    this.emit('volumechange');
  }

  mute() {
    if (!this.player) return;
    this.muted = true;
    this.player.mute();
    this.emit('volumechange');
  }

  getVolume() {
    if (!this.player) return;
    return this.player.getVolume() / 100;
  }

  setVolume(volume) {
    if (!this.player) return;
    this.volume = volume;
    this.player.setVolume(volume * 100);
    this.emit('volumechange');
  }

  getPlaybackRate() {
    if (!this.player) return;
    return this.player.getPlaybackRate();
  }

  // a suggestion: an unsupported rate is rounded toward 1, and onPlaybackRateChange is
  // what says which rate the video ended up playing at
  setPlaybackRate(rate) {
    if (!this.player) return;
    this.playbackRate = rate;
    this.player.setPlaybackRate(rate);
    this.emit('ratechange');
  }
}
