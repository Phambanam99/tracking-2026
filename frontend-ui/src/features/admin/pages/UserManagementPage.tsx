import { useEffect, useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { disableUser, enableUser, listUsers, type UserAdminItem } from "../api/userAdminApi";

const pageSize = 20;

export function UserManagementPage(): JSX.Element {
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<UserAdminItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCurrentPage(page);
  }, [page]);

  const loadCurrentPage = async (targetPage: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await listUsers(targetPage, pageSize);
      setUsers(response.content);
      setPage(response.page);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("admin.failedToLoadUsers"));
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = async (user: UserAdminItem): Promise<void> => {
    setUpdatingUserId(user.id);
    setError(null);
    try {
      if (user.enabled) {
        await disableUser(user.id);
      } else {
        await enableUser(user.id);
      }
      setUsers((previous) =>
        previous.map((current) =>
          current.id === user.id
            ? {
                ...current,
                enabled: !current.enabled,
              }
            : current,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("admin.failedToUpdateUserStatus"));
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <section className="rounded-[28px] border border-slate-700/80 bg-slate-900/55 p-5 shadow-xl">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-300/80">{t("admin.console")}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("admin.userManagement")}</h3>
          <p className="mt-1 text-sm text-slate-300">{t("admin.userManagementDescription")}</p>
        </div>
        <button
          className="rounded-full border border-slate-500 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
          disabled={loading}
          onClick={() => void loadCurrentPage(page)}
          type="button"
        >
          {t("admin.refresh")}
        </button>
      </header>

      {error ? (
        <p className="mt-3 rounded border border-rose-500/40 bg-rose-900/30 p-2 text-sm text-rose-200">{error}</p>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-800/80 bg-slate-950/60">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/80 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{t("admin.username")}</th>
              <th className="px-3 py-2">{t("admin.email")}</th>
              <th className="px-3 py-2">{t("admin.roles")}</th>
              <th className="px-3 py-2">{t("admin.status")}</th>
              <th className="px-3 py-2">{t("admin.created")}</th>
              <th className="px-3 py-2">{t("admin.action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {users.map((user) => (
              <tr className="bg-slate-950/30 transition hover:bg-slate-900/60" key={user.id}>
                <td className="px-3 py-2 text-slate-300">{user.id}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                    {user.username}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-300">{user.email}</td>
                <td className="px-3 py-2 text-slate-300">{user.roles.join(", ")}</td>
                <td className="px-3 py-2">
                  <span className={user.enabled ? "text-emerald-300" : "text-amber-300"}>
                    {user.enabled ? t("admin.enabled") : t("admin.disabled")}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{new Date(user.createdAt).toLocaleString(locale)}</td>
                <td className="px-3 py-2">
                  <button
                    className="rounded-full border border-slate-500 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                    disabled={updatingUserId === user.id}
                    onClick={() => void toggleUser(user)}
                    type="button"
                  >
                    {user.enabled ? t("admin.disable") : t("admin.enable")}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={7}>
                  {t("admin.noUsers")}
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={7}>
                  {t("admin.loadingUsers")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <span>
          {t("admin.userPageSummary", {
            current: page + 1,
            total: Math.max(totalPages, 1),
            count: totalElements,
          })}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-slate-500 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
            disabled={loading || page <= 0}
            onClick={() => setPage((previous) => Math.max(previous - 1, 0))}
            type="button"
          >
            {t("admin.prev")}
          </button>
          <button
            className="rounded-full border border-slate-500 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
            disabled={loading || page + 1 >= totalPages}
            onClick={() => setPage((previous) => previous + 1)}
            type="button"
          >
            {t("admin.next")}
          </button>
        </div>
      </footer>
    </section>
  );
}
