import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public demo mode (DEMO_MODE=1, set on the Vercel deployment).
 *
 * The demo only plays the recorded replay (replays/demo.json), so everything that could run
 * live agents or spend API credits is switched off here, before any page or route code runs:
 *   - /api/*            -> 403 (these start agent runs and write to the database)
 *   - /, /apply, /case/<id>/followup, and any live /case/<id> -> redirect to the replay
 *   - /case/<id>/dossier -> the replay's dossier
 * Without DEMO_MODE this file does nothing and the app behaves normally.
 */
const REPLAY = "/case/demo";

export function proxy(request: NextRequest) {
  if (process.env.DEMO_MODE !== "1") return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;

  // Next's own assets and anything with a file extension (fonts, images, favicon) pass through.
  if (pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Disabled in the public demo. Run the project locally for live research." }, { status: 403 });
  }

  const replayUrl = new URL(REPLAY, request.url);
  replayUrl.searchParams.set("replay", "1");

  if (pathname === "/dossier" || /^\/case\/[^/]+\/dossier\/?$/.test(pathname)) {
    if (searchParams.get("replay") === "1" && pathname === `${REPLAY}/dossier`) return NextResponse.next();
    const url = new URL(`${REPLAY}/dossier`, request.url);
    url.searchParams.set("replay", "1");
    return NextResponse.redirect(url);
  }

  const isCaseRoot = /^\/case\/[^/]+\/?$/.test(pathname);
  if (isCaseRoot && pathname.replace(/\/$/, "") === REPLAY && searchParams.get("replay") === "1") return NextResponse.next();

  // Everything else that is a page (start page, apply form, follow-up chat, live case ids).
  return NextResponse.redirect(replayUrl);
}
