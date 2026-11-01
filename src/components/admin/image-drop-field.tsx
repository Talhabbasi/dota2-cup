"use client";

import { useRef, useState, type DragEvent } from "react";
import { adminBtnClass, adminBtnSecondaryClass } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Click to browse, or drop a scoreboard image onto the box. */
export function ImageDropField({
  disabled,
  fileName,
  onFile,
  onReject,
}: {
  disabled?: boolean;
  fileName: string | null;
  onFile: (file: File) => void;
  onReject?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function take(list: FileList | null | undefined) {
    if (disabled) return;
    const file = list?.[0];
    if (!file || file.size === 0) return;
    if (!file.type.startsWith("image/")) {
      onReject?.("Drop a PNG or JPEG screenshot.");
      return;
    }
    onFile(file);
  }

  function onDrag(event: DragEvent<HTMLDivElement>, active: boolean) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setOver(active);
  }

  return (
    <div
      role="group"
      aria-label="Scoreboard image"
      onDragEnter={(event) => onDrag(event, true)}
      onDragOver={(event) => onDrag(event, true)}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        onDrag(event, false);
      }}
      onDrop={(event) => {
        onDrag(event, false);
        take(event.dataTransfer.files);
      }}
      className={cn(
        "grid gap-2 rounded-lg border border-dashed px-4 py-4 text-sm transition",
        over
          ? "border-amber-400 bg-amber-500/10"
          : "border-white/20 bg-white/[0.02]",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <p className="m-0 text-muted-foreground">
        {over ? "Drop the screenshot" : "Drag a scoreboard image here, or choose a file."}
      </p>
      {fileName ? (
        <p className="m-0 text-xs text-foreground">{fileName}</p>
      ) : null}
      <div>
        <button
          type="button"
          disabled={disabled}
          className={cn(adminBtnClass, adminBtnSecondaryClass)}
          onClick={() => inputRef.current?.click()}
        >
          Choose image
        </button>
        <input
          ref={inputRef}
          type="file"
          name="screenshot"
          accept={ACCEPT}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
