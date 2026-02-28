import { useEffect, useRef, useCallback } from 'react';
import useGameStore from '../store/gameStore';
import { audioEngine } from '../audio/audioEngine';
import { checkWin, nearWinCount } from '../utils/boardUtils';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useWebSocket() {
  const ws = useRef(null);
  const reconnTimer = useRef(null);
  const store = useGameStore.getState;

  const send = useCallback((type, payload = {}) => {
    const socket = ws.current;
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type, payload }));
  }, []);

  const connect = useCallback(() => {
    const socket = new WebSocket(WS_URL);
    ws.current = socket;
    useGameStore.getState().setConnectionState('connecting');

    socket.onopen = () => {
      useGameStore.getState().setConnectionState('connected');
      // Attempt session restore
      const { playerId, room } = useGameStore.getState();
      if (playerId && room) {
        socket.send(JSON.stringify({
          type: 'RECONNECT',
          payload: { savedPlayerId: playerId, roomId: room.id },
        }));
      }
    };

    socket.onmessage = (e) => {
      try {
        const { type, payload } = JSON.parse(e.data);
        handleServerMessage(type, payload, send);
      } catch { /* ignore parse errors */ }
    };

    socket.onclose = () => {
      useGameStore.getState().setConnectionState('disconnected');
      reconnTimer.current = setTimeout(connect, 3000);
    };

    socket.onerror = () => socket.close();
  }, [send]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return { send };
}

// ─── Server → client message handler ─────────────────────────────────────────

function handleServerMessage(type, payload, send) {
  const s = useGameStore.getState();

  switch (type) {
    case 'CONNECTED':
      // Always accept the server-assigned ID — stale localStorage values must not win
      s.setPlayerId(payload.playerId);
      break;

    case 'RECONNECTED':
      s.setPlayerId(payload.playerId);
      s.setRoom(payload.room);
      s.setCalledNumbers(payload.calledNumbers ?? []);
      if (payload.board) {
        s.setBoardArrangement(payload.board);
        s.setIsSetupComplete(true);
      }
      {
        const state = payload.room?.state;
        if (state === 'GAME' || state === 'COUNTDOWN') s.setScreen('GAME');
        else if (state === 'SETUP') {
          s.setSetupDeadlineMs(payload.room.setupDeadlineMs);
          s.setScreen('SETUP');
        } else s.setScreen('ROOM');
      }
      break;

    case 'RECONNECT_FAILED':
      s.setPlayerId(null);
      break;

    case 'ROOM_CREATED':
      s.setRoom(payload.room);
      s.setScreen('ROOM');
      break;

    case 'ROOM_JOINED':
      s.setRoom(payload.room);
      s.setScreen('ROOM');
      break;

    case 'ROOM_UPDATED':
      s.setRoom(payload);
      break;

    case 'SETUP_STARTED':
      s.setRoom(payload.room);
      s.setSetupDeadlineMs(payload.deadlineMs);
      s.setBoardArrangement(null);
      s.setIsSetupComplete(false);
      s.setSetupMode(null);
      s.setScreen('SETUP');
      break;

    case 'BOARD_AUTO_FILLED':
      s.setBoardArrangement(payload.arrangement);
      s.setIsSetupComplete(true);
      break;

    case 'GAME_COUNTDOWN':
      if (payload.count === 3) s.setScreen('GAME');
      s.setCountdownValue(payload.count);
      if (payload.count === 0) {
        audioEngine.playCountdownFinal();
        setTimeout(() => s.setCountdownValue(null), 800);
      } else {
        audioEngine.playCountdownTick();
      }
      break;

    case 'GAME_STARTED':
      s.setScreen('GAME');
      s.setRoom(payload.room);
      s.setCountdownValue(null);
      break;

    case 'NUMBER_CALLED': {
      audioEngine.duckMusic(2200);
      audioEngine.playNumberReveal(payload.number);
      s.addCalledNumber(payload.number);

      // Client-side win check
      const { boardArrangement, room, markedNumbers } = useGameStore.getState();
      if (boardArrangement && room) {
        const newMarked = s.autoMark
          ? new Set([...markedNumbers, payload.number])
          : markedNumbers;
        const win = checkWin(boardArrangement, newMarked, room.boardSize);
        if (win) s.setPendingWin(true);

        const nc = nearWinCount(boardArrangement, newMarked, room.boardSize);
        if (nc > 0) audioEngine.playNearWin();
      }
      break;
    }

    case 'TILE_MARKED':
      if (payload.playerId === s.playerId) audioEngine.playTileMark();
      break;

    case 'LINE_COMPLETED':
      audioEngine.playLineComplete();
      s.addCompletedLine({ playerId: payload.playerId, type: payload.type, index: payload.index });
      break;

    case 'GAME_ENDED':
      if (payload.winner) audioEngine.playVictory();
      s.setWinner(payload.winner);
      s.setGameEndReason(payload.reason);
      s.setScreen('VICTORY');
      break;

    case 'WIN_REJECTED':
      s.setPendingWin(false);
      break;

    case 'ERROR':
      console.error('[Server]', payload.message);
      break;

    default:
      break;
  }
}
