"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export function AuthButtons() {
  const { data, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return <span className="auth-chip muted">Sign in</span>;
  }

  if (!data?.user) {
    return (
      <button
        type="button"
        className="btn btn-gold"
        onClick={() => signIn("discord", { callbackUrl: pathname || "/" })}
      >
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
