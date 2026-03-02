import type { FormEvent } from "react";
import { useState } from "react";
import { login } from "../store/useAuthStore";

type LoginPageProps = {
  onSwitchToRegister: () => void;
};

export function LoginPage({ onSwitchToRegister }: LoginPageProps): JSX.Element {
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
      setError(cause instanceof Error ? cause.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
      <h2 className="mb-4 text-2xl font-semibold text-ink">Sign In</h2>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm text-slate-300">
          Username
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-ink"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-slate-300">
          Password
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-ink"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          className="w-full rounded-md bg-accent px-4 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <button
        className="mt-3 text-sm text-sky-300 hover:text-sky-200"
        onClick={onSwitchToRegister}
        type="button"
      >
        Need an account? Register
      </button>
    </div>
  );
}
