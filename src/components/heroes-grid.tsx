"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EsportsCard,
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
} from "@/components/common";
import { Pagination, usePagedList } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HeroTournamentStat } from "@/lib/heroes";
import { cn } from "@/lib/utils";

type PlayFilter = "all" | "played" | "unplayed";
type AttrFilter = "all" | "str" | "agi" | "int" | "universal";
type SortKey = "plays" | "name";

const ATTR_TABS: { key: AttrFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "str", label: "Strength" },
  { key: "agi", label: "Agility" },
  { key: "int", label: "Intelligence" },
  { key: "universal", label: "Universal" },
];

function attrKey(primaryAttr?: string): AttrFilter | "unknown" {
  const a = (primaryAttr ?? "").toLowerCase();
  if (a === "str") return "str";
  if (a === "agi") return "agi";
  if (a === "int") return "int";
  if (a === "all") return "universal";
  return "unknown";
}

function attrLabel(primaryAttr?: string) {
  switch (attrKey(primaryAttr)) {
    case "str":
      return "Strength";
    case "agi":
      return "Agility";
    case "int":
      return "Intelligence";
    case "universal":
      return "Universal";
    default:
      return "—";
  }
}

function playLabel(plays: number) {
  if (plays === 0) return "0 plays";
  if (plays === 1) return "1 play";
  return `${plays} plays`;
}

function HeroTile({ hero }: { hero: HeroTournamentStat }) {
  const played = hero.plays > 0;

  return (
    <Link
      href={`/heroes/${hero.slug}`}
      className={cn(
        "group overflow-hidden rounded-xl border border-white/10 bg-[#121824] transition-all duration-200",
        "hover:border-amber-500/30 hover:bg-[#161f30]",
        !played && "opacity-70",
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#0a0d14]">
        <Image
          src={hero.portrait}
          alt={hero.name}
          width={180}
          height={101}
          sizes="(max-width: 720px) 45vw, 180px"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {played ? (
          <Badge className="absolute top-2 right-2 bg-amber-500 font-mono text-black hover:bg-amber-500">
            {hero.plays}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="truncate font-medium text-foreground">{hero.name}</span>
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{attrLabel(hero.primaryAttr)}</span>
          <span className={played ? "text-amber-400" : undefined}>
            {playLabel(hero.plays)}
          </span>
        </span>
      </div>
    </Link>
  );
}

export function HeroesGrid({ heroes }: { heroes: HeroTournamentStat[] }) {
  const [query, setQuery] = useState("");
  const [playFilter, setPlayFilter] = useState<PlayFilter>("all");
  const [attrFilter, setAttrFilter] = useState<AttrFilter>("all");
  const [sort, setSort] = useState<SortKey>("plays");
  const [view, setView] = useState<"grid" | "table">("grid");

  const playedCount = heroes.filter((h) => h.plays > 0).length;
  const totalPicks = heroes.reduce((n, h) => n + h.plays, 0);

  const topPicks = useMemo(
    () =>
      [...heroes]
        .filter((h) => h.plays > 0)
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 5),
    [heroes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = heroes.filter((h) => {
      if (playFilter === "played" && h.plays < 1) return false;
      if (playFilter === "unplayed" && h.plays > 0) return false;
      if (attrFilter !== "all" && attrKey(h.primaryAttr) !== attrFilter) {
        return false;
      }
      if (!q) return true;
      return h.name.toLowerCase().includes(q);
    });

    list = [...list];
    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
    }
    return list;
  }, [heroes, query, playFilter, attrFilter, sort]);

  const { page, pageCount, slice, setPage } = usePagedList(filtered, 24);

  return (
    <div className="flex flex-col gap-6">
      {topPicks.length > 0 &&
      playFilter === "all" &&
      attrFilter === "all" &&
      !query ? (
        <EsportsCard interactive={false} className="p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="m-0 font-display text-lg">Most picked</h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              Top heroes in cup matches so far
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {topPicks.map((hero, i) => (
              <Link
                key={hero.id}
                href={`/heroes/${hero.slug}`}
                className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-[#0a0d14]/50 px-2 py-3 text-center transition-colors hover:border-amber-500/30"
              >
                <span className="font-mono text-[0.62rem] tracking-[0.14em] text-amber-400 uppercase">
                  #{i + 1}
                </span>
                <Image
                  src={hero.icon}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="rounded-md"
                />
                <span className="line-clamp-2 text-xs font-medium text-foreground">
                  {hero.name}
                </span>
                <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                  {hero.plays} picks
                </span>
              </Link>
            ))}
          </div>
        </EsportsCard>
      ) : null}

      <EsportsCard interactive={false} className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <label className="players-search heroes-search-wrap block max-w-md">
            <span className="sr-only">Search heroes</span>
            <input
              className="heroes-search w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search heroes…"
            />
          </label>

          <Tabs
            value={attrFilter}
            onValueChange={(v) => setAttrFilter(v as AttrFilter)}
          >
            <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1">
              {ATTR_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="px-3">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-2">
            <div className="team-view-toggle" role="tablist" aria-label="Filter by plays">
              {(
                [
                  ["all", `All ${heroes.length}`],
                  ["played", `Played ${playedCount}`],
                  ["unplayed", "Not played"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={playFilter === key}
                  className={playFilter === key ? "active" : ""}
                  onClick={() => setPlayFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="team-view-toggle" role="tablist" aria-label="Sort heroes">
              <button
                type="button"
                role="tab"
                aria-selected={sort === "plays"}
                className={sort === "plays" ? "active" : ""}
                onClick={() => setSort("plays")}
              >
                Most picked
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sort === "name"}
                className={sort === "name" ? "active" : ""}
                onClick={() => setSort("name")}
              >
                A–Z
              </button>
            </div>

            <div className="team-view-toggle" role="tablist" aria-label="View mode">
              <button
                type="button"
                role="tab"
                aria-selected={view === "grid"}
                className={view === "grid" ? "active" : ""}
                onClick={() => setView("grid")}
              >
                Grid
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "table"}
                className={view === "table" ? "active" : ""}
                onClick={() => setView("table")}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        <p className="m-0 text-sm text-muted-foreground">
          Showing <strong className="text-foreground">{slice.length}</strong> of{" "}
          {filtered.length} heroes
          {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
          {totalPicks > 0 ? (
            <>
              {" "}
              · <strong className="text-foreground">{totalPicks}</strong> total
              picks logged
            </>
          ) : null}
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No heroes match that search.
          </div>
        ) : view === "table" ? (
          <>
            <EsportsTable framed={false}>
              <EsportsTableHeader>
                <EsportsTableRow>
                  <EsportsTableHead>Hero</EsportsTableHead>
                  <EsportsTableHead>Attribute</EsportsTableHead>
                  <EsportsTableHead className="text-right!">Plays</EsportsTableHead>
                </EsportsTableRow>
              </EsportsTableHeader>
              <EsportsTableBody>
                {slice.map((hero) => (
                  <EsportsTableRow key={hero.id}>
                    <EsportsTableCell>
                      <Link
                        href={`/heroes/${hero.slug}`}
                        className="flex items-center gap-3 text-foreground!"
                      >
                        <Image
                          src={hero.icon}
                          alt=""
                          width={32}
                          height={32}
                          sizes="32px"
                          className="rounded"
                        />
                        <span className="font-medium">{hero.name}</span>
                      </Link>
                    </EsportsTableCell>
                    <EsportsTableCell className="text-muted-foreground">
                      {attrLabel(hero.primaryAttr)}
                    </EsportsTableCell>
                    <EsportsTableCell className="text-right! font-mono tabular-nums">
                      {hero.plays}
                    </EsportsTableCell>
                  </EsportsTableRow>
                ))}
              </EsportsTableBody>
            </EsportsTable>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {slice.map((hero) => (
                <HeroTile key={hero.id} hero={hero} />
              ))}
            </div>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
          </>
        )}
      </EsportsCard>
    </div>
  );
}
