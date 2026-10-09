import { APP_VERSION } from "@/lib/app-version";

export const dynamic = "force-dynamic";

/**
 * Reports the version of the web build that is serving requests. After an
 * in-app update the open tab polls this to see when the new build is live.
 */
export function GET() {
  return Response.json({ version: APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
