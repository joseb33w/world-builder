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
    house: { emoji: '[HOUSE]', label: 'House', baseColor: '#4ade80', floors: 2 },
    shop: { emoji: '[SHOP]', label: 'Shop', baseColor: '#fbbf24', floors: 1 },
    factory: { emoji: '[FACTORY]', label: 'Factory', baseColor: '#9ca3af', floors: 2 },
    castle: { emoji: '[CASTLE]', label: 'Castle', baseColor: '#a78bfa', floors: 4 },
    tower: { emoji: '[TOWER]', label: 'Tower', baseColor: '#60a5fa', floors: 5 },
    church: { emoji: '[CHURCH]', label: 'Church', baseColor: '#f9fafb', floors: 3 },
    stadium: { emoji: '[STADIUM]', label: 'Stadium', baseColor: '#34d399', floors: 2 },
    hospital: { emoji: '[HOSPITAL]', label: 'Hospital', baseColor: '#fca5a5', floors: 3 },
    school: { emoji: '[SCHOOL]', label: 'School', baseColor: '#fde68a', floors: 2 },
    restaurant: { emoji: '[RESTAURANT]', label: 'Restaurant', baseColor: '#fb923c', floors: 1 },
    hotel: { emoji: '[HOTEL]', label: 'Hotel', baseColor: '#c084fc', floors: 4 },
    park: { emoji: '[PARK]', label: 'Park', baseColor: '#86efac', floors: 0 },
    fountain: { emoji: '[FOUNTAIN]', label: 'Fountain', baseColor: '#67e8f9', floors: 0 },
    skyscraper: { emoji: '[SKYSCRAPER]', label: 'Skyscraper', baseColor: '#93c5fd', floors: 6 },
    library: { emoji: '[LIBRARY]', label: 'Library', baseColor: '#d4a574', floors: 2 },
    museum: { emoji: '[MUSEUM]', label: 'Museum', baseColor: '#e2e8f0', floors: 2 },
    default: { emoji: '[BUILD]', label: 'Build', baseColor: '#a5b4fc', floors: 2 }
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
    npcs: [],
    drag: { active: false, x: 0, y: 0, moved: false },
    weatherIndex: 0
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
    const full = safe.length === 3 ? safe.split('').map(ch => ch + ch).join('') : safe
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
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
      x: canvas.clientWidth / 2 + (wx + state.camera.x) * state.camera.zoom,
      y: canvas.clientHeight / 2 + (wy + state.camera.y) * state.camera.zoom
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

  function topBuilders() {
    const counts = new Map()
    state.buildings.forEach(building => {
      const name = building.player_name || 'Builder'
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }

  function ensureNpcs() {
    if (state.npcs.length) return
    state.npcs = Array.from({ length: 6 }).map((_, index) => ({
      id: `npc-${index}`,
      x: Math.random() * GRID_SIZE,
      y: Math.random() * GRID_SIZE,
      dx: Math.random() > 0.5 ? 1 : -1,
      dy: Math.random() > 0.5 ? 1 : -1,
      speed: 0.002 + Math.random() * 0.002,
      color: ['#fbbf24', '#34d399', '#22d3ee', '#f472b6'][index % 4]
    }))
  }

  function updateNpcs() {
    ensureNpcs()
    state.npcs.forEach(npc => {
      npc.x += npc.dx * npc.speed * 16
      npc.y += npc.dy * npc.speed * 16
      if (npc.x < 0 || npc.x > GRID_SIZE - 1) npc.dx *= -1
      if (npc.y < 0 || npc.y > GRID_SIZE - 1) npc.dy *= -1
      npc.x = Math.max(0, Math.min(GRID_SIZE - 1, npc.x))
      npc.y = Math.max(0, Math.min(GRID_SIZE - 1, npc.y))
    })
  }

  function updateWeatherParticles() {
    if (!weatherCanvas) return
    const maxParticles = state.weather === 'rain' ? 70 : state.weather === 'snow' ? 45 : state.weather === 'fog' ? 18 : 0
    if (!maxParticles) {
      state.weatherParticles = []
      return
    }
    while (state.weatherParticles.length < maxParticles) {
      state.weatherParticles.push({
        x: Math.random() * weatherCanvas.clientWidth,
        y: Math.random() * weatherCanvas.clientHeight,
        speed: state.weather === 'rain' ? 7 + Math.random() * 6 : 1 + Math.random() * 2,
        size: state.weather === 'fog' ? 50 + Math.random() * 90 : 1 + Math.random() * 3
      })
    }
    state.weatherParticles = state.weatherParticles.slice(0, maxParticles)
    state.weatherParticles.forEach(p => {
      p.y += p.speed
      if (state.weather === 'rain') p.x -= 1.2
      if (p.y > weatherCanvas.clientHeight + 20 || p.x < -20) {
        p.x = Math.random() * weatherCanvas.clientWidth
        p.y = -20
      }
    })
  }

  function weatherIcon() {
    return WEATHER_ICONS[state.weather] || 'fa-cloud'
  }

  function renderNameScreen() {
    return `
      <div class="name-screen">
        <div class="name-card">
          <div class="logo">[BUILD]</div>
          <h1>WORLD BUILDER</h1>
          <p>Pick the builder name other players will see in chat, on the leaderboard, and above your creations.</p>
          <form id="name-form">
            <input id="builder-name" type="text" maxlength="24" placeholder="Enter your builder name" value="${esc(state.playerName || state.user?.email?.split('@')[0] || '')}">
            <button type="submit">Enter World</button>
          </form>
        </div>
      </div>
    `
  }

  function renderTopbar() {
    return `
      <div class="topbar">
        <div class="city-title">WORLD BUILDER</div>
        <div class="stats">
          <div class="stat-badge builds"><i class="fa-solid fa-city"></i><span>${state.buildings.length} builds</span></div>
          <div class="stat-badge weather"><i class="fa-solid ${weatherIcon()}"></i><span>${state.weather}</span></div>
          <div class="stat-badge happy"><i class="fa-solid fa-user"></i><span>${esc(state.playerName || state.user?.email?.split('@')[0] || 'Builder')}</span></div>
          <button class="topbar-btn" id="logout-btn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
      </div>
    `
  }

  function renderDrawer() {
    const leaderboard = topBuilders()
    return `
      <button class="drawer-toggle" id="drawer-toggle"><i class="fa-solid fa-bars"></i></button>
      <aside class="side-drawer ${state.drawerOpen ? 'open' : ''}">
        <div class="drawer-header">
          <h2>City Feed</h2>
          <button class="drawer-close" id="drawer-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="drawer-body">
          <div class="drawer-section">
            <h3>Leaderboard</h3>
            ${leaderboard.length ? leaderboard.map((entry, index) => `
              <div class="leaderboard-item">
                <div class="lb-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'normal'}">${index + 1}</div>
                <div class="lb-name">${esc(entry[0])}</div>
                <div class="lb-count">${entry[1]}</div>
              </div>
            `).join('') : '<div class="building-log-item"><div class="bl-desc">No buildings yet. Be the first builder.</div></div>'}
          </div>

          <div class="drawer-section">
            <h3>Building Log</h3>
            ${state.buildings.slice().reverse().slice(0, 12).map(building => `
              <div class="building-log-item">
                <div class="bl-name">${esc(BUILDING_TYPES[building.building_type]?.label || 'Build')} - ${esc(building.player_name || 'Builder')}</div>
                <div class="bl-desc">${esc(building.description || '')}</div>
                <div class="bl-time">${fmtTime(building.created_at)}</div>
              </div>
            `).join('') || '<div class="building-log-item"><div class="bl-desc">Nothing built yet.</div></div>'}
          </div>

          <div class="drawer-section chat-section">
            <h3>Live Chat</h3>
            <div class="chat-messages" id="chat-messages">
              ${state.chatMessages.slice(-20).map(msg => `
                <div class="chat-msg">
                  <div class="cm-name">${esc(msg.player_name || 'Builder')}</div>
                  <div class="cm-text">${esc(msg.message || '')}</div>
                </div>
              `).join('') || '<div class="chat-msg"><div class="cm-text">No chat yet.</div></div>'}
            </div>
            <form class="chat-input-row" id="chat-form">
              <input id="chat-input" type="text" maxlength="180" placeholder="Say something to the city...">
              <button type="submit">Send</button>
            </form>
          </div>
        </div>
      </aside>
    `
  }

  function renderBuildPanel() {
    return `
      <div class="build-panel">
        <form class="build-row" id="build-form">
          <input class="build-input" id="build-input" type="text" maxlength="180" placeholder="Describe a building, like: futuristic glass tower" ${state.buildBusy ? 'disabled' : ''}>
          <button class="build-btn" type="submit" ${state.buildBusy ? 'disabled' : ''}><i class="fa-solid fa-hammer"></i>Build</button>
        </form>
        <div class="build-hint">Try: medieval castle, cozy bakery, giant stadium, snowy hospital, neon skyscraper.</div>
      </div>
    `
  }

  function renderPopup() {
    if (!state.selectedBuildingId) return ''
    const building = state.buildings.find(item => item.id === state.selectedBuildingId)
    if (!building) return ''
    return `
      <div class="building-popup" style="left:16px; top:76px;">
        <button class="bp-close" id="popup-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="bp-type">${esc(BUILDING_TYPES[building.building_type]?.label || 'Build')}</div>
        <div class="bp-desc">${esc(building.description || '')}</div>
        <div class="bp-builder">Built by <strong>${esc(building.player_name || 'Builder')}</strong></div>
        <div class="bp-time">${fmtTime(building.created_at)}</div>
      </div>
    `
  }

  function renderToast() {
    return state.toastText ? `<div class="toast show">${esc(state.toastText)}</div>` : '<div class="toast"></div>'
  }

  function renderWorldUI() {
    return `
      ${renderTopbar()}
      <canvas class="game-canvas" id="game-canvas"></canvas>
      <canvas class="weather-canvas" id="weather-canvas"></canvas>
      <div class="daynight-overlay" id="daynight-overlay"></div>
      ${renderDrawer()}
      ${renderPopup()}
      ${renderBuildPanel()}
      ${renderToast()}
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

    app.innerHTML = renderWorldUI()
    setupCanvasRefs()
    resizeCanvases()
    bindUIEvents()
    drawWorld()
  }

  function setupCanvasRefs() {
    canvas = document.getElementById('game-canvas')
    weatherCanvas = document.getElementById('weather-canvas')
    ctx = canvas?.getContext('2d') || null
    weatherCtx = weatherCanvas?.getContext('2d') || null
  }

  function resizeCanvases() {
    if (!canvas || !weatherCanvas) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    weatherCanvas.width = Math.floor(width * dpr)
    weatherCanvas.height = Math.floor(height * dpr)
    weatherCanvas.style.width = `${width}px`
    weatherCanvas.style.height = `${height}px`
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (weatherCtx) weatherCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function drawTile(gx, gy) {
    const iso = isoToScreen(gx, gy)
    const pos = worldToCanvas(iso.x, iso.y)
    const halfW = (TILE_W / 2) * state.camera.zoom
    const halfH = (TILE_H / 2) * state.camera.zoom
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.lineTo(pos.x + halfW, pos.y + halfH)
    ctx.lineTo(pos.x, pos.y + halfH * 2)
    ctx.lineTo(pos.x - halfW, pos.y + halfH)
    ctx.closePath()
    ctx.fillStyle = (gx + gy) % 2 === 0 ? '#1f3254' : '#22395f'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.stroke()
  }

  function drawBuilding(building) {
    const iso = isoToScreen(building.grid_x, building.grid_y)
    const pos = worldToCanvas(iso.x, iso.y)
    const zoom = state.camera.zoom
    const floors = Math.max(0, Number(building.floors || 1))
    const height = Math.max(18, floors * 14) * zoom
    const width = 34 * zoom
    const depth = 20 * zoom
    const base = building.color || BUILDING_TYPES[building.building_type]?.baseColor || '#a5b4fc'
    const left = shadeColor(base, 0.75)
    const right = shadeColor(base, 0.92)
    const roof = shadeColor(base, 1.12)

    if (building.building_type === 'park') {
      ctx.fillStyle = '#22c55e'
      ctx.beginPath()
      ctx.ellipse(pos.x, pos.y + 8 * zoom, 22 * zoom, 14 * zoom, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#14532d'
      ctx.fillRect(pos.x - 2 * zoom, pos.y - 10 * zoom, 4 * zoom, 18 * zoom)
      return
    }

    if (building.building_type === 'fountain') {
      ctx.fillStyle = '#67e8f9'
      ctx.beginPath()
      ctx.ellipse(pos.x, pos.y + 10 * zoom, 18 * zoom, 10 * zoom, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#dbeafe'
      ctx.fillRect(pos.x - 3 * zoom, pos.y - 8 * zoom, 6 * zoom, 18 * zoom)
      return
    }

    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath()
    ctx.ellipse(pos.x, pos.y + 18 * zoom, 24 * zoom, 10 * zoom, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - height)
    ctx.lineTo(pos.x - width, pos.y - height / 2)
    ctx.lineTo(pos.x - width, pos.y + depth)
    ctx.lineTo(pos.x, pos.y + depth - height / 2)
    ctx.closePath()
    ctx.fillStyle = left
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - height)
    ctx.lineTo(pos.x + width, pos.y - height / 2)
    ctx.lineTo(pos.x + width, pos.y + depth)
    ctx.lineTo(pos.x, pos.y + depth - height / 2)
    ctx.closePath()
    ctx.fillStyle = right
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - height)
    ctx.lineTo(pos.x + width, pos.y - height / 2)
    ctx.lineTo(pos.x, pos.y)
    ctx.lineTo(pos.x - width, pos.y - height / 2)
    ctx.closePath()
    ctx.fillStyle = roof
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < Math.max(1, floors); i++) {
      const wy = pos.y - height / 2 + i * 12 * zoom
      ctx.fillRect(pos.x - width * 0.65, wy, 8 * zoom, 5 * zoom)
      ctx.fillRect(pos.x + width * 0.35, wy + 2 * zoom, 8 * zoom, 5 * zoom)
    }
  }

  function drawNpcs() {
    state.npcs.forEach(npc => {
      const iso = isoToScreen(npc.x, npc.y)
      const pos = worldToCanvas(iso.x, iso.y)
      ctx.fillStyle = npc.color
      ctx.beginPath()
      ctx.arc(pos.x, pos.y + 8 * state.camera.zoom, 4 * state.camera.zoom, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  function drawWeatherLayer() {
    if (!weatherCtx || !weatherCanvas) return
    const width = weatherCanvas.clientWidth || window.innerWidth
    const height = weatherCanvas.clientHeight || window.innerHeight
    weatherCtx.clearRect(0, 0, width, height)

    if (state.weather === 'fog') {
      weatherCtx.fillStyle = 'rgba(255,255,255,0.05)'
      state.weatherParticles.forEach(p => {
        weatherCtx.beginPath()
        weatherCtx.ellipse(p.x, p.y, p.size, p.size * 0.45, 0, 0, Math.PI * 2)
        weatherCtx.fill()
      })
      return
    }

    const stroke = state.weather === 'rain' ? 'rgba(125,211,252,0.45)' : 'rgba(255,255,255,0.7)'
    weatherCtx.strokeStyle = stroke
    weatherCtx.fillStyle = stroke
    state.weatherParticles.forEach(p => {
      if (state.weather === 'rain') {
        weatherCtx.beginPath()
        weatherCtx.moveTo(p.x, p.y)
        weatherCtx.lineTo(p.x - 3, p.y + 12)
        weatherCtx.stroke()
      } else if (state.weather === 'snow') {
        weatherCtx.beginPath()
        weatherCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        weatherCtx.fill()
      }
    })
  }

  function updateDayNightOverlay() {
    const overlay = document.getElementById('daynight-overlay')
    if (!overlay) return
    const wave = (Math.sin(state.dayTime * Math.PI * 2) + 1) / 2
    const darkness = 0.08 + (1 - wave) * 0.34
    overlay.style.background = `linear-gradient(180deg, rgba(5,10,25,${darkness * 0.55}), rgba(5,10,25,${darkness}))`
    window.WorldAudio?.setDayPhase?.(wave < 0.35 ? 'night' : 'day')
  }

  function drawWorld() {
    if (!ctx || !canvas) return
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    ctx.clearRect(0, 0, width, height)

    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, state.dayTime < 0.35 || state.dayTime > 0.85 ? '#0f172a' : '#162a4d')
    sky.addColorStop(1, '#1e3357')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        drawTile(gx, gy)
      }
    }

    const sortedBuildings = state.buildings.slice().sort((a, b) => (a.grid_x + a.grid_y) - (b.grid_x + b.grid_y))
    sortedBuildings.forEach(drawBuilding)
    drawNpcs()
    drawWeatherLayer()
    updateDayNightOverlay()
  }

  function tick() {
    updateNpcs()
    updateWeatherParticles()
    drawWorld()
    animationFrame = requestAnimationFrame(tick)
  }

  function startAnimation() {
    if (animationStarted) return
    animationStarted = true
    tick()
  }

  function stopAnimation() {
    animationStarted = false
    if (animationFrame) cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  function cycleWeather() {
    state.weatherIndex = (state.weatherIndex + 1) % WEATHER_TYPES.length
    state.weather = WEATHER_TYPES[state.weatherIndex]
    window.WorldAudio?.setWeather?.(state.weather)
    if (state.weather !== 'sunny' && state.weather !== 'cloudy') toast(`Weather changed to ${state.weather}.`)
    drawWorld()
    renderUI()
  }

  function startWorldTimers() {
    if (weatherTimer) clearInterval(weatherTimer)
    if (dayTimer) clearInterval(dayTimer)
    weatherTimer = setInterval(cycleWeather, 30000)
    dayTimer = setInterval(() => {
      state.dayTime = (state.dayTime + 0.01) % 1
    }, DAY_CYCLE_MS / 100)
  }

  function stopWorldTimers() {
    if (weatherTimer) clearInterval(weatherTimer)
    if (dayTimer) clearInterval(dayTimer)
    weatherTimer = null
    dayTimer = null
  }

  function findBuildingAtPoint(clientX, clientY) {
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    let found = null
    let best = Infinity
    state.buildings.forEach(building => {
      const iso = isoToScreen(building.grid_x, building.grid_y)
      const pos = worldToCanvas(iso.x, iso.y)
      const dist = Math.hypot(pos.x - x, pos.y - y)
      if (dist < 28 * state.camera.zoom && dist < best) {
        best = dist
        found = building
      }
    })
    return found
  }

  async function handleLogout() {
    stopAnimation()
    stopWorldTimers()
    state.drawerOpen = false
    state.selectedBuildingId = null
    state.entered = false
    state.playerName = ''
    state.buildings = []
    state.chatMessages = []
    state.occupiedTiles = new Set()
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (error) {
      console.error('Logout error:', error?.message)
    }
    state.session = null
    state.user = null
    app.innerHTML = ''
    if (typeof window.__worldBuilderShowAuth === 'function') {
      await window.__worldBuilderShowAuth()
    }
  }

  function bindUIEvents() {
    document.getElementById('name-form')?.addEventListener('submit', event => {
      event.preventDefault()
      const input = document.getElementById('builder-name')
      const nextName = String(input?.value || '').trim() || state.user?.email?.split('@')[0] || 'Builder'
      state.playerName = nextName
      state.entered = true
      renderUI()
      startAnimation()
      startWorldTimers()
      window.WorldAudio?.attachToggleButton?.()
    })

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await handleLogout()
    })

    document.getElementById('drawer-toggle')?.addEventListener('click', () => {
      state.drawerOpen = !state.drawerOpen
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

    document.getElementById('build-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      if (state.buildBusy) return
      const input = document.getElementById('build-input')
      const value = String(input?.value || '').trim()
      if (!value) return
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

    document.getElementById('chat-form')?.addEventListener('submit', async event => {
      event.preventDefault()
      const input = document.getElementById('chat-input')
      const value = String(input?.value || '').trim()
      if (!value) return
      try {
        await sendChatMessage(value)
        if (input) input.value = ''
        await loadChatMessages()
        renderUI()
      } catch (error) {
        console.error('Chat error:', error?.message)
        toast(error?.message || 'Could not send chat message.')
      }
    })

    if (canvas) {
      canvas.onpointerdown = event => {
        state.drag.active = true
        state.drag.moved = false
        state.drag.x = event.clientX
        state.drag.y = event.clientY
      }
      canvas.onpointermove = event => {
        if (!state.drag.active) return
        const dx = event.clientX - state.drag.x
        const dy = event.clientY - state.drag.y
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.drag.moved = true
        state.drag.x = event.clientX
        state.drag.y = event.clientY
        state.camera.x += dx / state.camera.zoom
        state.camera.y += dy / state.camera.zoom
        drawWorld()
      }
      canvas.onpointerup = event => {
        if (!state.drag.moved) {
          const building = findBuildingAtPoint(event.clientX, event.clientY)
          state.selectedBuildingId = building?.id || null
          renderUI()
        }
        state.drag.active = false
      }
      canvas.onpointerleave = () => {
        state.drag.active = false
      }
      canvas.onwheel = event => {
        event.preventDefault()
        const nextZoom = state.camera.zoom + (event.deltaY < 0 ? 0.08 : -0.08)
        state.camera.zoom = Math.max(0.55, Math.min(1.8, nextZoom))
        drawWorld()
      }
    }
  }

  function setupResize() {
    if (resizeBound) return
    resizeBound = true
    window.addEventListener('resize', () => {
      resizeCanvases()
      drawWorld()
    })
  }

  function setupRealtime() {
    if (realtimeChannel) return
    try {
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
    } catch (error) {
      console.error('Realtime error:', error?.message)
    }
  }

  async function init() {
    setupResize()
    const { data: { session } } = await supabase.auth.getSession()
    state.session = session || null
    state.user = session?.user || null

    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      state.session = nextSession || null
      state.user = nextSession?.user || null
      if (!state.user) {
        stopAnimation()
        stopWorldTimers()
        state.entered = false
        state.playerName = ''
        app.innerHTML = ''
        return
      }
      try {
        await loadAllData()
      } catch (error) {
        console.error('Reload error:', error?.message)
      }
      renderUI()
    })

    if (!state.user) {
      app.innerHTML = ''
      return
    }

    await loadAllData()
    setupRealtime()
    renderUI()
  }

  init().catch(error => {
    console.error('Init error:', error?.message, error?.stack)
    app.innerHTML = '<div style="padding:24px;color:#f0f4ff;font-family:Inter,sans-serif;">World Builder failed to load.</div>'
  })
} catch (error) {
  console.error('World Builder fatal error:', error?.message, error?.stack)
}
