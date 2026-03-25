# 🏗️ World Builder

A **multiplayer isometric city-building game** where players describe buildings in natural language and watch them appear in a shared 3D isometric world — in real time.

![World Builder Banner](https://placehold.co/1200x400/0a0e1a/6366f1?text=World+Builder)

## 🎮 Play Now

Open `index.html` in your browser, enter your name, and start building!

> *Describe any building — "a tall red castle with a moat" or "futuristic glass skyscraper" — and the NLP parser brings it to life on the isometric grid.*

## ✨ Features

- **Natural Language Building** — Type a description like "small rustic bakery" or "massive neon tower" and the game parses building type, style, color, height, roof, and special features automatically.
- **Multiplayer** — All players share the same world. Buildings appear in real time via Supabase.
- **Isometric Rendering** — Full canvas-based isometric grid with depth sorting, shadows, and perspective.
- **Day/Night Cycle** — Dynamic 2-minute day/night cycle with ambient lighting changes.
- **Weather System** — Sunny, cloudy, rain, snow, and fog with animated particle effects.
- **NPC Life** — Walkers and cars move around the city autonomously.
- **Building Variety** — 17 building types (house, castle, skyscraper, park, fountain, hospital, etc.) each with unique rendering.
- **Style System** — Modern, medieval, futuristic, and rustic architectural styles with distinct visual treatments.
- **Special Features** — Smoke stacks, flags, antenna, moats, rooftop gardens, neon lights, and more based on your description.
- **Live Chat** — In-game multiplayer chat to coordinate with other builders.
- **Leaderboard** — See who has built the most in the world.
- **Building Log** — Scrollable history of everything built.
- **Procedural Audio** — City ambience, construction SFX, weather sounds, and day/night music via Web Audio API.
- **Mobile Friendly** — Touch controls for pan, pinch-to-zoom, and building on mobile devices.

## 🖼️ Screenshots

| Isometric City View | Building Popup | Chat & Leaderboard |
|---|---|---|
| ![city](https://placehold.co/400x300/0a0e1a/34d399?text=City+View) | ![popup](https://placehold.co/400x300/0a0e1a/f472b6?text=Building+Info) | ![chat](https://placehold.co/400x300/0a0e1a/fbbf24?text=Chat+%26+LB) |

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Rendering** | HTML5 Canvas (isometric engine) |
| **Frontend** | Vanilla JS (ES modules), Inter + Press Start 2P fonts |
| **Backend** | [Supabase](https://supabase.com) (Postgres + Realtime) |
| **Audio** | Web Audio API (procedural synthesis, no external files) |
| **Icons** | Font Awesome 6 |
| **Styling** | Custom CSS with CSS variables, glassmorphism panels |

## 📁 Project Structure

```
world-builder/
├── index.html      → Entry point
├── app.js          → Main game logic (state, rendering, Supabase, NLP parser)
├── styles.css      → All styling (dark theme, isometric UI, responsive)
├── focus-fix.js    → Input focus protection (prevents re-render blur)
├── audio.js        → Procedural audio system (ambience, SFX, music)
└── README.md       → This file
```

## 🧠 NLP Building Parser

The parser detects from your text description:

| Attribute | Examples |
|---|---|
| **Type** | "house", "castle", "skyscraper", "park", "fountain", "museum"... |
| **Style** | "modern", "medieval", "futuristic", "rustic" |
| **Color** | "red", "blue", "gold", "emerald", "navy", "crimson"... |
| **Height** | "tiny" (shorter), "tall/big" (taller), "massive/colossal" (tallest) |
| **Roof** | "dome", "spire", "garden roof" |
| **Features** | "smoke/chimney", "flag/banner", "neon/lights", "antenna", "moat" |

## 🎧 Audio System

All audio is **procedurally generated** using the Web Audio API — no external audio files needed:

- 🏙️ City ambience (brown noise + tonal drones)
- 🔨 Construction sounds (noise bursts + rising tones)
- 💬 Chat notification blips
- 🌅 Day/night music transitions (major ↔ minor chord drones)
- 🌧️ Weather sounds (rain noise, snow hush, fog drone)
- 🔇 Mute/unmute toggle button (bottom-right corner)

> Audio starts **muted** by default. Tap the speaker icon to enable.

## 🚀 Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/joseb33w/world-builder.git
   cd world-builder
   ```

2. Open `index.html` in a browser (or use a local server):
   ```bash
   npx serve .
   ```

3. Enter your name and start building!

## 📄 License

MIT — build whatever you want.
