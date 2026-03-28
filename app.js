import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

try {

const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
const supabase = window.__worldBuilderSupabase || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-xhhmxabftbyxrirvvihn-auth-token'
  }
})

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

  let style = 'default'
  if (/modern|contemporary|glass|steel|sleek|minimalist/i.test(lower)) style = 'modern'
  else if (/medieval|ancient|old|gothic|stone|castle/i.test(lower)) style = 'medieval'
  else if (/futuristic|cyber|neon|chrome|sci.?fi|holographic/i.test(lower)) style = 'futuristic'
  else if (/rustic|brick|wood|cabin|cottage|country|farm/i.test(lower)) style = 'rustic'

  let floors = BUILDING_TYPES[buildingType]?.floors || 2
  if (/tiny|small|little|mini|low/i.test(lower)) floors = Math.max(1, floors - 1)
  if (/tall|high|big|large/i.test(lower)) floors = Math.min(7, floors + 2)
  if (/massive|huge|enormous|giant|mega|colossal/i.test(lower)) floors = Math.min(9, floors + 4)

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

  let roofStyle = 'flat'
  if (/dome|round/i.test(lower)) roofStyle = 'dome'
  else if (/spire|point|spike|peak/i.test(lower)) roofStyle = 'spire'
  else if (/garden|green.?roof|rooftop.?garden|plants/i.test(lower)) roofStyle = 'garden'
  else if (buildingType === 'church' || buildingType === 'castle') roofStyle = 'spire'
  else if (style === 'medieval') roofStyle = 'spire'
  else if (floors >= 4) roofStyle = 'flat'
  else roofStyle = 'peaked'

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

function findNextTile() {
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

...[truncated]