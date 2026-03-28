;(function () {
  'use strict'

  let audioCtx = null
  let masterGain = null
  let ambienceGain = null
  let musicGain = null
  let sfxGain = null
  let muted = true
  let initialized = false
  let ambienceNodes = []
  let musicNodes = []
  let weatherNodes = []
  let toggleBtn = null
  let currentWeather = 'sunny'
  let currentDayPhase = 'day'

  function ensureContext() {
    if (audioCtx) return true
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      masterGain = audioCtx.createGain()
      masterGain.gain.value = muted ? 0 : 0.45
      masterGain.connect(audioCtx.destination)

      ambienceGain = audioCtx.createGain()
      ambienceGain.gain.value = 0.28
      ambienceGain.connect(masterGain)

      musicGain = audioCtx.createGain()
      musicGain.gain.value = 0.16
      musicGain.connect(masterGain)

      sfxGain = audioCtx.createGain()
      sfxGain.gain.value = 0.65
      sfxGain.connect(masterGain)

      initialized = true
      startAmbience()
      updateMusic()
      setWeather(currentWeather)
      return true
    } catch (error) {
      console.warn('[audio] Web Audio unavailable:', error?.message)
      return false
    }
  }

  async function resume() {
    if (!ensureContext()) return false
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume()
      } catch (_) {}
    }
    return true
  }

  function setMuted(nextMuted) {
    muted = !!nextMuted
    if (ensureContext()) {
      const now = audioCtx.currentTime
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, now, 0.02)
    }
    updateToggleButton()
  }

  function toggleMute() {
    if (!ensureContext()) return
    if (muted) {
      resume().then(() => {
        setMuted(false)
        playClick()
      })
    } else {
      playClick()
      setMuted(true)
    }
  }

  function updateToggleButton() {
    if (!toggleBtn) return
    toggleBtn.innerHTML = muted
      ? '<i class="fa-solid fa-volume-xmark"></i>'
      : '<i class="fa-solid fa-volume-high"></i>'
    toggleBtn.setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound')
    toggleBtn.title = muted ? 'Enable sound' : 'Mute sound'
  }

  function attachToggleButton() {
    if (toggleBtn && document.body.contains(toggleBtn)) return
    toggleBtn = document.getElementById('wb-audio-toggle')
    if (!toggleBtn) {
      toggleBtn = document.createElement('button')
      toggleBtn.id = 'wb-audio-toggle'
      toggleBtn.type = 'button'
      toggleBtn.style.position = 'fixed'
      toggleBtn.style.right = '14px'
      toggleBtn.style.bottom = '14px'
      toggleBtn.style.zIndex = '10001'
      toggleBtn.style.width = '52px'
      toggleBtn.style.height = '52px'
      toggleBtn.style.border = '1px solid rgba(255,255,255,0.12)'
      toggleBtn.style.borderRadius = '16px'
      toggleBtn.style.background = 'rgba(17,24,39,0.92)'
      toggleBtn.style.color = '#f0f4ff'
      toggleBtn.style.boxShadow = '0 12px 32px rgba(0,0,0,0.35)'
      toggleBtn.style.cursor = 'pointer'
      toggleBtn.style.backdropFilter = 'blur(12px)'
      document.body.appendChild(toggleBtn)
    }
    toggleBtn.onclick = toggleMute
    updateToggleButton()
  }

  function createNoiseBuffer() {
    const bufferSize = audioCtx.sampleRate * 2
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    return buffer
  }

  function createNoiseSource() {
    const source = audioCtx.createBufferSource()
    source.buffer = createNoiseBuffer()
    source.loop = true
    return source
  }

  function disconnectNodes(nodes) {
    nodes.forEach(node => {
      try { if (node.stop) node.stop() } catch (_) {}
      try { node.disconnect() } catch (_) {}
    })
  }

  function startAmbience() {
    if (!initialized) return
    disconnectNodes(ambienceNodes)
    ambienceNodes = []

    const noise = createNoiseSource()
    const lowpass = audioCtx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 380
    const noiseGain = audioCtx.createGain()
    noiseGain.gain.value = 0.07
    noise.connect(lowpass)
    lowpass.connect(noiseGain)
    noiseGain.connect(ambienceGain)
    noise.start()

    const drone = audioCtx.createOscillator()
    drone.type = 'sine'
    drone.frequency.value = 82
    const droneGain = audioCtx.createGain()
    droneGain.gain.value = 0.035
    drone.connect(droneGain)
    droneGain.connect(ambienceGain)
    drone.start()

    const hum = audioCtx.createOscillator()
    hum.type = 'triangle'
    hum.frequency.value = 164
    const humGain = audioCtx.createGain()
    humGain.gain.value = 0.012
    hum.connect(humGain)
    humGain.connect(ambienceGain)
    hum.start()

    ambienceNodes = [noise, lowpass, noiseGain, drone, droneGain, hum, humGain]
  }

  function updateMusic() {
    if (!initialized) return
    disconnectNodes(musicNodes)
    musicNodes = []

    const isNight = currentDayPhase === 'night'
    const root = isNight ? 130.81 : 164.81
    const third = isNight ? 155.56 : 196.0

    const osc1 = audioCtx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = root
    const gain1 = audioCtx.createGain()
    gain1.gain.value = 0.05
    osc1.connect(gain1)
    gain1.connect(musicGain)
    osc1.start()

    const osc2 = audioCtx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = third
    const gain2 = audioCtx.createGain()
    gain2.gain.value = 0.035
    osc2.connect(gain2)
    gain2.connect(musicGain)
    osc2.start()

    const lfo = audioCtx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = isNight ? 0.1 : 0.18
    const lfoGain = audioCtx.createGain()
    lfoGain.gain.value = isNight ? 0.012 : 0.018
    lfo.connect(lfoGain)
    lfoGain.connect(gain1.gain)
    lfo.start()

    musicNodes = [osc1, gain1, osc2, gain2, lfo, lfoGain]
  }

  function stopWeatherAudio() {
    disconnectNodes(weatherNodes)
    weatherNodes = []
  }

  function setWeather(weather) {
    currentWeather = weather || 'sunny'
    if (!initialized) return
    stopWeatherAudio()

    if (currentWeather === 'rain') {
      const rain = createNoiseSource()
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 1800
      const gain = audioCtx.createGain()
      gain.gain.value = 0.1
      rain.connect(filter)
      filter.connect(gain)
      gain.connect(ambienceGain)
      rain.start()
      weatherNodes = [rain, filter, gain]
    } else if (currentWeather === 'snow') {
      const snow = createNoiseSource()
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 700
      const gain = audioCtx.createGain()
      gain.gain.value = 0.035
      snow.connect(filter)
      filter.connect(gain)
      gain.connect(ambienceGain)
      snow.start()
      weatherNodes = [snow, filter, gain]
    } else if (currentWeather === 'fog') {
      const fog = audioCtx.createOscillator()
      fog.type = 'sine'
      fog.frequency.value = 98
      const gain = audioCtx.createGain()
      gain.gain.value = 0.02
      fog.connect(gain)
      gain.connect(ambienceGain)
      fog.start()
      weatherNodes = [fog, gain]
    }
  }

  function playClick() {
    if (!initialized || muted) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 620
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(gain)
    gain.connect(sfxGain)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  function playChatBlip() {
    if (!initialized || muted) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08)
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc.connect(gain)
    gain.connect(sfxGain)
    osc.start(now)
    osc.stop(now + 0.13)
  }

  function playConstruction() {
    if (!initialized || muted) return
    const now = audioCtx.currentTime

    const hit = createNoiseSource()
    const hitFilter = audioCtx.createBiquadFilter()
    hitFilter.type = 'bandpass'
    hitFilter.frequency.value = 1200
    hitFilter.Q.value = 2
    const hitGain = audioCtx.createGain()
    hitGain.gain.setValueAtTime(0.55, now)
    hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    hit.connect(hitFilter)
    hitFilter.connect(hitGain)
    hitGain.connect(sfxGain)
    hit.start(now)
    hit.stop(now + 0.13)

    const tone = audioCtx.createOscillator()
    tone.type = 'triangle'
    tone.frequency.setValueAtTime(280, now + 0.12)
    tone.frequency.exponentialRampToValueAtTime(620, now + 0.45)
    const toneGain = audioCtx.createGain()
    toneGain.gain.setValueAtTime(0.001, now + 0.12)
    toneGain.gain.linearRampToValueAtTime(0.22, now + 0.22)
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    tone.connect(toneGain)
    toneGain.connect(sfxGain)
    tone.start(now + 0.12)
    tone.stop(now + 0.56)
  }

  function setDayPhase(phase) {
    if (!phase || phase === currentDayPhase) return
    currentDayPhase = phase
    if (initialized) updateMusic()
  }

  function installGlobalInteractionHooks() {
    const unlock = async () => {
      await resume()
    }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
  }

  attachToggleButton()
  installGlobalInteractionHooks()

  window.WorldAudio = {
    resume,
    setMuted,
    toggleMute,
    playClick,
    playChatBlip,
    playConstruction,
    setWeather,
    setDayPhase,
    attachToggleButton,
    get muted() {
      return muted
    }
  }
})()
