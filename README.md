# BINGO FEVER 🎉

A premium multiplayer Bingo game — mobile-first, festival-inspired, with spring-physics UI, PixiJS WebGL particles, and a Node.js WebSocket backend.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Framer Motion |
| State | Zustand |
| Particles | PixiJS 8 |
| Audio | Web Audio API (procedural) |
| Backend | Node.js + ws (WebSockets) |
| PRNG | Mulberry32 (seeded, fair) |

## Project Structure

```
bingo/
├── server/          Node.js WebSocket server
│   └── src/
│       ├── index.js            Entry point
│       ├── services/
│       │   ├── RoomService.js  Room + player lifecycle
│       │   └── GameEngine.js   Seeded number calling + win validation
│       └── utils/prng.js       Mulberry32 PRNG
│
└── client/          React + Vite frontend
    └── src/
        ├── App.jsx             Root, gradient bg, screen router
        ├── screens/            LobbyScreen / RoomScreen / SetupScreen / GameScreen / VictoryScreen
        ├── components/
        │   ├── board/          BingoBoard, BingoTile
        │   ├── ui/             Button, GlassPanel
        │   ├── NumberDeck.jsx  Drag-and-drop card deck
        │   ├── CalledNumbers   Horizontal scroll call history
        │   └── VolumeControl   Master/music/SFX sliders
        ├── store/gameStore.js  Zustand state
        ├── hooks/useWebSocket  WS connection + message handler
        ├── audio/audioEngine   Web Audio API (procedural sounds + BGM)
        ├── pixi/ParticleSystem PixiJS background particles + confetti
        └── utils/              PRNG, boardUtils (win check, near-win)
```

## Getting Started

### 1. Install & run the server
```bash
cd server
npm install
npm run dev
```
Server starts on `ws://localhost:3001`.

### 2. Install & run the client
```bash
cd client
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

### Environment (optional)
Create `client/.env` to point at a remote server:
```
VITE_WS_URL=ws://your-server:3001
```

## Game Flow

```
Lobby ──► Room ──► Setup ──► Game ──► Victory
```

1. **Lobby** — Enter name, create or join a room (6-char code)
2. **Room** — Host picks board size (5–10), shares room code, starts setup
3. **Setup** — Each player arranges their n×n board:
   - **Auto-Assign** — cards scatter, then fly into position with spring animation
   - **Manual** — drag cards from the deck onto grid cells (60-second timer)
4. **Game** — Server calls numbers every 2 s; tap tiles to mark (or enable Auto-Mark); claim BINGO when a line completes
5. **Victory** — Server validates win; confetti, fanfare, winner revealed

## Features

- Dynamic n×n boards (n = 5–10), numbers 1 to n²
- Server-side seeded PRNG (reproducible, fair)
- Server-authoritative win validation
- Reconnection with full state restore (30-second grace period)
- Procedural audio (Web Audio API) — no audio files needed
- PixiJS GPU-accelerated particle background
- Spring-physics tile bounce, card drag, screen transitions (Framer Motion)
- Glassmorphism UI with animated gradient backgrounds
- Volume controls (master / music / SFX)
- Mobile-first, large touch targets, gesture smoothing
