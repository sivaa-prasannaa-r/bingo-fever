#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Check if rollup's native module matches the current platform.
# node_modules installed on Windows won't work in WSL/Linux, and vice-versa.
rollup_platform_ok() {
  local dir="$ROOT/client/node_modules/@rollup"
  case "$(uname -s)" in
    Linux*)  [ -d "$dir/rollup-linux-x64-gnu" ] || [ -d "$dir/rollup-linux-x64-musl" ] || [ -d "$dir/rollup-linux-arm64-gnu" ] ;;
    Darwin*) [ -d "$dir/rollup-darwin-x64" ] || [ -d "$dir/rollup-darwin-arm64" ] ;;
    *)       [ -d "$dir/rollup-win32-x64-msvc" ] || [ -d "$dir/rollup-win32-x64-gnu" ] ;;
  esac
}

# Install server dependencies if node_modules missing
if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "[setup] Installing server dependencies..."
  (cd "$ROOT/server" && npm install)
fi

# Delete a directory. In WSL, Windows-locked .exe/.node files block rm, so use cmd.exe directly.
remove_dir() {
  if command -v cmd.exe &>/dev/null; then
    cmd.exe /c "rmdir /s /q \"$(wslpath -w "$1")\"" 2>/dev/null || true
  else
    rm -rf "$1"
  fi
}

# Install client dependencies if missing or installed for a different platform
if [ ! -d "$ROOT/client/node_modules" ]; then
  echo "[setup] Installing client dependencies..."
  (cd "$ROOT/client" && npm install)
elif ! rollup_platform_ok; then
  echo "[setup] Platform mismatch detected — reinstalling client dependencies..."
  remove_dir "$ROOT/client/node_modules"
  rm -f "$ROOT/client/package-lock.json"
  (cd "$ROOT/client" && npm install)
else
  # Clear stale Vite dep cache if it exists (can cause 504 errors after platform switch)
  rm -rf "$ROOT/client/node_modules/.vite"
fi

# Start server in background
echo "[server] Starting on ws://localhost:3001 ..."
(cd "$ROOT/server" && npm run dev) &
SERVER_PID=$!

# Give server a moment to bind
sleep 1

# Start client in background
echo "[client] Starting on http://localhost:5173 ..."
(cd "$ROOT/client" && npm run dev) &
CLIENT_PID=$!

echo ""
echo "  BINGO FEVER is running!"
echo "  Client → http://localhost:5173"
echo "  Server → ws://localhost:3001"
echo ""
echo "  Press Ctrl+C to stop both."

# On Ctrl+C, kill both processes
trap 'echo ""; echo "Stopping..."; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0' INT TERM

# Wait for either process to exit
wait $SERVER_PID $CLIENT_PID
