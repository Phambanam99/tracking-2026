import { useMemo, useState } from "react";
import { ApiKeyManagementPage } from "./features/admin/pages/ApiKeyManagementPage";
import { UserManagementPage } from "./features/admin/pages/UserManagementPage";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { RegisterPage } from "./features/auth/pages/RegisterPage";
import { logout, useAuthStore } from "./features/auth/store/useAuthStore";
import { AircraftFeatureLayer } from "./features/aircraft/components/AircraftFeatureLayer";
import { MapContainer } from "./features/map/components/MapContainer";
import { LayerPanel } from "./features/map/components/LayerPanel";
import { SearchPanel } from "./features/search/components/SearchPanel";
import { WatchlistPanel } from "./features/watchlist/components/WatchlistPanel";
import { useWatchlistSync } from "./features/watchlist/hooks/useWatchlistSync";

type Page = "map" | "login" | "register" | "admin-users" | "admin-api-keys";

export function App(): JSX.Element {
  const auth = useAuthStore((state) => state);
  useWatchlistSync();
  const [page, setPage] = useState<Page>("map");
  const [showSearch, setShowSearch] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);

  const isAdmin = useMemo(() => auth.roles.includes("ROLE_ADMIN"), [auth.roles]);

  const currentPage = resolvePage(page, auth.isAuthenticated, isAdmin);

  return (
    // h-screen + flex-col so the map can fill all remaining vertical space
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-950 px-4 py-4 text-ink">
      <header className="mb-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
        <div>
          <h1 className="text-2xl font-bold">Tracking 2026</h1>
          <p className="text-sm text-slate-300">Live Tracking Dashboard</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {auth.isAuthenticated ? (
            <>
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">user: {auth.username}</span>
              <button className="rounded border border-slate-500 px-3 py-1 text-slate-200" onClick={() => void logout()} type="button">
                Logout
              </button>
            </>
          ) : (
            <span className="rounded bg-slate-800 px-2 py-1 text-slate-300">anonymous</span>
          )}
        </div>
      </header>

      <nav className="mb-3 flex flex-shrink-0 flex-wrap gap-2">
        <NavButton label="Map" onClick={() => setPage("map")} selected={currentPage === "map"} />
        {auth.isAuthenticated && (
          <>
            <NavButton label="Search" onClick={() => setShowSearch((v) => !v)} selected={showSearch} />
            <NavButton label="Watchlist" onClick={() => setShowWatchlist((v) => !v)} selected={showWatchlist} />
          </>
        )}
        {!auth.isAuthenticated && (
          <>
            <NavButton label="Login" onClick={() => setPage("login")} selected={currentPage === "login"} />
            <NavButton label="Register" onClick={() => setPage("register")} selected={currentPage === "register"} />
          </>
        )}
        {auth.isAuthenticated && isAdmin && (
          <>
            <NavButton label="Users" onClick={() => setPage("admin-users")} selected={currentPage === "admin-users"} />
            <NavButton label="API Keys" onClick={() => setPage("admin-api-keys")} selected={currentPage === "admin-api-keys"} />
          </>
        )}
      </nav>

      {/* min-h-0 is required in a flex-col so flex-1 can shrink below content size */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {currentPage === "map" && (
          <MapContainer>
            <AircraftFeatureLayer />
            <LayerPanel />
            {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
            {showWatchlist && <WatchlistPanel onClose={() => setShowWatchlist(false)} />}
          </MapContainer>
        )}
        {currentPage === "login" && <LoginPage onSwitchToRegister={() => setPage("register")} />}
        {currentPage === "register" && <RegisterPage onSwitchToLogin={() => setPage("login")} />}
        {currentPage === "admin-users" && <UserManagementPage />}
        {currentPage === "admin-api-keys" && <ApiKeyManagementPage />}
      </main>
    </div>
  );
}

type NavButtonProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function NavButton({ label, selected, onClick }: NavButtonProps): JSX.Element {
  return (
    <button
      className={`rounded px-3 py-1 text-sm ${selected ? "bg-accent text-slate-950" : "bg-slate-800 text-slate-200"}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function resolvePage(page: Page, isAuthenticated: boolean, isAdmin: boolean): Page {
  if (!isAuthenticated && (page === "admin-users" || page === "admin-api-keys" || page === "map")) {
    return "login";
  }
  if (isAuthenticated && (page === "login" || page === "register")) {
    return "map";
  }
  if (!isAdmin && (page === "admin-users" || page === "admin-api-keys")) {
    return "map";
  }
  return page;
}
