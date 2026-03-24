import { create } from 'zustand';
import { User, Portfolio, MarketData } from '@/types';

interface AppStore {
  user: User | null;
  token: string | null;
  portfolio: Portfolio | null;
  marketData: Record<string, MarketData>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setPortfolio: (portfolio: Portfolio | null) => void;
  setMarketData: (symbol: string, data: MarketData) => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  token: null,
  portfolio: null,
  marketData: {},

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setPortfolio: (portfolio) => set({ portfolio }),
  setMarketData: (symbol, data) =>
    set((state) => ({
      marketData: { ...state.marketData, [symbol]: data },
    })),
  logout: () =>
    set({
      user: null,
      token: null,
      portfolio: null,
      marketData: {},
    }),
}));
