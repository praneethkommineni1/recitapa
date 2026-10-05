import { currentUser } from "@/lib/auth";
import { handler, json } from "@/lib/http";

export const GET = handler(async () => json({ user: await currentUser() }));
