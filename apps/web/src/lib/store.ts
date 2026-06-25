import { create } from 'zustand';
import * as Colyseus from 'colyseus.js';

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  state: string;
  score: number;
  hasShield: boolean;
  shieldUntil?: number;
  segments: { x: number; y: number }[];
}

export interface FoodState {
  id: string;
  x: number;
  y: number;
  type: number;
}

interface GameState {
  room: Colyseus.Room | null;
  players: Record<string, PlayerState>;
  foods: Record<string, FoodState>;
  phase: number;
  hostId: string;
  countdown: number;
  timeRemaining: number;
  setRoom: (room: Colyseus.Room) => void;
  updateState: (state: Partial<GameState>) => void;
  clearStore: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  room: null,
  players: {},
  foods: {},
  phase: 0,
  hostId: "",
  countdown: 3,
  timeRemaining: 600,
  setRoom: (room) => set({ room }),
  updateState: (state) => set({ 
    players: state.players ? { ...state.players } : {}, 
    foods: state.foods ? { ...state.foods } : {}, 
    phase: state.phase,
    hostId: state.hostId || "",
    countdown: state.countdown || 3,
    timeRemaining: state.timeRemaining || 600
  }),
  clearStore: () => set({ room: null, players: {}, foods: {}, phase: 0, hostId: "", countdown: 3, timeRemaining: 600 }),
}));
