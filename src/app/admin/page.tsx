import Link from "next/link";
import {
  CalendarDays,
  ChartColumn,
  Gavel,
  Swords,
  Target,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/common";
import { AdminSignIn } from "@/components/admin-sign-in";
import { currentPlayer } from "@/lib/auth";
import { adminPasswordLoginConfigured } from "@/lib/admin-password";
import { getCupFeatureSettings } from "@/lib/cup-features";
import { getAdminInsights } from "@/lib/admin-insights";
import { getPaymentCollection } from "@/lib/payments";
import { MEDAL_LABELS, adminRoleName, formatPoints } from "@/lib/constants";
import { isSiteAdmin } from "@/lib/site-admin";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";
import { actionUpdateCupSwitches } from "@/app/admin/actions";
import {
  AdminField,
  AdminStatus,
  adminControlClass,
} from "@/components/admin/ui";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = pageMeta(
  "Admin",
  `Organizer panel for ${CUP_NAME}. Admins only.`,
);

const SECTIONS = [
  {
    href: "/admin/matches",
    label: "Matches",
    note: "OCR links, stand-ins, winners",
    icon: Swords,
    tone: "blue",
  },
  {
    href: "/admin/players",
    label: "Players",
    note: "Register, rename, roster",
    icon: Users,
    tone: "violet",
  },
  {
    href: "/admin/teams",
    label: "Teams",
    note: "Captains, rename, subs",
    icon: UsersRound,
    tone: "cyan",
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    note: "Book and edit fixtures",
    icon: CalendarDays,
    tone: "amber",
  },
  {
    href: "/admin/payments",
    label: "Payments",
    note: "Collection & mark paid",
    icon: Wallet,
    tone: "green",
  },
  {
    href: "/admin/auction",
    label: "Auction",
    note: "Fix sold prices",
    icon: Gavel,
    tone: "rose",
  },
  {
    href: "/admin/predictions",
    label: "Predictions",
    note: "Names and points",
    icon: Target,
    tone: "blue",
  },
  {
    href: "/admin/insights",
    label: "Insights",
    note: "Kills, assists, bids, roles",
    icon: ChartColumn,
    tone: "violet",
  },
] as const;

const TONE_ICON: Record<(typeof SECTIONS)[number]["tone"], string> = {
  blue: "bg-[#487fff]/15 text-[#8eb4ff]",
  violet: "bg-violet-500/15 text-violet-300",
  cyan: "bg-cyan-500/15 text-cyan-300",
  amber: "bg-amber-500/15 text-amber-300",
  green: "bg-emerald-500/15 text-emerald-300",
  rose: "bg-rose-500/15 text-rose-300",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { session, player } = await currentPlayer();
  const discordId = session?.user?.discordId ?? null;
  const signedIn = Boolean(session?.user);
  const isAdmin =
    session?.user?.isAdmin === true ||
    (discordId ? await isSiteAdmin(discordId) : false);

  if (!signedIn) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Organizer"
          title="Admin"
          subtitle={`Sign in with Discord or username. Discord needs the ${adminRoleName()} role (or a listed admin id).`}
        />
        {params.error === "unauthorized" ? (
          <p className="mb-4 text-sm text-rose-300" role="alert">
            That page is private. Sign in as an organizer to continue.
          </p>
        ) : null}
        <AdminSignIn
          callbackUrl="/admin"
          emailLoginEnabled={adminPasswordLoginConfigured()}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Organizer"
          title="Admin"
          subtitle="Only organizers can open this panel."
        />
        <p className="muted">
          You are signed in as{" "}
          <strong>
            {session?.user?.email ?? session?.user?.name ?? "a user"}
          </strong>
          , but you are not an organizer.
        </p>
        <p className="muted">
          <Link href="/" className="text-link">
            Back home
          </Link>
        </p>
      </div>
    );
  }

  const [settings, insights, payments] = await Promise.all([
    getCupFeatureSettings(),
    getAdminInsights(),
    getPaymentCollection(),
  ]);

  const metrics = [
    {
      label: "Players",
      value: insights.registeredPlayers.toLocaleString("en-PK"),
      detail: `${insights.signedPlayers} on teams`,
      tone: "blue" as const,
      href: "/admin/players",
    },
    {
      label: "Matches",
      value: insights.matchesPlayed.toLocaleString("en-PK"),
      detail: `${insights.matchesWithWinner} with winner`,
      tone: "violet" as const,
      href: "/admin/matches",
    },
    {
      label: "Collected",
      value: `Rs ${payments.collected.toLocaleString("en-PK")}`,
      detail: `${payments.unpaidCount} unpaid`,
      tone: "green" as const,
      href: "/admin/payments",
    },
    {
      label: "Auction sold",
      value: insights.soldCount.toLocaleString("en-PK"),
      detail:
        insights.avgSoldPrice != null
          ? `Avg ${formatPoints(insights.avgSoldPrice)}`
          : "No sales yet",
      tone: "amber" as const,
      href: "/admin/auction",
    },
    {
      label: "Predictions",
      value: settings.predictionsEnabled ? "Unlocked" : "Locked",
      detail: settings.auctionEnabled ? "Auction on" : "Auction off",
      tone: settings.predictionsEnabled ? ("green" as const) : ("rose" as const),
      href: "/admin/predictions",
    },
  ];

  return (
    <div className="page">
      <section className="admin-metric-grid mb-6">
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="admin-metric-card group"
          >
            <div className="min-w-0">
              <p className="m-0 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {m.label}
              </p>
              <p className="mt-1 mb-0 truncate text-xl font-semibold text-foreground sm:text-2xl">
                {m.value}
              </p>
              <p className="mt-1 mb-0 truncate text-xs text-muted-foreground">
                {m.detail}
              </p>
            </div>
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11",
                TONE_ICON[m.tone === "rose" ? "rose" : m.tone],
              )}
            >
              <span className="size-2 rounded-full bg-current opacity-80" />
            </span>
          </Link>
        ))}
      </section>

      <section className="admin-dash-grid mb-6">
        <div className="admin-card">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-base font-semibold text-foreground">
              Cup switches
            </h2>
            <AdminStatus tone="gold">live</AdminStatus>
          </div>
          <AdminConfirmForm
            key={[
              settings.auctionEnabled ? "a1" : "a0",
              settings.predictionsEnabled ? "p1" : "p0",
              settings.completeTeamRequired ? "c1" : "c0",
              settings.maxMedalToApply ?? "none",
            ].join("|")}
            action={actionUpdateCupSwitches}
            message="Save cup switch changes? This affects registration, auction, and prediction lock for everyone."
            successMessage="Cup switches saved"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <AdminField label="Auction">
              <select
                name="auctionEnabled"
                defaultValue={settings.auctionEnabled ? "on" : "off"}
                className={adminControlClass}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </AdminField>
            <AdminField label="Predictions">
              <select
                name="predictionsEnabled"
                defaultValue={settings.predictionsEnabled ? "on" : "off"}
                className={adminControlClass}
              >
                <option value="on">Unlocked — players can pick</option>
                <option value="off">Locked — closes all picks</option>
              </select>
            </AdminField>
            <AdminField label="Max rank">
              <select
                name="maxMedalToApply"
                defaultValue={settings.maxMedalToApply ?? "none"}
                className={adminControlClass}
              >
                <option value="none">None</option>
                {Object.entries(MEDAL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Complete team">
              <select
                name="completeTeamRequired"
                defaultValue={settings.completeTeamRequired ? "on" : "off"}
                className={adminControlClass}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </AdminField>
            <AdminSubmitButton className="sm:col-span-2 xl:col-span-4">
              Save switches
            </AdminSubmitButton>
          </AdminConfirmForm>
        </div>

        <div className="admin-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="m-0 text-base font-semibold text-foreground">
              Snapshot
            </h2>
            <Link
              href="/admin/insights"
              className="text-xs text-[#8eb4ff] transition hover:text-[#b6ceff]"
            >
              View insights →
            </Link>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0">
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Stand-in seats</span>
              <span className="font-medium text-foreground">
                {insights.standInSeats}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Highest sold</span>
              <span className="truncate font-medium text-foreground">
                {insights.highestSold
                  ? `${insights.highestSold.name} · ${formatPoints(insights.highestSold.value)}`
                  : "—"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Teams allowed</span>
              <span className="font-medium text-foreground">
                {payments.teamsAllowed}/{payments.teamCount}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Signed in as</span>
              <span className="truncate font-medium text-foreground">
                {player?.steamName ??
                  session?.user?.email ??
                  session?.user?.name ??
                  "admin"}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mt-0 mb-3 text-base font-semibold text-foreground">
          Organizer tools
        </h2>
        <ul className="admin-tool-grid m-0 list-none p-0">
          {SECTIONS.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.href}>
                <Link href={row.href} className="admin-tool-card group">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      TONE_ICON[row.tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {row.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {row.note}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="ml-auto text-[#8eb4ff]/70 transition group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
