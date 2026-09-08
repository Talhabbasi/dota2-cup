"use client";

import { useSearchParams } from "next/navigation";

export function LoginErrorBanner() {
  const error = useSearchParams().get("error");
  if (error !== "discord" && error !== "OAuthCallback") return null;

  return (
    <p className="lede" role="alert">
      Discord login failed. Check the OAuth2 Client Secret and redirect URL,
      then try Sign in again.
    </p>
  );
}
