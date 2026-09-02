"use client";

import { signIn } from "next-auth/react";

export function RegisterSignIn() {
  return (
    <button
      type="button"
      className="btn btn-gold"
      onClick={() => signIn("discord", { callbackUrl: "/register" })}
    >
      Continue with Discord
    </button>
  );
}
