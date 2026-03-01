export type Screen = 'LOBBY' | 'ROOM' | 'SETUP' | 'GAME' | 'VICTORY';
export type RoomState = 'LOBBY' | 'SETUP' | 'COUNTDOWN' | 'GAME' | 'ENDED';
export type LineType = 'row' | 'col' | 'diag';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface CompletedLine {
  type: LineType;
  index: number;
  playerId?: string;
}

export interface SerializedPlayer {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
  difficulty?: Difficulty;
}

export interface SerializedRoom {
  id: string;
  boardSize: number;
  turnWaitSecs: number;
  state: RoomState;
  host: string;
  setupDeadlineMs: number | null;
  currentTurn: string | null;
  players: SerializedPlayer[];
}

export interface Winner {
  id: string;
  name: string;
}

export interface PlayerLineInfo {
  lineCount: number;
  lines: CompletedLine[];
}

export type SendFn = (type: string, payload?: Record<string, unknown>) => void;
