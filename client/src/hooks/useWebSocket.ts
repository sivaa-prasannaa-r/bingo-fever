import { useEffect, useRef, useCallback } from 'react';
import useGameStore from '../store/gameStore';
import { audioEngine } from '../audio/audioEngine';
import { nearWinCount } from '../utils/boardUtils';
import type { SendFn, CompletedLine, PlayerLineInfo, SerializedRoom } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useWebSocket(): { send: SendFn } {
  const ws = useRef<WebSocket | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send: SendFn = useCallback((type, payload = {}) => {
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

    socket.onmessage = (e: MessageEvent) => {
      try {
        const { type, payload } = JSON.parse(e.data as string) as { type: string; payload: Record<string, unknown> };
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
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return { send };
}

// ─── Server → client message handler ─────────────────────────────────────────

function handleServerMessage(type: string, payload: Record<string, unknown>, send: SendFn): void {
  const s = useGameStore.getState();

  switch (type) {
    case 'CONNECTED':
      s.setPlayerId(payload.playerId as string);
      break;

    case 'RECONNECTED':
      s.setPlayerId(payload.playerId as string);
      s.setRoom(payload.room as Parameters<typeof s.setRoom>[0]);
      s.setCalledNumbers((payload.calledNumbers as number[]) ?? []);
      s.setCurrentTurn((payload.currentTurn as string | null) ?? null);
      if (payload.board) {
        s.setBoardArrangement(payload.board as number[]);
        s.setIsSetupComplete(true);
      }
      {
        const room = payload.room as { state?: string; setupDeadlineMs?: number } | undefined;
        const state = room?.state;
        if (state === 'GAME' || state === 'COUNTDOWN') s.setScreen('GAME');
        else if (state === 'SETUP') {
          s.setSetupDeadlineMs(room?.setupDeadlineMs ?? null);
          s.setScreen('SETUP');
        } else s.setScreen('ROOM');
      }
      break;

    case 'RECONNECT_FAILED':
      s.setPlayerId(null);
      break;

    case 'ROOM_CREATED':
      s.setRoom(payload.room as Parameters<typeof s.setRoom>[0]);
      s.setScreen('ROOM');
      break;

    case 'ROOM_JOINED':
      s.setRoom(payload.room as Parameters<typeof s.setRoom>[0]);
      s.setScreen('ROOM');
      break;

    case 'ROOM_UPDATED':
      s.setRoom(payload as unknown as SerializedRoom);
      break;

    case 'SETUP_STARTED':
      s.setRoom(payload.room as Parameters<typeof s.setRoom>[0]);
      s.setSetupDeadlineMs(payload.deadlineMs as number);
      s.setBoardArrangement(null);
      s.setIsSetupComplete(false);
      s.setSetupMode(null);
      s.setScreen('SETUP');
      break;

    case 'BOARD_AUTO_FILLED':
      s.setBoardArrangement(payload.arrangement as number[]);
      s.setIsSetupComplete(true);
      break;

    case 'GAME_COUNTDOWN':
      s.setCountdownValue(payload.count as number);
      if (payload.count === 0) {
        audioEngine.playCountdownFinal();
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
      s.setRoom(payload.room as Parameters<typeof s.setRoom>[0]);
      s.resetGameData();
      s.setCurrentTurn((payload.currentTurn as string | null) ?? null);
      s.setTurnDeadlineMs((payload.turnDeadlineMs as number | null) ?? null);
      break;

    case 'NUMBER_CALLED': {
      audioEngine.duckMusic(2200);
      audioEngine.playNumberReveal(payload.number as number);
      s.addCalledNumber(payload.number as number);
      s.setCurrentTurn((payload.nextTurn as string | null) ?? null);
      s.setTurnDeadlineMs((payload.turnDeadlineMs as number | null) ?? null);
      s.setLastCalledBy((payload.calledBy as { id: string; name: string } | null) ?? null);

      if (payload.playerLines) {
        const plArray = payload.playerLines as Array<{ playerId: string; lineCount: number; lines: CompletedLine[] }>;
        const plMap: Record<string, PlayerLineInfo> = {};
        for (const pl of plArray) {
          plMap[pl.playerId] = { lineCount: pl.lineCount, lines: pl.lines ?? [] };
        }
        s.setPlayerLines(plMap);

        const myPl = plMap[s.playerId ?? ''];
        if (myPl) {
          const myLines: CompletedLine[] = myPl.lines.map((l) => ({ ...l, playerId: s.playerId ?? undefined }));
          const prevCount = s.completedLines.length;
          s.setCompletedLines(myLines);
          if (myLines.length > prevCount) audioEngine.playLineComplete();
          if (myPl.lineCount >= 5 && !s.pendingWin) s.setPendingWin(true);
        }
      }

      const { boardArrangement, room, markedNumbers, autoMark } = useGameStore.getState();
      if (boardArrangement && room) {
        const newMarked = autoMark
          ? new Set([...markedNumbers, payload.number as number])
          : markedNumbers;
        const nc = nearWinCount(boardArrangement, newMarked, room.boardSize);
        if (nc > 0) audioEngine.playNearWin();
      }
      break;
    }

    case 'TURN_CHANGED':
      s.setCurrentTurn((payload.nextTurn as string | null) ?? null);
      s.setTurnDeadlineMs((payload.turnDeadlineMs as number | null) ?? null);
      break;

    case 'TILE_MARKED':
      if (payload.playerId === s.playerId) audioEngine.playTileMark();
      break;

    case 'LINE_COMPLETED':
      audioEngine.playLineComplete();
      s.addCompletedLine({
        playerId: payload.playerId as string,
        type: payload.type as CompletedLine['type'],
        index: payload.index as number,
      });
      break;

    case 'GAME_ENDED':
      if (payload.winner) audioEngine.playVictory();
      s.setWinner((payload.winner as Parameters<typeof s.setWinner>[0]) ?? null);
      s.setGameEndReason((payload.reason as string) ?? null);
      s.setWinnerBoard((payload.winnerBoard as number[] | null) ?? null);
      s.setScreen('VICTORY');
      break;

    case 'GAME_RESET':
      s.setRoom(payload.room as Parameters<typeof s.setRoom>[0]);
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
