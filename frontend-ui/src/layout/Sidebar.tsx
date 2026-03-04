import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { IconButton } from "../shared/components/IconButton";
import { useI18n } from "../shared/i18n/I18nProvider";

export type SidebarPanelId = "search" | "watchlist" | "tracked" | null;

type SidebarProps = {
  activePanel: SidebarPanelId;
  isAuthenticated: boolean;
  isAdmin: boolean;
  username: string | null;
  onSelectPanel: (panel: SidebarPanelId) => void;
  onShowMap: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenAdminUsers: () => void;
  onOpenAdminApiKeys: () => void;
  onLogout: () => void;
};

export function Sidebar({
  activePanel,
  isAuthenticated,
  isAdmin,
  username,
  onSelectPanel,
  onShowMap,
  onOpenLogin,
  onOpenRegister,
  onOpenAdminUsers,
  onOpenAdminApiKeys,
  onLogout,
}: SidebarProps): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();

  useEffect(() => {
    if (activePanel != null) {
      setIsMenuOpen(false);
    }
  }, [activePanel]);

  return (
    <aside className="pointer-events-none absolute right-4 top-4 z-40">
      <div className="relative pointer-events-auto">
        <IconButton
          active={isMenuOpen}
          ariaLabel={t("sidebar.toggleMenu")}
          className="glass-panel-strong text-slate-100"
          onClick={() => setIsMenuOpen((value) => !value)}
          tooltip={t("sidebar.menu")}
        >
          <MenuIcon />
        </IconButton>

        {isMenuOpen ? (
          <section className="glass-panel-strong absolute right-0 top-14 w-64 rounded-[24px] border border-slate-700/80 p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/75">{t("sidebar.navigation")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{t("sidebar.mapControls")}</p>
              </div>
              <button
                aria-label={t("sidebar.closeMenu")}
                className="rounded-full border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                onClick={() => setIsMenuOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-2">
              <MenuAction
                active={false}
                ariaLabel={t("sidebar.mapHome")}
                description={t("sidebar.mapHomeDescription")}
                onClick={() => {
                  onShowMap();
                  setIsMenuOpen(false);
                }}
                title={t("sidebar.mapHome")}
              >
                <LogoIcon />
              </MenuAction>

              <MenuAction
                active={activePanel === "search"}
                ariaLabel="Open search panel"
                description={t("sidebar.searchDescription")}
                onClick={() => {
                  onSelectPanel(activePanel === "search" ? null : "search");
                  setIsMenuOpen(false);
                }}
                title={t("sidebar.search")}
              >
                <SearchIcon />
              </MenuAction>

              <MenuAction
                active={activePanel === "watchlist"}
                ariaLabel="Open watchlist panel"
                description={isAuthenticated ? t("sidebar.watchlistDescription") : t("sidebar.watchlistAuthDescription")}
                onClick={() => {
                  if (isAuthenticated) {
                    onSelectPanel(activePanel === "watchlist" ? null : "watchlist");
                  } else {
                    onOpenLogin();
                  }
                  setIsMenuOpen(false);
                }}
                title={t("sidebar.watchlist")}
              >
                <WatchIcon />
              </MenuAction>

              {isAdmin ? (
                <>
                  <MenuAction
                    active={false}
                    ariaLabel={t("sidebar.adminUsers")}
                    description={t("sidebar.adminUsersDescription")}
                    onClick={() => {
                      onOpenAdminUsers();
                      setIsMenuOpen(false);
                    }}
                    title={t("sidebar.adminUsers")}
                  >
                    <UsersIcon />
                  </MenuAction>
                  <MenuAction
                    active={false}
                    ariaLabel={t("sidebar.apiKeys")}
                    description={t("sidebar.apiKeysDescription")}
                    onClick={() => {
                      onOpenAdminApiKeys();
                      setIsMenuOpen(false);
                    }}
                    title={t("sidebar.apiKeys")}
                  >
                    <KeyIcon />
                  </MenuAction>
                </>
              ) : null}

              {isAuthenticated ? (
                <MenuAction
                  active={false}
                  ariaLabel={t("sidebar.logout")}
                  description={username ? t("sidebar.logoutAs", { username }) : t("sidebar.logoutDescription")}
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  title={t("sidebar.logout")}
                >
                  <UserIcon />
                </MenuAction>
              ) : (
                <>
                  <MenuAction
                    active={false}
                    ariaLabel={t("sidebar.login")}
                    description={t("sidebar.loginDescription")}
                    onClick={() => {
                      onOpenLogin();
                      setIsMenuOpen(false);
                    }}
                    title={t("sidebar.login")}
                  >
                    <UserIcon />
                  </MenuAction>
                  <MenuAction
                    active={false}
                    ariaLabel={t("sidebar.register")}
                    description={t("sidebar.registerDescription")}
                    onClick={() => {
                      onOpenRegister();
                      setIsMenuOpen(false);
                    }}
                    title={t("sidebar.register")}
                  >
                    <PlusIcon />
                  </MenuAction>
                </>
              )}
            </div>

            <div className="mt-3 rounded-[20px] border border-slate-800/80 bg-slate-950/55 p-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{t("language.label")}</p>
              <div className="mt-2 flex gap-2">
                <LanguageButton
                  active={language === "vi"}
                  label="VI"
                  onClick={() => setLanguage("vi")}
                />
                <LanguageButton
                  active={language === "en"}
                  label="EN"
                  onClick={() => setLanguage("en")}
                />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

type LanguageButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function LanguageButton({ label, active, onClick }: LanguageButtonProps): JSX.Element {
  return (
    <button
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-cyan-300 text-slate-950"
          : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

type MenuActionProps = {
  active: boolean;
  ariaLabel: string;
  title: string;
  description: string;
  onClick: () => void;
  children: ReactNode;
};

function MenuAction({
  active,
  ariaLabel,
  title,
  description,
  onClick,
  children,
}: MenuActionProps): JSX.Element {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        active
          ? "border-cyan-400/60 bg-cyan-400/12 text-cyan-100"
          : "border-slate-800/80 bg-slate-950/55 text-slate-200 hover:border-slate-600 hover:bg-slate-900/90"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/80 text-slate-300">
        {children}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function MenuIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M4 12h16" strokeLinecap="round" />
      <path d="M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 12h16" strokeLinecap="round" />
      <path d="M12 4v16" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function SearchIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function WatchIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 5c4.2 0 7.8 2.7 9 6.5-1.2 3.8-4.8 6.5-9 6.5s-7.8-2.7-9-6.5C4.2 7.7 7.8 5 12 5Z" />
      <circle cx="12" cy="11.5" r="2.5" />
    </svg>
  );
}

function UsersIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M16 19a4 4 0 0 0-8 0" strokeLinecap="round" />
      <circle cx="12" cy="10" r="3" />
      <path d="M19 19a3 3 0 0 0-2.2-2.9" strokeLinecap="round" />
      <path d="M5 19a3 3 0 0 1 2.2-2.9" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="8.5" cy="15.5" r="3.5" />
      <path d="M11 13l8-8" strokeLinecap="round" />
      <path d="M17 7h2v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 9h2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M6 19c1.4-2.7 4-4 6-4s4.6 1.3 6 4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 5v14" strokeLinecap="round" />
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
