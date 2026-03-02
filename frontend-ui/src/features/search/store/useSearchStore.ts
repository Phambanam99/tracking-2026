import { create } from "zustand";
import type { SearchFilters, SearchMode, SearchResult } from "../types/searchTypes";

interface SearchState {
  filters: SearchFilters;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  selectedIcao: string | null;

  // Actions
  setQuery: (query: string) => void;
  setMode: (mode: SearchMode) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  setResults: (results: SearchResult[]) => void;
  setSearching: (searching: boolean) => void;
  setError: (error: string | null) => void;
  selectResult: (icao: string | null) => void;
  clearSearch: () => void;
}

const INITIAL_FILTERS: SearchFilters = {
  query: "",
  mode: "viewport",
};

export const useSearchStore = create<SearchState>((set) => ({
  filters: INITIAL_FILTERS,
  results: [],
  isSearching: false,
  error: null,
  selectedIcao: null,

  setQuery: (query: string) =>
    set((state) => ({ filters: { ...state.filters, query } })),

  setMode: (mode: SearchMode) =>
    set((state) => ({ filters: { ...state.filters, mode }, results: [], error: null })),

  setFilters: (partial: Partial<SearchFilters>) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  setResults: (results: SearchResult[]) => set({ results }),

  setSearching: (isSearching: boolean) => set({ isSearching }),

  setError: (error: string | null) => set({ error }),

  selectResult: (selectedIcao: string | null) => set({ selectedIcao }),

  clearSearch: () =>
    set({ filters: INITIAL_FILTERS, results: [], isSearching: false, error: null, selectedIcao: null }),
}));
