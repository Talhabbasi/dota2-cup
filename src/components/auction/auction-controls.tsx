"use client";

import {
  actionWebAuctionEnd,
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
import { EsportsCard } from "@/components/common";
import { labelForMedal } from "@/lib/constants";
import type { WebAuctionView } from "@/lib/web-auction";
import { cn } from "@/lib/utils";

export function AuctionControls({
  view,
  medals,
  connected,
  onResult,
  className,
}: {
  view: WebAuctionView;
  medals: readonly string[];
  connected: boolean;
  onResult: (result: unknown) => void;
  className?: string;
}) {
  const fields = (
    <>
      <input type="hidden" name="lotId" value={view.lotId ?? ""} />
      <input type="hidden" name="revision" value={view.revision} />
    </>
  );

  return (
    <EsportsCard
      interactive={false}
      className={cn("p-4", className)}
    >
      <fieldset disabled={!connected} className="m-0 grid gap-3 border-0 p-0">
        <h3 className="mt-0 mb-0 font-display text-lg tracking-wide uppercase">
          Auction controls
        </h3>
        <p className="m-0 text-xs text-muted-foreground">
          {!connected
            ? "Controls unlock when live updates are connected."
            : "Confirm sold / unsold carefully — those commit the lot."}
        </p>

        <AdminActionForm
          action={actionWebAuctionStart}
          successMessage="Auction started"
          refresh="background"
          onResult={onResult}
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
          <AdminSubmitButton className="w-full">
            Start medal pool
          </AdminSubmitButton>
        </AdminActionForm>

        <AdminActionForm
          action={actionWebAuctionStart}
          successMessage="Random all-ranks auction started"
          refresh="background"
          onResult={onResult}
          confirmMessage="Start an auction with every unsigned player in random order? Finish the current pool first if one is running."
          className="grid gap-2"
        >
          <input type="hidden" name="medal" value="all" />
          <AdminSubmitButton variant="secondary" className="w-full">
            Start random · all ranks
          </AdminSubmitButton>
          <p className="m-0 text-[0.7rem] text-muted-foreground">
            Adds every unsigned player (any medal) and shuffles the queue.
          </p>
        </AdminActionForm>

        <div className="grid grid-cols-2 gap-2">
          <AdminActionForm
            action={actionWebAuctionTimer}
            successMessage="Timer started"
            refresh="none"
            onResult={onResult}
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Start timer
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionPause}
            successMessage="Paused"
            refresh="none"
            onResult={onResult}
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Pause
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionResume}
            successMessage="Resumed"
            refresh="none"
            onResult={onResult}
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Resume
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionResetTimer}
            successMessage="Timer reset"
            refresh="none"
            onResult={onResult}
            confirmMessage="Reset the hammer clock for this lot?"
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Reset timer
            </AdminSubmitButton>
          </AdminActionForm>
          {/* Extend uses the same reset-clock backend as Reset Timer. */}
          <AdminActionForm
            action={actionWebAuctionResetTimer}
            successMessage="Timer extended"
            refresh="none"
            onResult={onResult}
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Extend timer
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionNext}
            successMessage="Next player"
            refresh="background"
            onResult={onResult}
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Next player
            </AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionSold}
            successMessage="Sold"
            confirmMessage="Confirm sale to the current high bidder?"
            refresh="background"
            onResult={onResult}
          >
            {fields}
            <AdminSubmitButton className="w-full text-xs">Mark sold</AdminSubmitButton>
          </AdminActionForm>
          <AdminActionForm
            action={actionWebAuctionPass}
            successMessage="Unsold"
            confirmMessage="Pass this player as unsold?"
            refresh="background"
            onResult={onResult}
          >
            {fields}
            <AdminSubmitButton variant="secondary" className="w-full text-xs">
              Mark unsold
            </AdminSubmitButton>
          </AdminActionForm>
        </div>

        <AdminActionForm
          action={actionWebAuctionEnd}
          successMessage="Auction ended"
          refresh="background"
          onResult={onResult}
          confirmMessage="End the current auction now? The open lot is marked unsold and the session goes idle. Sold lots stay."
          className="grid gap-2"
        >
          <AdminSubmitButton variant="danger" className="w-full">
            End current auction
          </AdminSubmitButton>
        </AdminActionForm>

        <p className="m-0 text-[0.7rem] text-muted-foreground">
          Previous player is not available from the current auction API — use
          Discord or DB tools if a lot must be rewound.
        </p>
      </fieldset>
    </EsportsCard>
  );
}
