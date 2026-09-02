"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButtons() {
  const { data, status } = useSession();

  if (status === "loading") {
    return <span className="auth-chip muted">Sign in</span>;
  }

  if (!data?.user) {
    return (
      <button type="button" className="btn" onClick={() => signIn("discord")}>
        Sign in
      </button>
    );
  }

  return (
    <span className="auth-chip">
      <span className="auth-name">{data.user.name}</span>
      <button type="button" className="btn btn-ghost" onClick={() => signOut()}>
        Sign out
      </button>
    </span>
  );
}
