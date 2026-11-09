"use client";

import Image from "next/image";
import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

const signInClass =
  "h-10 border-white/10 bg-[#161D2A] text-[#F8FAFC] shadow-none transition-colors duration-200 hover:border-[#F5AE28]/50 hover:bg-[#1E2838] hover:text-[#F8FAFC]";

export function AuthButtons() {
  const { data, status } = useSession();

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
        onClick={() => signIn("discord", { callbackUrl: "/profile" })}
      >
        <LogIn />
        Sign in
      </Button>
    );
  }

  const name = data.user.name ?? "Profile";
  const initial = name.trim().charAt(0).toUpperCase() || "P";

  return (
    <span className="flex items-center gap-2">
      <Link
        href="/profile"
        className="inline-flex max-w-40 items-center gap-2 text-sm text-[#A6AFBD]! transition-colors duration-200 hover:text-[#F8FAFC]!"
      >
        {data.user.image ? (
          <Image
            src={data.user.image}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full ring-1 ring-white/15"
          />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-[#1E2838] font-display text-sm font-bold text-[#F8FAFC]">
            {initial}
          </span>
        )}
        <span className="hidden truncate sm:inline">{name}</span>
      </Link>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 border-white/10 bg-transparent text-[#F8FAFC] shadow-none transition-colors duration-200 hover:border-white/20 hover:bg-[#1E2838] hover:text-[#F8FAFC]"
        onClick={() =>
          signOut({ redirect: false }).then(() => window.location.reload())
        }
      >
        <LogOut />
        Sign out
      </Button>
    </span>
  );
}
