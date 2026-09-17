"use client";

import { signIn } from "next-auth/react";

export function RegisterSignIn({
  callbackUrl = "/register",
}: {
  callbackUrl?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-gold"
      onClick={() => signIn("discord", { callbackUrl })}
    >
      Continue with Discord
    </button>
  );
}
