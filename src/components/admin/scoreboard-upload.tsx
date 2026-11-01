"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { actionIngestScoreboardScreenshot } from "@/app/admin/actions";
import { useAdminToast } from "@/components/admin/admin-toast";
import {
  AdminUploadProgress,
  type UploadProgressPhase,
} from "@/components/admin/upload-progress";
import { ImageDropField } from "@/components/admin/image-drop-field";
import {
  AdminCard,
  AdminSection,
  adminBtnClass,
  adminBtnPrimaryClass,
} from "@/components/admin/ui";
import { compressImageFileForUpload } from "@/lib/compress-image-client";
import { cn } from "@/lib/utils";

/** Fixture-scoped OCR upload — winner comes from the scoreboard, no extra tap. */
export function AdminScoreboardUpload({
  fixtureId,
  teamA,
  teamB,
  alreadyPlayed = false,
}: {
  fixtureId: string;
  teamA: string;
  teamB: string;
  /** Winner is already saved. This upload only fills player K/D/A. */
  alreadyPlayed?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<UploadProgressPhase>("idle");
  const [runId, setRunId] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useAdminToast();
  const router = useRouter();

  function upload(raw: File) {
    setError(null);
    setFileName(raw.name);
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
        toast.success(
          alreadyPlayed
            ? "Player K/D/A saved"
            : "Scoreboard saved · winner from screenshot",
        );
        formRef.current?.reset();
        setPicked(null);
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
            ? "Reading the scoreboard timed out. Try the same screenshot once more."
            : rawMsg || "Could not read that screenshot. Try again.";
        setError(message);
        toast.error(message);
        setPhase("idle");
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!picked) {
      const message = "Choose a SCOREBOARD screenshot to upload.";
      setError(message);
      toast.error(message);
      return;
    }
    upload(picked);
  }

  const busy = pending || phase === "done";

  return (
    <AdminCard tone="accent" className="mb-6">
      <AdminSection
        title={alreadyPlayed ? "Add player K/D/A" : "Option A · Upload scoreboard"}
      >
        <p className="m-0 text-sm text-muted-foreground">
          {alreadyPlayed ? (
            <>
              Upload the SCOREBOARD tab for <strong>{teamA}</strong> vs{" "}
              <strong>{teamB}</strong>. Player K/D/A is saved on this match.
              The winner stays as recorded.
            </>
          ) : (
            <>
              Upload the SCOREBOARD tab for <strong>{teamA}</strong> vs{" "}
              <strong>{teamB}</strong>. This saves each player&apos;s K/D/A and
              the winner — you do not need to tap win/lose after this.
            </>
          )}
        </p>
        <form ref={formRef} onSubmit={onSubmit} className="grid gap-3">
          <ImageDropField
            disabled={pending}
            fileName={fileName}
            onFile={(file) => {
              setPicked(file);
              upload(file);
            }}
            onReject={(message) => {
              setError(message);
              toast.error(message);
            }}
          />
          <div>
            <button
              type="submit"
              disabled={pending || !picked}
              className={cn(adminBtnClass, adminBtnPrimaryClass)}
            >
              {pending ? "Working…" : "Upload scoreboard"}
            </button>
          </div>
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
