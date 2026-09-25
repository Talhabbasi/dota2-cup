"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { RegisterSignIn } from "@/components/register-signin";

export function AdminSignIn({
  callbackUrl = "/admin",
  emailLoginEnabled = true,
}: {
  callbackUrl?: string;
  emailLoginEnabled?: boolean;
}) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("admin-credentials", {
        email: login.trim(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError("Wrong username/email or password.");
        setPending(false);
        return;
      }
      window.location.href = result?.url || callbackUrl;
    } catch {
      setError("Could not sign in. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <div className="register-gate rounded-lg border border-white/10 bg-[#121824] px-5 py-5">
        <p className="m-0 mb-3 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Discord
        </p>
        <p className="mt-0 mb-4 text-sm text-muted-foreground">
          Sign in with an organizer Discord account (Admin role or listed admin
          id).
        </p>
        <RegisterSignIn callbackUrl={callbackUrl} />
      </div>

      {emailLoginEnabled ? (
        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-white/10 bg-[#121824] px-5 py-5"
        >
          <p className="m-0 mb-3 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Username
          </p>
          <p className="mt-0 mb-4 text-sm text-muted-foreground">
            Credentials from <code className="text-xs">.env</code> — password
            is stored as a scrypt hash, never plaintext.
          </p>
          <label className="mb-3 grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Username or email</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              className="rounded-md border border-white/15 bg-[#0a0d14] px-3 py-2 text-foreground outline-none focus:border-amber-500/50"
            />
          </label>
          <label className="mb-4 grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-white/15 bg-[#0a0d14] px-3 py-2 text-foreground outline-none focus:border-amber-500/50"
            />
          </label>
          {error ? (
            <p className="mb-3 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn-gold w-full"
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
