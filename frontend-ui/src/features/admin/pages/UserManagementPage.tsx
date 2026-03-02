import { useEffect, useState } from "react";
import { disableUser, enableUser, listUsers, type UserAdminItem } from "../api/userAdminApi";

const pageSize = 20;

export function UserManagementPage(): JSX.Element {
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
      setError(cause instanceof Error ? cause.message : "Failed to load users");
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
      setError(cause instanceof Error ? cause.message : "Failed to update user status");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">User Management</h3>
          <p className="text-sm text-slate-300">Admin controls for enabling/disabling user accounts.</p>
        </div>
        <button
          className="rounded border border-slate-500 px-3 py-1 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={() => void loadCurrentPage(page)}
          type="button"
        >
          Refresh
        </button>
      </header>

      {error && <p className="mt-3 rounded border border-rose-500/40 bg-rose-900/30 p-2 text-sm text-rose-200">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/60 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {users.map((user) => (
              <tr className="bg-slate-950/30" key={user.id}>
                <td className="px-3 py-2 text-slate-300">{user.id}</td>
                <td className="px-3 py-2 text-cyan-200">{user.username}</td>
                <td className="px-3 py-2 text-slate-300">{user.email}</td>
                <td className="px-3 py-2 text-slate-300">{user.roles.join(", ")}</td>
                <td className="px-3 py-2">
                  <span className={user.enabled ? "text-emerald-300" : "text-amber-300"}>
                    {user.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{new Date(user.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button
                    className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={updatingUserId === user.id}
                    onClick={() => void toggleUser(user)}
                    type="button"
                  >
                    {user.enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={7}>
                  No users found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={7}>
                  Loading users...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <span>
          Page {page + 1} / {Math.max(totalPages, 1)} · {totalElements} users
        </span>
        <div className="flex gap-2">
          <button
            className="rounded border border-slate-500 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || page <= 0}
            onClick={() => setPage((previous) => Math.max(previous - 1, 0))}
            type="button"
          >
            Prev
          </button>
          <button
            className="rounded border border-slate-500 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || page + 1 >= totalPages}
            onClick={() => setPage((previous) => previous + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}
