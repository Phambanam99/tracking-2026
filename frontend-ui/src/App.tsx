import type { ReactNode } from "react";
import { Suspense, lazy, useMemo, useState } from "react";
import { useAuthStore } from "./features/auth/store/useAuthStore";
import { AppShell } from "./layout/AppShell";
import { I18nProvider, useI18n } from "./shared/i18n/I18nProvider";

const LoginPage = lazy(async () =>
  import("./features/auth/pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(async () =>
  import("./features/auth/pages/RegisterPage").then((module) => ({ default: module.RegisterPage })),
);
const UserManagementPage = lazy(async () =>
  import("./features/admin/pages/UserManagementPage").then((module) => ({ default: module.UserManagementPage })),
);
const ApiKeyManagementPage = lazy(async () =>
  import("./features/admin/pages/ApiKeyManagementPage").then((module) => ({ default: module.ApiKeyManagementPage })),
);

type Page = "map" | "login" | "register" | "admin-users" | "admin-api-keys";

export function App(): JSX.Element {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent(): JSX.Element {
  const auth = useAuthStore((state) => state);
  const [page, setPage] = useState<Page>("map");
  const isAdmin = useMemo(() => auth.roles.includes("ROLE_ADMIN"), [auth.roles]);
  const currentPage = resolvePage(page, auth.isAuthenticated, isAdmin);
  const { t } = useI18n();

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-950 text-ink">
      <Suspense fallback={<PageFallback />}>
        {currentPage === "map" ? (
          <AppShell
            isAdmin={isAdmin}
            onOpenAdminApiKeys={() => setPage("admin-api-keys")}
            onOpenAdminUsers={() => setPage("admin-users")}
            onOpenLogin={() => setPage("login")}
            onOpenRegister={() => setPage("register")}
          />
        ) : null}

        {currentPage === "login" ? (
          <PageFrame
            eyebrow={t("app.auth")}
            onBack={auth.isAuthenticated ? () => setPage("map") : undefined}
            title={t("app.signInTitle")}
          >
            <LoginPage onSwitchToRegister={() => setPage("register")} />
          </PageFrame>
        ) : null}

        {currentPage === "register" ? (
          <PageFrame
            eyebrow={t("app.auth")}
            onBack={auth.isAuthenticated ? () => setPage("map") : undefined}
            title={t("app.registerTitle")}
          >
            <RegisterPage onSwitchToLogin={() => setPage("login")} />
          </PageFrame>
        ) : null}

        {currentPage === "admin-users" ? (
          <PageFrame eyebrow={t("app.admin")} onBack={() => setPage("map")} title={t("app.userManagementTitle")}>
            <UserManagementPage />
          </PageFrame>
        ) : null}

        {currentPage === "admin-api-keys" ? (
          <PageFrame eyebrow={t("app.admin")} onBack={() => setPage("map")} title={t("app.apiKeyManagementTitle")}>
            <ApiKeyManagementPage />
          </PageFrame>
        ) : null}
      </Suspense>
    </div>
  );
}

type PageFrameProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  onBack?: () => void;
};

function PageFrame({ eyebrow, title, children, onBack }: PageFrameProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_24%),radial-gradient(circle_at_78%_12%,rgba(59,130,246,0.18),transparent_20%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.98))]" />
      <div className="pointer-events-none absolute inset-y-12 left-[12%] w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-[10%] h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
      {onBack ? (
        <button
          className="glass-panel absolute left-4 top-4 rounded-full px-4 py-2 text-sm text-slate-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          onClick={onBack}
          type="button"
        >
          {t("app.backToMap")}
        </button>
      ) : null}
      <div className="relative z-10 flex w-full max-w-6xl flex-col gap-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            {t("app.pageDescription")}
          </p>
        </div>
        <div className="glass-panel-strong rounded-[32px] border border-slate-700/80 p-5 md:p-8">{children}</div>
      </div>
    </div>
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

function PageFallback(): JSX.Element {
  const { t } = useI18n();

  return <div className="flex h-full items-center justify-center text-sm text-slate-300">{t("app.loadingWorkspace")}</div>;
}
