import { useEffect, useRef, useCallback } from 'react';
import useGameStore from '../store/gameStore';
import { audioEngine } from '../audio/audioEngine';
import { nearWinCount } from '../utils/boardUtils';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useWebSocket() {
  const ws = useRef(null);
  const reconnTimer = useRef(null);

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
      s.setPlayerId(payload.playerId);
      break;

    case 'RECONNECTED':
      s.setPlayerId(payload.playerId);
      s.setRoom(payload.room);
      s.setCalledNumbers(payload.calledNumbers ?? []);
      s.setCurrentTurn(payload.currentTurn ?? null);
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
      s.setCountdownValue(payload.count);
      if (payload.count === 0) {
        audioEngine.playCountdownFinal();
        // Switch to GAME after the "GO!" display clears
        setTimeout(() => {
          s.setScreen('GAME');
          s.setCountdownValue(null);
        }, 900);
      } else {
        audioEngine.playCountdownTick();
      }
      break;

    case 'GAME_STARTED':
      s.setScreen('GAME');
      s.setRoom(payload.room);
      s.resetGameData();
      s.setCurrentTurn(payload.currentTurn ?? null);
      s.setTurnDeadlineMs(payload.turnDeadlineMs ?? null);
      break;

    case 'NUMBER_CALLED': {
      audioEngine.duckMusic(2200);
      audioEngine.playNumberReveal(payload.number);
      s.addCalledNumber(payload.number);
      s.setCurrentTurn(payload.nextTurn ?? null);
      s.setTurnDeadlineMs(payload.turnDeadlineMs ?? null);
      s.setLastCalledBy(payload.calledBy ?? null);

      // Update all players' line progress from server data
      if (payload.playerLines) {
        const plMap = {};
        for (const pl of payload.playerLines) {
          plMap[pl.playerId] = { lineCount: pl.lineCount, lines: pl.lines ?? [] };
        }
        s.setPlayerLines(plMap);

        // Update own completed lines for tile highlighting
        const myPl = plMap[s.playerId];
        if (myPl) {
          const myLines = myPl.lines.map((l) => ({ ...l, playerId: s.playerId }));
          const prevCount = s.completedLines.length;
          s.setCompletedLines(myLines);
          // Play sound if a new line was completed
          if (myLines.length > prevCount) {
            audioEngine.playLineComplete();
          }
          // Enable BINGO button when 5 lines reached
          if (myPl.lineCount >= 5 && !s.pendingWin) {
            s.setPendingWin(true);
          }
        }
      }

      // Near-win audio anticipation
      const { boardArrangement, room, markedNumbers, autoMark } = useGameStore.getState();
      if (boardArrangement && room) {
        const newMarked = autoMark
          ? new Set([...markedNumbers, payload.number])
          : markedNumbers;
        const nc = nearWinCount(boardArrangement, newMarked, room.boardSize);
        if (nc > 0) audioEngine.playNearWin();
      }
      break;
    }

    case 'TURN_CHANGED':
      s.setCurrentTurn(payload.nextTurn ?? null);
      s.setTurnDeadlineMs(payload.turnDeadlineMs ?? null);
      break;

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

    case 'GAME_RESET':
      // Host triggered Play Again — go back to room lobby
      s.setRoom(payload.room);
      s.setScreen('ROOM');
      s.setCalledNumbers([]);
      s.setCompletedLines([]);
      s.setPendingWin(false);
      s.setSetupMode(null);
      s.setBoardArrangement(null);
      s.setIsSetupComplete(false);
      s.setCurrentTurn(null);
      s.setTurnDeadlineMs(null);
      s.setPlayerLines({});
      s.setWinner(null);
      s.setGameEndReason(null);
      s.setLastCalledBy(null);
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
