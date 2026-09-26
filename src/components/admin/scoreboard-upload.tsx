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
  const [phase, setPhase] = useState<"idle" | "upload" | "ocr">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useAdminToast();
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("screenshot");
    if (!(file instanceof File) || file.size === 0) {
      const message = "Choose a SCOREBOARD screenshot to upload.";
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    setPhase("upload");
    startTransition(async () => {
      try {
        setPhase("ocr");
        const result = await actionIngestScoreboardScreenshot(data);
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        toast.success("Scoreboard ingested");
        formRef.current?.reset();
        setFileName(null);
        setError(null);
        router.push(`/admin/matches/${result.matchId}`);
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : "Could not read that screenshot. Try again.";
        setError(message);
        toast.error(message);
      } finally {
        setPhase("idle");
      }
    });
  }

  const pendingLabel =
    phase === "upload"
      ? "Uploading…"
      : phase === "ocr"
        ? "Reading…"
        : "Upload & ingest";

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
              onChange={(event) => {
                setFileName(event.target.files?.[0]?.name ?? null);
                setError(null);
              }}
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
            {pending ? pendingLabel : "Upload & ingest"}
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
      </AdminSection>
    </AdminCard>
  );
}
