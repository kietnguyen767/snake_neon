import { create } from 'zustand';
import * as Colyseus from 'colyseus.js';

interface GameState {
  room: Colyseus.Room | null;
  players: Record<string, any>;
  foods: Record<string, any>;
  phase: number;
  hostId: string;
  countdown: number;
  timeRemaining: number;
  setRoom: (room: Colyseus.Room) => void;
  updateState: (state: any) => void;
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
