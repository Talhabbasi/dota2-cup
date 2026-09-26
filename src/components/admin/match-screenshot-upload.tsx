"use client";

import { useTransition, type FormEvent } from "react";
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
  const toast = useAdminToast();
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("matchId", matchId);
    startTransition(async () => {
      try {
        await actionAttachMatchScreenshot(data);
        toast.success("Screenshot saved to S3");
        form.reset();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Upload failed.",
        );
      }
    });
  }

  return (
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
  );
}
