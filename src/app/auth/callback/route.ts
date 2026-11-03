// Loopback callback for Sign in with ChatGPT (local installs only).
import { handleCallback, localOrigin } from "@/lib/chatgpt";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = localOrigin(req);
  if (!origin) return new Response("Not available on this server.", { status: 404 });
  const result = await handleCallback(new URL(req.url).searchParams);
  const to = new URL("/tube/customize", origin);
  to.searchParams.set("ai", "chatgpt");
  if (result.ok) to.searchParams.set("chatgpt", result.planUsage ? "connected" : "no-plan");
  else to.searchParams.set("chatgpt_error", result.error.slice(0, 200));
  return Response.redirect(to, 303);
}
