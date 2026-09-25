"use client";

import { AdminDataTable } from "@/components/admin/master-detail";
import { formatPoints } from "@/lib/constants";

export type AdminLotRow = {
  id: string;
  playerName: string;
  teamName: string;
  soldPrice: number;
  purse: number;
};

export function AdminAuctionBoard({ lots }: { lots: AdminLotRow[] }) {
  const teams = [
    ...new Set(lots.map((l) => l.teamName).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <AdminDataTable
      title="Sold lots"
      hint="Click a lot to correct the sold price."
      items={lots}
      getId={(l) => l.id}
      hrefFor={(l) => `/admin/auction/${l.id}`}
      searchPlaceholder="Search player or team…"
      searchText={(l) => `${l.playerName} ${l.teamName}`}
      emptyLabel="No sold lots this season."
      filters={[
        {
          key: "team",
          label: "Team",
          options: teams.map((name) => ({ value: name, label: name })),
          match: (l, value) => l.teamName === value,
        },
        {
          key: "price",
          label: "Price",
          options: [
            { value: "high", label: "5k+" },
            { value: "mid", label: "2k–5k" },
            { value: "low", label: "Under 2k" },
          ],
          match: (l, value) => {
            if (value === "high") return l.soldPrice >= 5000;
            if (value === "mid")
              return l.soldPrice >= 2000 && l.soldPrice < 5000;
            if (value === "low") return l.soldPrice < 2000;
            return true;
          },
        },
      ]}
      columns={[
        {
          key: "player",
          header: "Player",
          cell: (l) => <span className="font-medium">{l.playerName}</span>,
        },
        {
          key: "team",
          header: "Team",
          cell: (l) => l.teamName,
        },
        {
          key: "price",
          header: "Sold",
          cell: (l) => (
            <span className="tabular-nums text-primary">
              {formatPoints(l.soldPrice)}
            </span>
          ),
        },
        {
          key: "purse",
          header: "Purse left",
          cell: (l) => (
            <span className="tabular-nums text-muted-foreground">
              {formatPoints(l.purse)}
            </span>
          ),
        },
      ]}
    />
  );
}
