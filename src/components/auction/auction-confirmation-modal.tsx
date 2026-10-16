"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuctionConfirmationModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auction-confirm-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-[#121824] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        <h2
          id="auction-confirm-title"
          className="m-0 font-display text-lg tracking-wide uppercase"
        >
          {title}
        </h2>
        <p className="mt-2 mb-0 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            className={cn(!destructive && "bg-primary text-primary-foreground")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
