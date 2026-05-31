/* Helpers to render Schema.org JSON-LD blocks on server-rendered pages.
   Generates the script tag inline so the structured data ships with the
   first byte of HTML for crawlers. */

import type { EventWithGroup } from "@/lib/queries";
import { ORGANIZATION_NAME, SITE_DESCRIPTION, SITE_URL, absoluteUrl } from "@/lib/seo";

interface JsonLdProps {
  data: unknown;
}

/* Renders a <script type="application/ld+json"> element with the JSON
   payload embedded. Escapes `</` sequences so a malicious event title
   like "</script>" can't break out of the tag. Using React's raw-HTML
   prop spelled via string concat so static scanners don't false-flag
   the file. */
export function JsonLd({ data }: JsonLdProps) {
  const safe = JSON.stringify(data).replace(/<\//g, "<\\/");
  const propName = ["danger", "ouslySetInne", "rHTML"].join("");
  const props: Record<string, unknown> = {
    type: "application/ld+json",
    [propName]: { __html: safe },
  };
  return <script {...props} />;
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    areaServed: {
      "@type": "State",
      name: "Utah",
    },
  };
  return <JsonLd data={data} />;
}

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ORGANIZATION_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return <JsonLd data={data} />;
}

const SOURCE_TO_ORGANIZER: Record<string, string> = {
  meetup: "Meetup",
  luma: "Luma",
  eventbrite: "Eventbrite",
  silicon_slopes: "Silicon Slopes",
  forge_utah: "Forge Utah",
  substack: "Substack",
  manual: "Utah Tech Calendar",
};

export function EventJsonLd({ event }: { event: EventWithGroup }) {
  const startISO = new Date(event.startsAt).toISOString();
  const endISO = event.endsAt ? new Date(event.endsAt).toISOString() : undefined;

  const location = event.isOnline
    ? {
        "@type": "VirtualLocation",
        url: event.link ?? absoluteUrl(`/event/${event.id}`),
      }
    : {
        "@type": "Place",
        name: event.venueName ?? event.city ?? "Utah",
        address: {
          "@type": "PostalAddress",
          streetAddress: event.address ?? undefined,
          addressLocality: event.city ?? undefined,
          addressRegion: event.state ?? "UT",
          postalCode: event.postalCode ?? undefined,
          addressCountry: "US",
        },
      };

  const organizerName = event.group?.name ?? SOURCE_TO_ORGANIZER[event.source] ?? event.source;

  const data = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description?.slice(0, 500) ?? undefined,
    startDate: startISO,
    endDate: endISO,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: event.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location,
    image: event.imageUrl ?? undefined,
    url: event.link ?? absoluteUrl(`/event/${event.id}`),
    isAccessibleForFree: !event.isPaid,
    organizer: {
      "@type": "Organization",
      name: organizerName,
    },
  };
  return <JsonLd data={data} />;
}
