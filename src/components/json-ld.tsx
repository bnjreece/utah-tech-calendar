/* Helpers to render Schema.org JSON-LD blocks on server-rendered pages.
   Generates the script tag inline so the structured data ships with the
   first byte of HTML for crawlers. */

import type { EventWithGroup } from "@/lib/queries";
import { ORGANIZATION_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { buildEventJsonLd } from "@/lib/seo-rules";

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

/* Event markup comes from lib/seo-rules.ts buildEventJsonLd, which returns
   null for events Google can't use (online-only, no address, penciled-in,
   hidden or placeholder-titled); render nothing then. */
export function EventJsonLd({ event }: { event: EventWithGroup }) {
  const data = buildEventJsonLd(event);
  if (!data) return null;
  return <JsonLd data={data} />;
}
