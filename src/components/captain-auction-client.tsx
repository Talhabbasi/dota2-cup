"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { RegisterSignIn } from "@/components/register-signin";
import { useState } from "react";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import type { WebAuctionView } from "@/lib/web-auction";
import { adminControlClass } from "@/components/admin/ui";

export function CaptainAuctionClient({
  initialView,
  discordTeamId = null,
}: {
  initialView: WebAuctionView;
  discordTeamId?: string | null;
}) {
  const { data: session, status } = useSession();
  const [loginName, setLoginName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isCaptain = Boolean(session?.user?.isCaptainBidder);
  const teamId = session?.user?.captainTeamId ?? null;

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signIn("captain-credentials", {
      loginName,
      passcode,
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setError("Invalid captain login or passcode.");
      return;
    }
    window.location.reload();
  }

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (discordTeamId && session?.user?.discordId) {
    return (
      <div className="grid gap-4">
        <p className="m-0 text-sm">
          Bidding as <strong>{session.user.name}</strong> with Discord.
        </p>
        <LiveAuctionBoard
          initial={initialView}
          canBid
          teamId={discordTeamId}
        />
      </div>
    );
  }

  if (!isCaptain) {
    return (
      <div className="mx-auto grid max-w-sm gap-4">
        <RegisterSignIn callbackUrl="/auction/captain" />
        <p className="m-0 text-center text-xs text-muted-foreground">
          Or use the captain login from Admin → Auction.
        </p>
      <form onSubmit={onLogin} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Captain login</span>
          <input
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            className={adminControlClass}
            required
            autoComplete="username"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Passcode</span>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className={adminControlClass}
            required
            autoComplete="current-password"
          />
        </label>
        {error ? (
          <p className="m-0 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Open bid desk"}
        </button>
      </form>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm">
          Bidding as <strong>{session?.user?.name}</strong>
        </p>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          onClick={() =>
            signOut({ redirect: false }).then(() => window.location.reload())
          }
        >
          Sign out
        </button>
      </div>
      <LiveAuctionBoard initial={initialView} canBid teamId={teamId} />
    </div>
  );
}
