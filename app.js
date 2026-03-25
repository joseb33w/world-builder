import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

try {

const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const TABLES = {
  buildings: 'uNMexs7BYTXQ2_world_builder_buildings',
  chat: 'uNMexs7BYTXQ2_world_builder_chat_messages'
}

// ===================== CONSTANTS =====================
const GRID_SIZE = 20
const TILE_W = 64
const TILE_H = 32
const TILE_DEPTH = 8
const POLL_INTERVAL = 3000
const DAY_CYCLE_MS = 120000 // 2 min full cycle

const BUILDING_TYPES = {
  house: { emoji: '🏠', baseColor: '#4ade80', roofColor: '#166534', floors: 2 },
  shop: { emoji: '🏪', baseColor: '#fbbf24', roofColor: '#92400e', floors: 1 },
  factory: { emoji: '🏭', baseColor: '#9ca3af', roofColor: '#374151', floors: 2 },
  castle: { emoji: '🏰', baseColor: '#a78bfa', roofColor: '#4c1d95', floors: 4 },
  tower: { emoji: '🗼', baseColor: '#60a5fa', roofColor: '#1e3a5f', floors: 5 },
  church: { emoji: '⛪', baseColor: '#f9fafb', roofColor: '#6b7280', floors: 3 },
  stadium: { emoji: '🏟️', baseColor: '#34d399', roofColor: '#065f46', floors: 2 },
  hospital: { emoji: '🏥', baseColor: '#fca5a5', roofColor: '#991b1b', floors: 3 },
  school: { emoji: '🏫', baseColor: '#fde68a', roofColor: '#78350f', floors: 2 },
  restaurant: { emoji: '🍽️', baseColor: '#fb923c', roofColor: '#7c2d12', floors: 1 },
  hotel: { emoji: '🏨', baseColor: '#c084fc', roofColor: '#581c87', floors: 4 },
  park: { emoji: '🌳', baseColor: '#86efac', roofColor: '#14532d', floors: 0 },
  fountain: { emoji: '⛲', baseColor: '#67e8f9', roofColor: '#155e75', floors: 0 },
  skyscraper: { emoji: '🏙️', baseColor: '#93c5fd', roofColor: '#1e40af', floors: 6 },
  library: { emoji: '📚', baseColor: '#d4a574', roofColor: '#6b3a1f', floors: 2 },
  museum: { emoji: '🏛️', baseColor: '#e2e8f0', roofColor: '#475569', floors: 2 },
  default: { emoji: '🏗️', baseColor: '#a5b4fc', roofColor: '#3730a3', floors: 2 }
}

const STYLES = {
  modern: { wallMod: [0.9, 0.95, 1.0], windowStyle: 'glass', accent: '#22d3ee' },
  medieval: { wallMod: [0.8, 0.75, 0.7], windowStyle: 'arch', accent: '#a16207' },
  futuristic: { wallMod: [0.7, 0.8, 1.0], windowStyle: 'neon', accent: '#c084fc' },
  rustic: { wallMod: [0.85, 0.7, 0.6], windowStyle: 'small', accent: '#92400e' },
  default: { wallMod: [0.9, 0.9, 0.9], windowStyle: 'normal', accent: '#6366f1' }
}

const WEATHER_TYPES = ['sunny', 'cloudy', 'rain', 'snow', 'fog']
const WEATHER_ICONS = { sunny: 'fa-sun', cloudy: 'fa-cloud', rain: 'fa-cloud-rain', snow: 'fa-snowflake', fog: 'fa-smog' }

// ===================== STATE =====================
const state = {
  playerName: '',
  entered: false,
  buildings: [],
  chatMessages: [],
  occupiedTiles: new Set(),
  camera: { x: 0, y: 0, zoom: 1 },
  dragging: false,
  dragStart: { x: 0, y: 0 },
  cameraStart: { x: 0, y: 0 },
  pinchStart: 0,
  zoomStart: 1,
  selectedBuilding: null,
  popupPos: null,
  drawerOpen: false,
  weather: 'sunny',
  dayTime: 0,
  toastText: '',
  toastTimeout: null,
  buildBusy: false,
  animFrame: 0,
  clouds: [],
  walkers: [],
  cars: [],
  particles: []
}

const app = document.getElementById('app')
let canvas, ctx, weatherCanvas, weatherCtx
let lastTime = 0

// ===================== HELPERS =====================
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function toast(msg) {
  state.toastText = msg
  if (state.toastTimeout) clearTimeout(state.toastTimeout)
  state.toastTimeout = setTimeout(() => { state.toastText = ''; renderUI() }, 2200)
  renderUI()
}

function fmtTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return { r, g, b }
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
}

function shadeColor(hex, factor) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r * factor, g * factor, b * factor)
}

function mixColor(hex, mixHex, amount) {
  const c1 = hexToRgb(hex)
  const c2 = hexToRgb(mixHex)
  return rgbToHex(
    c1.r + (c2.r - c1.r) * amount,
    c1.g + (c2.g - c1.g) * amount,
    c1.b + (c2.b - c1.b) * amount
  )
}

function isoToScreen(gx, gy) {
  const sx = (gx - gy) * (TILE_W / 2)
  const sy = (gx + gy) * (TILE_H / 2)
  return { sx, sy }
}

function screenToIso(sx, sy) {
  const gx = (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2
  const gy = (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2
  return { gx: Math.floor(gx), gy: Math.floor(gy) }
}

function worldToCanvas(wx, wy) {
  const cx = (wx + state.camera.x) * state.camera.zoom + canvas.width / 2
  const cy = (wy + state.camera.y) * state.camera.zoom + canvas.height / 2
  return { cx, cy }
}

function canvasToWorld(cx, cy) {
  const wx = (cx - canvas.width / 2) / state.camera.zoom - state.camera.x
  const wy = (cy - canvas.height / 2) / state.camera.zoom - state.camera.y
  return { wx, wy }
}

// ===================== NLP PARSER =====================
function parseDescription(text) {
  const lower = text.toLowerCase()

  // Detect type
  let buildingType = 'default'
  const typeKeys = Object.keys(BUILDING_TYPES).filter(k => k !== 'default')
  for (const t of typeKeys) {
    if (lower.includes(t)) { buildingType = t; break }
  }
  if (buildingType === 'default') {
    if (/glass|skyscraper|high.?rise|sky.?scraper/i.test(lower)) buildingType = 'skyscraper'
    else if (/apartment|condo|flat/i.test(lower)) buildingType = 'hotel'
    else if (/cafe|coffee|bakery|diner/i.test(lower)) buildingType = 'restaurant'
    else if (/garden|tree|green/i.test(lower)) buildingType = 'park'
    else if (/water|splash|jet/i.test(lower)) buildingType = 'fountain'
    else if (/book|read/i.test(lower)) buildingType = 'library'
    else if (/art|exhibit|gallery/i.test(lower)) buildingType = 'museum'
    else if (/store|market|mall|boutique/i.test(lower)) buildingType = 'shop'
    else if (/office|corporate|business/i.test(lower)) buildingType = 'skyscraper'
    else if (/fort|stronghold/i.test(lower)) buildingType = 'castle'
    else if (/warehouse|plant|mill/i.test(lower)) buildingType = 'factory'
    else if (/clinic|medical/i.test(lower)) buildingType = 'hospital'
    else if (/arena|court|field/i.test(lower)) buildingType = 'stadium'
    else if (/temple|cathedral|chapel|mosque|synagogue/i.test(lower)) buildingType = 'church'
    else if (/inn|lodge|motel/i.test(lower)) buildingType = 'hotel'
    else if (/college|university|academy/i.test(lower)) buildingType = 'school'
  }

  // Detect style
  let style = 'default'
  if (/modern|contemporary|glass|steel|sleek|minimalist/i.test(lower)) style = 'modern'
  else if (/medieval|ancient|old|gothic|stone|castle/i.test(lower)) style = 'medieval'
  else if (/futuristic|cyber|neon|chrome|sci.?fi|holographic/i.test(lower)) style = 'futuristic'
  else if (/rustic|brick|wood|cabin|cottage|country|farm/i.test(lower)) style = 'rustic'

  // Detect height
  let floors = BUILDING_TYPES[buildingType]?.floors || 2
  if (/tiny|small|little|mini|low/i.test(lower)) floors = Math.max(1, floors - 1)
  if (/tall|high|big|large/i.test(lower)) floors = Math.min(7, floors + 2)
  if (/massive|huge|enormous|giant|mega|colossal/i.test(lower)) floors = Math.min(9, floors + 4)

  // Detect color
  let color = BUILDING_TYPES[buildingType]?.baseColor || '#a5b4fc'
  const colorMap = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    purple: '#a855f7', pink: '#ec4899', orange: '#f97316', white: '#f8fafc',
    black: '#1f2937', gold: '#fbbf24', silver: '#d1d5db', cyan: '#06b6d4',
    teal: '#14b8a6', brown: '#92400e', crimson: '#dc2626', navy: '#1e3a5f',
    emerald: '#059669', ruby: '#e11d48', sapphire: '#2563eb', amber: '#d97706'
  }
  for (const [name, hex] of Object.entries(colorMap)) {
    if (lower.includes(name)) { color = hex; break }
  }

  // Roof style
  let roofStyle = 'flat'
  if (/dome|round/i.test(lower)) roofStyle = 'dome'
  else if (/spire|point|spike|peak/i.test(lower)) roofStyle = 'spire'
  else if (/garden|green.?roof|rooftop.?garden|plants/i.test(lower)) roofStyle = 'garden'
  else if (buildingType === 'church' || buildingType === 'castle') roofStyle = 'spire'
  else if (style === 'medieval') roofStyle = 'spire'
  else if (floors >= 4) roofStyle = 'flat'
  else roofStyle = 'peaked'

  // Features
  const features = {
    smoke: /factory|chimney|smoke|steam/i.test(lower),
    flag: /flag|banner|castle|fort/i.test(lower),
    lights: /neon|light|glow|lamp|bright/i.test(lower),
    antenna: /antenna|tower|radio|broadcast/i.test(lower),
    moat: /moat|water|canal/i.test(lower) && buildingType === 'castle',
    garden: /garden|tree|plant|bush|flower/i.test(lower)
  }

  return {
    building_type: buildingType,
    style,
    floors,
    color,
    roof_style: roofStyle,
    features
  }
}

// ===================== FIND NEXT TILE =====================
function findNextTile() {
  // Spiral outward from center
  const cx = Math.floor(GRID_SIZE / 2)
  const cy = Math.floor(GRID_SIZE / 2)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const gx = cx + dx
        const gy = cy + dy
        if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) continue
        const key = `${gx},${gy}`
        if (!state.occupiedTiles.has(key)) return { gx, gy }
      }
    }
  }
  return null
}

// ===================== SUPABASE OPS =====================
async function loadBuildings() {
  try {
    const { data, error } = await supabase.from(TABLES.buildings).select('*').order('created_at', { ascending: true })
    if (error) throw error
    state.buildings = data || []
    state.occupiedTiles.clear()
    state.buildings.forEach(b => state.occupiedTiles.add(`${b.position_x},${b.position_y}`))
  } catch (e) { console.error('Load buildings error:', e.message) }
}

async function loadChat() {
  try {
    const { data, error } = await supabase.from(TABLES.chat).select('*').order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    state.chatMessages = (data || []).reverse()
  } catch (e) { console.error('Load chat error:', e.message) }
}

async function placeBuilding(description) {
  const tile = findNextTile()
  if (!tile) { toast('City is full! No more tiles.'); return }

  const parsed = parseDescription(description)
  const payload = {
    description,
    builder_name: state.playerName,
    position_x: tile.gx,
    position_y: tile.gy,
    building_type: parsed.building_type,
    style: parsed.style,
    height: parsed.floors,
    color: parsed.color,
    floors: parsed.floors,
    roof_style: parsed.roof_style,
    features: parsed.features
  }

  const { error } = await supabase.from(TABLES.buildings).insert(payload)
  if (error) throw error
  await loadBuildings()
  toast(`${BUILDING_TYPES[parsed.building_type]?.emoji || '🏗️'} ${parsed.building_type} built!`)
}

async function sendChat(message) {
  const { error } = await supabase.from(TABLES.chat).insert({ builder_name: state.playerName, message })
  if (error) throw error
  await loadChat()
}

// ===================== CITY STATS =====================
function getCityStats() {
  const total = state.buildings.length
  const population = state.buildings.reduce((sum, b) => {
    const floors = b.floors || 1
    const typeMultiplier = b.building_type === 'hotel' ? 30 : b.building_type === 'house' ? 8 : b.building_type === 'skyscraper' ? 50 : 15
    return sum + floors * typeMultiplier
  }, 0)

  const types = new Set(state.buildings.map(b => b.building_type))
  const variety = types.size
  const happiness = Math.min(100, Math.round(variety * 12 + Math.min(total, 20) * 2))

  const builderCounts = {}
  state.buildings.forEach(b => { builderCounts[b.builder_name] = (builderCounts[b.builder_name] || 0) + 1 })
  const leaderboard = Object.entries(builderCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return { total, population, happiness, leaderboard }
}

// ===================== ANIMATION ENTITIES =====================
function initEntities() {
  // Clouds
  state.clouds = []
  for (let i = 0; i < 8; i++) {
    state.clouds.push({
      x: Math.random() * 2000 - 500,
      y: Math.random() * 200 - 100,
      w: 80 + Math.random() * 120,
      speed: 0.2 + Math.random() * 0.3,
      opacity: 0.15 + Math.random() * 0.15
    })
  }

  // Walkers
  state.walkers = []
  for (let i = 0; i < 12; i++) {
    const gx = Math.floor(Math.random() * GRID_SIZE)
    const gy = Math.floor(Math.random() * GRID_SIZE)
    state.walkers.push({
      gx, gy, progress: Math.random(),
      targetGx: gx + (Math.random() > 0.5 ? 1 : 0),
      targetGy: gy + (Math.random() > 0.5 ? 1 : 0),
      speed: 0.003 + Math.random() * 0.004,
      color: ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#c084fc', '#fb923c'][Math.floor(Math.random() * 6)]
    })
  }

  // Cars
  state.cars = []
  for (let i = 0; i < 6; i++) {
    const onX = Math.random() > 0.5
    state.cars.push({
      gx: onX ? Math.random() * GRID_SIZE : Math.floor(Math.random() * GRID_SIZE) + 0.5,
      gy: onX ? Math.floor(Math.random() * GRID_SIZE) + 0.5 : Math.random() * GRID_SIZE,
      moveX: onX,
      speed: 0.01 + Math.random() * 0.02,
      color: ['#ef4444', '#3b82f6', '#fbbf24', '#f8fafc', '#1f2937'][Math.floor(Math.random() * 5)]
    })
  }
}

function updateEntities() {
  // Clouds
  state.clouds.forEach(c => {
    c.x += c.speed
    if (c.x > 2000) c.x = -200
  })

  // Walkers
  state.walkers.forEach(w => {
    w.progress += w.speed
    if (w.progress >= 1) {
      w.gx = w.targetGx
      w.gy = w.targetGy
      w.progress = 0
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)]
      w.targetGx = Math.max(0, Math.min(GRID_SIZE - 1, w.gx + dx))
      w.targetGy = Math.max(0, Math.min(GRID_SIZE - 1, w.gy + dy))
    }
  })

  // Cars
  state.cars.forEach(c => {
    if (c.moveX) {
      c.gx += c.speed
      if (c.gx > GRID_SIZE) c.gx = 0
    } else {
      c.gy += c.speed
      if (c.gy > GRID_SIZE) c.gy = 0
    }
  })
}

// ===================== DRAWING =====================
function drawGrid() {
  const nightFactor = getNightFactor()
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const { sx, sy } = isoToScreen(gx, gy)
      const { cx, cy } = worldToCanvas(sx, sy)

      const occupied = state.occupiedTiles.has(`${gx},${gy}`)
      let tileColor = occupied ? '#1a2744' : '#1e3a2e'

      // Roads along edges
      const isRoadH = gy % 5 === 0
      const isRoadV = gx % 5 === 0
      if ((isRoadH || isRoadV) && !occupied) tileColor = '#2a2a3e'

      const shadedColor = mixColor(tileColor, '#050510', nightFactor * 0.4)

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(state.camera.zoom, state.camera.zoom)

      // Tile
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(TILE_W / 2, TILE_H / 2)
      ctx.lineTo(0, TILE_H)
      ctx.lineTo(-TILE_W / 2, TILE_H / 2)
      ctx.closePath()
      ctx.fillStyle = shadedColor
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      ctx.restore()
    }
  }
}

function getNightFactor() {
  // 0 = full day, 1 = full night
  const cycle = (state.dayTime % DAY_CYCLE_MS) / DAY_CYCLE_MS
  // Sine wave: 0->0.5 is day, 0.5->1 is night
  return Math.max(0, Math.sin(cycle * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5)
}

function drawIsometricBuilding(b) {
  const { sx, sy } = isoToScreen(b.position_x, b.position_y)
  const { cx, cy } = worldToCanvas(sx, sy)
  const nightFactor = getNightFactor()

  const typeInfo = BUILDING_TYPES[b.building_type] || BUILDING_TYPES.default
  const styleInfo = STYLES[b.style] || STYLES.default
  const baseColor = b.color || typeInfo.baseColor
  const roofColor = typeInfo.roofColor
  const floors = b.floors || 2
  const floorH = 14
  const totalH = floors * floorH
  const features = b.features || {}

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(state.camera.zoom, state.camera.zoom)

  const wallLeft = mixColor(shadeColor(baseColor, styleInfo.wallMod[0]), '#050510', nightFactor * 0.35)
  const wallRight = mixColor(shadeColor(baseColor, styleInfo.wallMod[1]), '#050510', nightFactor * 0.35)
  const topColor = mixColor(shadeColor(baseColor, styleInfo.wallMod[2]), '#050510', nightFactor * 0.3)
  const shadedRoof = mixColor(roofColor, '#050510', nightFactor * 0.3)

  // === Park/fountain special ===
  if (b.building_type === 'park' || b.building_type === 'fountain') {
    // Green base
    ctx.beginPath()
    ctx.moveTo(0, -4)
    ctx.lineTo(TILE_W / 2, TILE_H / 2 - 4)
    ctx.lineTo(0, TILE_H - 4)
    ctx.lineTo(-TILE_W / 2, TILE_H / 2 - 4)
    ctx.closePath()
    ctx.fillStyle = mixColor('#22c55e', '#050510', nightFactor * 0.3)
    ctx.fill()

    // Trees or fountain
    const t = state.animFrame
    if (b.building_type === 'park') {
      for (let i = 0; i < 3; i++) {
        const ox = -8 + i * 8
        const oy = -8 - i * 3
        const sway = Math.sin(t * 0.02 + i) * 1.5
        ctx.fillStyle = mixColor('#15803d', '#050510', nightFactor * 0.3)
        ctx.fillRect(ox + sway, oy, 2, 8)
        ctx.beginPath()
        ctx.arc(ox + sway, oy - 4, 7 + Math.sin(t * 0.03 + i) * 1, 0, Math.PI * 2)
        ctx.fillStyle = mixColor('#4ade80', '#050510', nightFactor * 0.3)
        ctx.fill()
      }
    } else {
      // Fountain
      ctx.beginPath()
      ctx.ellipse(0, 2, 14, 8, 0, 0, Math.PI * 2)
      ctx.fillStyle = mixColor('#0ea5e9', '#050510', nightFactor * 0.2)
      ctx.fill()
      // Water jets
      const jh = 10 + Math.sin(t * 0.06) * 4
      ctx.strokeStyle = 'rgba(96,165,250,0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -jh)
      ctx.moveTo(-4, 0)
      ctx.quadraticCurveTo(-4, -jh * 0.6, -8, -jh * 0.3)
      ctx.moveTo(4, 0)
      ctx.quadraticCurveTo(4, -jh * 0.6, 8, -jh * 0.3)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  // === Moat ===
  if (features.moat) {
    ctx.beginPath()
    ctx.moveTo(0, 4)
    ctx.lineTo(TILE_W / 2 + 4, TILE_H / 2 + 4)
    ctx.lineTo(0, TILE_H + 4)
    ctx.lineTo(-TILE_W / 2 - 4, TILE_H / 2 + 4)
    ctx.closePath()
    ctx.fillStyle = 'rgba(14,165,233,0.35)'
    ctx.fill()
  }

  // === Left wall ===
  ctx.beginPath()
  ctx.moveTo(-TILE_W / 2, TILE_H / 2)
  ctx.lineTo(0, TILE_H)
  ctx.lineTo(0, TILE_H - totalH)
  ctx.lineTo(-TILE_W / 2, TILE_H / 2 - totalH)
  ctx.closePath()
  ctx.fillStyle = wallLeft
  ctx.fill()

  // === Right wall ===
  ctx.beginPath()
  ctx.moveTo(TILE_W / 2, TILE_H / 2)
  ctx.lineTo(0, TILE_H)
  ctx.lineTo(0, TILE_H - totalH)
  ctx.lineTo(TILE_W / 2, TILE_H / 2 - totalH)
  ctx.closePath()
  ctx.fillStyle = wallRight
  ctx.fill()

  // === Top face ===
  const topY = TILE_H - totalH
  ctx.beginPath()
  ctx.moveTo(0, topY - TILE_H / 2)
  ctx.lineTo(TILE_W / 2, topY)
  ctx.lineTo(0, topY + TILE_H / 2)
  ctx.lineTo(-TILE_W / 2, topY)
  ctx.closePath()
  ctx.fillStyle = topColor
  ctx.fill()

  // === Windows ===
  const windowGlow = nightFactor > 0.3
  for (let f = 0; f < floors; f++) {
    const wy = TILE_H - f * floorH - 6
    // Left side windows
    for (let w = 0; w < 2; w++) {
      const wx = -TILE_W / 4 + w * 10 - 3
      const wwy = wy - w * 2.5 - 4
      ctx.fillStyle = windowGlow
        ? `rgba(251,191,36,${0.5 + Math.sin(state.animFrame * 0.02 + f + w) * 0.2})`
        : 'rgba(200,220,255,0.5)'
      ctx.fillRect(wx, wwy, 5, 4)
    }
    // Right side windows
    for (let w = 0; w < 2; w++) {
      const wx = TILE_W / 4 - w * 10 - 2
      const wwy = wy - (1 - w) * 2.5 - 4
      ctx.fillStyle = windowGlow
        ? `rgba(251,191,36,${0.5 + Math.sin(state.animFrame * 0.02 + f + w + 3) * 0.2})`
        : 'rgba(200,220,255,0.5)'
      ctx.fillRect(wx, wwy, 5, 4)
    }
  }

  // === Roof ===
  const roofBase = topY - TILE_H / 2
  if (b.roof_style === 'spire') {
    ctx.beginPath()
    ctx.moveTo(0, roofBase - 18)
    ctx.lineTo(TILE_W / 3, topY)
    ctx.lineTo(-TILE_W / 3, topY)
    ctx.closePath()
    ctx.fillStyle = shadedRoof
    ctx.fill()
  } else if (b.roof_style === 'dome') {
    ctx.beginPath()
    ctx.ellipse(0, roofBase, TILE_W / 3, 12, 0, Math.PI, 0)
    ctx.fillStyle = shadedRoof
    ctx.fill()
  } else if (b.roof_style === 'garden') {
    ctx.fillStyle = mixColor('#22c55e', '#050510', nightFactor * 0.3)
    ctx.beginPath()
    ctx.moveTo(0, topY - TILE_H / 2 - 2)
    ctx.lineTo(TILE_W / 2 - 4, topY - 2)
    ctx.lineTo(0, topY + TILE_H / 2 - 2)
    ctx.lineTo(-TILE_W / 2 + 4, topY - 2)
    ctx.closePath()
    ctx.fill()
    // Mini trees
    for (let i = 0; i < 2; i++) {
      const tx = -6 + i * 12
      const ty = topY - TILE_H / 2 + 2
      ctx.beginPath()
      ctx.arc(tx, ty - 3, 4, 0, Math.PI * 2)
      ctx.fillStyle = mixColor('#4ade80', '#050510', nightFactor * 0.2)
      ctx.fill()
    }
  } else if (b.roof_style === 'peaked') {
    ctx.beginPath()
    ctx.moveTo(0, roofBase - 10)
    ctx.lineTo(TILE_W / 2 - 2, topY)
    ctx.lineTo(0, topY + TILE_H / 2 - 2)
    ctx.lineTo(-TILE_W / 2 + 2, topY)
    ctx.closePath()
    ctx.fillStyle = shadedRoof
    ctx.fill()
  }

  // === Features ===
  const t = state.animFrame

  // Smoke
  if (features.smoke) {
    for (let i = 0; i < 4; i++) {
      const phase = t * 0.015 + i * 1.5
      const smokeY = roofBase - 8 - (phase % 4) * 5
      const smokeX = 8 + Math.sin(phase) * 3
      const opacity = Math.max(0, 0.3 - (phase % 4) * 0.07)
      ctx.beginPath()
      ctx.arc(smokeX, smokeY, 3 + (phase % 4), 0, Math.PI * 2)
      ctx.fillStyle = `rgba(180,180,180,${opacity})`
      ctx.fill()
    }
  }

  // Flag
  if (features.flag) {
    const flagX = 6
    const flagY = roofBase - 18
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(flagX, roofBase - 2)
    ctx.lineTo(flagX, flagY)
    ctx.stroke()
    const wave = Math.sin(t * 0.04) * 2
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.moveTo(flagX, flagY)
    ctx.lineTo(flagX + 10 + wave, flagY + 2)
    ctx.lineTo(flagX, flagY + 6)
    ctx.fill()
  }

  // Neon lights (futuristic)
  if (features.lights || b.style === 'futuristic') {
    const glowColor = styleInfo.accent || '#c084fc'
    ctx.shadowColor = glowColor
    ctx.shadowBlur = 6 + Math.sin(t * 0.03) * 3
    ctx.strokeStyle = glowColor
    ctx.lineWidth = 1
    ctx.strokeRect(-TILE_W / 2 + 4, TILE_H / 2 - totalH + 2, 2, totalH - 4)
    ctx.strokeRect(TILE_W / 2 - 6, TILE_H / 2 - totalH + 2, 2, totalH - 4)
    ctx.shadowBlur = 0
  }

  // Antenna
  if (features.antenna) {
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, roofBase - 2)
    ctx.lineTo(0, roofBase - 16)
    ctx.stroke()
    // Blinking light
    if (Math.sin(t * 0.05) > 0) {
      ctx.beginPath()
      ctx.arc(0, roofBase - 16, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ef4444'
      ctx.fill()
    }
  }

  ctx.restore()
}

function drawClouds() {
  const nightFactor = getNightFactor()
  state.clouds.forEach(c => {
    const { cx, cy } = worldToCanvas(c.x, c.y)
    ctx.save()
    ctx.globalAlpha = c.opacity * (1 - nightFactor * 0.5)
    ctx.fillStyle = '#e2e8f0'
    ctx.beginPath()
    ctx.ellipse(cx, cy, c.w / 2 * state.camera.zoom, 12 * state.camera.zoom, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.ellipse(cx - c.w * 0.2 * state.camera.zoom, cy - 4 * state.camera.zoom, c.w * 0.3 * state.camera.zoom, 10 * state.camera.zoom, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

function drawWalkers() {
  state.walkers.forEach(w => {
    const curGx = w.gx + (w.targetGx - w.gx) * w.progress
    const curGy = w.gy + (w.targetGy - w.gy) * w.progress
    const { sx, sy } = isoToScreen(curGx, curGy)
    const { cx, cy } = worldToCanvas(sx, sy + TILE_H / 2)

    ctx.save()
    ctx.translate(cx, cy)
    const s = state.camera.zoom
    // Body
    ctx.fillStyle = w.color
    ctx.fillRect(-1.5 * s, -6 * s, 3 * s, 4 * s)
    // Head
    ctx.beginPath()
    ctx.arc(0, -8 * s, 2 * s, 0, Math.PI * 2)
    ctx.fillStyle = '#fcd34d'
    ctx.fill()
    ctx.restore()
  })
}

function drawCars() {
  state.cars.forEach(c => {
    const { sx, sy } = isoToScreen(c.gx, c.gy)
    const { cx, cy } = worldToCanvas(sx, sy + TILE_H / 2)

    ctx.save()
    ctx.translate(cx, cy)
    const s = state.camera.zoom
    // Car body
    ctx.fillStyle = c.color
    ctx.fillRect(-5 * s, -3 * s, 10 * s, 4 * s)
    // Roof
    ctx.fillStyle = shadeColor(c.color, 0.8)
    ctx.fillRect(-3 * s, -5 * s, 6 * s, 2 * s)
    ctx.restore()
  })
}

function drawSkyGradient() {
  const nightFactor = getNightFactor()
  const topColor = mixColor('#1e3a5f', '#050510', nightFactor * 0.7)
  const bottomColor = mixColor('#2c4c77', '#0a0e1a', nightFactor * 0.6)
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0, topColor)
  grad.addColorStop(1, bottomColor)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Stars at night
  if (nightFactor > 0.3) {
    ctx.fillStyle = `rgba(255,255,255,${nightFactor * 0.6})`
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5 + 42) % canvas.width)
      const sy = ((i * 97.3 + 18) % (canvas.height * 0.5))
      const twinkle = 1 + Math.sin(state.animFrame * 0.02 + i) * 0.4
      ctx.beginPath()
      ctx.arc(sx, sy, twinkle, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Moon
  if (nightFactor > 0.3) {
    ctx.fillStyle = `rgba(244,228,168,${nightFactor * 0.8})`
    ctx.beginPath()
    ctx.arc(canvas.width - 100, 80, 28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = mixColor('#1e3a5f', '#050510', nightFactor * 0.7)
    ctx.beginPath()
    ctx.arc(canvas.width - 90, 74, 24, 0, Math.PI * 2)
    ctx.fill()
  }

  // Sun
  if (nightFactor < 0.4) {
    const sunAlpha = 1 - nightFactor * 2.5
    ctx.fillStyle = `rgba(251,191,36,${sunAlpha * 0.9})`
    ctx.beginPath()
    ctx.arc(120, 70, 24, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(251,191,36,${sunAlpha * 0.15})`
    ctx.beginPath()
    ctx.arc(120, 70, 48, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawWeatherEffects() {
  if (!weatherCanvas) return
  weatherCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height)

  if (state.weather === 'rain') {
    weatherCtx.strokeStyle = 'rgba(96,165,250,0.35)'
    weatherCtx.lineWidth = 1
    for (let i = 0; i < 120; i++) {
      const x = (i * 17 + state.animFrame * 3.5) % weatherCanvas.width
      const y = (i * 31 + state.animFrame * 8) % weatherCanvas.height
      weatherCtx.beginPath()
      weatherCtx.moveTo(x, y)
      weatherCtx.lineTo(x - 2, y + 12)
      weatherCtx.stroke()
    }
  } else if (state.weather === 'snow') {
    weatherCtx.fillStyle = 'rgba(255,255,255,0.6)'
    for (let i = 0; i < 80; i++) {
      const x = (i * 23 + state.animFrame * 0.5 + Math.sin(state.animFrame * 0.01 + i) * 20) % weatherCanvas.width
      const y = (i * 37 + state.animFrame * 1.2) % weatherCanvas.height
      weatherCtx.beginPath()
      weatherCtx.arc(x, y, 2, 0, Math.PI * 2)
      weatherCtx.fill()
    }
  } else if (state.weather === 'fog') {
    for (let i = 0; i < 5; i++) {
      const y = 100 + i * 100 + Math.sin(state.animFrame * 0.005 + i) * 30
      weatherCtx.fillStyle = `rgba(200,210,230,${0.04 + Math.sin(state.animFrame * 0.003 + i) * 0.02})`
      weatherCtx.fillRect(0, y, weatherCanvas.width, 80)
    }
  }
}

function gameLoop(timestamp) {
  if (!canvas) { requestAnimationFrame(gameLoop); return }
  const dt = timestamp - lastTime
  lastTime = timestamp
  state.animFrame++
  state.dayTime += dt

  // Resize canvas
  if (canvas.width !== canvas.clientWidth * 2 || canvas.height !== canvas.clientHeight * 2) {
    canvas.width = canvas.clientWidth * 2
    canvas.height = canvas.clientHeight * 2
  }
  if (weatherCanvas && (weatherCanvas.width !== weatherCanvas.clientWidth * 2 || weatherCanvas.height !== weatherCanvas.clientHeight * 2)) {
    weatherCanvas.width = weatherCanvas.clientWidth * 2
    weatherCanvas.height = weatherCanvas.clientHeight * 2
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  updateEntities()

  drawSkyGradient()
  drawClouds()
  drawGrid()
  drawCars()

  // Draw buildings sorted by position for depth
  const sorted = [...state.buildings].sort((a, b) => (a.position_x + a.position_y) - (b.position_x + b.position_y))
  sorted.forEach(b => drawIsometricBuilding(b))

  drawWalkers()
  drawWeatherEffects()

  requestAnimationFrame(gameLoop)
}

// ===================== INPUT HANDLING =====================
function setupCanvasInput() {
  canvas = document.querySelector('.game-canvas')
  ctx = canvas.getContext('2d')
  weatherCanvas = document.querySelector('.weather-overlay canvas')
  weatherCtx = weatherCanvas?.getContext('2d')

  let pointers = new Map()

  canvas.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 1) {
      state.dragging = true
      state.dragStart = { x: e.clientX, y: e.clientY }
      state.cameraStart = { x: state.camera.x, y: state.camera.y }
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()]
      state.pinchStart = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      state.zoomStart = state.camera.zoom
    }
  })

  canvas.addEventListener('pointermove', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 1 && state.dragging) {
      const dx = (e.clientX - state.dragStart.x) / state.camera.zoom
      const dy = (e.clientY - state.dragStart.y) / state.camera.zoom
      state.camera.x = state.cameraStart.x + dx
      state.camera.y = state.cameraStart.y + dy
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()]
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      state.camera.zoom = Math.max(0.3, Math.min(3, state.zoomStart * (dist / state.pinchStart)))
    }
  })

  const pointerEnd = e => {
    pointers.delete(e.pointerId)
    if (pointers.size === 0) state.dragging = false
  }
  canvas.addEventListener('pointerup', pointerEnd)
  canvas.addEventListener('pointercancel', pointerEnd)

  // Mouse wheel zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    state.camera.zoom = Math.max(0.3, Math.min(3, state.camera.zoom * delta))
  }, { passive: false })

  // Click to select building
  canvas.addEventListener('click', e => {
    if (Math.abs(e.clientX - state.dragStart.x) > 8 || Math.abs(e.clientY - state.dragStart.y) > 8) return
    const rect = canvas.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width)
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height)
    const { wx, wy } = canvasToWorld(canvasX, canvasY)
    const { gx, gy } = screenToIso(wx, wy)

    const clicked = state.buildings.find(b => b.position_x === gx && b.position_y === gy)
    if (clicked) {
      state.selectedBuilding = clicked
      state.popupPos = { x: e.clientX, y: e.clientY }
      renderUI()
    } else {
      state.selectedBuilding = null
      renderUI()
    }
  })
}

// ===================== WEATHER =====================
function cycleWeather() {
  const idx = WEATHER_TYPES.indexOf(state.weather)
  state.weather = WEATHER_TYPES[(idx + 1) % WEATHER_TYPES.length]
}

setInterval(() => {
  cycleWeather()
  renderUI()
}, 30000)

// ===================== POLLING =====================
setInterval(async () => {
  if (!state.entered) return
  await loadBuildings()
  await loadChat()
  renderUI()
}, POLL_INTERVAL)

// ===================== RENDER =====================
function renderUI() {
  if (!state.entered) {
    app.innerHTML = renderNameScreen()
    bindNameEvents()
    return
  }

  const stats = getCityStats()
  const nightFactor = getNightFactor()

  app.innerHTML = `
    <canvas class="game-canvas"></canvas>
    <div class="daynight-overlay" style="background: rgba(5,5,16,${nightFactor * 0.25})"></div>
    <div class="weather-overlay"><canvas></canvas></div>

    <div class="topbar">
      <span class="city-title"><i class="fa-solid fa-city"></i> World Builder</span>
      <div class="stats">
        <span class="stat-badge pop"><i class="fa-solid fa-users"></i> ${stats.population.toLocaleString()}</span>
        <span class="stat-badge happy"><i class="fa-solid fa-face-smile"></i> ${stats.happiness}%</span>
        <span class="stat-badge weather" id="weather-toggle"><i class="fa-solid ${WEATHER_ICONS[state.weather]}"></i> ${state.weather}</span>
        <span class="stat-badge builds"><i class="fa-solid fa-building"></i> ${stats.total}</span>
      </div>
    </div>

    <button class="drawer-toggle" id="drawer-toggle"><i class="fa-solid fa-bars"></i></button>

    <div class="side-drawer ${state.drawerOpen ? 'open' : ''}" id="side-drawer">
      <div class="drawer-header">
        <h2><i class="fa-solid fa-chart-bar"></i> City Panel</h2>
        <button class="drawer-close" id="drawer-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="drawer-body">
        <div class="drawer-section">
          <h3><i class="fa-solid fa-trophy"></i> Leaderboard</h3>
          ${stats.leaderboard.slice(0, 10).map((lb, i) => `
            <div class="leaderboard-item">
              <div class="lb-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal'}">${i + 1}</div>
              <span class="lb-name">${esc(lb.name)}</span>
              <span class="lb-count">${lb.count} 🏗️</span>
            </div>
          `).join('') || '<p style="color:var(--muted);font-size:.8rem;">No buildings yet.</p>'}
        </div>

        <div class="drawer-section">
          <h3><i class="fa-solid fa-clock-rotate-left"></i> Recent Buildings</h3>
          ${state.buildings.slice(-10).reverse().map(b => `
            <div class="building-log-item">
              <div class="bl-name">${BUILDING_TYPES[b.building_type]?.emoji || '🏗️'} ${esc(b.builder_name)}</div>
              <div class="bl-desc">${esc(b.description)}</div>
              <div class="bl-time">${fmtTime(b.created_at)}</div>
            </div>
          `).join('') || '<p style="color:var(--muted);font-size:.8rem;">No buildings yet.</p>'}
        </div>

        <div class="drawer-section chat-section">
          <h3><i class="fa-solid fa-comments"></i> City Chat</h3>
          <div class="chat-messages" id="chat-messages">
            ${state.chatMessages.map(m => `
              <div class="chat-msg">
                <div class="cm-name">${esc(m.builder_name)}</div>
                <div class="cm-text">${esc(m.message)}</div>
              </div>
            `).join('') || '<p style="color:var(--muted);font-size:.75rem;">No messages yet.</p>'}
          </div>
          <div class="chat-input-row">
            <input id="chat-input" placeholder="Say something..." maxlength="200">
            <button id="chat-send"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    </div>

    ${state.selectedBuilding ? renderBuildingPopup() : ''}

    <div class="build-panel">
      <div class="build-row">
        <input class="build-input" id="build-input" placeholder="Describe a building... e.g. a tall glass skyscraper" maxlength="300" ${state.buildBusy ? 'disabled' : ''}>
        <button class="build-btn" id="build-btn" ${state.buildBusy ? 'disabled' : ''}><i class="fa-solid fa-hammer"></i> Build</button>
      </div>
      <div class="build-hint">Try: "a medieval castle with a moat" or "a tiny rustic cottage with a garden"</div>
    </div>

    ${state.toastText ? `<div class="toast">${esc(state.toastText)}</div>` : ''}
  `

  setupCanvasInput()
  bindGameEvents()
}

function renderNameScreen() {
  return `
    <div class="name-screen">
      <div class="name-card">
        <div class="logo">🏙️</div>
        <h1>World Builder</h1>
        <p>Build cities together. Describe any building you can imagine and watch it appear in a shared isometric world.</p>
        <input id="name-input" placeholder="Enter your builder name..." maxlength="30">
        <button id="name-btn">Enter the City</button>
      </div>
    </div>
  `
}

function renderBuildingPopup() {
  const b = state.selectedBuilding
  if (!b) return ''
  const typeInfo = BUILDING_TYPES[b.building_type] || BUILDING_TYPES.default
  let px = state.popupPos?.x || 200
  let py = state.popupPos?.y || 200
  // Keep popup on screen
  if (px > window.innerWidth - 290) px = window.innerWidth - 290
  if (py > window.innerHeight - 200) py = window.innerHeight - 200
  if (px < 10) px = 10
  if (py < 60) py = 60

  return `
    <div class="building-popup" style="left:${px}px;top:${py}px;">
      <button class="bp-close" id="popup-close"><i class="fa-solid fa-xmark"></i></button>
      <div class="bp-type">${typeInfo.emoji} ${esc(b.building_type)} · ${esc(b.style || 'standard')}</div>
      <div class="bp-desc">${esc(b.description)}</div>
      <div class="bp-builder">Built by <strong>${esc(b.builder_name)}</strong></div>
      <div class="bp-time">Tile (${b.position_x}, ${b.position_y}) · ${b.floors || 1} floors · ${fmtTime(b.created_at)}</div>
    </div>
  `
}

// ===================== EVENTS =====================
function bindNameEvents() {
  const input = document.getElementById('name-input')
  const btn = document.getElementById('name-btn')
  if (!input || !btn) return

  const enter = async () => {
    const name = input.value.trim()
    if (!name) return
    state.playerName = name
    state.entered = true
    await loadBuildings()
    await loadChat()
    initEntities()
    // Center camera on middle of grid
    const { sx, sy } = isoToScreen(GRID_SIZE / 2, GRID_SIZE / 2)
    state.camera.x = -sx
    state.camera.y = -sy
    renderUI()
    requestAnimationFrame(gameLoop)
  }

  btn.addEventListener('click', enter)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') enter() })
}

function bindGameEvents() {
  document.getElementById('drawer-toggle')?.addEventListener('click', () => {
    state.drawerOpen = !state.drawerOpen
    renderUI()
  })
  document.getElementById('drawer-close')?.addEventListener('click', () => {
    state.drawerOpen = false
    renderUI()
  })
  document.getElementById('popup-close')?.addEventListener('click', () => {
    state.selectedBuilding = null
    renderUI()
  })

  document.getElementById('weather-toggle')?.addEventListener('click', () => {
    cycleWeather()
    renderUI()
  })

  const buildInput = document.getElementById('build-input')
  const buildBtn = document.getElementById('build-btn')
  if (buildInput && buildBtn) {
    const doBuild = async () => {
      const desc = buildInput.value.trim()
      if (!desc || state.buildBusy) return
      state.buildBusy = true
      renderUI()
      try {
        await placeBuilding(desc)
      } catch (e) {
        console.error('Build error:', e.message)
        toast('Build failed: ' + e.message)
      }
      state.buildBusy = false
      // Refocus input after re-render
      renderUI()
      const newInput = document.getElementById('build-input')
      if (newInput) { newInput.value = ''; newInput.focus() }
    }
    buildBtn.addEventListener('click', doBuild)
    buildInput.addEventListener('keydown', e => { if (e.key === 'Enter') doBuild() })
  }

  const chatInput = document.getElementById('chat-input')
  const chatSend = document.getElementById('chat-send')
  if (chatInput && chatSend) {
    const doChat = async () => {
      const msg = chatInput.value.trim()
      if (!msg) return
      try {
        await sendChat(msg)
      } catch (e) { console.error('Chat error:', e.message) }
      renderUI()
    }
    chatSend.addEventListener('click', doChat)
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') doChat() })
  }

  // Scroll chat to bottom
  const chatEl = document.getElementById('chat-messages')
  if (chatEl) chatEl.scrollTop = chatEl.scrollHeight
}

// ===================== INIT =====================
renderUI()

} catch (e) {
  console.error('App error:', e.message, e.stack)
  document.getElementById('app').innerHTML = `<div style="padding:40px;color:#f87171;"><h2>Error</h2><p>${e.message}</p></div>`
}
