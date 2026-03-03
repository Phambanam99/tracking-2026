import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { createApiKey, revokeApiKey, type CreateApiKeyResponse } from "../../auth/api/authApi";

export function ApiKeyManagementPage(): JSX.Element {
  const { t } = useI18n();
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
      setError(cause instanceof Error ? cause.message : t("admin.failedToIssueApiKey"));
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
      setError(cause instanceof Error ? cause.message : t("admin.failedToRevokeApiKey"));
    }
  };

  return (
    <section className="rounded-[28px] border border-slate-700/80 bg-slate-900/55 p-5 shadow-xl">
      <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-300/80">{t("admin.console")}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("admin.apiKeyManagement")}</h3>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
        <label className="text-sm text-slate-300">
          {t("admin.sourceId")}
          <input
            className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-ink md:w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
            onChange={(event) => setSourceId(event.target.value)}
            value={sourceId}
          />
        </label>
        <button
          className="rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
          disabled={!sourceId.trim() || loading}
          onClick={() => void issueKey()}
          type="button"
        >
          {loading ? t("admin.issuing") : t("admin.createApiKey")}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded border border-rose-500/40 bg-rose-900/30 p-2 text-sm text-rose-200">{error}</p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {createdKeys.map((key) => (
          <li className="rounded-[24px] border border-slate-800 bg-slate-950/70 p-4 text-sm shadow-lg" key={key.id}>
            <p className="text-cyan-200">ID {key.id} · {key.sourceId}</p>
            <p className="break-all text-slate-300">{key.apiKey}</p>
            <p className="mt-1 text-xs text-slate-400">
              {t("admin.apiKeyStatus", { status: key.active ? t("admin.active") : t("admin.revoked") })}
            </p>
            {key.active ? (
              <button
                className="mt-3 rounded-full border border-amber-500/60 px-3 py-1 text-xs text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                onClick={() => void revoke(key.id)}
                type="button"
              >
                {t("admin.revoke")}
              </button>
            ) : null}
          </li>
        ))}
        {createdKeys.length === 0 ? (
          <li className="text-sm text-slate-400">{t("admin.noApiKeys")}</li>
        ) : null}
      </ul>
    </section>
  );
}
