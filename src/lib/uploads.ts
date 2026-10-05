import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "./db";
import { HttpError } from "./http";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const UPLOAD_MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_BYTES = 6 * 1024 * 1024;

/** Persist a base64 data URL image and return its public URL. */
export function saveDataUrl(dataUrl: string): string {
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  const ext = match && TYPES[match[1]];
  if (!match || !ext) throw new HttpError(400, "Photos must be JPEG, PNG or WebP.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_BYTES) throw new HttpError(413, "Photo is too large (max 6 MB).");
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name), bytes);
  return `/api/uploads/${name}`;
}

export function photoField(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("data:")) return saveDataUrl(value);
  if (/^\/api\/uploads\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(value)) return value;
  throw new HttpError(400, "Invalid photo.");
}
