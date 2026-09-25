"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CalendarDays,
  ChartColumn,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  Swords,
  Target,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { CUP_ICON_PATH, CUP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { AdminToastProvider } from "@/components/admin/admin-toast";

/** Close mobile drawer when the route changes (adjust during render). */
function useCloseOnPathChange(pathname: string) {
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }
  return [open, setOpen] as const;
}

const NAV = [
  {
    group: "Desk",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      { href: "/admin/insights", label: "Insights", icon: ChartColumn },
    ],
  },
  {
    group: "Cup",
    items: [
      { href: "/admin/matches", label: "Matches", icon: Swords },
      { href: "/admin/players", label: "Players", icon: Users },
      { href: "/admin/teams", label: "Teams", icon: UsersRound },
      { href: "/admin/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/admin/payments", label: "Payments", icon: Wallet },
      { href: "/admin/auction", label: "Auction", icon: Gavel },
      { href: "/admin/predictions", label: "Predictions", icon: Target },
    ],
  },
] as const;

function titleFromPath(pathname: string) {
  if (pathname === "/admin") return "Dashboard";
  for (const group of NAV) {
    for (const item of group.items) {
      if (item.href === "/admin") continue;
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }
  return "Admin";
}

export function AdminShell({
  userLabel,
  children,
}: {
  userLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useCloseOnPathChange(pathname);
  const pageTitle = titleFromPath(pathname);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("admin-nav-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("admin-nav-open");
    };
  }, [open, setOpen]);

  return (
    <AdminToastProvider>
      <div className="admin-shell">
        <aside
          className={cn(
            "admin-sidebar",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
        <div className="flex h-14 items-center gap-2.5 border-b border-white/8 px-4">
          <Image
            src={CUP_ICON_PATH}
            alt=""
            width={28}
            height={28}
            className="rounded-md"
          />
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold text-foreground">
              {CUP_NAME}
            </p>
            <p className="m-0 text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
              Admin
            </p>
          </div>
          <button
            type="button"
            className="ml-auto rounded-lg p-1.5 text-muted-foreground lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.group} className="mb-5">
              <p className="mb-2 px-2 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground/80 uppercase">
                {group.group}
              </p>
              <ul className="m-0 grid list-none gap-0.5 p-0">
                {group.items.map((item) => {
                  const exact = "exact" in item && item.exact;
                  const active = exact
                    ? pathname === item.href
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                          active
                            ? "bg-[#487fff]/18 font-medium text-[#8eb4ff] shadow-[inset_3px_0_0_#487fff]"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0 opacity-90" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/8 p-3">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="admin-stage">
        <header className="admin-topbar">
          <button
            type="button"
            className="rounded-lg border border-white/10 p-2 text-muted-foreground transition hover:bg-white/5 hover:text-foreground lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="m-0 text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
              Admin / {pageTitle}
            </p>
            <h1 className="m-0 truncate text-base font-semibold text-foreground sm:text-lg">
              {pageTitle}
            </h1>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="m-0 truncate text-sm font-medium text-foreground">
                {userLabel}
              </p>
              <p className="m-0 text-[0.65rem] tracking-[0.1em] text-muted-foreground uppercase">
                Organizer
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#487fff]/20 text-xs font-semibold text-[#8eb4ff]">
              {userLabel.slice(0, 1).toUpperCase() || "A"}
            </span>
          </div>
        </header>
        <div className="admin-main">{children}</div>
      </div>
      </div>
    </AdminToastProvider>
  );
}
