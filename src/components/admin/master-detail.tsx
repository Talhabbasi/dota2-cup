"use client";

import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
} from "@/components/common/esports-table";
import { cn } from "@/lib/utils";
import {
  AdminEmpty,
  AdminToolbar,
  adminBtnClass,
  adminBtnSecondaryClass,
  adminControlClass,
} from "@/components/admin/ui";

export type AdminColumn<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

export type AdminFilterOption = {
  value: string;
  label: string;
};

export type AdminFilterDef<T> = {
  key: string;
  label: string;
  /** All = empty string value */
  options: AdminFilterOption[];
  match: (row: T, value: string) => boolean;
};

type AdminDataTableProps<T> = {
  title: string;
  hint?: string;
  items: T[];
  getId: (row: T) => string;
  hrefFor: (row: T) => string;
  columns: AdminColumn<T>[];
  filters?: AdminFilterDef<T>[];
  searchPlaceholder?: string;
  searchText: (row: T) => string;
  emptyLabel?: string;
};

/** Searchable + filterable admin table — each row opens its detail sub-page. */
export function AdminDataTable<T>({
  title,
  hint,
  items,
  getId,
  hrefFor,
  columns,
  filters = [],
  searchPlaceholder = "Search…",
  searchText,
  emptyLabel = "Nothing here yet.",
}: AdminDataTableProps<T>) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return items.filter((row) => {
      for (const filter of filters) {
        const value = filterValues[filter.key] ?? "";
        if (value && !filter.match(row, value)) return false;
      }
      if (q && !searchText(row).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, deferredQuery, searchText, filters, filterValues]);

  const activeFilterCount = filters.filter(
    (f) => (filterValues[f.key] ?? "") !== "",
  ).length;

  return (
    <div>
      <AdminToolbar title={title} count={filtered.length} hint={hint}>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {filters.map((filter) => (
            <label
              key={filter.key}
              className="flex min-w-[9rem] flex-col gap-1 text-[0.65rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
            >
              {filter.label}
              <select
                value={filterValues[filter.key] ?? ""}
                onChange={(e) =>
                  setFilterValues((prev) => ({
                    ...prev,
                    [filter.key]: e.target.value,
                  }))
                }
                className={cn(adminControlClass, "min-w-[9rem] normal-case")}
                aria-label={filter.label}
              >
                <option value="">All</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[0.65rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase sm:min-w-[14rem]">
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(adminControlClass, "normal-case")}
              aria-label="Search"
            />
          </label>
          {activeFilterCount > 0 || query ? (
            <button
              type="button"
              className={cn(
                adminBtnClass,
                adminBtnSecondaryClass,
                "self-end text-xs",
              )}
              onClick={() => {
                setQuery("");
                setFilterValues({});
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </AdminToolbar>

      {items.length === 0 ? (
        <AdminEmpty>{emptyLabel}</AdminEmpty>
      ) : filtered.length === 0 ? (
        <AdminEmpty>No rows match these filters.</AdminEmpty>
      ) : (
        <div className="admin-table-scroll">
          <EsportsTable>
            <EsportsTableHeader>
              <EsportsTableRow>
                {columns.map((col) => (
                  <EsportsTableHead key={col.key} className={col.className}>
                    {col.header}
                  </EsportsTableHead>
                ))}
                <EsportsTableHead className="w-12 text-right">
                  Open
                </EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {filtered.map((row) => {
                const href = hrefFor(row);
                return (
                  <EsportsTableRow
                    key={getId(row)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                    onClick={() => router.push(href)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(href);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    {columns.map((col) => (
                      <EsportsTableCell key={col.key} className={col.className}>
                        {col.cell(row)}
                      </EsportsTableCell>
                    ))}
                    <EsportsTableCell className="text-right text-[#8eb4ff]/80">
                      →
                    </EsportsTableCell>
                  </EsportsTableRow>
                );
              })}
            </EsportsTableBody>
          </EsportsTable>
        </div>
      )}
    </div>
  );
}
