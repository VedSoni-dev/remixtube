import { localOrigin, startAuthorization } from "@/lib/chatgpt";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const origin = localOrigin(req, { post: true });
  if (!origin) return Response.json({ error: "Sign in with ChatGPT only works when TubeRemix runs on your own computer." }, { status: 403 });
  return Response.json({ url: await startAuthorization(origin) });
}
