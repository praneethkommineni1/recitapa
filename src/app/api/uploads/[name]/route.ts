import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";
import { UPLOAD_MIME } from "@/lib/uploads";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { name } = await params;
  const match = /^[a-f0-9]{24}\.(jpg|png|webp)$/.exec(name);
  const file = match && path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name);
  if (!match || !file || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": UPLOAD_MIME[match[1]], "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
