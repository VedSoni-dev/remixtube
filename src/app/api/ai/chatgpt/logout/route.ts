import { localOrigin, signOut } from "@/lib/chatgpt";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!localOrigin(req, { post: true })) return Response.json({ error: "Only available on a local install." }, { status: 403 });
  return Response.json(await signOut());
}
