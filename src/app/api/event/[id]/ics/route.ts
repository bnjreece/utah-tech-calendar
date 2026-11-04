import { NextRequest } from "next/server";
import { getPublicEventByParam } from "@/lib/queries";
import { eventsToIcal } from "@/lib/feeds/ical";
import { SITE_URL } from "@/lib/seo";
import { eventSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

/* Single-event .ics download for the "Add to Apple Calendar" button.
   Resolves a slug or an old UUID like the detail page, from the shared
   cached dataset (no database query). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const event = await getPublicEventByParam(idParam);
  if (!event) return new Response("Not found", { status: 404 });

  const host = new URL(req.url).host;
  const ical = eventsToIcal([event], host, SITE_URL);
  /* ASCII fallback + RFC 5987 UTF-8 filename so non-ASCII titles render
     correctly when the user saves the file. The slug is already
     lowercase ASCII so the fallback is rarely materially different. */
  const slug = eventSlug(event.title, event.id);
  const asciiName = `${slug}.ics`;
  const utf8Name = encodeURIComponent(`${event.title}.ics`);
  return new Response(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
