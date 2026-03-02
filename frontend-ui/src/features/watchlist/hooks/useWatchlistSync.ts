import { useEffect } from "react";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useWatchlistStore } from "../store/useWatchlistStore";

/**
 * Syncs watchlist groups with the server whenever auth state changes.
 * Clears local state on logout.
 */
export function useWatchlistSync(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchGroups = useWatchlistStore((s) => s.fetchGroups);
  const clearAll = useWatchlistStore((s) => s.clearAll);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchGroups();
    } else {
      clearAll();
    }
  }, [isAuthenticated, fetchGroups, clearAll]);
}
