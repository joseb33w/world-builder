import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

try {
  const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
  const supabase = window.__worldBuilderSupabase || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
      storageKey: 'sb-xhhmxabftbyxrirvvihn-auth-token'
    }
  })

  const TABLES = {
    buildings: 'uNMexs7BYTXQ2_world_builder_buildings',
    chat: 'uNMexs7BYTXQ2_world_builder_chat_messages'
  }

  const GRID_SIZE = 20
  const TILE_W = 64
  const TILE_H = 32
  const DAY_CYCLE_MS = 120000
  const WEATHER_TYPES = ['sunny', 'cloudy', 'rain', 'snow', 'fog']
  const WEATHER_ICONS = { sunny: 'fa-sun', cloudy: 'fa-cloud', rain: 'fa-cloud-rain', snow: 'fa-snowflake', fog: 'fa-smog' }

  const BUILDING_TYPES = {
    house: { emoji: 'HOUSE', baseColor: '#4ade80', floors: 2 },
    shop: { emoji: 'SHOP', baseColor: '#fbbf24', floors: 1 },
    factory: { emoji: 'FACTORY', baseColor: '#9ca3af', floors: 2 },
    castle: { emoji: 'CASTLE', baseColor: '#a78bfa', floors: 4 },
    tower: { emoji: 'TOWER', baseColor: '#60a5fa', floors: 5 },
    church: { emoji: 'CHURCH', baseColor: '#f9fafb', floors: 3 },
    stadium: { emoji: 'STADIUM', baseColor: '#34d399', floors: 2 },
    hospital: { emoji: 'HOSPITAL', baseColor: '#fca5a5', floors: 3 },
    school: { emoji: 'SCHOOL', baseColor: '#fde68a', floors: 2 },
    restaurant: { emoji: 'RESTAURANT', baseColor: '#fb923c', floors: 1 },
    hotel: { emoji: 'HOTEL', baseColor: '#c084fc', floors: 4 },
    park: { emoji: 'PARK', baseColor: '#86efac', floors: 0 },
    fountain: { emoji: 'FOUNTAIN', baseColor: '#67e8f9', floors: 0 },
    skyscraper: { emoji: 'SKYSCRAPER', baseColor: '#93c5fd', floors: 6 },
    library: { emoji: 'LIBRARY', baseColor: '#d4a574', floors: 2 },
    museum: { emoji: 'MUSEUM', baseColor: '#e2e8f0', floors: 2 },
    default: { emoji: 'BUILD', baseColor: '#a5b4fc', floors: 2 }
  }

  const state = {
    session: null,
    user: null,
    authReady: false,
    playerName: '',
    entered: false,
    buildings: [],
    chatMessages: [],
    occupiedTiles: new Set(),
    camera: { x: 0, y: -40, zoom: 1 },
    drawerOpen: false,
    weather: 'sunny',
    dayTime: 0,
    toastText: '',
    toastTimeout: null,
    buildBusy: false
  }

  const app = document.getElementById('app')
  let canvas = null
  let ctx = null
  let weatherCanvas = null
  let weatherCtx = null
  let animationStarted = false
  let realtimeChannel = null

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function toast(message) {
    state.toastText = message
    if (state.toastTimeout) clearTimeout(state.toastTimeout)
    state.toastTimeout = setTimeout(() => {
      state.toastText = ''
      renderUI()
    }, 2200)
    renderUI()
  }

  function fmtTime(value) {
    if (!value) return ''
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function hexToRgb(hex) {
    const safe = String(hex || '#a5b4fc').replace('#', '')
    const r = parseInt(safe.slice(0, 2), 16)
    const g = parseInt(safe.slice(2, 4), 16)
    const b = parseInt(safe.slice(4, 6), 16)
    return { r, g, b }
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
  }

  function shadeColor(hex, factor) {
    const { r, g, b } = hexToRgb(hex)
    return rgbToHex(r * factor, g * factor, b * factor)
  }

  function isoToScreen(gx, gy) {
    return {
      x: (gx - gy) * (TILE_W / 2),
      y: (gx + gy) * (TILE_H / 2)
    }
  }

  function worldToCanvas(wx, wy) {
    if (!canvas) return { x: 0, y: 0 }
    return {
      x: canvas.width / 2 + (wx + state.camera.x) * state.camera.zoom,
      y: canvas.height / 2 + (wy + state.camera.y) * state.camera.zoom
    }
  }

  function parseDescription(text) {
    const lower = String(text || '').toLowerCase()
    let buildingType = 'default'
    for (const key of Object.keys(BUILDING_TYPES)) {
      if (key !== 'default' && lower.includes(key)) {
        buildingType = key
        break
      }
    }
    if (buildingType === 'default') {
      if (/glass|skyscraper|high.?rise|sky.?scraper/i.test(lower)) buildingType = 'skyscraper'
      else if (/cafe|coffee|bakery|diner/i.test(lower)) buildingType = 'restaurant'
      else if (/garden|tree|green|park/i.test(lower)) buildingType = 'park'
      else if (/water|fountain|splash/i.test(lower)) buildingType = 'fountain'
      else if (/store|market|mall|boutique/i.test(lower)) buildingType = 'shop'
      else if (/fort|stronghold/i.test(lower)) buildingType = 'castle'
      else if (/warehouse|plant|mill/i.test(lower)) buildingType = 'factory'
      else if (/clinic|medical/i.test(lower)) buildingType = 'hospital'
      else if (/arena|court|field/i.test(lower)) buildingType = 'stadium'
      else if (/temple|cathedral|chapel|mosque|synagogue/i.test(lower)) buildingType = 'church'
      else if (/inn|lodge|motel|hotel/i.test(lower)) buildingType = 'hotel'
      else if (/college|university|academy|school/i.test(lower)) buildingType = 'school'
      else if (/book|read|library/i.test(lower)) buildingType = 'library'
      else if (/art|exhibit|gallery|museum/i.test(lower)) buildingType = 'museum'
      else if (/tower/i.test(lower)) buildingType = 'tower'
    }

    let floors = BUILDING_TYPES[buildingType]?.floors || 2
    if (/tiny|small|little|mini|low/i.test(lower)) floors = Math.max(1, floors - 1)
    if (/tall|high|big|large/i.test(lower)) floors = Math.min(8, floors + 2)
    if (/massive|huge|enormous|giant|mega|colossal/i.test(lower)) floors = Math.min(10, floors + 4)

    let color = BUILDING_TYPES[buildingType]?.baseColor || '#a5b4fc'
    const colorMap = {
      red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', pink: '#ec4899', orange: '#f97316', white: '#f8fafc', black: '#1f2937', gold: '#fbbf24', silver: '#d1d5db', cyan: '#06b6d4', teal: '#14b8a6', brown: '#92400e', crimson: '#dc2626', navy: '#1e3a5f', emerald: '#059669', ruby: '#e11d48', sapphire: '#2563eb', amber: '#d97706'
    }
    for (const [name, hex] of Object.entries(colorMap)) {
      if (lower.includes(name)) {
        color = hex
        break
      }
    }

    return {
      building_type: buildingType,
      floors,
      color,
      description: text
    }
  }

  function rebuildOccupiedTiles() {
    state.occupiedTiles = new Set(state.buildings.map(b => `${b.grid_x},${b.grid_y}`))
  }

  function findNextTile() {
    const center = Math.floor(GRID_SIZE / 2)
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const gx = center + dx
          const gy = center + dy
          if (gx < 0 || gy < 0 || gx >= GRID_SIZE || gy >= GRID_SIZE) continue
          const key = `${gx},${gy}`
          if (!state.occupiedTiles.has(key)) return { gx, gy }
        }
      }
    }
    return null
  }

  async function loadBuildings() {
    const { data, error } = await supabase.from(TABLES.buildings).select('*').order('created_at', { ascending: true })
    if (error) throw error
    state.buildings = Array.isArray(data) ? data : []
    rebuildOccupiedTiles()
  }

  async function loadChatMessages() {
    const { data, error } = await supabase.from(TABLES.chat).select('*').order('created_at', { ascending: true }).limit(50)
    if (error) throw error
    state.chatMessages = Array.isArray(data) ? data : []
  }

  async function loadAllData() {
    await Promise.all([loadBuildings(), loadChatMessages()])
  }

  async function placeBuilding(description) {
    const tile = findNextTile()
    if (!tile) {
      toast('The city grid is full.')
      return
    }

    const parsed = parseDescription(description)
    const payload = {
      user_id: state.user?.id || null,
      player_name: state.playerName || state.user?.email?.split('@')[0] || 'Builder',
      description,
      building_type: parsed.building_type,
      color: parsed.color,
      floors: parsed.floors,
      grid_x: tile.gx,
      grid_y: tile.gy
    }

    const { error } = await supabase.from(TABLES.buildings).insert(payload)
    if (error) throw error
    window.WorldAudio?.playConstruction?.()
    toast('Building added to the world.')
  }

  async function sendChatMessage(text) {
    const message = String(text || '').trim()
    if (!message) return
    const payload = {
      user_id: state.user?.id || null,
      player_name: state.playerName || state.user?.email?.split('@')[0] || 'Builder',
      message
    }
    const { error } = await supabase.from(TABLES.chat).insert(payload)
    if (error) throw error
  }

  function renderTopbar() {
    return `
      <div class="topbar">
        <div class="city-title">WORLD BUILDER</div>
        <div class="stats">
          <span class="stat-badge builds"><i class="fa-solid fa-city"></i>${state.buildings.length} builds</span>
          <span class="stat-badge weather"><i class="fa-solid ${WEATHER_ICONS[state.weather] || 'fa-cloud'}"></i>${state.weather}</span>
          <span class="stat-badge happy"><i class="fa-solid fa-user"></i>${esc(state.playerName || 'Builder')}</span>
        </div>
      </div>
    `
  }

  function renderNameScreen() {
    return `
      <div class="name-screen">
        <div class="name-card">
          <div class="logo"><i class="fa-solid fa-cubes"></i></div>
          <h1>World Builder</h1>
          <p>Your email and password login appears first when the app opens. After signing in, choose the builder name shown in the shared world.</p>
          <input id="player-name" type="text" maxlength="24" placeholder="Enter your builder name" value="${esc(state.playerName)}">
          <button id="enter-world">Enter World</button>
        </div>
      </div>
    `
  }

  function renderBuildPanel() {
    return `
      <div class="build-panel">
        <div class="build-row">
          <input id="build-input" class="build-input" type="text" placeholder="Describe a building, like tall red castle with a moat" ${state.buildBusy ? 'disabled' : ''}>
          <button id="build-btn" class="build-btn" ${state.buildBusy ? 'disabled' : ''}><i class="fa-solid fa-hammer"></i>${state.buildBusy ? 'Building...' : 'Build'}</button>
        </div>
        <div class="build-hint">Examples: futuristic glass skyscraper, tiny rustic bakery, giant emerald stadium</div>
      </div>
    `
  }

  function renderDrawer() {
    const leaderboard = Object.entries(state.buildings.reduce((acc, building) => {
      const key = building.player_name || 'Builder'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})).sort((a, b) => b[1] - a[1])

    return `
      <button class="drawer-toggle" id="drawer-toggle"><i class="fa-solid fa-bars"></i></button>
      <aside class="side-drawer ${state.drawerOpen ? 'open' : ''}">
        <div class="drawer-header">
          <h2>City Feed</h2>
          <button class="drawer-close" id="drawer-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="drawer-body">
          <section class="drawer-section">
            <h3>Leaderboard</h3>
            ${leaderboard.length ? leaderboard.map(([name, count], index) => `
              <div class="leaderboard-item">
                <div class="lb-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'normal'}">${index + 1}</div>
                <div class="lb-name">${esc(name)}</div>
                <div class="lb-count">${count}</div>
              </div>
            `).join('') : '<div class="building-log-item">No builders yet.</div>'}
          </section>

          <section class="drawer-section">
            <h3>Recent Builds</h3>
            ${state.buildings.slice().reverse().slice(0, 12).map(building => `
              <div class="building-log-item">
                <div class="bl-name">${esc(building.player_name || 'Builder')} built a ${esc(building.building_type || 'building')}</div>
                <div class="bl-desc">${esc(building.description || '')}</div>
                <div class="bl-time">${fmtTime(building.created_at)}</div>
              </div>
            `).join('') || '<div class="building-log-item">No buildings yet.</div>'}
          </section>

          <section class="drawer-section chat-section">
            <h3>Chat</h3>
            <div class="chat-messages" id="chat-messages">
              ${state.chatMessages.map(msg => `
                <div class="chat-msg">
                  <div class="cm-name">${esc(msg.player_name || 'Builder')}</div>
                  <div class="cm-text">${esc(msg.message || '')}</div>
                </div>
              `).join('') || '<div class="chat-msg"><div class="cm-text">No messages yet.</div></div>'}
            </div>
            <div class="chat-input-row">
              <input id="chat-input" type="text" placeholder="Say something to the city">
              <button id="chat-send">Send</button>
            </div>
          </section>
        </div>
      </aside>
    `
  }

  function renderToast() {
    if (!state.toastText) return ''
    return `<div style="position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:180;background:rgba(17,24,39,0.96);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px 16px;box-shadow:0 12px 32px rgba(0,0,0,0.35);">${esc(state.toastText)}</div>`
  }

  function renderGame() {
    return `
      ${renderTopbar()}
      <canvas id="game-canvas" class="game-canvas"></canvas>
      <canvas id="weather-canvas" class="game-canvas" style="pointer-events:none;"></canvas>
      ${renderDrawer()}
      ${renderBuildPanel()}
      ${renderToast()}
    `
  }

  function renderUI() {
    if (!state.authReady || !state.user) {
      app.innerHTML = ''
      return
    }

    app.innerHTML = state.entered ? renderGame() : renderNameScreen() + renderToast()
    bindEvents()
    setupCanvasRefs()
    if (state.entered) {
      startAnimation()
      drawScene()
    }
  }

  function setupCanvasRefs() {
    canvas = document.getElementById('game-canvas')
    weatherCanvas = document.getElementById('weather-canvas')
    if (canvas) ctx = canvas.getContext('2d')
    if (weatherCanvas) weatherCtx = weatherCanvas.getContext('2d')
    resizeCanvases()
  }

  function resizeCanvases() {
    if (canvas) {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    if (weatherCanvas) {
      weatherCanvas.width = window.innerWidth
      weatherCanvas.height = window.innerHeight
    }
  }

  function drawTile(gx, gy) {
    const iso = isoToScreen(gx, gy)
    const pos = worldToCanvas(iso.x, iso.y)
    const halfW = (TILE_W / 2) * state.camera.zoom
    const halfH = (TILE_H / 2) * state.camera.zoom

    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - halfH)
    ctx.lineTo(pos.x + halfW, pos.y)
    ctx.lineTo(pos.x, pos.y + halfH)
    ctx.lineTo(pos.x - halfW, pos.y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.fill()
    ctx.stroke()
  }

  function drawBuilding(building) {
    const iso = isoToScreen(building.grid_x, building.grid_y)
    const pos = worldToCanvas(iso.x, iso.y)
    const floors = Number(building.floors || 2)
    const baseColor = building.color || '#a5b4fc'
    const width = 22 * state.camera.zoom
    const depth = 22 * state.camera.zoom
    const height = Math.max(18, floors * 14) * state.camera.zoom

    ctx.fillStyle = shadeColor(baseColor, 0.75)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - height)
    ctx.lineTo(pos.x + width, pos.y - height / 2)
    ctx.lineTo(pos.x + width, pos.y + depth / 2)
    ctx.lineTo(pos.x, pos.y)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = shadeColor(baseColor, 0.58)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - height)
    ctx.lineTo(pos.x - width, pos.y - height / 2)
    ctx.lineTo(pos.x - width, pos.y + depth / 2)
    ctx.lineTo(pos.x, pos.y)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = shadeColor(baseColor, 1.08)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - height - depth / 2)
    ctx.lineTo(pos.x + width, pos.y - height / 2)
    ctx.lineTo(pos.x, pos.y)
    ctx.lineTo(pos.x - width, pos.y - height / 2)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `${Math.max(10, 11 * state.camera.zoom)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText((building.building_type || 'build').toUpperCase(), pos.x, pos.y - height / 2)
  }

  function drawWeatherOverlay() {
    if (!weatherCtx || !weatherCanvas) return
    weatherCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height)
    if (state.weather === 'rain') {
      weatherCtx.strokeStyle = 'rgba(120,180,255,0.35)'
      for (let i = 0; i < 80; i++) {
        const x = (i * 53 + Date.now() * 0.25) % weatherCanvas.width
        const y = (i * 41 + Date.now() * 0.45) % weatherCanvas.height
        weatherCtx.beginPath()
        weatherCtx.moveTo(x, y)
        weatherCtx.lineTo(x - 6, y + 14)
        weatherCtx.stroke()
      }
    } else if (state.weather === 'snow') {
      weatherCtx.fillStyle = 'rgba(255,255,255,0.6)'
      for (let i = 0; i < 60; i++) {
        const x = (i * 67 + Date.now() * 0.08) % weatherCanvas.width
        const y = (i * 59 + Date.now() * 0.12) % weatherCanvas.height
        weatherCtx.beginPath()
        weatherCtx.arc(x, y, 2, 0, Math.PI * 2)
        weatherCtx.fill()
      }
    } else if (state.weather === 'fog') {
      weatherCtx.fillStyle = 'rgba(220,230,255,0.08)'
      weatherCtx.fillRect(0, 0, weatherCanvas.width, weatherCanvas.height)
    }
  }

  function drawScene() {
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#0b1220')
    gradient.addColorStop(1, '#111827')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        drawTile(gx, gy)
      }
    }

    state.buildings.slice().sort((a, b) => (a.grid_x + a.grid_y) - (b.grid_x + b.grid_y)).forEach(drawBuilding)
    drawWeatherOverlay()
  }

  function animate() {
    if (!state.entered) return
    state.dayTime = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS
    window.WorldAudio?.setDayPhase?.(state.dayTime > 0.5 ? 'night' : 'day')
    drawScene()
    requestAnimationFrame(animate)
  }

  function startAnimation() {
    if (animationStarted) return
    animationStarted = true
    requestAnimationFrame(animate)
  }

  function randomizeWeather() {
    state.weather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)]
    window.WorldAudio?.setWeather?.(state.weather)
  }

  function bindEvents() {
    document.getElementById('enter-world')?.addEventListener('click', () => {
      const input = document.getElementById('player-name')
      const nextName = String(input?.value || '').trim() || state.user?.email?.split('@')[0] || 'Builder'
      state.playerName = nextName.slice(0, 24)
      state.entered = true
      window.WorldAudio?.resume?.()
      renderUI()
    })

    document.getElementById('player-name')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        document.getElementById('enter-world')?.click()
      }
    })

    document.getElementById('build-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('build-input')
      const value = String(input?.value || '').trim()
      if (!value || state.buildBusy) return
      state.buildBusy = true
      renderUI()
      try {
        await placeBuilding(value)
        if (input) input.value = ''
        await loadBuildings()
      } catch (error) {
        console.error('Build error:', error?.message)
        toast(error?.message || 'Could not place building.')
      } finally {
        state.buildBusy = false
        renderUI()
      }
    })

    document.getElementById('build-input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        document.getElementById('build-btn')?.click()
      }
    })

    document.getElementById('drawer-toggle')?.addEventListener('click', () => {
      state.drawerOpen = true
      window.WorldAudio?.playClick?.()
      renderUI()
    })

    document.getElementById('drawer-close')?.addEventListener('click', () => {
      state.drawerOpen = false
      window.WorldAudio?.playClick?.()
      renderUI()
    })

    document.getElementById('chat-send')?.addEventListener('click', async () => {
      const input = document.getElementById('chat-input')
      const value = String(input?.value || '').trim()
      if (!value) return
      try {
        await sendChatMessage(value)
        if (input) input.value = ''
        window.WorldAudio?.playChatBlip?.()
        await loadChatMessages()
        renderUI()
      } catch (error) {
        console.error('Chat error:', error?.message)
        toast(error?.message || 'Could not send chat message.')
      }
    })

    document.getElementById('chat-input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        document.getElementById('chat-send')?.click()
      }
    })

    window.addEventListener('resize', resizeCanvases)
  }

  function setupRealtime() {
    if (realtimeChannel) return
    realtimeChannel = supabase.channel('world-builder-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.buildings }, async () => {
        await loadBuildings()
        renderUI()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.chat }, async () => {
        await loadChatMessages()
        window.WorldAudio?.playChatBlip?.()
        renderUI()
      })
      .subscribe()
  }

  async function handleSession(session) {
    state.session = session || null
    state.user = session?.user || null
    state.authReady = true

    if (!state.user) {
      state.entered = false
      state.playerName = ''
      renderUI()
      return
    }

    if (!state.playerName) {
      state.playerName = state.user.email?.split('@')[0] || 'Builder'
    }

    await loadAllData()
    setupRealtime()
    randomizeWeather()
    renderUI()
  }

  async function init() {
    try {
      app.innerHTML = ''
      const { data: { session } } = await supabase.auth.getSession()
      await handleSession(session)
      supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        try {
          await handleSession(nextSession)
        } catch (error) {
          console.error('Auth state error:', error?.message)
        }
      })
    } catch (error) {
      console.error('Init error:', error?.message, error?.stack)
      state.authReady = true
      renderUI()
    }
  }

  init()
} catch (error) {
  console.error('World Builder fatal error:', error?.message, error?.stack)
}
