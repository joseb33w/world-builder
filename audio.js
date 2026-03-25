/**
 * audio.js — Procedural audio system for World Builder
 *
 * Uses Web Audio API to generate all sounds procedurally (no external files).
 * - City ambience (gentle noise + tone drones)
 * - Construction sounds (when building is placed)
 * - Day/night ambient music shift
 * - Weather audio (rain, wind)
 * - Mute/unmute toggle
 *
 * Exposes window.WorldAudio for optional integration with app.js.
 * Also hooks into DOM events independently.
 */
;(function() {
  'use strict'

  let audioCtx = null
  let masterGain = null
  let ambienceGain = null
  let musicGain = null
  let sfxGain = null
  let muted = true // Start muted, user opts in
  let initialized = false
  let ambienceNodes = []
  let musicInterval = null
  let currentDayPhase = 'day'

  // Lazy-init on first user interaction
  function ensureContext() {
    if (audioCtx) return true
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      masterGain = audioCtx.createGain()
      masterGain.gain.value = muted ? 0 : 0.5
      masterGain.connect(audioCtx.destination)

      ambienceGain = audioCtx.createGain()
      ambienceGain.gain.value = 0.3
      ambienceGain.connect(masterGain)

      musicGain = audioCtx.createGain()
      musicGain.gain.value = 0.15
      musicGain.connect(masterGain)

      sfxGain = audioCtx.createGain()
      sfxGain.gain.value = 0.6
      sfxGain.connect(masterGain)

      initialized = true
      return true
    } catch(e) {
      console.warn('[audio] Web Audio API not available:', e.message)
      return false
    }
  }

  function resumeCtx() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
  }

  // ========== AMBIENCE ==========
  function createNoise(type) {
    // Brown noise for city ambience
    const bufferSize = audioCtx.sampleRate * 2
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      // Brown noise filter
      last = (last + (0.02 * white)) / 1.02
      data[i] = last * 3.5
    }
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return source
  }

  function startAmbience() {
    if (!initialized) return
    stopAmbience()

    // Gentle brown noise backdrop
    const noise = createNoise()
    const noiseFilter = audioCtx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 400
    noiseFilter.Q.value = 0.5
    const noiseGain = audioCtx.createGain()
    noiseGain.gain.value = 0.08
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(ambienceGain)
    noise.start()
    ambienceNodes.push(noise, noiseFilter, noiseGain)

    // Subtle city drone (low hum)
    const drone = audioCtx.createOscillator()
    drone.type = 'sine'
    drone.frequency.value = 80
    const droneGain = audioCtx.createGain()
    droneGain.gain.value = 0.04
    drone.connect(droneGain)
    droneGain.connect(ambienceGain)
    drone.start()
    ambienceNodes.push(drone, droneGain)

    // Higher harmonic
    const hum = audioCtx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 160
    const humGain = audioCtx.createGain()
    humGain.gain.value = 0.015
    hum.connect(humGain)
    humGain.connect(ambienceGain)
    hum.start()
    ambienceNodes.push(hum, humGain)
  }

  function stopAmbience() {
    ambienceNodes.forEach(node => {
      try { if (node.stop) node.stop() } catch(e) {}
      try { node.disconnect() } catch(e) {}
    })
    ambienceNodes = []
  }

  // ========== CONSTRUCTION SFX ==========
  function playConstruction() {
    if (!initialized || muted) return
    resumeCtx()
    const now = audioCtx.currentTime

    // Hammer hit (noise burst)
    const hitBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate)
    const hitData = hitBuffer.getChannelData(0)
    for (let i = 0; i < hitData.length; i++) {
      hitData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.03))
    }
    const hitSource = audioCtx.createBufferSource()
    hitSource.buffer = hitBuffer
    const hitFilter = audioCtx.createBiquadFilter()
    hitFilter.type = 'bandpass'
    hitFilter.frequency.value = 1200
    hitFilter.Q.value = 2
    const hitGain = audioCtx.createGain()
    hitGain.gain.setValueAtTime(0.7, now)
    hitGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    hitSource.connect(hitFilter)
    hitFilter.connect(hitGain)
    hitGain.connect(sfxGain)
    hitSource.start(now)
    hitSource.stop(now + 0.2)

    // Second hit
    const hit2 = audioCtx.createBufferSource()
    hit2.buffer = hitBuffer
    const hit2Gain = audioCtx.createGain()
    hit2Gain.gain.setValueAtTime(0.5, now + 0.18)
    hit2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.33)
    hit2.connect(hitFilter.cloneNode ? hitFilter : hitGain)
    hit2.connect(hit2Gain)
    hit2Gain.connect(sfxGain)
    hit2.start(now + 0.18)
    hit2.stop(now + 0.4)

    // Rising tone (construction complete)
    const tone = audioCtx.createOscillator()
    tone.type = 'triangle'
    tone.frequency.setValueAtTime(300, now + 0.25)
    tone.frequency.exponentialRampToValueAtTime(600, now + 0.55)
    const toneGain = audioCtx.createGain()
    toneGain.gain.setValueAtTime(0, now + 0.25)
    toneGain.gain.linearRampToValueAtTime(0.3, now + 0.35)
    toneGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65)
    tone.connect(toneGain)
    toneGain.connect(sfxGain)
    tone.start(now + 0.25)
    tone.stop(now + 0.7)

    // Sparkle (high sine blip)
    const sparkle = audioCtx.createOscillator()
    sparkle.type = 'sine'
    sparkle.frequency.setValueAtTime(1200, now + 0.5)
    sparkle.frequency.exponentialRampToValueAtTime(1800, now + 0.65)
    const sparkGain = audioCtx.createGain()
    sparkGain.gain.setValueAtTime(0.15, now + 0.5)
    sparkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
    sparkle.connect(sparkGain)
    sparkGain.connect(sfxGain)
    sparkle.start(now + 0.5)
    sparkle.stop(now + 0.8)
  }

  // ========== CHAT BLIP ==========
  function playChatBlip() {
    if (!initialized || muted) return
    resumeCtx()
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08)
    const g = audioCtx.createGain()
    g.gain.setValueAtTime(0.15, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc.connect(g)
    g.connect(sfxGain)
    osc.start(now)
    osc.stop(now + 0.15)
  }

  // ========== UI CLICK ==========
  function playClick() {
    if (!initialized || muted) return
    resumeCtx()
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 600
    const g = audioCtx.createGain()
    g.gain.setValueAtTime(0.08, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
    osc.connect(g)
    g.connect(sfxGain)
    osc.start(now)
    osc.stop(now + 0.05)
  }

  // ========== DAY/NIGHT MUSIC ==========
  let musicOsc1 = null, musicOsc2 = null, musicLFO = null

  function setDayPhase(phase) {
    if (phase === currentDayPhase || !initialized) return
    currentDayPhase = phase
    updateMusic()
  }

  function updateMusic() {
    if (!initialized || muted) return
    resumeCtx()
    const now = audioCtx.currentTime

    // Clean up old music oscillators
    ;[musicOsc1, musicOsc2, musicLFO].forEach(n => {
      try { if (n && n.stop) n.stop(now + 0.5) } catch(e) {}
    })

    // Day = bright major chord, Night = darker minor
    const isNight = currentDayPhase === 'night'
    const baseFreq = isNight ? 130.81 : 164.81 // C3 vs E3
    const thirdFreq = isNight ? 155.56 : 196.00 // Eb3 (minor) vs G3 (major)

    musicOsc1 = audioCtx.createOscillator()
    musicOsc1.type = 'sine'
    musicOsc1.frequency.value = baseFreq
    const mg1 = audioCtx.createGain()
    mg1.gain.value = 0.06
    musicOsc1.connect(mg1)
    mg1.connect(musicGain)
    musicOsc1.start(now)

    musicOsc2 = audioCtx.createOscillator()
    musicOsc2.type = 'sine'
    musicOsc2.frequency.value = thirdFreq
    const mg2 = audioCtx.createGain()
    mg2.gain.value = 0.04
    musicOsc2.connect(mg2)
    mg2.connect(musicGain)
    musicOsc2.start(now)

    // LFO for gentle pulsing
    musicLFO = audioCtx.createOscillator()
    musicLFO.type = 'sine'
    musicLFO.frequency.value = isNight ? 0.1 : 0.2
    const lfoGain = audioCtx.createGain()
    lfoGain.gain.value = isNight ? 0.015 : 0.02
    musicLFO.connect(lfoGain)
    lfoGain.connect(mg1.gain)
    musicLFO.start(now)
  }

  // ========== WEATHER AUDIO ==========
  let rainSource = null, rainFilter = null, rainGain2 = null

  function setWeather(weather) {
    if (!initialized) return
    stopWeatherAudio()
    if (muted) return
    resumeCtx()

    if (weather === 'rain') {
      // Rain = filtered noise
      rainSource = createNoise()
      rainFilter = audioCtx.createBiquadFilter()
      rainFilter.type = 'highpass'
      rainFilter.frequency.value = 2000
      rainFilter.Q.value = 0.3
      rainGain2 = audioCtx.createGain()
      rainGain2.gain.value = 0.12
      rainSource.connect(rainFilter)
      rainFilter.connect(rainGain2)
      rainGain2.connect(ambienceGain)
      rainSource.start()
    } else if (weather === 'snow') {
      // Snow = very quiet, muffled noise
      rainSource = createNoise()
      rainFilter = audioCtx.createBiquadFilter()
      rainFilter.type = 'lowpass'
      rainFilter.frequency.value = 600
      rainGain2 = audioCtx.createGain()
      rainGain2.gain.value = 0.04
      rainSource.connect(rainFilter)
      rainFilter.connect(rainGain2)
      rainGain2.connect(ambienceGain)
      rainSource.start()
    } else if (weather === 'fog') {
      // Fog = low drone
      rainSource = audioCtx.createOscillator()
      rainSource.type = 'sine'
      rainSource.frequency.value = 55
      rainGain2 = audioCtx.createGain()
      rainGain2.gain.value = 0.03
      rainSource.connect(rainGain2)
      rainGain2.connect(ambienceGain)
      rainSource.start()
    }
    // sunny/cloudy = just ambience, no extra
  }

  function stopWeatherAudio() {
    ;[rainSource, rainFilter, rainGain2].forEach(n => {
      try { if (n && n.stop) n.stop() } catch(e) {}
      try { if (n) n.disconnect() } catch(e) {}
    })
    rainSource = null
    rainFilter = null
    rainGain2 = null
  }

  // ========== MUTE TOGGLE ==========
  function toggleMute() {
    if (!ensureContext()) return false
    resumeCtx()
    muted = !muted
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, audioCtx.currentTime, 0.1)

    if (!muted) {
      startAmbience()
      updateMusic()
    } else {
      stopAmbience()
      stopWeatherAudio()
    }

    updateMuteButton()
    return !muted
  }

  function isMuted() { return muted }

  // ========== UI: MUTE BUTTON ==========
  function createMuteButton() {
    const existing = document.getElementById('audio-mute-btn')
    if (existing) return

    const btn = document.createElement('button')
    btn.id = 'audio-mute-btn'
    btn.setAttribute('aria-label', 'Toggle audio')
    btn.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>'
    btn.style.cssText = `
      position: fixed; bottom: 80px; right: 12px; z-index: 200;
      width: 44px; height: 44px; border-radius: 12px;
      background: rgba(17,24,39,0.92); border: 1px solid rgba(255,255,255,0.1);
      color: #8b95b0; display: grid; place-items: center;
      cursor: pointer; font-size: 1.1rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      transition: color 0.2s, border-color 0.2s;
    `
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleMute()
    })
    document.body.appendChild(btn)
  }

  function updateMuteButton() {
    const btn = document.getElementById('audio-mute-btn')
    if (!btn) return
    btn.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>'
    btn.style.color = muted ? '#8b95b0' : '#22d3ee'
    btn.style.borderColor = muted ? 'rgba(255,255,255,0.1)' : 'rgba(34,211,238,0.3)'
  }

  // ========== DOM HOOKS ==========
  // Listen for build button clicks to play construction sound
  document.addEventListener('click', (e) => {
    const target = e.target
    if (!target) return

    // Build button
    if (target.classList.contains('build-btn') || target.closest('.build-btn')) {
      // Delay slightly so the building actually gets placed first
      setTimeout(playConstruction, 200)
    }

    // Chat send button
    if (target.closest('.chat-input-row button')) {
      playChatBlip()
    }

    // Nav/drawer toggles
    if (target.classList.contains('drawer-toggle') || target.closest('.drawer-toggle') ||
        target.classList.contains('drawer-close') || target.closest('.drawer-close') ||
        target.classList.contains('nav-tab') || target.closest('.nav-tab')) {
      playClick()
    }

    // Name submit
    if (target.closest('.name-card button')) {
      playClick()
    }
  }, true)

  // Keyboard: Enter on build input
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const target = e.target
      if (target && target.classList.contains('build-input')) {
        setTimeout(playConstruction, 200)
      }
      if (target && target.closest('.chat-input-row')) {
        playChatBlip()
      }
    }
  }, true)

  // Watch for weather/time changes by observing DOM
  let weatherCheckInterval = setInterval(() => {
    // Check weather badge in the topbar
    const weatherBadge = document.querySelector('.stat-badge.weather')
    if (weatherBadge) {
      const text = weatherBadge.textContent.toLowerCase()
      for (const w of ['rain', 'snow', 'fog', 'cloudy', 'sunny']) {
        if (text.includes(w)) {
          setWeather(w)
          break
        }
      }
    }

    // Check day/night overlay for phase
    const overlay = document.querySelector('.daynight-overlay')
    if (overlay) {
      const bg = overlay.style.background || ''
      if (bg.includes('0.4') || bg.includes('0.5') || bg.includes('0.6') || bg.includes('0.7') || bg.includes('0.3')) {
        setDayPhase('night')
      } else {
        setDayPhase('day')
      }
    }
  }, 3000)

  // Init on load
  function init() {
    createMuteButton()
    // Also re-create button if DOM is rebuilt
    const appObserver = new MutationObserver(() => {
      if (!document.getElementById('audio-mute-btn')) {
        createMuteButton()
      }
    })
    if (document.body) {
      appObserver.observe(document.body, { childList: true, subtree: false })
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // ========== PUBLIC API ==========
  window.WorldAudio = {
    toggleMute,
    isMuted,
    playConstruction,
    playChatBlip,
    playClick,
    setWeather,
    setDayPhase,
    ensureContext
  }

  console.log('[audio] World Builder audio system loaded (start muted, tap speaker icon to enable)')
})()
