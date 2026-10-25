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

import { canonicalTag, canonicalizeTags } from "./auto-tag";
import { getSpecialWeek, SPECIAL_WEEK_SLUGS } from "./special-weeks";

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
      "Utah's fintech corridor runs from Sandy to Lehi: Galileo, MX, SoFi, Finicity, Marqeta, Ramp. This page lists in-person events for engineers, founders, and operators building in payments, banking infrastructure, lending, and digital assets.",
    anchors: ["Galileo Financial Technologies", "MX", "SoFi", "Finicity", "Marqeta", "Ramp", "FinWise Bank"],
    /* Unfeatured 2026-10-25: no upcoming events. Re-feature when it has some. */
    featured: false,
  },
  {
    /* Stored as `biotech`; healthtech and medtech alias here
       (lib/auto-tag.ts TAG_ALIASES), so /tag/healthtech redirects. */
    tag: "biotech",
    display: "Health & Life Sciences",
    seoTitle: "Utah Health & Life Sciences Events · Biotech, Medtech · Utah Tech Calendar",
    seoDescription:
      "Utah biotech, medtech and digital health events - life sciences talks, BioUtah meetups, device and pharma research. Recursion, Myriad, BD Medical, Intermountain.",
    intro:
      "Utah's health and life sciences cluster runs from computational drug discovery (Recursion) and genomics (Myriad) to a deep device-manufacturing base (BD Medical, Edwards Lifesciences) and digital health (Intermountain Health, Health Catalyst). This page tracks the in-person research talks, BioUtah meetups, and industry events across the Wasatch front.",
    anchors: ["Recursion Pharmaceuticals", "Myriad Genetics", "BD Medical", "Edwards Lifesciences", "Intermountain Health", "BioUtah"],
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
    /* Unfeatured 2026-10-25: no upcoming events. Re-feature when it has some. */
    featured: false,
  },
  {
    tag: "aerospace",
    display: "Aerospace & Defense",
    seoTitle: "Utah Aerospace & Defense Events · Hill AFB, 47G · Utah Tech Calendar",
    seoDescription:
      "Utah aerospace and defense events - 47G meetups, Hill AFB industry days, Zero Gravity Summit. Northrop Grumman, Boeing, L3Harris, BAE.",
    intro:
      "Utah's aerospace and defense corridor is built around Hill Air Force Base in Layton. 47G organizes the year-round calendar - the Zero Gravity Summit, Day on the Hill, quarterly industry roundtables. This page collects the in-person events for engineers, founders, and operators in the cluster.",
    anchors: ["47G", "Northrop Grumman", "Boeing", "L3Harris", "BAE Systems", "Lockheed Martin", "Fortem Technologies"],
    featured: true,
  },
  {
    /* Permanent umbrella: aerospace and defense, manufacturing,
       robotics, energy, hardware. Outlives the Hard Tech Week tag. */
    tag: "hard-tech",
    display: "Hard Tech",
    seoTitle: "Utah Hard Tech Events · Aerospace, Manufacturing, Robotics · Utah Tech Calendar",
    seoDescription:
      "Utah hard tech events - aerospace and defense, advanced manufacturing, composites, robotics, drones and energy. Facility tours, 47G roundtables, founder nights.",
    intro:
      "Utah builds physical things: composites at Hexcel and Albany, defense tech around Hill Air Force Base, counter-drone systems at Fortem, robotics and energy startups up and down the Wasatch front. This page lists the in-person hard tech events, from facility tours to 47G roundtables.",
    anchors: ["47G", "Hexcel", "Northrop Grumman", "Fortem Technologies", "Albany Engineered Composites", "Nammo"],
    featured: true,
  },
  {
    tag: "gamedev",
    display: "Game Dev",
    seoTitle: "Utah Game Dev Events · Unity, Unreal, Indie · Utah Tech Calendar",
    seoDescription:
      "Utah game development events - indie game jams, Unity meetups, BYU EAE / U of U Entertainment Arts showcases. WB Games SLC, Smart Bomb alumni.",
    intro:
      "Utah's game dev scene is split between two anchors: WB Games SLC (formerly Avalanche) and the BYU + U of U game programs that feed indie studios across the front. This page lists Utah Indie Game meetups, jams, showcases, and the occasional Unity / Unreal user-group night.",
    anchors: ["WB Games SLC", "Smart Bomb Interactive", "BYU EAE", "U of U Entertainment Arts", "Utah Indie Games"],
    /* Unfeatured 2026-10-25: no upcoming events. Re-feature when it has some. */
    featured: false,
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

/* Display names for tags outside the curated taxonomy. Anything not
   listed falls back to a title-cased slug. */
const TAG_LABELS: Readonly<Record<string, string>> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  rust: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  ruby: "Ruby",
  php: "PHP",
  elixir: "Elixir",
  "c-sharp": "C# / .NET",
  scala: "Scala",
  dart: "Dart",
  react: "React",
  vue: "Vue",
  angular: "Angular",
  svelte: "Svelte",
  nextjs: "Next.js",
  django: "Django",
  flask: "Flask",
  rails: "Rails",
  laravel: "Laravel",
  flutter: "Flutter",
  "machine-learning": "Machine Learning",
  blockchain: "Blockchain",
  cloud: "Cloud",
  hardware: "Hardware",
  design: "Design",
  mobile: "Mobile",
  web: "Web Dev",
  "women-in-tech": "Women in Tech",
  hackathon: "Hackathon",
  conference: "Conference",
  workshop: "Workshop",
  meetup: "Meetup",
};

function titleCase(tag: string): string {
  return tag
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/* The name a person sees for a stored tag: a special week's label, the
   taxonomy's display name, a listed label, else the title-cased slug.
   Old spellings show under their canonical name (startup -> Founders). */
export function tagDisplayName(tag: string): string {
  const t = canonicalTag(tag) ?? tag.toLowerCase();
  return getSpecialWeek(t)?.label ?? BY_TAG.get(t)?.display ?? TAG_LABELS[t] ?? titleCase(t);
}

/* Card order: special weeks, hard tech and industries first, then
   topics, audience, languages/frameworks, and format tags last, so the
   4-tag cut on event cards keeps the most specific ones. */
const TAG_GROUP_RANK: Readonly<Record<string, number>> = {
  "hard-tech": 1,
  aerospace: 1,
  biotech: 2,
  fintech: 2,
  blockchain: 2,
  edtech: 2,
  gamedev: 2,
  ai: 3,
  "machine-learning": 3,
  cybersecurity: 3,
  data: 3,
  devops: 3,
  cloud: 3,
  hardware: 3,
  mobile: 3,
  web: 3,
  design: 3,
  founders: 4,
  "women-in-tech": 4,
  conference: 6,
  hackathon: 6,
  workshop: 6,
  meetup: 6,
};
function tagRank(tag: string): number {
  if (SPECIAL_WEEK_SLUGS.has(tag)) return 0;
  return TAG_GROUP_RANK[tag] ?? 5;
}

/* Stored tags ready to show: canonical names, no retired tags, no
   repeats, most specific first (stable within a group). */
export function displayTags(tags: readonly string[] | null | undefined): string[] {
  return canonicalizeTags(tags)
    .map((t, i) => ({ t, i, r: tagRank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.t);
}

export function getFeaturedVerticals(): TagMeta[] {
  return TAG_TAXONOMY.filter((t) => t.featured);
}

export function getAllCanonicalTags(): TagMeta[] {
  return TAG_TAXONOMY;
}
