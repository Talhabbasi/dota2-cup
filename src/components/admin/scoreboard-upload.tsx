"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { actionIngestScoreboardScreenshot } from "@/app/admin/actions";
import { useAdminToast } from "@/components/admin/admin-toast";
import {
  AdminCard,
  AdminSection,
  adminBtnClass,
  adminBtnPrimaryClass,
  adminControlClass,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/** Admin intake: upload SCOREBOARD → storage + OCR → match editor. */
export function AdminScoreboardUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const toast = useAdminToast();
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const matchId = await actionIngestScoreboardScreenshot(data);
        toast.success("Scoreboard ingested");
        formRef.current?.reset();
        setFileName(null);
        router.push(`/admin/matches/${matchId}`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not read that screenshot.",
        );
      }
    });
  }

  return (
    <AdminCard tone="accent" className="mb-6">
      <AdminSection title="Upload scoreboard">
        <p className="m-0 text-sm text-muted-foreground">
          Uploads go to S3 first, then OCR runs (same as #results). Use the
          SCOREBOARD tab (PNG/JPEG).
        </p>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="grid min-w-0 flex-1 gap-1.5 text-sm">
            <span className="text-muted-foreground">Screenshot</span>
            <input
              type="file"
              name="screenshot"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required
              disabled={pending}
              className={adminControlClass}
              onChange={(event) =>
                setFileName(event.target.files?.[0]?.name ?? null)
              }
            />
            {fileName ? (
              <span className="text-xs text-muted-foreground">{fileName}</span>
            ) : null}
          </label>
          <button
            type="submit"
            disabled={pending}
            className={cn(adminBtnClass, adminBtnPrimaryClass)}
          >
            {pending ? "Reading…" : "Upload & ingest"}
          </button>
        </form>
      </AdminSection>
    </AdminCard>
  );
}
