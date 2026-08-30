// Covers what has actually shipped broken here, and the element's lifecycle: URL parsing,
// MIME and attribute resolution, time/percentage arithmetic, the loop and pause decisions,
// the scroll-in gate, building and tearing down on `src` and on disconnect, the `<video>`
// API the element speaks - `paused`, the setters, `readyState`, `buffered`, and the event
// names, which are the `<video>`'s - group wrap-around, control teardown, the ARIA the controls write, and the seek bar's motion
// between time reports.
//
// Deliberately not covered: anything needing a real YouTube, Vimeo or media player. jsdom
// has no playback, no IntersectionObserver, no ResizeObserver and no network, so those
// paths are exercised through their decision logic with stub receivers instead - what
// breaks in a real browser is timing, and this cannot see it. The always-play fallback the
// missing IntersectionObserver forces is the one jsdom path that is also a real one.

import { jest } from '@jest/globals'
import { RE_VIDEO } from 'book-of-spells'
import { VideoBackground, parseSource, readParams, DEFAULTS } from '../video-background.mjs'
import { VideoBackgroundGroup, SeekBar, PlayToggle, MuteToggle, seekBarsFor } from '../controls.mjs'
import { Provider } from '../lib/provider.mjs'
import { Video, MIME_MAP, mimeType } from '../lib/video.mjs'
import { YouTube } from '../lib/youtube.mjs'
import { Vimeo } from '../lib/vimeo.mjs'

// jsdom logs "not implemented" for these instead of throwing; a stub keeps the output
// clean and lets a test count the calls
beforeAll(() => {
  HTMLMediaElement.prototype.play = jest.fn()
  HTMLMediaElement.prototype.pause = jest.fn()
})

// A YouTube API that is already loaded and hands back a player with no methods, the way
// the real one does until the iframe answers. Every YouTube element in this file builds
// against it; `players` collects what was constructed so a test can answer for the frame.
const players = []
beforeAll(() => {
  window.YT = { loaded: 1, Player: class { constructor(frame, options) { players.push({ frame, options }) } } }
})
afterEach(() => { players.length = 0 })

afterEach(() => {
  document.body.innerHTML = ''
})

const element = (html) => {
  document.body.insertAdjacentHTML('beforeend', html)
  return document.body.lastElementChild
}

const events = (target, ...names) => {
  const seen = []
  for (const name of names) target.addEventListener(name, () => seen.push(name))
  return seen
}

describe('parseSource', () => {
  test('returns undefined instead of throwing on a missing link', () => {
    expect(parseSource(null)).toBeUndefined()
    expect(parseSource(undefined)).toBeUndefined()
    expect(parseSource('')).toBeUndefined()
  })

  test('identifies each supported source type', () => {
    expect(parseSource('https://youtu.be/dQw4w9WgXcQ').type).toBe('youtube')
    expect(parseSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ').id).toBe('dQw4w9WgXcQ')
    expect(parseSource('https://vimeo.com/123456789').type).toBe('vimeo')
    expect(parseSource('https://example.com/clip.mp4').type).toBe('video')
  })

  test('a link that is none of them is not a source', () => {
    expect(parseSource('https://example.com/page.html')).toBeUndefined()
  })

  test('picks up the Vimeo unlisted hash', () => {
    expect(parseSource('https://vimeo.com/123456789/abc123def').unlisted).toBe('abc123def')
    expect(parseSource('https://vimeo.com/123456789?h=abc123def').unlisted).toBe('abc123def')
    expect(parseSource('https://player.vimeo.com/video/123456789?h=abc123def').unlisted).toBe('abc123def')
  })

  test('a public Vimeo URL never grows a hash it does not have', () => {
    expect(parseSource('https://vimeo.com/123456789').unlisted).toBeUndefined()
    // the last two segments look like id/hash, but the id is the last one
    expect(parseSource('https://vimeo.com/channels/staffpicks/123456789').unlisted).toBeUndefined()
    expect(parseSource('https://vimeo.com/groups/motion/videos/123456789').unlisted).toBeUndefined()
  })

  // guards MIME_MAP against drifting away from book-of-spells' RE_VIDEO
  test('matches every container MIME_MAP claims to support', () => {
    for (const ext in MIME_MAP) {
      expect(parseSource(`https://example.com/clip.${ext}`).type).toBe('video')
    }
  })
})

describe('RE_VIDEO', () => {
  test('tolerates query strings and hashes', () => {
    expect(RE_VIDEO.test('https://example.com/clip.mp4?v=2')).toBe(true)
    expect(RE_VIDEO.test('https://example.com/clip.webm#t=10')).toBe(true)
  })

  test('ignores unknown containers and extensionless URLs', () => {
    expect(RE_VIDEO.test('https://example.com/clip.mkv')).toBe(false)
    expect(RE_VIDEO.test('https://example.com/clip')).toBe(false)
  })
})

describe('mimeType', () => {
  test('leaves the MIME undefined rather than throwing on a bare filename', () => {
    expect(mimeType('clip')).toBeUndefined()
  })

  test('resolves known extensions regardless of case', () => {
    expect(mimeType('CLIP.MP4')).toBe('video/mp4')
    expect(mimeType('clip.WebM')).toBe('video/webm')
  })
})

describe('readParams', () => {
  test('an element with no attributes gets every default', () => {
    const params = readParams(element('<video-background></video-background>'))
    for (const key in DEFAULTS) {
      if (key === 'always-play') continue // forced on below, jsdom has no IntersectionObserver
      expect(params[key]).toBe(DEFAULTS[key])
    }
  })

  test('a value is typed, a bare boolean attribute is true, and "false" turns a default off', () => {
    const params = readParams(element('<video-background muted autoplay="false" start-at="10" volume="0.5" resolution="4:3" poster="a.png"></video-background>'))
    expect(params.muted).toBe(true)
    expect(params.autoplay).toBe(false)
    expect(params['start-at']).toBe(10)
    expect(params.volume).toBe(0.5)
    expect(params.resolution).toBe('4:3')
    expect(params.poster).toBe('a.png')
  })

  test('a bare attribute on a non-boolean option is ignored, not read as "true"', () => {
    const params = readParams(element('<video-background poster title></video-background>'))
    expect(params.poster).toBeNull()
    expect(params.title).toBe('Video background')
  })

  test('without IntersectionObserver there is no scroll gate, so always-play is forced on', () => {
    expect('IntersectionObserver' in window).toBe(false)
    expect(readParams(element('<video-background></video-background>'))['always-play']).toBe(true)
  })
})

describe('time and percentage conversion', () => {
  const clip = Object.assign(Object.create(Provider.prototype), { params: { 'start-at': 10 }, duration: 20 })

  test('round-trips around start-at', () => {
    expect(clip.timeToPercentage(15)).toBe(50)
    expect(clip.percentageToTime(50)).toBe(15)
  })

  test('clamps at both ends', () => {
    expect(clip.timeToPercentage(5)).toBe(0)
    expect(clip.timeToPercentage(25)).toBe(100)
    expect(clip.percentageToTime(-5)).toBe(10)
    expect(clip.percentageToTime(150)).toBe(20)
  })

  test('returns start-at while the duration is still unknown', () => {
    const unknown = Object.assign(Object.create(Provider.prototype), { params: { 'start-at': 10 }, duration: 0 })
    expect(unknown.percentageToTime(50)).toBe(10)
  })

  test('reports 0%, not 100%, while the duration is still unknown', () => {
    const unknown = Object.assign(Object.create(Provider.prototype), { params: { 'start-at': 0 }, duration: 0 })
    expect(unknown.timeToPercentage(30)).toBe(0)
  })
})

describe('setDuration', () => {
  test('clamps to end-at, or to a shorter video', () => {
    // a host, because a duration that moves is announced on it
    const capped = Object.assign(Object.create(Provider.prototype), { host: document.createElement('div'), params: { 'end-at': 20 } })
    capped.setDuration(60)
    expect(capped.duration).toBe(20)
    capped.setDuration(15)
    expect(capped.duration).toBe(15)

    const full = Object.assign(Object.create(Provider.prototype), { host: document.createElement('div'), params: { 'end-at': 0 } })
    full.setDuration(60)
    expect(full.duration).toBe(60)
  })
})

describe('native loop and start-at', () => {
  const video = (params) => Object.assign(Object.create(Video.prototype), { params, player: document.createElement('video') })

  test('a loop with no start-at rides the seamless native attribute', () => {
    const clip = video({ loop: true, 'start-at': 0 })
    clip.syncNativeLoop()
    expect(clip.player.hasAttribute('loop')).toBe(true)
  })

  test('start-at hands the loop to onVideoEnded, which native loop would skip', () => {
    const clip = video({ loop: true, 'start-at': 5 })
    clip.syncNativeLoop()
    expect(clip.player.hasAttribute('loop')).toBe(false)
  })

  test('a start-at set after the player exists still takes the attribute back', () => {
    const clip = video({ loop: true, 'start-at': 0 })
    clip.syncNativeLoop()
    clip.setStartAt(5)
    expect(clip.player.hasAttribute('loop')).toBe(false)
  })
})

describe('onVideoEnded', () => {
  const ended = (overrides) => {
    const calls = []
    const clip = Object.assign(Object.create(Video.prototype), {
      params: { loop: true, 'start-at': 3 },
      paused: false,
      player: { paused: true, play: () => calls.push('play') },
      updateState: (state) => calls.push(`state:${state}`),
      emit: (name) => calls.push(name),
      seekTo: (seconds) => calls.push(`seekTo:${seconds}`),
      pause: () => calls.push('pause'),
      onVideoPlay: () => calls.push('onVideoPlay'),
      ...overrides
    })
    clip.onVideoEnded()
    return calls
  }

  test('a looping video rewinds to start-at and plays again', () => {
    expect(ended()).toEqual(['state:ended', 'ended', 'seekTo:3', 'play'])
  })

  test('an explicit user pause outlives the end of the video', () => {
    expect(ended({ paused: true })).toEqual(['state:ended', 'ended', 'pause'])
  })

  test('a loop cut short by end-at re-announces play without restarting', () => {
    expect(ended({ player: { paused: false, play: () => { throw new Error('restarted') } } })).toEqual(['state:ended', 'ended', 'seekTo:3', 'onVideoPlay'])
  })

  test('a non-looping video stays stopped', () => {
    expect(ended({ params: { loop: false, 'start-at': 3 } })).toEqual(['state:ended', 'ended', 'pause'])
  })
})

describe('YouTube notstarted', () => {
  const notstarted = (overrides) => {
    const calls = []
    const clip = Object.assign(Object.create(YouTube.prototype), {
      params: { autoplay: true, 'always-play': false, 'start-at': 0 },
      isIntersecting: false,
      player: { playVideo: () => calls.push('playVideo') },
      seekTo: (seconds) => calls.push(`seekTo:${seconds}`),
      emit: () => {},
      ...overrides
    })
    clip.onVideoStateChange({ data: -1 })
    return calls
  }

  test('a lazy video never scrolled to stays quiet', () => {
    expect(notstarted()).toEqual([])
  })

  test('an intersecting video starts, and always-play starts off-screen', () => {
    expect(notstarted({ isIntersecting: true })).toEqual(['seekTo:0', 'playVideo'])
    expect(notstarted({ params: { autoplay: true, 'always-play': true, 'start-at': 0 } })).toEqual(['seekTo:0', 'playVideo'])
  })

  test('autoplay off means off, wherever the video sits', () => {
    expect(notstarted({ isIntersecting: true, params: { autoplay: false, 'always-play': true, 'start-at': 0 } })).toEqual([])
  })
})

describe('shouldPlay', () => {
  const shouldPlay = (state) => Provider.prototype.shouldPlay.call(state)

  const playable = {
    paused: false,
    currentState: 'paused',
    isIntersecting: true,
    params: { loop: true, autoplay: true, 'always-play': false }
  }

  test('plays an intersecting, autoplaying video', () => {
    expect(shouldPlay(playable)).toBe(true)
  })

  test('never overrides an explicit user pause', () => {
    expect(shouldPlay({ ...playable, paused: true })).toBe(false)
  })

  test('autoplay off means off, in view or not', () => {
    expect(shouldPlay({ ...playable, params: { ...playable.params, autoplay: false } })).toBe(false)
  })

  test('leaves an already playing or off-screen video alone', () => {
    expect(shouldPlay({ ...playable, currentState: 'playing' })).toBe(false)
    expect(shouldPlay({ ...playable, isIntersecting: false })).toBe(false)
  })

  test('always-play keeps a video going, it never starts one autoplay said not to', () => {
    const pinned = { ...playable, isIntersecting: false, params: { ...playable.params, 'always-play': true, autoplay: false } }
    expect(shouldPlay({ ...pinned, currentState: 'notstarted' })).toBe(false)
    expect(shouldPlay({ ...pinned, currentState: 'paused' })).toBe(false)
  })

  test('plays off-screen when pinned with always-play', () => {
    expect(shouldPlay({ ...playable, isIntersecting: false, params: { ...playable.params, 'always-play': true } })).toBe(true)
  })

  test('stays ended when looping is off', () => {
    expect(shouldPlay({ ...playable, currentState: 'ended', params: { ...playable.params, loop: false } })).toBe(false)
  })
})

describe('scrolling into view', () => {
  // The element's own observer callback, fed entries by hand.
  const scrolled = (overrides, isIntersecting) => {
    const host = element('<video-background></video-background>')
    const provider = {
      player: {},
      paused: false,
      currentState: 'notstarted',
      params: { loop: true, autoplay: true, 'always-play': false },
      shouldPlay: Provider.prototype.shouldPlay,
      softPlay: jest.fn(),
      softPause: jest.fn(),
      destroy: () => {},
      ...overrides
    }
    host.provider = provider
    host.onIntersect({ isIntersecting })
    return provider
  }

  test('an autoplaying video starts on scroll-in, one with autoplay off stays still', () => {
    expect(scrolled({}, true).softPlay).toHaveBeenCalledTimes(1)
    const manual = scrolled({ params: { loop: true, autoplay: false, 'always-play': false } }, true)
    expect(manual.softPlay).not.toHaveBeenCalled()
    expect(manual.isIntersecting).toBe(true)
  })

  test('a video the visitor paused stays paused on scroll-in', () => {
    expect(scrolled({ paused: true, currentState: 'paused' }, true).softPlay).not.toHaveBeenCalled()
  })

  test('an ended video with loop off does not restart on scroll-in', () => {
    expect(scrolled({ currentState: 'ended', params: { loop: false, autoplay: true, 'always-play': false } }, true).softPlay).not.toHaveBeenCalled()
  })

  test('scrolling out pauses whatever autoplay says', () => {
    const out = scrolled({ currentState: 'playing', params: { loop: true, autoplay: false, 'always-play': false } }, false)
    expect(out.softPause).toHaveBeenCalledTimes(1)
    expect(out.isIntersecting).toBe(false)
  })
})

describe('the <video> API', () => {
  const file = () => element('<video-background src="https://example.com/clip.mp4"></video-background>')

  test('paused reads the way it does on a <video>: true until playing, false while playing or buffering, true with nothing built', () => {
    expect(element('<video-background></video-background>').paused).toBe(true)
    const host = file()
    expect(host.paused).toBe(true)
    host.provider.updateState('playing')
    expect(host.paused).toBe(false)
    host.provider.updateState('buffering')
    expect(host.paused).toBe(false)
    host.provider.updateState('paused')
    expect(host.paused).toBe(true)
    host.provider.updateState('ended')
    expect(host.paused).toBe(true)
  })

  test('the events are the <video>\'s names, in its order, and stay on the element', () => {
    const wrap = element('<div></div>')
    const host = document.createElement('video-background')
    host.setAttribute('src', 'https://example.com/clip.mp4')
    const seen = events(host, 'loadedmetadata', 'play', 'playing', 'pause', 'timeupdate', 'volumechange', 'ended', 'seeked', 'waiting')
    const escaped = events(wrap, 'play', 'timeupdate', 'loadedmetadata')
    wrap.appendChild(host)
    expect(seen).toEqual([])

    const provider = host.provider
    provider.onVideoPlay()
    expect(seen.slice(0, 2)).toEqual(['play', 'playing'])
    provider.onVideoTimeUpdate()
    expect(seen).toContain('timeupdate')
    provider.onVideoPause()
    expect(seen).toContain('pause')
    provider.setVolume(0.5)
    expect(seen.filter((name) => name === 'volumechange')).toHaveLength(1)
    provider.mute()
    provider.unmute()
    // four, not three: the first unmute also restores the volume, which is a change of its own
    expect(seen.filter((name) => name === 'volumechange')).toHaveLength(4)
    provider.onVideoBuffering()
    expect(seen).toContain('waiting')
    provider.seekTo(3)
    expect(seen).toContain('seeked')
    provider.onVideoEnded()
    expect(seen).toContain('ended')
    expect(escaped).toEqual([])
  })

  test('durationchange fires when the duration becomes known and when end-at cuts it, not on a tick that repeats it', () => {
    const host = file()
    const seen = events(host, 'durationchange')
    host.provider.setDuration(60)
    host.provider.setDuration(60)
    expect(seen).toEqual(['durationchange'])
    expect(host.duration).toBe(60)
    host.provider.setEndAt(30)
    expect(seen).toEqual(['durationchange', 'durationchange'])
    expect(host.duration).toBe(30)
  })

  test('currentTime, volume and muted can be assigned, and go where seekTo, setVolume and mute go', () => {
    const host = file()
    const seek = jest.spyOn(host.provider, 'seekTo')
    host.currentTime = 10
    expect(seek).toHaveBeenCalledWith(10)
    host.volume = 0.5
    expect(host.volume).toBe(0.5)
    expect(host.player.volume).toBe(0.5)
    host.muted = true
    expect(host.muted).toBe(true)
    expect(host.player.muted).toBe(true)
    host.muted = false
    expect(host.muted).toBe(false)
    expect(host.player.muted).toBe(false)
  })

  test('readyState turns 1 with the duration; buffered is the <video>\'s own for a file, and YouTube\'s loaded fraction as one range', async () => {
    const host = file()
    expect(host.readyState).toBe(0)
    expect(typeof host.buffered.length).toBe('number')
    host.provider.setDuration(60)
    expect(host.readyState).toBe(1)

    const yt = element('<video-background src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></video-background>')
    await new Promise((resolve) => setTimeout(resolve))
    expect(yt.buffered.length).toBe(0)
    const player = { playVideo: jest.fn(), getDuration: () => 60, seekTo: jest.fn(), getVideoLoadedFraction: () => 0.5 }
    players[0].options.events.onReady({ target: player })
    expect(yt.buffered.length).toBe(1)
    expect(yt.buffered.start(0)).toBe(0)
    expect(yt.buffered.end(0)).toBe(30)
  })

  test('an element with nothing built answers the <video> names at rest rather than throwing', () => {
    const host = element('<video-background></video-background>')
    expect(host.readyState).toBe(0)
    expect(host.buffered.length).toBe(0)
    expect(() => { host.currentTime = 5; host.volume = 0.5; host.muted = true }).not.toThrow()
  })
})

describe('Vimeo background mode', () => {
  // background=1 is what hides Vimeo's chrome, and it autoplays, loops and mutes by
  // definition; these are the corrections the provider makes from the API
  const vimeo = (params, player) => Object.assign(Object.create(Vimeo.prototype), {
    host: document.createElement('div'),
    playerElement: { style: {} },
    params: { loop: false, autoplay: false, muted: false, 'always-play': false, 'start-at': 0, 'end-at': 0, 'force-on-low-battery': false, ...params },
    player: { play: jest.fn(), pause: jest.fn(), setLoop: jest.fn(), setMuted: jest.fn(), getDuration: () => Promise.resolve(42), ...player },
    muted: params.muted ?? false, volume: 1, paused: false, requested: false, initialPlay: false, initialVolume: false,
    currentState: 'notstarted', duration: 0, isIntersecting: true, is_mobile: false
  })

  test('sound is put back at ready when muted is off, and left off when it is on', () => {
    const loud = vimeo({ muted: false })
    loud.onVideoPlayerReady()
    expect(loud.player.setMuted).toHaveBeenCalledWith(false)
    const quiet = vimeo({ muted: true })
    quiet.onVideoPlayerReady()
    expect(quiet.player.setMuted).not.toHaveBeenCalled()
  })

  test('the first play nobody asked for is paused; the first play the page asked for is not', () => {
    const own = vimeo({})
    own.onVideoPlay({ seconds: 0, duration: 42 })
    expect(own.player.pause).toHaveBeenCalledTimes(1)
    expect(own.player.setLoop).toHaveBeenCalledWith(false)

    const asked = vimeo({})
    asked.play()
    asked.onVideoPlay({ seconds: 0, duration: 42 })
    expect(asked.player.pause).not.toHaveBeenCalled()
    expect(asked.currentState).toBe('playing')
  })
})

describe('loading the YouTube API', () => {
  // A fresh copy of the module: the promise is per document and every other YouTube test in
  // this file has already resolved the shared one against the `YT.loaded` stub.
  const fresh = async () => {
    let loaded
    await jest.isolateModulesAsync(async () => { loaded = await import('../lib/load.mjs') })
    return loaded
  }

  test('resolves even when another library takes the ready hook without chaining it', async () => {
    jest.useFakeTimers()
    const saved = window.YT
    window.YT = { loaded: 0 }
    try {
      const { loadYouTubeAPI, YOUTUBE_READY_INTERVAL } = await fresh()
      let settled = false
      const ready = loadYouTubeAPI().then(() => { settled = true })
      document.querySelector('script[src="https://www.youtube.com/player_api"]').dispatchEvent(new Event('load'))
      window.onYouTubeIframeAPIReady = () => {} // the other library, overwriting
      window.YT.loaded = 1
      await jest.advanceTimersByTimeAsync(YOUTUBE_READY_INTERVAL)
      await ready
      expect(settled).toBe(true)
    } finally {
      window.YT = saved
      jest.useRealTimers()
      document.querySelector('script[src="https://www.youtube.com/player_api"]')?.remove()
    }
  })

  test('gives up, loudly, on an API that loads but never comes up', async () => {
    jest.useFakeTimers()
    const saved = window.YT
    window.YT = { loaded: 0 }
    try {
      const { loadYouTubeAPI, YOUTUBE_READY_INTERVAL, YOUTUBE_READY_TRIES } = await fresh()
      const failed = expect(loadYouTubeAPI()).rejects.toThrow('never became ready')
      document.querySelector('script[src="https://www.youtube.com/player_api"]').dispatchEvent(new Event('load'))
      await jest.advanceTimersByTimeAsync(YOUTUBE_READY_INTERVAL * YOUTUBE_READY_TRIES)
      await failed
    } finally {
      window.YT = saved
      jest.useRealTimers()
      document.querySelector('script[src="https://www.youtube.com/player_api"]')?.remove()
    }
  })
})

describe('the element', () => {
  test('is defined under its tag, and the class is the export', () => {
    expect(customElements.get('video-background')).toBe(VideoBackground)
    expect(customElements.get('video-background-group')).toBe(VideoBackgroundGroup)
  })

  test('a file src builds a <video> with a typed <source>, says it is ready, and the element is the instance', () => {
    const host = element('<div class="hero"><video-background src="https://example.com/clip.mp4" muted></video-background></div>').firstElementChild
    expect(host.type).toBe('video')
    expect(host.player).toBe(host.querySelector('video'))
    expect(host.playerElement).toBe(host.player)
    expect(host.querySelector('video > source').getAttribute('src')).toBe('https://example.com/clip.mp4')
    expect(host.querySelector('video > source').getAttribute('type')).toBe('video/mp4')
    expect(host.player.hasAttribute('muted')).toBe(true)
    expect(host.player.hasAttribute('playsinline')).toBe(true)
    expect(host.currentState).toBe('notstarted')
    expect(host.paused).toBe(true)
  })

  test('loadedmetadata fires on the element once the duration is known, and like a <video>\'s does not bubble', () => {
    const wrap = element('<div></div>')
    const host = document.createElement('video-background')
    host.setAttribute('src', 'https://example.com/clip.mp4')
    const seen = events(host, 'loadedmetadata')
    const escaped = events(wrap, 'loadedmetadata')
    wrap.appendChild(host)
    expect(seen).toEqual([])
    host.provider.setDuration(60)
    expect(seen).toEqual(['loadedmetadata'])
    expect(escaped).toEqual([])
  })

  test('a YouTube src builds a no-cookie iframe carrying the id, the title and the api flag', () => {
    const host = element('<video-background src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Intro"></video-background>')
    const frame = host.querySelector('iframe')
    expect(host.type).toBe('youtube')
    expect(frame.src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/)
    expect(frame.src).toContain('enablejsapi=1')
    expect(frame.getAttribute('title')).toBe('Intro')
    expect(frame.getAttribute('allow')).toBe('autoplay; mute')
  })

  test('a scroll-in before YouTube has answered touches no player, and the ready event starts the video', async () => {
    const host = element('<video-background src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></video-background>')
    await new Promise((resolve) => setTimeout(resolve))
    expect(players.length).toBe(1)
    expect(players[0].frame).toBe(host.querySelector('iframe'))
    expect(host.player).toBeNull()

    expect(() => host.onIntersect({ isIntersecting: true })).not.toThrow()
    expect(() => host.play()).not.toThrow()

    const player = { playVideo: jest.fn(), getDuration: () => 60, seekTo: jest.fn() }
    players[0].options.events.onReady({ target: player })
    expect(host.player).toBe(player)
    expect(player.playVideo).toHaveBeenCalledTimes(1)
  })

  test('a frame torn down before YouTube answered ignores the late ready event', async () => {
    const host = element('<video-background src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></video-background>')
    await new Promise((resolve) => setTimeout(resolve))
    const provider = host.provider
    host.removeAttribute('src')
    const player = { playVideo: jest.fn(), getDuration: () => 60, seekTo: jest.fn() }
    players[0].options.events.onReady({ target: player })
    expect(provider.player).toBeNull()
    expect(player.playVideo).not.toHaveBeenCalled()
  })

  test('an unlisted Vimeo src keeps its hash in the embed url', () => {
    const host = element('<video-background src="https://vimeo.com/123456789/abc123def"></video-background>')
    expect(host.querySelector('iframe').src).toContain('h=abc123def')
  })

  test('a src that is not a video builds nothing and the api is inert', () => {
    const host = element('<video-background src="https://example.com/page.html"></video-background>')
    expect(host.provider).toBeNull()
    expect(host.children.length).toBe(0)
    expect(() => { host.play(); host.pause(); host.seek(50); host.setVolume(1) }).not.toThrow()
    expect(host.timeToPercentage(10)).toBe(0)
  })

  test('the stylesheet lands in <head> once, however many elements build', () => {
    element('<video-background src="https://example.com/a.mp4"></video-background>')
    element('<video-background src="https://example.com/b.mp4"></video-background>')
    expect(document.querySelectorAll('#video-background-style').length).toBe(1)
  })

  test('unstyled takes every rule off the element and leaves the parent alone, and fit-box fills it with a block', () => {
    const wrap = element('<div><video-background unstyled fit-box src="https://example.com/clip.mp4"></video-background></div>')
    const host = wrap.firstElementChild
    expect(host.params.unstyled).toBe(true)
    expect(wrap.style.position).toBe('')
    const rules = Array.from(document.getElementById('video-background-style').sheet.cssRules)
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) expect(rule.selectorText).toContain(':not([unstyled])')
    expect(host.player.style.display).toBe('block')
    expect(host.player.style.width).toBe('100%')
    const framed = element('<video-background unstyled fit-box src="https://vimeo.com/137250145"></video-background>')
    expect(framed.querySelector('iframe').style.border).toBe('0px')
  })

  test('a poster is written as an escaped url, and a static parent is made the containing block', () => {
    const wrap = element('<div><video-background src="https://example.com/clip.mp4" poster=\'a"b.png\'></video-background></div>')
    const host = wrap.firstElementChild
    // jsdom drops the quotes a browser keeps; the escaped quote inside is what matters
    expect(host.style.backgroundImage).toContain('a\\"b.png')
    expect(wrap.style.position).toBe('relative')
  })

  test('removing src tears the player down and announces it; setting it again rebuilds', () => {
    const host = element('<video-background src="https://example.com/clip.mp4"></video-background>')
    const seen = events(host, 'emptied', 'loadedmetadata')

    host.removeAttribute('src')
    expect(seen).toEqual(['emptied'])
    expect(host.provider).toBeNull()
    expect(host.querySelector('video')).toBeNull()

    host.setAttribute('src', 'https://example.com/other.mp4')
    host.provider.setDuration(30)
    expect(seen).toEqual(['emptied', 'loadedmetadata'])
    expect(host.querySelector('video > source').getAttribute('src')).toBe('https://example.com/other.mp4')
  })

  test('a src of the same type swaps the video in place, a different type rebuilds', () => {
    const host = element('<video-background src="https://example.com/clip.mp4"></video-background>')
    const video = host.player

    host.setSource('https://example.com/other.webm')
    expect(host.player).toBe(video)
    expect(host.getAttribute('src')).toBe('https://example.com/other.webm')
    expect(video.querySelector('source').getAttribute('type')).toBe('video/webm')

    host.setAttribute('src', 'https://youtu.be/dQw4w9WgXcQ')
    expect(host.type).toBe('youtube')
    expect(host.querySelector('video')).toBeNull()
    expect(host.querySelector('iframe')).not.toBeNull()
  })

  test('disconnecting tears the player down, so nothing outlives the element', () => {
    const host = element('<video-background src="https://example.com/clip.mp4"></video-background>')
    const seen = events(host, 'emptied')
    host.remove()
    expect(seen).toEqual(['emptied'])
    expect(host.provider).toBeNull()
    expect(host.querySelector('video')).toBeNull()
  })

  test('start-at and end-at are live attributes', () => {
    const host = element('<video-background src="https://example.com/clip.mp4" end-at="30"></video-background>')
    host.provider.setDuration(60)
    expect(host.duration).toBe(30)
    host.setAttribute('start-at', '5')
    expect(host.provider.params['start-at']).toBe(5)
    host.setEndAt(20)
    expect(host.duration).toBe(20)
  })

  test('mobile="false" on a touch device keeps the poster and builds no player', () => {
    const touchPoints = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
    try {
      const host = element('<video-background src="https://example.com/clip.mp4" mobile="false" poster="a.png"></video-background>')
      expect(host.provider).toBeNull()
      expect(host.style.backgroundImage).toContain('a.png')
    } finally {
      if (touchPoints) Object.defineProperty(navigator, 'maxTouchPoints', touchPoints)
      else delete navigator.maxTouchPoints
    }
  })
})

describe('the group', () => {
  const group = () => {
    const wrap = element(`<video-background-group>
      <video-background src="https://example.com/a.mp4" loop="false"></video-background>
      <video-background src="https://example.com/b.mp4" loop="false" autoplay="false"></video-background>
    </video-background-group>`)
    return wrap
  }

  test('finds its members on connect', () => {
    const stack = group()
    expect(stack.stack.length).toBe(2)
    expect(stack.currentElement).toBe(stack.stack[0])
  })

  test('running off the end wraps to the first and announces the rewind', () => {
    const stack = group()
    const seen = events(stack, 'video-background-group-forward-rewind', 'video-background-group-backward-rewind', 'video-background-group-next')
    stack.current = 1
    stack.next()
    expect(stack.current).toBe(0)
    expect(seen).toEqual(['video-background-group-forward-rewind', 'video-background-group-next'])
  })

  test('running off the start wraps to the last and announces the rewind', () => {
    const stack = group()
    const seen = events(stack, 'video-background-group-forward-rewind', 'video-background-group-backward-rewind', 'video-background-group-previous')
    stack.prev()
    expect(stack.current).toBe(1)
    expect(seen).toEqual(['video-background-group-backward-rewind', 'video-background-group-previous'])
  })

  test('an ordinary step announces no rewind, shows the next member and hides the last', () => {
    const stack = group()
    const seen = events(stack, 'video-background-group-forward-rewind', 'video-background-group-backward-rewind')
    stack.next()
    expect(seen).toEqual([])
    expect(stack.stack[0].style.display).toBe('none')
    expect(stack.stack[1].style.display).toBe('block')
  })

  test('the end of the current member steps the group, the end of another does not', () => {
    const stack = group()
    stack.stack[1].dispatchEvent(new Event('ended'))
    expect(stack.current).toBe(0)
    stack.stack[0].dispatchEvent(new Event('ended'))
    expect(stack.current).toBe(1)
  })

  test('disconnecting takes the listeners back', () => {
    const stack = group()
    stack.remove()
    expect(stack.listeners).toBeNull()
    stack.stack[0].dispatchEvent(new Event('ended'))
    expect(stack.current).toBe(0)
  })
})

describe('control teardown', () => {
  // Records every (event, handler) pair an element is given and every one taken
  // back, so a destroy() that removes a fresh .bind() instead of the original
  // shows up as a pair still outstanding.
  const track = (element) => {
    const pairs = []
    const add = element.addEventListener.bind(element)
    const remove = element.removeEventListener.bind(element)
    element.addEventListener = (name, fn, opts) => { pairs.push([name, fn]); add(name, fn, opts) }
    element.removeEventListener = (name, fn) => {
      const i = pairs.findIndex(([n, f]) => n === name && f === fn)
      if (i > -1) pairs.splice(i, 1)
      remove(name, fn)
    }
    return pairs
  }
  const outstanding = (pairs) => pairs.map(([name]) => name)
  const dispatch = (element, name) => element.dispatchEvent(new Event(name))

  // A stub target: any element carrying the members the controls read and call. The real
  // element proxies exactly these onto its provider.
  let target, targetTracked
  beforeEach(() => {
    target = element('<div id="hero"></div>')
    Object.assign(target, { currentTime: 0, currentState: 'paused', timeToPercentage: (t) => t, seek: jest.fn(), play: jest.fn(), pause: jest.fn(), mute: jest.fn(), unmute: jest.fn(), muted: false, playerElement: null })
    targetTracked = track(target)
  })

  test('a destroyed seek bar hands back every listener it took, and the wrapper can be bound again', () => {
    const wrapper = element('<div id="bar" data-target="#hero"><input class="js-seek-bar" type="range"></div>')
    const inputTracked = track(wrapper.querySelector('.js-seek-bar'))

    const bar = new SeekBar(wrapper)
    expect(seekBarsFor(target).has(bar)).toBe(true)
    expect(new SeekBar(wrapper).listeners).toBeUndefined()

    bar.destroy()
    expect(outstanding(targetTracked)).toEqual([])
    expect(outstanding(inputTracked)).toEqual([])
    expect(seekBarsFor(target).size).toBe(0)

    const again = new SeekBar(wrapper)
    expect(again.listeners.length).toBeGreaterThan(0)
    expect(seekBarsFor(target).has(again)).toBe(true)
  })

  test('a destroyed play toggle neither follows the video nor drives it', () => {
    const button = element('<button id="play" data-target="#hero"></button>')
    const buttonTracked = track(button)

    const toggle = new PlayToggle(button)
    dispatch(target, 'play')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    button.click()
    expect(target.pause).toHaveBeenCalledTimes(1)

    toggle.destroy()
    expect(outstanding(targetTracked)).toEqual([])
    expect(outstanding(buttonTracked)).toEqual([])
    dispatch(target, 'pause')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    button.click()
    expect(target.pause).toHaveBeenCalledTimes(1)
    expect(target.play).not.toHaveBeenCalled()
  })

  test('a destroyed mute toggle neither follows the video nor drives it', () => {
    const button = element('<button id="mute" data-target="#hero"></button>')
    const buttonTracked = track(button)

    const toggle = new MuteToggle(button)
    target.muted = true
    dispatch(target, 'volumechange')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    button.click()
    expect(target.unmute).toHaveBeenCalledTimes(1)

    toggle.destroy()
    expect(outstanding(targetTracked)).toEqual([])
    expect(outstanding(buttonTracked)).toEqual([])
    target.muted = false
    dispatch(target, 'volumechange')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    button.click()
    expect(target.unmute).toHaveBeenCalledTimes(1)
  })

  test('destroying a control that never bound is a no-op', () => {
    expect(() => new SeekBar(null).destroy()).not.toThrow()
    expect(() => new PlayToggle(document.createElement('button')).destroy()).not.toThrow()
    expect(() => new MuteToggle(document.createElement('button')).destroy()).not.toThrow()
  })

  test('a control takes the element it is handed over data-target', () => {
    const button = document.createElement('button')
    const toggle = new PlayToggle(button, target)
    expect(toggle.target).toBe(target)
  })
})

describe('control ARIA', () => {
  const dispatch = (element, name) => element.dispatchEvent(new Event(name))
  let target
  beforeEach(() => {
    target = element('<div id="hero"></div>')
    Object.assign(target, { currentState: 'paused', muted: true })
  })

  test('a toggle keeps the name it was given and carries the state in aria-pressed, as a toggle button and not a switch', () => {
    const play = element('<button id="play" data-target="#hero">Play</button>')
    const mute = element('<button id="mute" data-target="#hero">Mute</button>')
    new PlayToggle(play)
    new MuteToggle(mute)

    for (const button of [play, mute]) {
      expect(button.hasAttribute('role')).toBe(false)
      expect(button.getAttribute('type')).toBe('button')
      expect(button.getAttribute('aria-pressed')).toBe('false')
    }

    dispatch(target, 'play')
    target.muted = true
    dispatch(target, 'volumechange')
    expect(play.getAttribute('aria-pressed')).toBe('true')
    expect(mute.getAttribute('aria-pressed')).toBe('true')
    expect(play.textContent).toBe('Play')
    expect(mute.textContent).toBe('Mute')
    expect(play.hasAttribute('aria-label')).toBe(false)
    expect(mute.hasAttribute('aria-label')).toBe(false)
  })

  test('a mute toggle reads the muted start off loadedmetadata', () => {
    const mute = element('<button data-target="#hero">Mute</button>')
    new MuteToggle(mute)
    dispatch(target, 'loadedmetadata')
    expect(mute.getAttribute('aria-pressed')).toBe('true')
  })

  test('an authored type and aria-pressed are left alone', () => {
    const play = element('<button id="play" type="submit" aria-pressed="true" data-target="#hero">Play</button>')
    const toggle = new PlayToggle(play)
    expect(play.getAttribute('type')).toBe('submit')
    expect(toggle.active).toBe(true)
  })

  test('a seek bar with no name gets one, and one with a name keeps it', () => {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bare" data-target="#hero"><input class="js-seek-bar" type="range"></div>
      <div id="named" data-target="#hero"><input class="js-seek-bar" type="range" aria-label="Scrub"></div>
      <div id="labelled" data-target="#hero"><label for="scrub">Scrub</label><input id="scrub" class="js-seek-bar" type="range"></div>
    `)
    new SeekBar(document.querySelector('#bare'))
    new SeekBar(document.querySelector('#named'))
    new SeekBar(document.querySelector('#labelled'))
    expect(document.querySelector('#bare input').getAttribute('aria-label')).toBe('Seek')
    expect(document.querySelector('#named input').getAttribute('aria-label')).toBe('Scrub')
    expect(document.querySelector('#labelled input').hasAttribute('aria-label')).toBe(false)
  })
})

describe('seek bar motion', () => {
  const dispatch = (element, name) => element.dispatchEvent(new Event(name))
  let target, input
  beforeEach(() => {
    jest.useFakeTimers()
    target = element('<div id="hero"></div>')
    // Identity mapping, so the bar's value reads as seconds.
    Object.assign(target, { currentTime: 10, currentState: 'playing', timeToPercentage: (t) => t, seek: jest.fn(), playerElement: null })
    input = element('<div id="bar" data-target="#hero"><input class="js-seek-bar" type="range" min="0" max="100" step="any"></div>').querySelector('input')
    new SeekBar(document.querySelector('#bar'))
  })
  afterEach(() => jest.useRealTimers())
  const shown = () => parseFloat(input.value)

  test('the bar moves on animation frames between two time reports', () => {
    dispatch(target, 'timeupdate')
    expect(shown()).toBe(10)
    jest.advanceTimersByTime(100)
    expect(shown()).toBeGreaterThan(10)
    expect(shown()).toBeLessThan(11)
  })

  test('a report a few milliseconds behind the bar is jitter and the bar holds', () => {
    dispatch(target, 'timeupdate')
    jest.advanceTimersByTime(200)
    const before = shown()
    target.currentTime = 10.1
    dispatch(target, 'timeupdate')
    expect(shown()).toBe(before)
  })

  test('a report a second or more behind is a loop, and the bar snaps back', () => {
    dispatch(target, 'timeupdate')
    target.currentTime = 2
    dispatch(target, 'timeupdate')
    expect(shown()).toBe(2)
  })

  test('a paused video holds the bar where the last report put it', () => {
    target.currentState = 'paused'
    dispatch(target, 'timeupdate')
    jest.advanceTimersByTime(500)
    expect(shown()).toBe(10)
  })

  test('dragging locks the bar to the thumb, and letting go seeks', () => {
    dispatch(target, 'timeupdate')
    input.value = 40
    input.dispatchEvent(new Event('input'))
    target.currentTime = 11
    dispatch(target, 'timeupdate')
    jest.advanceTimersByTime(50)
    expect(shown()).toBe(40)
    input.dispatchEvent(new Event('change'))
    expect(target.seek).toHaveBeenCalledWith('40')
  })

  test('a destroyed background resets the bar', () => {
    dispatch(target, 'timeupdate')
    dispatch(target, 'emptied')
    jest.advanceTimersByTime(50)
    expect(shown()).toBe(0)
  })
})
