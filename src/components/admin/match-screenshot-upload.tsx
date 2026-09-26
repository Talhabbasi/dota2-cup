"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { actionAttachMatchScreenshot } from "@/app/admin/actions";
import { useAdminToast } from "@/components/admin/admin-toast";
import {
  adminBtnClass,
  adminBtnPrimaryClass,
  adminControlClass,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/** Replace / attach a scoreboard image on an existing match (S3 only). */
export function AdminMatchScreenshotUpload({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useAdminToast();
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("matchId", matchId);
    const file = data.get("screenshot");
    if (!(file instanceof File) || file.size === 0) {
      const message = "Choose a screenshot to upload.";
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await actionAttachMatchScreenshot(data);
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        toast.success("Screenshot saved to S3");
        form.reset();
        setError(null);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : "Upload failed. Try again.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm">
          <span className="text-muted-foreground">Image file</span>
          <input
            type="file"
            name="screenshot"
            accept="image/png,image/jpeg,image/webp,image/gif"
            required
            disabled={pending}
            className={adminControlClass}
            onChange={() => setError(null)}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className={cn(adminBtnClass, adminBtnPrimaryClass)}
        >
          {pending ? "Uploading to S3…" : "Save to S3"}
        </button>
      </form>
      {error ? (
        <p
          role="alert"
          className="m-0 rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
