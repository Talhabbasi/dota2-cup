"use client";

import type { ComponentProps } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EsportsCard } from "@/components/common/esports-card";

export type EsportsTableProps = ComponentProps<typeof Table> & {
  /** Wrap the table in the standard surface card. Default true. */
  framed?: boolean;
  frameClassName?: string;
};

/**
 * Dark esports table: muted uppercase headers, zebra rows, amber-tint hover.
 */
export function EsportsTable({
  className,
  framed = true,
  frameClassName,
  ...props
}: EsportsTableProps) {
  const table = (
    <Table
      className={cn("text-foreground", className)}
      {...props}
    />
  );

  if (!framed) return table;

  return (
    <EsportsCard
      interactive={false}
      className={cn("overflow-hidden py-0", frameClassName)}
    >
      {table}
    </EsportsCard>
  );
}

export function EsportsTableHeader({
  className,
  ...props
}: ComponentProps<typeof TableHeader>) {
  return (
    <TableHeader
      className={cn("[&_tr]:border-white/10", className)}
      {...props}
    />
  );
}

export function EsportsTableBody({
  className,
  ...props
}: ComponentProps<typeof TableBody>) {
  return (
    <TableBody
      className={cn(
        "[&_tr:nth-child(even)]:bg-white/[0.02] [&_tr:last-child]:border-0",
        className,
      )}
      {...props}
    />
  );
}

export function EsportsTableRow({
  className,
  ...props
}: ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        "border-white/10 transition-colors hover:bg-amber-500/5 data-[state=selected]:bg-amber-500/10",
        className,
      )}
      {...props}
    />
  );
}

export function EsportsTableHead({
  className,
  ...props
}: ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      className={cn(
        "h-10 bg-[#121824]! px-3 text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground! uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function EsportsTableCell({
  className,
  ...props
}: ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={cn(
        "border-white/10! px-3 py-2.5 align-middle text-sm text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function EsportsTableFooter({
  className,
  ...props
}: ComponentProps<typeof TableFooter>) {
  return (
    <TableFooter
      className={cn("border-white/10 bg-[#0a0d14]/60", className)}
      {...props}
    />
  );
}

export function EsportsTableCaption({
  className,
  ...props
}: ComponentProps<typeof TableCaption>) {
  return (
    <TableCaption
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}
