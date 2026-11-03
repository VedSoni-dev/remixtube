import { completeWithPlan, localOrigin } from "@/lib/chatgpt";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!localOrigin(req, { post: true })) return Response.json({ error: "Only available on a local install." }, { status: 403 });
  let body: { system?: unknown; user?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad request" }, { status: 400 }); }
  if (typeof body.system !== "string" || typeof body.user !== "string" || body.system.length > 4000 || body.user.length > 12000) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  try {
    return Response.json({ text: await completeWithPlan(body.system, body.user) });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 502;
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status });
  }
}
