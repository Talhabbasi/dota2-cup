"use client";

import { useCallback, useState } from "react";
import {
  actionWebAuctionNext,
  actionWebAuctionPass,
  actionWebAuctionPause,
  actionWebAuctionResetTimer,
  actionWebAuctionResume,
  actionWebAuctionSold,
  actionWebAuctionStart,
  actionWebAuctionTimer,
} from "@/app/admin/actions";
import {
  AdminActionForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { AdminField, adminControlClass } from "@/components/admin/ui";
import { LiveAuctionBoard } from "@/components/live-auction-board";
import type { WebAuctionView } from "@/lib/web-auction";
import { labelForMedal } from "@/lib/constants";

export function AdminAuctionDesk({
  view,
  format,
  medals,
}: {
  view: WebAuctionView;
  format: string;
  medals: readonly string[];
}) {
  const [current, setCurrent] = useState(view);
  const [connected, setConnected] = useState(false);
  const onView = useCallback((next: WebAuctionView, ready: boolean) => { setCurrent(next); setConnected(ready); }, []);
  const fields = <><input type="hidden" name="lotId" value={current.lotId ?? ""} /><input type="hidden" name="revision" value={current.revision} /></>;
  if (format === "TEAM_BASED") {
    return (
      <p className="m-0 text-sm text-muted-foreground">
        This season is <strong>team-based</strong>. Assign players under Teams —
        no live auction desk.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <LiveAuctionBoard initial={view} onView={onView} />
      <fieldset disabled={!connected} className="grid gap-3 self-start rounded-xl border border-white/10 p-4">
        <h3 className="mt-0 mb-1 font-display text-lg tracking-wide uppercase">
          Master control
        </h3>
        <AdminActionForm
          action={actionWebAuctionStart}
          successMessage="Auction started"
          className="grid gap-2"
        >
          <AdminField label="Medal pool">
            <select name="medal" defaultValue={medals[0]} className={adminControlClass}>
              {medals.map((m) => (
                <option key={m} value={m}>
                  {labelForMedal(m)}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminSubmitButton>Introduce / start pool</AdminSubmitButton>
        </AdminActionForm>

        <div className="grid grid-cols-2 gap-2">
          <AdminActionForm action={actionWebAuctionTimer} successMessage="Timer started">
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Start timer
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm action={actionWebAuctionResetTimer} successMessage="Timer reset">
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Reset timer
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm action={actionWebAuctionPause} successMessage="Paused">
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Pause
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm action={actionWebAuctionResume} successMessage="Resumed">
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Resume
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionSold}
            successMessage="Sold"
            confirmMessage="Confirm sale to high bidder?"
          >
            {fields}
            <AdminSubmitButton className="w-full text-xs">Sold</AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionPass}
            successMessage="Unsold"
            confirmMessage="Pass this player as unsold?"
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Pass / unsold
            </AdminSubmitButton>
          </AdminActionForm>
        </div>
        <AdminActionForm action={actionWebAuctionNext} successMessage="Next player">
          {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
            Pass and introduce next
          </AdminSubmitButton>
        </AdminActionForm>
      </fieldset>
    </div>
  );
}
