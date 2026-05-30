import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, events as eventsTable } from "@/lib/db";
import { getEventById } from "@/lib/queries";
import { eventsToIcal } from "@/lib/feeds/ical";
import { extractIdPrefix, looksLikeUuid } from "@/lib/slugs";

export const dynamic = "force-dynamic";

/* Single-event .ics download for the "Add to Apple Calendar" button.
   Mirrors the slug/UUID resolution from the detail page so an old
   bookmark or copy-pasted UUID still resolves. */
async function resolveEventId(idParam: string): Promise<string | null> {
  if (looksLikeUuid(idParam)) return idParam;
  const prefix = extractIdPrefix(idParam);
  if (!prefix) return null;
  const r = await db.execute<{ id: string }>(sql`
    SELECT id FROM events WHERE id::text ILIKE ${prefix + "%"} LIMIT 1
  `);
  const rows = (Array.isArray(r) ? r : r.rows ?? []) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const realId = await resolveEventId(idParam);
  if (!realId) return new Response("Not found", { status: 404 });
  const event = await getEventById(realId);
  if (!event) return new Response("Not found", { status: 404 });

  const host = new URL(req.url).host;
  const ical = eventsToIcal([event], host);
  return new Response(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.id}.ics"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
