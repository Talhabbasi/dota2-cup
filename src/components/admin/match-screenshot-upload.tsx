"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { actionAttachMatchScreenshot } from "@/app/admin/actions";
import { useAdminToast } from "@/components/admin/admin-toast";
import { ImageDropField } from "@/components/admin/image-drop-field";
import {
  AdminUploadProgress,
  type UploadProgressPhase,
} from "@/components/admin/upload-progress";
import { adminBtnClass, adminBtnPrimaryClass } from "@/components/admin/ui";
import { compressImageFileForUpload } from "@/lib/compress-image-client";
import { cn } from "@/lib/utils";

/** Replace / attach a scoreboard image on an existing match (S3 only). */
export function AdminMatchScreenshotUpload({ matchId }: { matchId: string }) {
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
        data.set("matchId", matchId);
        data.set("screenshot", file);
        setPhase("upload");
        window.setTimeout(() => setPhase("ocr"), 700);
        const result = await actionAttachMatchScreenshot(data);
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          setPhase("idle");
          return;
        }
        setPhase("done");
        const pendingLinks = result.seats - result.linked;
        toast.success(
          pendingLinks > 0
            ? `K/D/A saved · ${result.linked}/${result.seats} players linked`
            : `K/D/A saved · ${result.seats} players linked`,
        );
        setPicked(null);
        setFileName(null);
        setError(null);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : "Upload failed. Try again.";
        setError(message);
        toast.error(message);
        setPhase("idle");
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!picked) {
      const message = "Choose a screenshot to upload.";
      setError(message);
      toast.error(message);
      return;
    }
    upload(picked);
  }

  const busy = pending || phase === "done";

  return (
    <div className="grid gap-3">
      <form onSubmit={onSubmit} className="grid gap-3">
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
            {pending ? "Working…" : "Read scoreboard"}
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
    </div>
  );
}
