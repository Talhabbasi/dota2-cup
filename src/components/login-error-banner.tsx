"use client";

import { useSearchParams } from "next/navigation";

export function LoginErrorBanner() {
  const error = useSearchParams().get("error");
  if (error !== "discord" && error !== "OAuthCallback") return null;

  return (
    <p className="lede" role="alert">
      Discord login failed. Try Sign in again. If it keeps failing, ask an admin.
    </p>
  );
}
