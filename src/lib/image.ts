"use client";

/** Maximum size of the original file accepted for upload. */
export const MAX_UPLOAD_BYTES = 512 * 1024; // 512 KB
/** Target size after compression. */
export const TARGET_BYTES = 128 * 1024; // 128 KB
/** Maximum dimension (width/height) after scaling. */
const MAX_DIMENSION = 800;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read the image file."));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function dataUrlSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return Math.round(((dataUrl.length - comma - 1) * 3) / 4);
}

function render(img: HTMLImageElement, scale: number, type: string, quality?: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}

/**
 * Compresses an image to fit under `targetBytes` (default 128 KB).
 * - PNG first when `preferPng` is set (e.g. QR codes), falls back to JPEG if still too large.
 * - Otherwise iterates JPEG quality / scale until the target size is reached.
 */
export async function compressImage(
  file: File,
  options: { targetBytes?: number; preferPng?: boolean } = {},
): Promise<string> {
  const targetBytes = options.targetBytes ?? TARGET_BYTES;
  const img = await loadImage(file);

  if (options.preferPng) {
    const png = render(img, Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height)), "image/png");
    if (dataUrlSize(png) <= targetBytes) return png;
  }

  let scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  let quality = 0.8;
  for (let attempt = 0; attempt < 12; attempt++) {
    const dataUrl = render(img, scale, "image/jpeg", quality);
    if (dataUrlSize(dataUrl) <= targetBytes) return dataUrl;
    if (quality > 0.45) {
      quality -= 0.15;
    } else {
      scale *= 0.75;
      quality = 0.8;
    }
  }
  // Last resort: smallest canvas at lowest quality.
  return render(img, 0.25, "image/jpeg", 0.4);
}

/** Validates file size (max 512 KB). Throws with a user-friendly message. */
export function assertFileSize(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB).`);
  }
}

/**
 * Compresses the image and uploads it to the R2 bucket.
 * Returns the public URL to store in the database.
 */
export async function uploadImageToR2(file: File, options: { preferPng?: boolean } = {}): Promise<string> {
  assertFileSize(file);
  const dataUrl = await compressImage(file, options);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Upload failed. Please try again.");
  }
  const data2 = (await res.json()) as { url: string };
  return data2.url;
}
