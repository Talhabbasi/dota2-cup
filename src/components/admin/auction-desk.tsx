"use client";

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
import { MEDALS, MEDAL_LABELS } from "@/lib/constants";

export function AdminAuctionDesk({
  view,
  format,
}: {
  view: WebAuctionView;
  format: string;
}) {
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
      <LiveAuctionBoard initial={view} />
      <div className="grid gap-3 self-start rounded-xl border border-white/10 p-4">
        <h3 className="mt-0 mb-1 font-display text-lg tracking-wide uppercase">
          Master control
        </h3>
        <AdminActionForm
          action={actionWebAuctionStart}
          successMessage="Auction started"
          className="grid gap-2"
        >
          <AdminField label="Medal pool">
            <select name="medal" defaultValue="divine" className={adminControlClass}>
              {MEDALS.map((m) => (
                <option key={m} value={m}>
                  {MEDAL_LABELS[m]}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminSubmitButton>Introduce / start pool</AdminSubmitButton>
        </AdminActionForm>

        <div className="grid grid-cols-2 gap-2">
          <AdminActionForm action={actionWebAuctionTimer} successMessage="Timer started">
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Start timer
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm action={actionWebAuctionResetTimer} successMessage="Timer reset">
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Reset timer
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm action={actionWebAuctionPause} successMessage="Paused">
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Pause
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm action={actionWebAuctionResume} successMessage="Resumed">
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Resume
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionSold}
            successMessage="Sold"
            confirmMessage="Confirm sale to high bidder?"
          >
            <AdminSubmitButton className="w-full text-xs">Sold</AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionPass}
            successMessage="Unsold"
            confirmMessage="Pass this player as unsold?"
          >
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Pass / unsold
            </AdminSubmitButton>
          </AdminActionForm>
        </div>
        <AdminActionForm action={actionWebAuctionNext} successMessage="Next player">
          <AdminSubmitButton variant="secondary" className="w-full text-xs">
            Introduce next (skip queue advance)
          </AdminSubmitButton>
        </AdminActionForm>
      </div>
    </div>
  );
}
