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

    loadScript('https://www.youtube.com/player_api').catch(reject);
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
