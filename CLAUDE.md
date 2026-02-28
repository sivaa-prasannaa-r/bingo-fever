# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Running the Project

Two processes must run concurrently. They are independent — kill and restart either one without affecting the other.

```bash
# Server (ws://localhost:3001)
cd server && npm install && npm run dev

# Client (http://localhost:5173)
cd client && npm install && npm run dev
```

Or use the convenience script from the repo root:
```bash
bash start.sh
```

`start.sh` auto-installs dependencies if `node_modules` is missing, starts both processes, and kills both on `Ctrl+C`.

**Port conflicts on Windows:** If ports are stuck after a crash, kill by PID:
```bash
netstat -ano | findstr ":3001"   # find PID
taskkill /F /PID <PID>
```

There are no tests, no linting config, and no build step for the server. The client build is:
```bash
cd client && npm run build   # outputs to client/dist/
cd client && npm run preview # preview the production build
```

**Environment variable:** Create `client/.env` to point the client at a non-local server:
```
VITE_WS_URL=ws://your-host:3001
```

---

## Architecture

### Communication Model

All client↔server communication is JSON over a single persistent WebSocket connection. Every message is `{ type: string, payload: object }`. The server is fully authoritative — it holds all room state, runs the number-calling engine, validates wins, and enforces the setup deadline. The client holds a mirror of the room state plus its own board arrangement and marked numbers.

### Game State Machine

```
LOBBY → ROOM → SETUP (60 s timer) → COUNTDOWN (3-2-1) → GAME → VICTORY
                                          ↑ auto-fill if timer expires
```

The server tracks its own room state (`LOBBY | SETUP | COUNTDOWN | GAME | ENDED`). The client tracks a parallel screen state (`LOBBY | ROOM | SETUP | GAME | VICTORY`) held in Zustand. Screen transitions are driven by incoming WebSocket messages handled in `client/src/hooks/useWebSocket.js`. The Zustand `screen` field is the single source of truth for which React screen component renders.

### WebSocket Protocol (complete reference)

**Client → Server**

| Type | Payload | When |
|------|---------|------|
| `CREATE_ROOM` | `{ playerName, boardSize }` | Lobby — create room |
| `JOIN_ROOM` | `{ playerName, roomId }` | Lobby — join existing room |
| `UPDATE_BOARD_SIZE` | `{ boardSize }` | Room — host changes size |
| `START_SETUP` | `{ boardSize }` | Room — host starts |
| `SUBMIT_BOARD` | `{ arrangement: number[] }` | Setup — player ready |
| `MARK_TILE` | `{ number }` | Game — manual mark |
| `CLAIM_WIN` | `{}` | Game — BINGO claim |
| `RECONNECT` | `{ savedPlayerId, roomId }` | On reconnect |

**Server → Client**

| Type | Payload | Triggers |
|------|---------|---------|
| `CONNECTED` | `{ playerId }` | Every new connection — always overwrite local `playerId` |
| `RECONNECTED` | `{ playerId, room, calledNumbers, board }` | Successful reconnect |
| `RECONNECT_FAILED` | `{}` | Session expired |
| `ROOM_CREATED` | `{ room }` | After `CREATE_ROOM` |
| `ROOM_JOINED` | `{ room }` | After `JOIN_ROOM` |
| `ROOM_UPDATED` | serialized room | Any player join/leave/ready change |
| `SETUP_STARTED` | `{ boardSize, deadlineMs, room }` | Host starts setup |
| `BOARD_AUTO_FILLED` | `{ arrangement }` | Server auto-fills after 60 s |
| `GAME_COUNTDOWN` | `{ count: 3|2|1|0 }` | One per second before start |
| `GAME_STARTED` | `{ room }` | Game begins |
| `NUMBER_CALLED` | `{ number, sequence }` | Every 2 seconds during game |
| `TILE_MARKED` | `{ playerId, number }` | Echoed to all players |
| `LINE_COMPLETED` | `{ playerId, type, index }` | Unused — client detects locally |
| `GAME_ENDED` | `{ winner, reason, lineInfo }` | Win or numbers exhausted |
| `WIN_REJECTED` | `{ message }` | Invalid CLAIM_WIN |
| `ERROR` | `{ message }` | Server error |

### Zustand Store (`client/src/store/gameStore.js`)

One flat store — no slices. Key non-obvious fields:

- `markedNumbers` is a `Set<number>` (not an array) — create new Set on every update for React reactivity
- `completedLines` is `Array<{ type: 'row'|'col'|'diag', index, playerId }>`
- `pendingWin` — set `true` when client detects a winning line; shows the BINGO claim button
- `countdownValue` — `3|2|1|0|null`; when `null`, overlay is hidden
- `setupDeadlineMs` — Unix timestamp of the 60-second setup deadline
- `playerId` and `playerName` are persisted in `localStorage` (`bingo_pid`, `bingo_name`)
- **Critical:** `playerId` must always be overwritten by the server's `CONNECTED` payload, never conditionally — stale localStorage values cause the host not to recognise themselves as host

### Server Services

**`RoomService`** (`server/src/services/RoomService.js`)
- Owns all room lifecycle: create, join, leave, setup, submit board, start, end
- Tracks two maps: `rooms: Map<roomId, room>` and `playerRoom: Map<playerId, roomId>`
- `serialize(room)` strips internals (engine, timers) for wire transmission
- On player disconnect, a 30-second `setTimeout` evicts them if they never reconnect
- Auto-fill: a `setTimeout` at 60 s generates random boards for unready players via `autoBoard(n)` and calls `onAutoFill(room)` callback

**`GameEngine`** (`server/src/services/GameEngine.js`)
- Instantiated per game, seeded with `room.gameSeed = Date.now()`
- `generateSequence()` uses Mulberry32 PRNG + Fisher-Yates to build a deterministic call order
- `_callNext()` uses `setTimeout` (not `setInterval`) to call numbers every 2 seconds
- `validateWin(board)` checks rows, columns, and both diagonals against `calledNumbers`
- `stop()` clears the timer — must be called on game end to prevent leaks

**`RoomService._roomOf(playerId)`** is the internal helper for all per-player lookups.

### Win Detection — Two Layers

**Client (optimistic, for UI only):** `boardUtils.checkWin(board, markedNumbers, n)` runs in `GameScreen` after every `NUMBER_CALLED`. Sets `pendingWin = true` which shows the BINGO button. Also runs `nearWinCount()` to trigger audio anticipation.

**Server (authoritative):** On `CLAIM_WIN`, `GameEngine.validateWin(player.board)` checks all lines against `calledNumbers`. If valid, broadcasts `GAME_ENDED`; if not, sends `WIN_REJECTED` and resets `pendingWin` on the client.

`isInLine(position, completedLines, n)` in `boardUtils.js` maps a flat board index to row/col/diagonal membership for tile glow rendering.

### PRNG and Fairness

Both `server/src/utils/prng.js` and `client/src/utils/prng.js` contain identical Mulberry32 implementations. The number call sequence is generated once on the server using `room.gameSeed` and is consumed monotonically. Board auto-assignment uses a different seed (`Date.now() ^ Math.random()`). Reconnecting clients receive the full `calledNumbers` array to catch up.

### Audio Engine (`client/src/audio/audioEngine.js`)

No audio files — all sounds are synthesised from Web Audio API oscillators. Architecture:

```
AudioContext → masterGain ← musicGain (BGM)
                          ← sfxGain  (SFX)
```

`init()` is async and must be called from a user gesture handler (browser requirement). It is called lazily from `App.jsx`'s `onClick`/`onTouchStart`. All sound methods silently no-op if `init()` has not been called.

`duckMusic(durationMs)` reduces `musicGain` to 15% for the given duration then restores it — used during number reveals.

BGM is a procedural pentatonic loop firing every 450 ms via `setInterval`.

### Particle System (`client/src/pixi/ParticleSystem.js`)

Loaded with a **dynamic import** inside `useEffect` — it will not block React render if PixiJS fails to load. PixiJS 8 API is used (`app.init()` async, `g.circle()` + `g.fill()` drawing pattern — not the PixiJS 7 `beginFill/endFill` API).

`setIntensity(v)` scales particle velocity — called by `App.jsx` on every screen change with preset values (`GAME: 1.6`, `VICTORY: 2.8`).

`spawnConfetti(n)` adds short-lived rectangular particles with gravity + air drag on the victory screen.

### CSS Architecture (`client/src/styles/globals.css`)

**Critical rule:** Framer Motion cannot interpolate CSS gradient strings. Background gradients are applied as inline `backgroundImage` via React `style` prop (not via `animate`). The `.bg-gradient` div is a fixed full-screen overlay.

Glassmorphism panels use `rgba(0,0,0,0.35)` (dark) not white — this ensures text remains readable on all screen gradients. The `html/body` base is `#1a0030` so any transparency shows deep purple, not white.

The bingo board uses a single CSS variable `--board-n` on `.bingo-board` to set `grid-template-columns: repeat(var(--board-n), 1fr)`. Tile sizing uses `clamp(0.7rem, 2.5vw, 1.1rem)` for font and `aspect-ratio: 1` for shape.

Design tokens:
```css
--primary: #FF6B9D  --secondary: #4ECDC4  --accent: #6C63FF
--gold: #FFE66D     --coral: #FF6B6B      --azure: #00D2FF
--radius-lg: 28px   --radius: 20px        --radius-sm: 12px
```

Spring easing: `--spring: cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot bounce).

### Setup Modes

**Auto-Assign:** Entirely client-side. A PRNG shuffles `[1..n²]`, stores it in `boardArrangement`, then an animation sequence runs: `scatter` phase (cards displaced by random offsets via Framer Motion), followed by `fly` phase (cards spring to zero offset with 42 ms staggered delay per card). The auto-submits `SUBMIT_BOARD` when the animation finishes.

**Manual Placement:** `NumberDeck.jsx` renders the unplaced deck. Drag-and-drop uses raw pointer/touch events with `document.elementFromPoint()` to detect drop targets — no HTML5 Drag API (not mobile-friendly). The board cells are identified by `data-cell-index` attributes. The `deck` is derived as `allNumbers.filter(n => !Object.values(placed).includes(n))`.

### Screen Transitions

`AnimatePresence mode="wait"` in `App.jsx` wraps all screens with `key={screen}`. Exit animation plays before enter animation. Transitions are `opacity + scale + y` (40 ms). Each screen uses a CSS gradient background set via `backgroundImage` inline style — gradients change instantly (CSS cannot animate between gradient strings).

---

## Data Shapes

**Serialized Room (over wire):**
```javascript
{
  id: string,          // e.g. "K3G0"
  boardSize: number,   // 5–10
  state: string,       // LOBBY | SETUP | COUNTDOWN | GAME | ENDED
  host: string,        // playerId of host
  setupDeadlineMs: number | null,
  players: Array<{ id, name, ready, connected }>
}
```

**Board Arrangement:** Flat `number[]` of length `n²`, row-major order. `board[r * n + c]` is the number at row `r`, column `c`.

**CompletedLine:** `{ type: 'row' | 'col' | 'diag', index: number, playerId: string }`
- `row`: `index` is the row number (0-based)
- `col`: `index` is the column number (0-based)
- `diag`: `index 0` = top-left→bottom-right, `index 1` = top-right→bottom-left

---

## Non-Obvious Gotchas

- **`playerId` must always be overwritten on `CONNECTED`** — the `if (!s.playerId)` guard (keeping stale localStorage values) causes the host to see "Waiting for host to start" because `room.host` never matches the local `playerId`.

- **Framer Motion cannot animate gradients** — passing a gradient string to `animate={{ background: ... }}` causes a runtime crash. Use inline `style={{ backgroundImage: ... }}` instead.

- **PixiJS 8 drawing API** — uses `g.circle(x, y, r); g.fill({ color, alpha })` not the PixiJS 7 `beginFill / drawCircle / endFill` chain.

- **`markedNumbers` is a Set** — must create a new `Set` instance (not mutate) on every update for Zustand to trigger re-renders: `new Set([...prev, number])`.

- **Auto-mark** — when enabled, `addCalledNumber()` in the store automatically adds the number to `markedNumbers`. The server does not track individual tile marks; it only validates the full board against `calledNumbers` on `CLAIM_WIN`.

- **Server port conflict on Windows** — `taskkill /F /IM node.exe` kills all Node processes including the client's Vite server. Use `netstat -ano | findstr ":3001"` to find the specific PID instead.

- **`LINE_COMPLETED` is never sent by the server** — line detection is client-only (via `boardUtils.checkWin`). The `LINE_COMPLETED` case in `useWebSocket.js` is a stub.
