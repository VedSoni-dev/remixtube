// Malformed percent-encoding in a path would otherwise surface as a 500 from param decoding.
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  try {
    decodeURIComponent(req.nextUrl.pathname);
  } catch {
    return new NextResponse("Bad request: malformed URL.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/r/:path*", "/tube/topics/:path*"] };
