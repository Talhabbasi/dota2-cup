"use client";

import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const signInClass =
  "border-amber-500/50 bg-amber-500/5 text-foreground shadow-[0_0_18px_rgba(245,158,11,0.22)] hover:border-amber-500/70 hover:bg-amber-500/10 hover:text-foreground hover:shadow-[0_0_22px_rgba(245,158,11,0.35)] dark:border-amber-500/50 dark:bg-amber-500/5 dark:hover:border-amber-500/70 dark:hover:bg-amber-500/10 dark:hover:text-foreground";

export function AuthButtons() {
  const { data, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled className={signInClass}>
        <LogIn />
        Sign in
      </Button>
    );
  }

  if (!data?.user) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={signInClass}
        onClick={() => signIn("discord", { callbackUrl: pathname || "/" })}
      >
        <LogIn />
        Sign in
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="hidden max-w-36 truncate text-sm text-muted-foreground sm:inline">
        {data.user.name}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-white/15 bg-transparent text-foreground shadow-none hover:border-white/25 hover:bg-transparent hover:text-foreground dark:border-white/15 dark:bg-transparent dark:hover:bg-transparent"
        onClick={() => signOut()}
      >
        <LogOut />
        Sign out
      </Button>
    </span>
  );
}
