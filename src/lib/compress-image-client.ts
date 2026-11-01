/** Server actions reject bodies over the platform limit. Keep the screenshot at or under 1 MB. */

/** Stay under 1 MB after the form wrapper, so the server action body is accepted. */
const MAX_UPLOAD_BYTES = 900_000;

async function renderJpeg(file: File, edge: number, quality: number): Promise<File | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/jpeg", quality),
  );
  if (!blob) return null;
  const base = file.name.replace(/\.[^.]+$/, "") || "scoreboard";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export async function compressImageFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= MAX_UPLOAD_BYTES && file.type === "image/jpeg") return file;

  try {
    let edge = 1600;
    let quality = 0.82;
    let best = file;
    for (let pass = 0; pass < 6; pass++) {
      const next = await renderJpeg(file, edge, quality);
      if (!next) return best;
      best = next;
      if (next.size <= MAX_UPLOAD_BYTES) return next;
      edge = Math.max(720, Math.round(edge * 0.8));
      quality = Math.max(0.5, quality - 0.08);
    }
    return best.size < file.size ? best : file;
  } catch {
    return file;
  }
}
