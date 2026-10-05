import { endSession } from "@/lib/auth";
import { handler, json } from "@/lib/http";

export const POST = handler(async () => {
  await endSession();
  return json({ ok: true });
});
