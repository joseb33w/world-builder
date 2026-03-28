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
    house: { emoji: '🏠', label: 'House', baseColor: '#4ade80', floors: 2 },
    shop: { emoji: '🏪', label: 'Shop', baseColor: '#fbbf24', floors: 1 },
    factory: { emoji: '🏭', label: 'Factory', baseColor: '#9ca3af', floors: 2 },
    castle: { emoji: '🏰', label: 'Castle', baseColor: '#a78bfa', floors: 4 },
    tower: { emoji: '🗼', label: 'Tower', baseColor: '#60a5fa', floors: 5 },
    church: { emoji: '⛪', label: 'Church', baseColor: '#f9fafb', floors: 3 },
    stadium: { emoji: '🏟️', label: 'Stadium', baseColor: '#34d399', floors: 2 },
    hospital: { emoji: '🏥', label: 'Hospital', baseColor: '#fca5a5', floors: 3 },
    school: { emoji: '🏫', label: 'School', baseColor: '#fde68a', floors: 2 },
    restaurant: { emoji: '🍽️', label: 'Restaurant', baseColor: '#fb923c', floors: 1 },
    hotel: { emoji: '🏨', label: 'Hotel', baseColor: '#c084fc', floors: 4 },
    park: { emoji: '🌳', label: 'Park', baseColor: '#86efac', floors: 0 },
    fountain: { emoji: '⛲', label: 'Fountain', baseColor: '#67e8f9', floors: 0 },
    skyscraper: { emoji: '🏙️', label: 'Skyscraper', baseColor: '#93c5fd', floors: 6 },
    library: { emoji: '📚', label: 'Library', baseColor: '#d4a574', floors: 2 },
    museum: { emoji: '🖼️', label: 'Museum', baseColor: '#e2e8f0', floors: 2 },
    default: { emoji: '🏗️', label: 'Build', baseColor: '#a5b4fc', floors: 2 }
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
    buildBusy: false,
    selectedBuildingId: null,
    weatherParticles: [],
    npcs: []
  }

  const app = document.getElementById('app')
  let canvas = null
  let ctx = null
  let weatherCanvas = null
  let weatherCtx = null
  let animationStarted = false
  let realtimeChannel = null
  let resizeBound = false
  let animationFrame = null
  let weatherTimer = null
  let dayTimer = null

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

  function screenToWorld(x, y) {
    if (!canvas) return { x: 0, y: 0 }
    return {
      x: (x - canvas.width / 2) / state.camera.zoom - state.camera.x,
      y: (y - canvas.height / 2) / state.camera.zoom - state.camera.y
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
      else if (/house|home|cottage|villa/i.test(lower)) buildingType = 'house'
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

    const style = /medieval/.test(lower)
      ? 'medieval'
      : /futuristic|neon|cyber/.test(lower)
        ? 'futuristic'
        : /rustic|wood|farm/.test(lower)
          ? 'rustic'
          : 'modern'

    return {
      building_type: buildingType,
      floors,
      color,
      style,
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
    window.WorldAudio?.resume?.()
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
    window.WorldAudio?.resume?.()
    window.WorldAudio?.playChatBlip?.()
  }

  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (error) {
      console.error('Sign out error:', error?.message)
    }
    state.session = null
    state.user = null
    state.entered = false
    state.playerName = ''
    state.selectedBuildingId = null
    renderUI()
    if (window.__worldBuilderShowAuthOverlay) {
      await window.__worldBuilderShowAuthOverlay()
      const { data: { session } } = await supabase.auth.getSession()
      await bootFromSession(session)
    }
  }

  function getLeaderboard() {
    const counts = new Map()
    state.buildings.forEach(building => {
      const name = building.player_name || 'Builder'
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }

  function renderTopbar() {
    return `
      <div class="topbar">
        <div class="city-title">WORLD BUILDER</div>
        <div class="stats">
          <span class="stat-badge builds"><i class="fa-solid fa-city"></i>${state.buildings.length} builds</span>
          <span class="stat-badge weather"><i class="fa-solid ${WEATHER_ICONS[state.weather] || 'fa-cloud'}"></i>${state.weather}</span>
          <span class="stat-badge happy"><i class="fa-solid fa-user"></i>${esc(state.playerName || 'Builder')}</span>
          <button class="topbar-btn" id="wb-logout-btn"><i class="fa-solid fa-right-from-bracket"></i><span>Log out</span></button>
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
          <p>Your email and password login appears first when the app opens. After signing in, choose the builder name other players will see in the world and start creating.</p>
          <form id="name-form">
            <input id="player-name-input" maxlength="24" placeholder="Choose your builder name" value="${esc(state.playerName || state.user?.email?.split('@')[0] || '')}">
            <button type="submit">Enter the world</button>
          </form>
        </div>
      </div>
    `
  }

  function renderDrawer() {
    const leaderboard = getLeaderboard()
    return `
      <button class="drawer-toggle" id="drawer-toggle" aria-label="Open drawer"><i class="fa-solid fa-bars"></i></button>
      <aside class="side-drawer ${state.drawerOpen ? 'open' : ''}">
        <div class="drawer-header">
          <h2>City Feed</h2>
          <button class="drawer-close" id="drawer-close" aria-label="Close drawer"><i class="fa-solid fa-xmark"></i></button>
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
            `).join('') : '<div class="building-log-item"><div class="bl-desc">No builders yet.</div></div>'}
          </section>

          <section class="drawer-section">
            <h3>Building Log</h3>
            ${state.buildings.slice().reverse().slice(0, 12).map(building => {
              const meta = BUILDING_TYPES[building.building_type] || BUILDING_TYPES.default
              return `
                <div class="building-log-item">
                  <div class="bl-name">${meta.emoji} ${esc(meta.label)}</div>
                  <div class="bl-desc">${esc(building.description || 'A new structure was added.')}</div>
                  <div class="bl-time">${esc(building.player_name || 'Builder')} · ${fmtTime(building.created_at)}</div>
                </div>
              `
            }).join('') || '<div class="building-log-item"><div class="bl-desc">Nothing built yet. Be the first.</div></div>'}
          </section>

          <section class="drawer-section chat-section">
            <h3>Live Chat</h3>
            <div class="chat-messages" id="chat-messages">
              ${state.chatMessages.map(msg => `
                <div class="chat-msg">
                  <div class="cm-name">${esc(msg.player_name || 'Builder')}</div>
                  <div class="cm-text">${esc(msg.message || '')}</div>
                </div>
              `).join('') || '<div class="chat-msg"><div class="cm-text">Say hello to the city.</div></div>'}
            </div>
            <form id="chat-form" class="chat-input-row">
              <input id="chat-input" maxlength="140" placeholder="Message the city...">
              <button type="submit">Send</button>
            </form>
          </section>
        </div>
      </aside>
    `
  }

  function renderBuildPanel() {
    return `
      <div class="build-panel">
        <form id="build-form" class="build-row">
          <input id="build-input" class="build-input" maxlength="160" placeholder="Describe a building, like: futuristic glass tower with neon lights" ${state.buildBusy ? 'disabled' : ''}>
          <button class="build-btn" type="submit" ${state.buildBusy ? 'disabled' : ''}><i class="fa-solid fa-hammer"></i>${state.buildBusy ? 'Building...' : 'Build'}</button>
        </form>
        <div class="build-hint">Try: medieval castle, cozy bakery, giant stadium, snowy hospital, neon skyscraper.</div>
      </div>
    `
  }

  function renderPopup() {
    const building = state.buildings.find(item => item.id === state.selectedBuildingId)
    if (!building || !canvas) return ''
    const iso = isoToScreen(building.grid_x, building.grid_y)
    const point = worldToCanvas(iso.x, iso.y - (building.floors || 1) * 18 - 60)
    const meta = BUILDING_TYPES[building.building_type] || BUILDING_TYPES.default
    return `
      <div class="building-popup" style="left:${Math.max(12, Math.min(point.x - 110, window.innerWidth - 292))}px; top:${Math.max(70, point.y)}px;">
        <button class="bp-close" id="popup-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="bp-type">${meta.emoji} ${esc(meta.label)}</div>
        <div class="bp-desc">${esc(building.description || '')}</div>
        <div class="bp-builder">Built by <strong>${esc(building.player_name || 'Builder')}</strong></div>
        <div class="bp-time">${fmtTime(building.created_at)}</div>
      </div>
    `
  }

  function renderGameShell() {
    return `
      ${renderTopbar()}
      <div class="daynight-overlay" id="daynight-overlay"></div>
      <canvas id="game-canvas" class="game-canvas"></canvas>
      <canvas id="weather-canvas" class="weather-canvas"></canvas>
      ${renderDrawer()}
      ${renderBuildPanel()}
      ${renderPopup()}
      ${state.toastText ? `<div class="toast">${esc(state.toastText)}</div>` : ''}
    `
  }

  function renderUI() {
    if (!state.user) {
      app.innerHTML = ''
      return
    }
    if (!state.entered) {
      app.innerHTML = renderNameScreen()
      bindUIEvents()
      return
    }
    app.innerHTML = renderGameShell()
    bindUIEvents()
    ensureCanvasRefs()
    syncOverlayState()
    if (!animationStarted) startAnimation()
  }

  function ensureCanvasRefs() {
    canvas = document.getElementById('game-canvas')
    weatherCanvas = document.getElementById('weather-canvas')
    if (canvas) ctx = canvas.getContext('2d')
    if (weatherCanvas) weatherCtx = weatherCanvas.getContext('2d')
    resizeCanvases()
    if (!resizeBound) {
      resizeBound = true
      window.addEventListener('resize', resizeCanvases)
    }
    setupCanvasInteractions()
  }

  function resizeCanvases() {
    if (canvas) {
      canvas.width = window.innerWidth * Math.max(1, window.devicePixelRatio || 1)
      canvas.height = window.innerHeight * Math.max(1, window.devicePixelRatio || 1)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx?.setTransform(1, 0, 0, 1, 0, 0)
      ctx?.scale(Math.max(1, window.devicePixelRatio || 1), Math.max(1, window.devicePixelRatio || 1))
    }
    if (weatherCanvas) {
      weatherCanvas.width = window.innerWidth * Math.max(1, window.devicePixelRatio || 1)
      weatherCanvas.height = window.innerHeight * Math.max(1, window.devicePixelRatio || 1)
      weatherCanvas.style.width = `${window.innerWidth}px`
      weatherCanvas.style.height = `${window.innerHeight}px`
      weatherCtx?.setTransform(1, 0, 0, 1, 0, 0)
      weatherCtx?.scale(Math.max(1, window.devicePixelRatio || 1), Math.max(1, window.devicePixelRatio || 1))
    }
  }

  function syncOverlayState() {
    const overlay = document.getElementById('daynight-overlay')
    if (!overlay) return
    const t = state.dayTime
    const brightness = Math.sin(t * Math.PI * 2) * 0.5 + 0.5
    const darkness = 1 - brightness
    overlay.style.background = `linear-gradient(180deg, rgba(10,14,26,${0.08 + darkness * 0.28}), rgba(10,14,26,${0.02 + darkness * 0.46}))`
    window.WorldAudio?.setWeather?.(state.weather)
    window.WorldAudio?.setDayPhase?.(brightness < 0.38 ? 'night' : 'day')
  }

  function initNPCs() {
    if (state.npcs.length) return
    for (let i = 0; i < 10; i++) {
      state.npcs.push({
        x: Math.random() * GRID_SIZE,
        y: Math.random() * GRID_SIZE,
        dx: Math.random() > 0.5 ? 1 : -1,
        dy: Math.random() > 0.5 ? 1 : -1,
        speed: 0.004 + Math.random() * 0.008,
        type: i < 6 ? 'walker' : 'car',
        color: i < 6 ? '#fbbf24' : '#22d3ee'
      })
    }
  }

  function initWeatherParticles() {
    state.weatherParticles = Array.from({ length: 80 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 1 + Math.random() * 3,
      speed: 1 + Math.random() * 2,
      drift: -0.5 + Math.random()
    }))
  }

  function updateWeatherParticles() {
    if (!weatherCtx || !weatherCanvas) return
    weatherCtx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    if (!state.weatherParticles.length) initWeatherParticles()
    if (state.weather === 'sunny' || state.weather === 'cloudy') return

    weatherCtx.save()
    if (state.weather === 'rain') {
      weatherCtx.strokeStyle = 'rgba(125, 211, 252, 0.55)'
      weatherCtx.lineWidth = 1.2
      state.weatherParticles.forEach(p => {
        weatherCtx.beginPath()
        weatherCtx.moveTo(p.x, p.y)
        weatherCtx.lineTo(p.x + p.drift * 3, p.y + p.speed * 8)
        weatherCtx.stroke()
        p.x += p.drift * 1.2
        p.y += p.speed * 3.2
        if (p.y > window.innerHeight) {
          p.y = -10
          p.x = Math.random() * window.innerWidth
        }
      })
    } else if (state.weather === 'snow') {
      weatherCtx.fillStyle = 'rgba(255,255,255,0.85)'
      state.weatherParticles.forEach(p => {
        weatherCtx.beginPath()
        weatherCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        weatherCtx.fill()
        p.x += p.drift * 0.8
        p.y += p.speed * 0.8
        if (p.y > window.innerHeight) {
          p.y = -10
          p.x = Math.random() * window.innerWidth
        }
      })
    } else if (state.weather === 'fog') {
      state.weatherParticles.slice(0, 18).forEach((p, i) => {
        const radius = 40 + (i % 4) * 22
        const gradient = weatherCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius)
        gradient.addColorStop(0, 'rgba(226,232,240,0.08)')
        gradient.addColorStop(1, 'rgba(226,232,240,0)')
        weatherCtx.fillStyle = gradient
        weatherCtx.beginPath()
        weatherCtx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        weatherCtx.fill()
        p.x += 0.18 + p.drift * 0.2
        if (p.x > window.innerWidth + 60) p.x = -60
      })
    }
    weatherCtx.restore()
  }

  function drawTile(gx, gy) {
    const iso = isoToScreen(gx, gy)
    const point = worldToCanvas(iso.x, iso.y)
    const halfW = (TILE_W / 2) * state.camera.zoom
    const halfH = (TILE_H / 2) * state.camera.zoom
    ctx.beginPath()
    ctx.moveTo(point.x, point.y - halfH)
    ctx.lineTo(point.x + halfW, point.y)
    ctx.lineTo(point.x, point.y + halfH)
    ctx.lineTo(point.x - halfW, point.y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.stroke()
  }

  function drawBuilding(building) {
    const iso = isoToScreen(building.grid_x, building.grid_y)
    const point = worldToCanvas(iso.x, iso.y)
    const floors = Math.max(0, Number(building.floors) || 0)
    const meta = BUILDING_TYPES[building.building_type] || BUILDING_TYPES.default
    const width = 20 * state.camera.zoom
    const depth = 20 * state.camera.zoom
    const floorHeight = 16 * state.camera.zoom
    const totalHeight = Math.max(floorHeight, floors * floorHeight)
    const baseColor = building.color || meta.baseColor
    const leftColor = shadeColor(baseColor, 0.78)
    const rightColor = shadeColor(baseColor, 0.58)
    const topColor = shadeColor(baseColor, 1.08)

    ctx.save()

    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath()
    ctx.ellipse(point.x, point.y + 10 * state.camera.zoom, width * 1.15, depth * 0.58, 0, 0, Math.PI * 2)
    ctx.fill()

    if (meta.label === 'Park') {
      ctx.fillStyle = 'rgba(34,197,94,0.75)'
      ctx.beginPath()
      ctx.moveTo(point.x, point.y - depth)
      ctx.lineTo(point.x + width, point.y)
      ctx.lineTo(point.x, point.y + depth)
      ctx.lineTo(point.x - width, point.y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#166534'
      ctx.beginPath()
      ctx.arc(point.x, point.y - 18 * state.camera.zoom, 12 * state.camera.zoom, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#92400e'
      ctx.fillRect(point.x - 2 * state.camera.zoom, point.y - 10 * state.camera.zoom, 4 * state.camera.zoom, 14 * state.camera.zoom)
    } else if (meta.label === 'Fountain') {
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.ellipse(point.x, point.y, width, depth * 0.8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#dbeafe'
      ctx.fillRect(point.x - 3 * state.camera.zoom, point.y - 20 * state.camera.zoom, 6 * state.camera.zoom, 20 * state.camera.zoom)
      ctx.beginPath()
      ctx.arc(point.x, point.y - 24 * state.camera.zoom, 6 * state.camera.zoom, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(point.x, point.y - totalHeight - depth)
      ctx.lineTo(point.x + width, point.y - totalHeight)
      ctx.lineTo(point.x, point.y - totalHeight + depth)
      ctx.lineTo(point.x - width, point.y - totalHeight)
      ctx.closePath()
      ctx.fillStyle = topColor
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(point.x - width, point.y - totalHeight)
      ctx.lineTo(point.x, point.y - totalHeight + depth)
      ctx.lineTo(point.x, point.y + depth)
      ctx.lineTo(point.x - width, point.y)
      ctx.closePath()
      ctx.fillStyle = leftColor
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(point.x + width, point.y - totalHeight)
      ctx.lineTo(point.x, point.y - totalHeight + depth)
      ctx.lineTo(point.x, point.y + depth)
      ctx.lineTo(point.x + width, point.y)
      ctx.closePath()
      ctx.fillStyle = rightColor
      ctx.fill()

      const windowRows = Math.max(1, Math.min(6, floors))
      for (let i = 0; i < windowRows; i++) {
        const wy = point.y - totalHeight + 8 * state.camera.zoom + i * 12 * state.camera.zoom
        ctx.fillStyle = state.dayTime > 0.68 || state.dayTime < 0.22 ? 'rgba(251,191,36,0.9)' : 'rgba(224,231,255,0.55)'
        ctx.fillRect(point.x - width * 0.68, wy, 5 * state.camera.zoom, 7 * state.camera.zoom)
        ctx.fillRect(point.x + width * 0.32, wy, 5 * state.camera.zoom, 7 * state.camera.zoom)
      }

      if (/castle|church|tower/.test(building.building_type || '')) {
        ctx.fillStyle = shadeColor(baseColor, 0.72)
        ctx.beginPath()
        ctx.moveTo(point.x, point.y - totalHeight - depth - 18 * state.camera.zoom)
        ctx.lineTo(point.x + 8 * state.camera.zoom, point.y - totalHeight - depth + 4 * state.camera.zoom)
        ctx.lineTo(point.x - 8 * state.camera.zoom, point.y - totalHeight - depth + 4 * state.camera.zoom)
        ctx.closePath()
        ctx.fill()
      }
    }

    if (state.selectedBuildingId === building.id) {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(point.x, point.y - depth - totalHeight - 8 * state.camera.zoom)
      ctx.lineTo(point.x + width + 8 * state.camera.zoom, point.y - totalHeight)
      ctx.lineTo(point.x, point.y + depth + 8 * state.camera.zoom)
      ctx.lineTo(point.x - width - 8 * state.camera.zoom, point.y - totalHeight)
      ctx.closePath()
      ctx.stroke()
    }

    ctx.font = `${Math.max(10, 11 * state.camera.zoom)}px Inter`
    ctx.fillStyle = 'rgba(240,244,255,0.92)'
    ctx.textAlign = 'center'
    ctx.fillText(meta.emoji, point.x, point.y - totalHeight - depth - 12 * state.camera.zoom)
    ctx.restore()
  }

  function updateNPCs() {
    initNPCs()
    state.npcs.forEach(npc => {
      npc.x += npc.dx * npc.speed
      npc.y += npc.dy * npc.speed
      if (npc.x < 0 || npc.x > GRID_SIZE - 1) npc.dx *= -1
      if (npc.y < 0 || npc.y > GRID_SIZE - 1) npc.dy *= -1
    })
  }

  function drawNPCs() {
    state.npcs.forEach(npc => {
      const iso = isoToScreen(npc.x, npc.y)
      const point = worldToCanvas(iso.x, iso.y)
      ctx.save()
      ctx.fillStyle = npc.color
      if (npc.type === 'walker') {
        ctx.beginPath()
        ctx.arc(point.x, point.y - 8 * state.camera.zoom, 4 * state.camera.zoom, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(point.x - 2 * state.camera.zoom, point.y - 4 * state.camera.zoom, 4 * state.camera.zoom, 10 * state.camera.zoom)
      } else {
        ctx.fillRect(point.x - 8 * state.camera.zoom, point.y - 4 * state.camera.zoom, 16 * state.camera.zoom, 8 * state.camera.zoom)
      }
      ctx.restore()
    })
  }

  function drawScene() {
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    const sky = ctx.createLinearGradient(0, 0, 0, window.innerHeight)
    const daylight = Math.sin(state.dayTime * Math.PI * 2) * 0.5 + 0.5
    if (daylight < 0.35) {
      sky.addColorStop(0, '#0b1120')
      sky.addColorStop(1, '#111827')
    } else {
      sky.addColorStop(0, '#10203d')
      sky.addColorStop(1, '#1e293b')
    }
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        drawTile(gx, gy)
      }
    }

    const sortedBuildings = [...state.buildings].sort((a, b) => (a.grid_x + a.grid_y) - (b.grid_x + b.grid_y))
    sortedBuildings.forEach(drawBuilding)
    updateNPCs()
    drawNPCs()
    updateWeatherParticles()
  }

  function animate() {
    drawScene()
    animationFrame = requestAnimationFrame(animate)
  }

  function startAnimation() {
    if (animationStarted) return
    animationStarted = true
    initWeatherParticles()
    animate()
  }

  function cycleWeather() {
    const next = WEATHER_TYPES[(WEATHER_TYPES.indexOf(state.weather) + 1) % WEATHER_TYPES.length]
    state.weather = next
    initWeatherParticles()
    syncOverlayState()
    renderUI()
  }

  function startWorldTimers() {
    if (!weatherTimer) {
      weatherTimer = setInterval(() => {
        if (!state.entered) return
        cycleWeather()
      }, 30000)
    }
    if (!dayTimer) {
      dayTimer = setInterval(() => {
        if (!state.entered) return
        state.dayTime = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS
        syncOverlayState()
      }, 1000)
    }
  }

  function getPointerPos(event) {
    const rect = canvas.getBoundingClientRect()
    const clientX = event.touches ? event.touches[0].clientX : event.clientX
    const clientY = event.touches ? event.touches[0].clientY : event.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function findBuildingAt(px, py) {
    let found = null
    let bestDistance = Infinity
    state.buildings.forEach(building => {
      const iso = isoToScreen(building.grid_x, building.grid_y)
      const point = worldToCanvas(iso.x, iso.y)
      const distance = Math.hypot(point.x - px, point.y - py)
      if (distance < 34 * state.camera.zoom && distance < bestDistance) {
        bestDistance = distance
        found = building
      }
    })
    return found
  }

  function setupCanvasInteractions() {
    if (!canvas || canvas.dataset.bound === 'true') return
    canvas.dataset.bound = 'true'

    let dragging = false
    let last = { x: 0, y: 0 }

    const startDrag = event => {
      dragging = true
      const pos = getPointerPos(event)
      last = pos
      window.WorldAudio?.resume?.()
    }

    const moveDrag = event => {
      if (!dragging) return
      const pos = getPointerPos(event)
      state.camera.x += (pos.x - last.x) / state.camera.zoom
      state.camera.y += (pos.y - last.y) / state.camera.zoom
      last = pos
    }

    const endDrag = event => {
      if (!dragging) return
      const pos = getPointerPos(event)
      const moved = Math.hypot(pos.x - last.x, pos.y - last.y)
      dragging = false
      if (moved < 8) {
        const found = findBuildingAt(pos.x, pos.y)
        state.selectedBuildingId = found?.id || null
        renderUI()
      }
    }

    canvas.addEventListener('pointerdown', startDrag)
    canvas.addEventListener('pointermove', moveDrag)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointerleave', () => { dragging = false })
    canvas.addEventListener('wheel', event => {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -0.08 : 0.08
      state.camera.zoom = Math.max(0.55, Math.min(1.8, state.camera.zoom + delta))
    }, { passive: false })
  }

  function bindUIEvents() {
    document.getElementById('wb-logout-btn')?.addEventListener('click', signOut)
    document.getElementById('drawer-toggle')?.addEventListener('click', () => {
      state.drawerOpen = true
      renderUI()
    })
    document.getElementById('drawer-close')?.addEventListener('click', () => {
      state.drawerOpen = false
      renderUI()
    })
    document.getElementById('popup-close')?.addEventListener('click', () => {
      state.selectedBuildingId = null
      renderUI()
    })
    document.getElementById('name-form')?.addEventListener('submit', event => {
      event.preventDefault()
      const input = document.getElementById('player-name-input')
      const nextName = String(input?.value || '').trim() || state.user?.email?.split('@')[0] || 'Builder'
      state.playerName = nextName.slice(0, 24)
      state.entered = true
      renderUI()
      startWorldTimers()
      window.WorldAudio?.resume?.()
    })
    document.getElementById('build-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      const input = document.getElementById('build-input')
      const text = String(input?.value || '').trim()
      if (!text || state.buildBusy) return
      state.buildBusy = true
      renderUI()
      try {
        await placeBuilding(text)
        if (input) input.value = ''
      } catch (error) {
        console.error('Build error:', error?.message)
        toast(error?.message || 'Could not build right now.')
      } finally {
        state.buildBusy = false
        renderUI()
      }
    })
    document.getElementById('chat-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      const input = document.getElementById('chat-input')
      const text = String(input?.value || '').trim()
      if (!text) return
      try {
        await sendChatMessage(text)
        input.value = ''
      } catch (error) {
        console.error('Chat error:', error?.message)
        toast(error?.message || 'Could not send chat message.')
      }
    })
  }

  function setupRealtime() {
    if (realtimeChannel) return
    realtimeChannel = supabase.channel('world-builder-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.buildings }, async () => {
        const before = state.buildings.length
        await loadBuildings()
        if (state.buildings.length > before) window.WorldAudio?.playConstruction?.()
        renderUI()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.chat }, async () => {
        const before = state.chatMessages.length
        await loadChatMessages()
        if (state.chatMessages.length > before) window.WorldAudio?.playChatBlip?.()
        renderUI()
      })
      .subscribe()
  }

  async function bootFromSession(session) {
    state.session = session || null
    state.user = session?.user || null
    state.authReady = true
    if (!state.user) {
      state.entered = false
      state.playerName = ''
      state.selectedBuildingId = null
      renderUI()
      return
    }
    state.playerName = state.playerName || state.user.email?.split('@')[0] || 'Builder'
    await loadAllData()
    renderUI()
    setupRealtime()
  }

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    await bootFromSession(session)
    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await bootFromSession(nextSession)
    })
  }

  init().catch(error => {
    console.error('Init error:', error?.message, error?.stack)
    app.innerHTML = '<div class="name-screen"><div class="name-card"><h1>World Builder</h1><p>Something went wrong while loading the city.</p></div></div>'
  })
} catch (error) {
  console.error('World Builder fatal error:', error?.message, error?.stack)
}
