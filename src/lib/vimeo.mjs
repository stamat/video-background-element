import { Provider } from './provider.mjs';
import { loadVimeoAPI } from './load.mjs';

// the segment before the hash has to be the numeric id, otherwise
// /channels/staffpicks/123456789 reads the id itself as a hash
const RE_VIMEO_UNLISTED_PATH = /\/\d+\/([^/?#\s]+)\/?\s*$/;
const RE_VIMEO_UNLISTED_QUERY = /[?&]h=([^&#]+)/;

// an unlisted vimeo video 404s without its hash, carried either as the trailing
// path segment or as ?h= - both spellings reach this one place
export function getVimeoUnlistedHash(url) {
  if (!url) return;
  const pts = url.match(RE_VIMEO_UNLISTED_PATH) || url.match(RE_VIMEO_UNLISTED_QUERY);
  if (pts) return pts[1];
}

export class Vimeo extends Provider {
  constructor(host, source) {
    super(host, source, 'vimeo');
    this.unlisted = source.unlisted;
    this.requested = false; // a play this element asked for, as opposed to background mode's own
  }

  connect() {
    const frame = this.createFrame();
    frame.src = this.generateSrcURL(this.id, this.unlisted);
    this.mount(frame);
    // one catch for the load and the construction both: a throw inside a then() is an
    // unhandled rejection nobody sees, and the frame is on the page either way
    loadVimeoAPI().then(() => this.initPlayer()).catch((error) => console.warn(`video-background: ${error.message}`));
  }

  initPlayer() {
    if (this.destroyed || this.player) return;
    this.player = new window.Vimeo.Player(this.playerElement);

    this.player.on('loaded', this.onVideoPlayerReady.bind(this));
    this.player.on('ended', this.onVideoEnded.bind(this));
    this.player.on('play', this.onVideoPlay.bind(this));
    this.player.on('pause', this.onVideoPause.bind(this));
    this.player.on('bufferstart', this.onVideoBuffering.bind(this));
    this.player.on('timeupdate', this.onVideoTimeUpdate.bind(this));
    this.player.on('playbackratechange', ({ playbackRate }) => this.onRateChange(playbackRate));

    if (this.volume !== 1 && !this.muted) this.setVolume(this.volume);
    if (this.params['playback-rate'] !== 1) this.setPlaybackRate(this.params['playback-rate']);
  }

  generateSrcURL(id, unlisted) {
    unlisted = unlisted ? `h=${unlisted}&` : '';
    let src = `https://player.vimeo.com/video/${id}?${unlisted}background=1&controls=0`;

    if (this.muted) src += '&muted=1'; // the live state, not the parameter: a swap after an unmute stays unmuted
    if (this.autoplayNow()) src += '&autoplay=1';
    if (this.params.loop) src += '&loop=1&autopause=0';
    if (this.params['no-cookie']) src += '&dnt=1';

    // a hash, not a query param
    if (this.params['start-at']) src += '#t=' + this.params['start-at'] + 's';

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

    // the url form: player.js takes an unlisted hash only as ?h= on a url, never beside an id
    const url = `https://vimeo.com/${this.id}` + (this.unlisted ? `?h=${this.unlisted}` : '');
    // 'loaded' fires again and onVideoPlayerReady with it - the seek to start-at, the
    // autoplay and the duration come from there; this adds what a new load drops
    this.player.loadVideo({ url }).then(() => {
      this.player.setLoop(this.params.loop);
      this.player.setMuted(this.muted);
      if (start) { this.player.play(); } else { this.player.pause(); }
    }).catch(() => {
      this.playerElement.src = this.generateSrcURL(this.id, this.unlisted);
    });
  }

  onVideoPlayerReady() {
    this.mobileLowBatteryAutoplayHack();

    // background=1 mutes by definition, whatever the URL said - Vimeo documents it as
    // controls off, loop, autoplay and mute in one - so sound is put back from the API
    if (!this.muted) this.player.setMuted(false);

    if (this.params['start-at']) this.seekTo(this.params['start-at']);

    if (this.autoplayNow()) this.player.play();

    this.player.getDuration().then((duration) => {
      this.setDuration(duration);
    });
  }

  onVideoEnded() {
    this.updateState('ended');
    this.emit('ended');
    if (this.paused || !this.params.loop) return this.pause();

    this.seekTo(this.params['start-at']);
    this.emit('play');
    this.updateState('playing');
  }

  onVideoTimeUpdate(event) {
    this.currentTime = event.seconds;
    this.percentComplete = this.timeToPercentage(event.seconds);
    this.emit('timeupdate');
    this.setDuration(event.duration);

    if (this.params['end-at'] && this.duration && event.seconds >= this.duration) {
      this.onVideoEnded();
    }
  }

  onVideoBuffering() {
    this.updateState('buffering');
  }

  onVideoPlay(event) {
    this.setDuration(event.duration);

    if (!this.initialPlay) {
      this.reveal();

      // background=1 loops and autoplays by definition, whatever the embed URL said, so
      // both are corrected here: the loop from the API, and a first play nobody asked for
      // paused - unless the browser blocked that autoplay and this first play is the
      // visitor's own, which `requested` tells apart
      this.player.setLoop(this.params.loop);
      if (!this.autoplayNow() && !this.requested) return this.player.pause();
    }

    const seconds = event.seconds;
    if (this.params['start-at'] && seconds < this.params['start-at']) {
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

  seek(percentage) {
    this.seekTo(this.percentageToTime(percentage));
  }

  seekTo(time) {
    if (!this.player) return;
    this.player.setCurrentTime(time);
    this.emit('seeked');
  }

  softPause() {
    if (!this.player || this.currentState === 'paused') return;
    this.player.pause();
  }

  softPlay() {
    if (!this.player || this.currentState === 'playing') return;
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
    this.emit('volumechange');
  }

  mute() {
    if (!this.player) return;
    this.muted = true;
    this.player.setMuted(true);
    this.emit('volumechange');
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
    this.emit('volumechange');
  }

  // a promise, the player reports asynchronously
  getPlaybackRate() {
    if (!this.player) return;
    return this.player.getPlaybackRate();
  }

  // Listed as a PRO and Business feature, and asynchronous either way, so the rate is taken
  // from the promise resolving with what the player took rather than from the call -
  // `playbackRate` never claims a speed the video is not playing at, and a rejection is
  // warned rather than swallowed. The promise answers as well as the event, since nothing
  // here can prove the event fires for a rate the API set.
  setPlaybackRate(rate) {
    if (!this.player) return;
    this.player.setPlaybackRate(rate)
      .then((playbackRate) => this.onRateChange(playbackRate))
      .catch((error) => console.warn(`video-background: ${error.message}`));
  }
}
