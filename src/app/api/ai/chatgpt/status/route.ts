import { localOrigin, MANAGE_USAGE, status } from "@/lib/chatgpt";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  if (!localOrigin(req)) {
    return Response.json({ local: false, connected: false, email: "", planUsage: false, manageUsage: MANAGE_USAGE });
  }
  return Response.json({ local: true, ...(await status()), manageUsage: MANAGE_USAGE });
}
