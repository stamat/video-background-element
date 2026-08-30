// One promise per API for the whole document: the YouTube script calls
// window.onYouTubeIframeAPIReady exactly once, so every element has to wait on the same
// resolution rather than each installing a callback that clobbers the last.

const scripts = new Map();

function loadScript(src) {
  if (scripts.has(src)) return scripts.get(src);

  const promise = new Promise((resolve, reject) => {
    let tag = document.querySelector(`script[src="${src}"]`);
    if (!tag) {
      tag = document.createElement('script');
      tag.async = true;
      tag.src = src;
      document.head.appendChild(tag);
    }
    tag.addEventListener('load', () => resolve(), { once: true });
    tag.addEventListener('error', () => reject(new Error(`video-background: failed to load ${src}`)), { once: true });
  });

  scripts.set(src, promise);
  return promise;
}

let youtubeReady = null;

// ten seconds of asking, at the rate the API itself takes to come up
export const YOUTUBE_READY_INTERVAL = 100;
export const YOUTUBE_READY_TRIES = 100;

export function loadYouTubeAPI() {
  if (youtubeReady) return youtubeReady;

  youtubeReady = new Promise((resolve, reject) => {
    if (window.YT && window.YT.loaded) return resolve();

    // the host page may have its own handler on this hook - chain it, the API calls it once
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previous === 'function') previous();
      resolve();
    };

    // Another library on the page can take that hook without chaining it - media-elements
    // does - and then the one call goes to them. So the API is watched directly as well:
    // `YT.loaded` turns 1 when it can build players. Bounded, or a load that never gets
    // there would be asked forever.
    loadScript('https://www.youtube.com/player_api').then(() => {
      let tries = YOUTUBE_READY_TRIES;
      const timer = setInterval(() => {
        if (window.YT && window.YT.loaded) {
          clearInterval(timer);
          resolve();
        } else if (--tries <= 0) {
          clearInterval(timer);
          reject(new Error('video-background: the YouTube API loaded but never became ready'));
        }
      }, YOUTUBE_READY_INTERVAL);
    }).catch(reject);
  });

  return youtubeReady;
}

let vimeoReady = null;

export function loadVimeoAPI() {
  if (vimeoReady) return vimeoReady;

  vimeoReady = window.Vimeo && window.Vimeo.Player
    ? Promise.resolve()
    : loadScript('https://player.vimeo.com/api/player.js');

  return vimeoReady;
}
