/* Curated registry of "vertical" tags. Drives:
   - /tag/[tag] editorial intro (replaces the generic "N events tagged X"
     paragraph with a Utah-specific paragraph that earns SEO and
     matches the rest of the site's voice)
   - sitemap.ts so canonical tag pages stay in the index even on a
     dry week (zero approved events doesn't equal "tag doesn't exist")
   - homepage / footer surfacing as "Browse by vertical"
   - SEO <title> and meta description, hand-tuned per tag rather than
     a template that floods the SERP with near-duplicates

   Adding a new tag here is the source of truth - the auto-tag.ts
   regex lives in parallel. If a tag exists in RULES but not here, the
   landing page still works (via the DB fallback in tagFromSlug) but
   you miss the editorial polish. Both should move together. */

export interface TagMeta {
  /* The canonical tag string as stored in events.tags. Lowercase
     kebab-case to match the slug. */
  tag: string;
  /* Display form for headlines: "Fintech", "Healthtech", "AI", etc.
     `tagTitle()` in the route is a fallback; this overrides. */
  display: string;
  /* The `<title>` tag - hand-tuned for long-tail SEO. Keep under
     60 chars to avoid Google truncation. */
  seoTitle: string;
  /* Meta description, 130-155 chars. The first sentence is the hook
     in the SERP. */
  seoDescription: string;
  /* On-page intro paragraph. ~30-50 words. Written in the same
     editorial voice as the rest of the site. Specific to Utah - name
     the local companies / clusters / personalities so the page
     reads like a person wrote it, not a CMS. */
  intro: string;
  /* Companies/orgs that anchor the vertical in Utah. Listed under
     the intro as "anchor employers" so visitors orient quickly. */
  anchors?: string[];
  /* Whether this tag should appear in the homepage / footer
     "Browse by vertical" surface. We surface the top 6-8 verticals;
     niche tags can live in the taxonomy without being featured. */
  featured: boolean;
}

export const TAG_TAXONOMY: TagMeta[] = [
  {
    tag: "ai",
    display: "AI",
    seoTitle: "Utah AI Events · Meetups, Conferences, Talks · Utah Tech Calendar",
    seoDescription:
      "Every upcoming in-person Utah AI event - meetups, conferences, workshops, hackathons. Curated from Silicon Slopes, Lehi, SLC, Provo, and BYU/U.",
    intro:
      "Utah's AI scene runs hot. Silicon Slopes hosts the weekly Power Hour, Recursion and Domo push hiring forward, and BYU + U of U research labs spin off founders monthly. This page lists every in-person AI meetup, lecture, demo, and hackathon we can find.",
    anchors: ["Silicon Slopes", "Recursion Pharmaceuticals", "Domo", "BYU AI Lab", "Lehi founders"],
    featured: true,
  },
  {
    tag: "fintech",
    display: "Fintech",
    seoTitle: "Utah Fintech Events · Payments, Banking, Crypto · Utah Tech Calendar",
    seoDescription:
      "Utah fintech meetups, talks, and conferences - payments, banking, lending, neobanks, wealthtech. Lehi cluster + SLC events curated weekly.",
    intro:
      "Utah's fintech corridor runs from Sandy to Lehi: Galileo, MX, SoFi, Finicity, Acima. This page lists in-person events for engineers, founders, and operators building in payments, banking infrastructure, lending, and digital assets.",
    anchors: ["Galileo Financial Technologies", "MX", "SoFi", "Finicity", "Acima", "Pelago"],
    featured: true,
  },
  {
    tag: "healthtech",
    display: "Healthtech",
    seoTitle: "Utah Healthtech Events · Digital Health, EHR, Med Devices · Utah Tech Calendar",
    seoDescription:
      "Utah healthtech meetups and conferences - digital health, EHR/EMR, telehealth, patient platforms. Oracle Health, Intermountain, Owlet, Recursion.",
    intro:
      "Utah's healthtech employer base is unusually deep: Oracle Health (ex-Cerner), Intermountain Health's innovation org, Owlet, R1 RCM, and the patient-platform startups across Sandy and Lehi. This page collects in-person events for engineers and operators in digital health.",
    anchors: ["Oracle Health", "Intermountain Health", "Owlet", "R1 RCM", "Recursion Pharmaceuticals"],
    featured: true,
  },
  {
    tag: "biotech",
    display: "Biotech",
    seoTitle: "Utah Biotech Events · Life Sciences, Genomics, Devices · Utah Tech Calendar",
    seoDescription:
      "Utah biotech meetups, conferences, and lab events - life sciences, genomics, medical devices. Recursion, Myriad, BD Medical, U of U research.",
    intro:
      "Utah biotech sits at the intersection of computational drug discovery (Recursion), genomics legacy (Myriad), and a strong device-manufacturing base (BD Medical, Edwards Lifesciences). This page tracks the in-person research talks, founder dinners, and industry meetups happening across the Wasatch front.",
    anchors: ["Recursion Pharmaceuticals", "Myriad Genetics", "BD Medical", "Edwards Lifesciences", "BioHive"],
    featured: true,
  },
  {
    tag: "edtech",
    display: "Edtech",
    seoTitle: "Utah Edtech Events · Learning Tech, LMS, K12 + Higher Ed · Utah Tech Calendar",
    seoDescription:
      "Utah edtech meetups and conferences - LMS, online learning, K-12 + higher ed platforms. Instructure (Canvas), Pluralsight, Civitas, BYU Continuing Ed.",
    intro:
      "Utah's edtech cluster centers on Lehi - Instructure (Canvas), Pluralsight, Civitas Learning - with deep BYU and U of U research crossover. This page lists the in-person events for engineers, learning designers, and founders building education tools.",
    anchors: ["Instructure (Canvas)", "Pluralsight", "Civitas Learning", "BYU OpenCourseWare", "U of U EdTech"],
    featured: true,
  },
  {
    tag: "cybersecurity",
    display: "Cybersecurity",
    seoTitle: "Utah Cybersecurity Events · Infosec, Pentest, AppSec · Utah Tech Calendar",
    seoDescription:
      "Utah cybersecurity meetups and conferences - infosec, pentest, AppSec, blue team, CTI. SaintCon, BSides SLC, OWASP Utah, monthly DEF CON groups.",
    intro:
      "Utah's security community runs through SaintCon (Provo), BSides SLC, OWASP Utah, and the DEF CON 801/385 groups. This page lists every in-person infosec event - meetups, capture-the-flag nights, talks, and the regional conferences.",
    anchors: ["SaintCon", "BSides SLC", "OWASP Utah", "DEF CON 801", "Lookout", "BlackCloak"],
    featured: true,
  },
  {
    tag: "founders",
    display: "Founders",
    seoTitle: "Utah Founder & Startup Events · Pitch Nights, Demos · Utah Tech Calendar",
    seoDescription:
      "Utah startup founder events - pitch nights, founder dinners, accelerator demo days, investor meetups. Silicon Slopes, Kickstart, Pelion, Album VC.",
    intro:
      "Utah's founder scene runs on a few weekly fixtures plus a long tail of cohort demo days. Silicon Slopes, Kickstart Fund, Pelion, Album VC, and BoomStartup anchor the calendar. This page lists every in-person event for early-stage founders and the people who back them.",
    anchors: ["Silicon Slopes", "Kickstart Fund", "Pelion Venture Partners", "Album VC", "BoomStartup"],
    featured: true,
  },
  {
    tag: "devops",
    display: "DevOps",
    seoTitle: "Utah DevOps Events · Kubernetes, SRE, CI/CD · Utah Tech Calendar",
    seoDescription:
      "Utah DevOps meetups - Kubernetes, SRE, CI/CD, observability, platform engineering. SLC + Lehi groups.",
    intro:
      "Utah's DevOps community is small but consistent: Kubernetes SLC, the AWS user group, SRE meetups out of Lehi. This page lists every in-person event for platform, infra, and SRE engineers.",
    featured: false,
  },
  {
    tag: "data",
    display: "Data",
    seoTitle: "Utah Data Events · Engineering, Science, Analytics · Utah Tech Calendar",
    seoDescription:
      "Utah data meetups - engineering, science, analytics, warehousing, ML pipelines. SLC + Lehi groups.",
    intro:
      "Utah data engineering and science meetups: SLC Data Engineering, Big Mountain Data, Day of Data, plus the dbt/Snowflake/Databricks user groups when they swing through. This page lists every in-person event for the people moving data around for a living.",
    featured: false,
  },
];

const BY_TAG: Map<string, TagMeta> = new Map(TAG_TAXONOMY.map((t) => [t.tag, t]));

export function getTagMeta(tag: string): TagMeta | null {
  return BY_TAG.get(tag.toLowerCase()) ?? null;
}

export function getFeaturedVerticals(): TagMeta[] {
  return TAG_TAXONOMY.filter((t) => t.featured);
}

export function getAllCanonicalTags(): TagMeta[] {
  return TAG_TAXONOMY;
}
