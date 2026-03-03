import type { FormEvent } from "react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { login } from "../store/useAuthStore";

type LoginPageProps = {
  onSwitchToRegister: () => void;
};

export function LoginPage({ onSwitchToRegister }: LoginPageProps): JSX.Element {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ username, password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] border border-slate-800/80 bg-slate-950/65 p-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/80">{t("auth.flightDesk")}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{t("auth.signIn")}</h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
          {t("auth.signInDescription")}
        </p>
        <div className="mt-6 grid gap-3 text-sm text-slate-300">
          <FeatureLine text={t("auth.featureShell")} />
          <FeatureLine text={t("auth.featureWatchlist")} />
          <FeatureLine text={t("auth.featureAdmin")} />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-700/80 bg-slate-900/88 p-6 shadow-2xl">
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm text-slate-300">
            {t("auth.username")}
            <input
              className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label className="block text-sm text-slate-300">
            {t("auth.password")}
            <input
              className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? t("auth.signingIn") : t("auth.signInButton")}
          </button>
        </form>
        <button
          className="mt-4 text-sm text-sky-300 transition hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
          onClick={onSwitchToRegister}
          type="button"
        >
          {t("auth.needAccount")}
        </button>
      </div>
    </div>
  );
}

type FeatureLineProps = {
  text: string;
};

function FeatureLine({ text }: FeatureLineProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
      <span>{text}</span>
    </div>
  );
}
