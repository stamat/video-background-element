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

    if (this.volume !== 1 && !this.muted) this.setVolume(this.volume);
  }

  generateSrcURL(id, unlisted) {
    unlisted = unlisted ? `h=${unlisted}&` : '';
    let src = `https://player.vimeo.com/video/${id}?${unlisted}background=1&controls=0`;

    if (this.params.muted) src += '&muted=1';
    if (this.autoplayNow()) src += '&autoplay=1';
    if (this.params.loop) src += '&loop=1&autopause=0';
    if (this.params['no-cookie']) src += '&dnt=1';

    // a hash, not a query param
    if (this.params['start-at']) src += '#t=' + this.params['start-at'] + 's';

    return src;
  }

  setSource(source) {
    this.id = source.id;
    this.unlisted = source.unlisted;
    this.playerElement.src = this.generateSrcURL(this.id, this.unlisted);
  }

  onVideoPlayerReady() {
    this.mobileLowBatteryAutoplayHack();

    if (this.params['start-at']) this.seekTo(this.params['start-at']);

    if (this.autoplayNow()) this.player.play();

    this.player.getDuration().then((duration) => {
      this.setDuration(duration);
    });

    this.emit('video-background-ready');
  }

  onVideoEnded() {
    this.updateState('ended');
    this.emit('video-background-ended');
    if (this.paused || !this.params.loop) return this.pause();

    this.seekTo(this.params['start-at']);
    this.updateState('playing');
    this.emit('video-background-play');
  }

  onVideoTimeUpdate(event) {
    this.currentTime = event.seconds;
    this.percentComplete = this.timeToPercentage(event.seconds);
    this.emit('video-background-time-update');
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

      // loop is on by default on the player side, whatever the embed URL said
      this.player.setLoop(this.params.loop);

      // the player sometimes starts on its own after the first buffer - not always,
      // and nothing announces why - so the first play is re-checked against autoplay
      if (!this.autoplayNow()) return this.player.pause();
    }

    const seconds = event.seconds;
    if (this.params['start-at'] && seconds < this.params['start-at']) {
      this.seekTo(this.params['start-at']);
    }

    if (this.duration && seconds >= this.duration) {
      this.seekTo(this.params['start-at']);
    }

    this.updateState('playing');
    this.emit('video-background-play');
  }

  onVideoPause() {
    this.updateState('paused');
    this.emit('video-background-pause');
  }

  seek(percentage) {
    this.seekTo(this.percentageToTime(percentage));
  }

  seekTo(time) {
    if (!this.player) return;
    this.player.setCurrentTime(time);
    this.emit('video-background-seeked');
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

    if (!this.initialVolume) {
      this.initialVolume = true;
      this.setVolume(this.params.volume);
    }
    this.player.setMuted(false);
    this.emit('video-background-unmute');
  }

  mute() {
    if (!this.player) return;
    this.muted = true;
    this.player.setMuted(true);
    this.emit('video-background-mute');
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
    this.emit('video-background-volume-change');
  }
}
