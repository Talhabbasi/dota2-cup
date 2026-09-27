"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { actionIngestScoreboardScreenshot } from "@/app/admin/actions";
import { useAdminToast } from "@/components/admin/admin-toast";
import {
  AdminUploadProgress,
  type UploadProgressPhase,
} from "@/components/admin/upload-progress";
import {
  AdminCard,
  AdminSection,
  adminBtnClass,
  adminBtnPrimaryClass,
  adminControlClass,
} from "@/components/admin/ui";
import { compressImageFileForUpload } from "@/lib/compress-image-client";
import { cn } from "@/lib/utils";

/** Fixture-scoped OCR upload — winner comes from the scoreboard, no extra tap. */
export function AdminScoreboardUpload({
  fixtureId,
  teamA,
  teamB,
}: {
  fixtureId: string;
  teamA: string;
  teamB: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<UploadProgressPhase>("idle");
  const [runId, setRunId] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useAdminToast();
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = new FormData(form).get("screenshot");
    if (!(raw instanceof File) || raw.size === 0) {
      const message = "Choose a SCOREBOARD screenshot to upload.";
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    setRunId((n) => n + 1);
    setPhase("compress");
    startTransition(async () => {
      try {
        const file = await compressImageFileForUpload(raw);
        const data = new FormData();
        data.set("fixtureId", fixtureId);
        data.set("screenshot", file);
        setPhase("upload");
        window.setTimeout(() => setPhase("ocr"), 700);
        const result = await actionIngestScoreboardScreenshot(data);
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          setPhase("idle");
          return;
        }
        setPhase("done");
        toast.success("Scoreboard saved · winner from screenshot");
        formRef.current?.reset();
        setFileName(null);
        setError(null);
        router.push(`/admin/matches/${result.matchId}`);
        router.refresh();
      } catch (err) {
        const rawMsg =
          err instanceof Error && err.message.trim() ? err.message : "";
        const message =
          /aborted due to timeout|timed? out|TimeoutError|AbortError/i.test(
            rawMsg,
          )
            ? "Upload timed out while reading the scoreboard. Try again with a clearer crop."
            : rawMsg || "Could not read that screenshot. Try again.";
        setError(message);
        toast.error(message);
        setPhase("idle");
      }
    });
  }

  const busy = pending || phase === "done";

  return (
    <AdminCard tone="accent" className="mb-6">
      <AdminSection title="Option A · Upload scoreboard">
        <p className="m-0 text-sm text-muted-foreground">
          Upload the SCOREBOARD tab for <strong>{teamA}</strong> vs{" "}
          <strong>{teamB}</strong>. OCR reads the winner — you do not need to
          tap win/lose after this.
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
            {pending ? "Working…" : "Upload scoreboard"}
          </button>
        </form>
        <AdminUploadProgress
          key={runId}
          active={busy && phase !== "idle"}
          phase={phase}
        />
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
