export type Difficulty = 'easy' | 'medium' | 'hard';
export type RoomState = 'LOBBY' | 'SETUP' | 'COUNTDOWN' | 'GAME' | 'ENDED';
export type LineType = 'row' | 'col' | 'diag';

export interface Line {
  type: LineType;
  index: number;
}

export type WinResult =
  | { valid: true; lines: Line[] }
  | { valid: false };

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
