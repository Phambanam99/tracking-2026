import { useState } from "react";
import { createApiKey, revokeApiKey, type CreateApiKeyResponse } from "../../auth/api/authApi";

export function ApiKeyManagementPage(): JSX.Element {
  const [sourceId, setSourceId] = useState("RADAR-001");
  const [createdKeys, setCreatedKeys] = useState<CreateApiKeyResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const issueKey = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const nextKey = await createApiKey({ sourceId });
      setCreatedKeys((previous) => [nextKey, ...previous]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to issue API key");
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (id: number): Promise<void> => {
    setError(null);
    try {
      await revokeApiKey(id);
      setCreatedKeys((previous) =>
        previous.map((key) =>
          key.id === id
            ? {
                ...key,
                active: false,
              }
            : key,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke API key");
    }
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
      <h3 className="text-lg font-semibold text-ink">API Key Management</h3>
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
        <label className="text-sm text-slate-300">
          Source ID
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-ink md:w-64"
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          />
        </label>
        <button
          className="rounded bg-accent px-4 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!sourceId.trim() || loading}
          onClick={() => void issueKey()}
          type="button"
        >
          {loading ? "Issuing..." : "Create API Key"}
        </button>
      </div>

      {error && <p className="mt-3 rounded border border-rose-500/40 bg-rose-900/30 p-2 text-sm text-rose-200">{error}</p>}

      <ul className="mt-4 space-y-2">
        {createdKeys.map((key) => (
          <li className="rounded border border-slate-800 bg-slate-950/70 p-3 text-sm" key={key.id}>
            <p className="text-cyan-200">ID {key.id} · {key.sourceId}</p>
            <p className="break-all text-slate-300">{key.apiKey}</p>
            <p className="mt-1 text-xs text-slate-400">status: {key.active ? "active" : "revoked"}</p>
            {key.active && (
              <button className="mt-2 rounded border border-amber-500/60 px-2 py-1 text-xs text-amber-300" onClick={() => void revoke(key.id)} type="button">
                Revoke
              </button>
            )}
          </li>
        ))}
        {createdKeys.length === 0 && <li className="text-sm text-slate-400">No API keys created in this session.</li>}
      </ul>
    </section>
  );
}
