/* Title-keyword auto-tagger. Scrapers don't always emit tags - most
   Eventbrite events ship without any, and Luma calendars supply ad-hoc
   labels at best. We infer tags from the event title (and, for a few
   unambiguous phrases, the description) so the /tag/[tag] landing pages
   have actual content.

   Approach: a hand-curated keyword -> canonical-tag table. Aim for high
   precision - a tag landing page with one off-topic event hurts more
   than helps.

   Topic rules (2026-10-25 tag cleanup) match the TITLE. A description
   only counts through a rule's `desc` pattern, which lists strong
   phrases ("cyber security", "machine learning", "data engineering").
   Single loose words in a description were the main source of wrong
   tags: `pm\b` matched "7:00 PM" (product-management on 91 approved
   events, about 5 real), a bare "security" matched "security deposit",
   "Snowflake" and "47G" in a sponsor list tagged data and aerospace.
   Language, framework and format rules still read title + description,
   as before.

   Every tag that reaches events.tags goes through `finalizeTags`: the
   alias map (startup/founder -> founders, healthtech/medtech -> biotech,
   product-management dropped), then implications (aerospace and the
   Hard Tech Week tag imply the permanent `hard-tech` umbrella). */

interface TagRule {
  tag: string;
  /* Matched against the title, or title + description when `anyText`. */
  re: RegExp;
  anyText?: boolean;
  /* Strong phrases that count when they appear in the description. */
  desc?: RegExp;
}

/* Shared by the aerospace rule (title) and the hard-tech umbrella. */
const AEROSPACE_TITLE =
  /\b(aerospace|(?<!(?:self|thesis|dissertation)[- ])defen[cs]e|national security|air force|hill afb|space force|warfighters?|drones?|counter[- ]uas|c-uas|uas|uavs?|aam|advanced air mobility|evtol|air mobility|space\s+(?:industry|tech|technology|systems|shuttle|station|economy|exploration|launch|force)|in space|outer space|spacecraft|spaceflight|satellites?|astronauts?|rockets?|rocketry|northrop\s+grumman|raytheon|l3harris|lockheed(?:\s+martin)?|boeing|bae\s+systems|47g|zero gravity summit)\b/i;

const RULES: TagRule[] = [
  /* Programming languages */
  { tag: "javascript", re: /\b(javascript|js\b|node\.?js)\b/i, anyText: true },
  { tag: "typescript", re: /\btypescript|\bts\b/i, anyText: true },
  { tag: "python", re: /\bpython\b/i, anyText: true },
  { tag: "rust", re: /\brust\b(?! belt)/i, anyText: true },
  { tag: "go", re: /\b(golang|go user group|go meetup)\b/i, anyText: true },
  { tag: "java", re: /\bjava\b(?!script)/i, anyText: true },
  { tag: "kotlin", re: /\bkotlin\b/i, anyText: true },
  { tag: "swift", re: /\bswift\b/i, anyText: true },
  { tag: "ruby", re: /\bruby\b/i, anyText: true },
  { tag: "php", re: /\bphp\b/i, anyText: true },
  { tag: "elixir", re: /\belixir\b/i, anyText: true },
  { tag: "c-sharp", re: /\bc#|c-sharp|\.net\b/i, anyText: true },
  { tag: "scala", re: /\bscala\b/i, anyText: true },
  { tag: "dart", re: /\bdart\b/i, anyText: true },

  /* Frameworks / runtimes */
  { tag: "react", re: /\breact(?:\.?js)?\b(?!ion)/i, anyText: true },
  { tag: "vue", re: /\bvue(?:\.?js)?\b/i, anyText: true },
  { tag: "angular", re: /\bangular\b/i, anyText: true },
  { tag: "svelte", re: /\bsvelte\b/i, anyText: true },
  { tag: "nextjs", re: /\bnext\.?js\b/i, anyText: true },
  { tag: "django", re: /\bdjango\b/i, anyText: true },
  { tag: "flask", re: /\bflask\b/i, anyText: true },
  { tag: "rails", re: /\brails\b/i, anyText: true },
  { tag: "laravel", re: /\blaravel\b/i, anyText: true },
  { tag: "flutter", re: /\bflutter\b/i, anyText: true },

  /* Topics: title, plus strong description phrases only. */
  /* Tightened: bare `agents?` and `claude`/`copilot` collide with real
     estate agents, insurance agents, the literal model name in an
     unrelated career-fair listing, etc. Require the AI sense via
     "AI agents" / "agentic" / "agent framework". */
  {
    tag: "ai",
    re: /\b(ai|artificial intelligence|generative ai|genai|llm|llms|ai agents?|agentic|agent framework|chatgpt|chatbots?|claude code|gpt-?\d|anthropic|openai)\b/i,
    desc: /\b(artificial intelligence|generative ai|large language models?|ai agents?|agentic ai|ai\/ml)\b/i,
  },
  {
    tag: "machine-learning",
    re: /\b(machine learning|ml|mlops|deep learning|neural networks?)\b/i,
    desc: /\b(machine learning|deep learning|neural networks?|mlops)\b/i,
  },
  {
    /* "Snowflake", "SQL" and "warehouse" no longer count from a
       description: sponsor lists ("AI Meetup with Qlik and Snowflake")
       and venue copy fired them. */
    tag: "data",
    re: /\b(data engineering|data engineers?|data science|data scientists?|data analytics|data warehous\w*|sql|postgres|postgresql|big data|databricks|snowflake|airflow|dbt)\b/i,
    desc: /\b(data engineering|data science|data analytics|data warehous\w*|big data|data pipelines?)\b/i,
  },
  {
    /* Bare "security" counts in a title only, and not in the non-cyber
       phrases below. "national security" is defense (aerospace). */
    tag: "cybersecurity",
    re: /\b(cyber\s*security|cyber|infosec|appsec|owasp|bsides\w*|saintcon|def\s?con|ctf|capture the flag|hackthebox|hack the box|penetration test\w*|pentest\w*|ethical hacking|red team|blue team|cissp|ceh|comptia|cmmc|(?<!(?:social|national|homeland|job|financial|food|border)\s)security(?!\s+deposits?))\b/i,
    desc: /\b(cyber\s*security|information security|infosec|application security|appsec|penetration testing|ethical hacking|capture the flag|security operations|threat intelligence|zero trust)\b/i,
  },
  {
    tag: "blockchain",
    re: /\b(blockchain|crypto|web3|defi|nft|solana|ethereum|bitcoin)\b/i,
    desc: /\b(blockchain|web3|ethereum|bitcoin|solana)\b/i,
  },
  {
    tag: "devops",
    re: /\b(devops|sre|kubernetes|k8s|docker|terraform|ci\/cd|cicd|platform engineering)\b/i,
    desc: /\b(devops|kubernetes|platform engineering|site reliability|infrastructure as code)\b/i,
  },
  {
    tag: "cloud",
    re: /\b(aws|azure|gcp|google cloud|cloud native|serverless|lambda)\b/i,
    desc: /\b(cloud native|google cloud|amazon web services|microsoft azure)\b/i,
  },
  {
    tag: "hardware",
    re: /\b(hardware|iot|robotics|embedded|raspberry pi|arduino|3d print\w*)\b/i,
    desc: /\b(embedded systems|raspberry pi|internet of things)\b/i,
  },
  {
    /* Bare "design" and "ui" are gone: "3D Design and Printing",
       "Love vs Design" (a company) and many descriptions fired them. */
    tag: "design",
    re: /\b(ux|ui\/ux|ux\/ui|ui design|user experience|product design|design systems?|designing products|interaction design|service design|design thinking|figma)\b/i,
    desc: /\b(ux design|ui design|user experience design|product design|interaction design)\b/i,
  },
  {
    tag: "mobile",
    re: /\b(android|ios|mobile app|native app)\b/i,
    desc: /\b(mobile app development|ios development|android development)\b/i,
  },
  {
    tag: "web",
    re: /\b(web dev|web development|frontend|backend|fullstack|full[- ]stack)\b/i,
    desc: /\b(web development|frontend development|full[- ]stack development)\b/i,
  },
  /* Health & Life Sciences (stored as `biotech`): wet-lab biotech, medtech
     and digital health in one tag. Healthtech and medtech alias here. */
  {
    tag: "biotech",
    re: /\b(biotech|life sciences?|genomics|medical devices?|medtech|med[- ]tech|drug discovery|clinical trials?|cell therapy|gene therapy|crispr|pharma\w*|healthtech|health[- ]tech|digital health|healthcare\s+(?:tech|innovation|engineer|software|platform|startup|company|ceo|executive|operator|industry|leader)|telehealth|telemedicine|ehr|emr|patient\s+(?:platform|portal|experience|engagement)|oracle\s+health|intermountain\s+health|owlet\s+(?:health|baby|monitor|engineer)|health\s+catalyst|nomi\s+health|recursion\s+pharmaceuticals|biohive)\b/i,
    desc: /\b(life sciences|drug discovery|medical devices?|clinical trials?|cell therapy|gene therapy|digital health)\b/i,
  },
  /* Utah's fintech corridor (Galileo/MX/SoFi/Finicity) plus payments/
     banking infra vocabulary. Anchor employer names must be scoped to
     a fintech context - bare "Galileo" collides with the telescope,
     bare "Plaid" with the clothing pattern. */
  {
    tag: "fintech",
    re: /\b(fintech|fin[- ]tech|payments?\s+(?:platform|infra|engineer|tech|industry|company|product|api)|banking\s+(?:tech|infra|platform|api|software)|neobank|defi|wealthtech|insurtech|paytech|galileo\s+financial|finicity|plaid\s+(?:api|developer|engineer|fintech))\b/i,
    desc: /\b(fintech|payments?\s+(?:platform|infrastructure|industry)|banking\s+(?:technology|infrastructure|platform)|neobank|wealthtech|insurtech)\b/i,
  },
  /* Edtech = K-12 + higher ed + corporate learning. */
  {
    tag: "edtech",
    re: /\b(edtech|ed[- ]tech|learning\s+(?:management\s+system|platform|tech|design|engineer)|online\s+learning|education\s+(?:tech|software|startup)|canvas\s+(?:lms|instructure|university)|instructure|pluralsight|civitas\s+learning)\b/i,
    desc: /\b(edtech|education technology|learning management system)\b/i,
  },
  /* Aerospace & Defense: flight, space, defense, drones/UAS/AAM. Title
     only; "47G" in a description (a sponsor or host line) no longer
     counts. Bare "space" is not enough ("Founders Space"). */
  {
    tag: "aerospace",
    re: AEROSPACE_TITLE,
    desc: /\b(aerospace|defense industry|defense tech\w*|department of defense|space industry|hill air force base|advanced air mobility)\b/i,
  },
  /* Hard tech: the permanent umbrella for physical-world engineering
     (aerospace and defense, manufacturing, robotics, energy, hardware).
     Title only. Anchor employers cover facility tours whose titles say
     nothing else ("Hexcel R&D and Carbon Fiber Tour"). */
  {
    tag: "hard-tech",
    re: /\b(hard[- ]?tech|deep[- ]?tech|manufactur\w*|manufatur\w*|composites?|carbon fiber|machining|machinists?|machine (?:shop|tour)|additive|robots?|robotics|physical ai|energy|nuclear|fusion power|semiconductors?|hardware\s+(?:startups?|engineering|engineers?|founders?|design|companies|company|teams?)|hexcel|nammo|fortem|albany engineered|paramount machine|passivelogic)\b/i,
  },
  /* Game development - small but real Utah scene. Match dev/design
     vocabulary scoped to gaming so a generic "Game Night" social
     doesn't get tagged. */
  {
    tag: "gamedev",
    re: /\b(game\s+(?:dev|developer|design|designer|engine|jam|night|programming|studio|industry)|indie\s+game|gamedev|unity\s+(?:engine|game|developer)|unreal\s+engine|godot\s+engine|byu\s+eae)\b/i,
    desc: /\b(game development|indie games?|game jam|unreal engine|unity engine)\b/i,
  },

  /* Format / audience: title + description, unchanged. */
  { tag: "founders", re: /\b(founders?|founding|startup|entrepreneurs?)\b/i, anyText: true },
  { tag: "women-in-tech", re: /\b(women in tech|women who|she tech|girls who)\b/i, anyText: true },
  { tag: "hackathon", re: /\b(hackathon|hack night|hack day)\b/i, anyText: true },
  { tag: "conference", re: /\b(conference|summit|conf\b)\b/i, anyText: true },
  { tag: "workshop", re: /\b(workshop|bootcamp|class\b|training)\b/i, anyText: true },
  { tag: "meetup", re: /\b(meetup|networking|mixer|happy hour)\b/i, anyText: true },
];

/* Retired or merged tag spellings -> the canonical tag, or null for a
   retired tag. Applied to every tag on the way into events.tags, to
   ?tags= in URLs (lib/filters.ts) and to /tag/<alias> (a redirect).
   product-management is retired: about 5 real events, and the rest were
   clock times. Those events are still found by search. */
export const TAG_ALIASES: Readonly<Record<string, string | null>> = {
  startup: "founders",
  founder: "founders",
  healthtech: "biotech",
  medtech: "biotech",
  "product-management": null,
};

/* What a ?tags=product-management URL turns into: a search. */
export const RETIRED_TAG_SEARCH: Readonly<Record<string, string>> = {
  "product-management": "product management",
};

/* Tags one tag brings with it. */
const TAG_IMPLIES: Readonly<Record<string, readonly string[]>> = {
  aerospace: ["hard-tech"],
  "hard-tech-week": ["hard-tech"],
};

/* Every (tag, implied tag) pair, so a SQL merge (lib/tag-merge.ts) can
   apply implications to the final array, including tags it retained from
   the row. */
export function tagImplicationPairs(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [from, tos] of Object.entries(TAG_IMPLIES)) for (const to of tos) out.push([from, to]);
  return out;
}

/* Lowercased, trimmed, aliased. null = drop it. */
export function canonicalTag(tag: string): string | null {
  const t = tag.trim().toLowerCase();
  if (!t) return null;
  if (Object.prototype.hasOwnProperty.call(TAG_ALIASES, t)) return TAG_ALIASES[t];
  return t;
}

/* Alias every tag, drop retired ones, de-duplicate, keep order. */
export function canonicalizeTags(tags: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const t = canonicalTag(raw);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/* The stored spellings a canonical tag matches in queries, so a row not
   yet rewritten (still `startup`) is found by ?tags=founders. */
export function tagQueryVariants(canonical: string): string[] {
  const out = [canonical];
  for (const [alias, to] of Object.entries(TAG_ALIASES)) if (to === canonical) out.push(alias);
  return out;
}

/* Canonicalize, then add implied tags. Used on every write. */
export function finalizeTags(tags: readonly string[]): string[] {
  const out = canonicalizeTags(tags);
  for (const t of [...out]) {
    for (const imp of TAG_IMPLIES[t] ?? []) if (!out.includes(imp)) out.push(imp);
  }
  return out;
}

/* Cert-spam pattern - kept in sync with scrape-runner's PAID_TITLE_RE.
   Two shapes: explicit cert keywords (CISSP, CPMAI, ...), and the
   generic Eventbrite "N Days Training" / "N Hours Workshop" pattern
   that ad sellers use to grab keyword traffic. Either gate flips the
   "skip strong content tags" switch below. */
/* `six sigma|black belt|green belt` will occasionally false-flag a
   manufacturing-adjacent or martial-arts-themed legit event (e.g.
   "Lean Six Sigma for Engineering Teams"). Accepted tradeoff: the
   Eventbrite ad-spam volume far outweighs the rare crossover, and the
   manual /admin/review queue gives the admin a path to undo. */
const CERT_SPAM_KEYWORDS_RE =
  /\b(certification|certification training|training program|exam prep|bootcamp|ccna|ccnp|ccie|cissp|capm|pmp|isc[²2]|ceh|comptia|isaca|itil|cpmai|caip|caissp|scrum master|prince2|safe agile|tableau certification|six sigma|black belt|green belt|pmi-acp)\b/i;
/* The middle slot is an allowlist of cert-spam adjectives (Classroom,
   Hands-On, Live Online, Weekend, etc) rather than `\w+` filler. The
   previous {0,3} \w+ slot false-flagged legit titles like
   "30 Day Coding Challenge Workshop" - "Coding Challenge" is a tech
   subject in the filler position, not a paid-class signal. */
const NUMERIC_TRAINING_RE =
  /\b\d+[\s-]*(?:days?|hours?|weeks?|sessions?|weekends?)\s+(?:(?:live|online|virtual|in[- ]person|hybrid|classroom|hands[- ]on|weekend|intensive|certified|confirmed|advanced|basic|beginner)\s+){0,3}(?:training|workshop|bootcamp|course)\b/i;
function isCertSpamTitle(haystack: string): boolean {
  return CERT_SPAM_KEYWORDS_RE.test(haystack) || NUMERIC_TRAINING_RE.test(haystack);
}

/* Strong content categories shouldn't accept a Salesforce-style
   "PMI-CPMAI Certification weekend Training" event as legitimate AI
   programming. Format tags (workshop/training/meetup) still apply to
   these rows so they remain searchable, just not under the
   audience-misleading content lens. */
const STRONG_CONTENT_TAGS = new Set([
  "ai",
  "machine-learning",
  "data",
  "cybersecurity",
  "cloud",
  "blockchain",
  "devops",
]);

export function inferTagsFromTitle(title: string, description?: string | null): string[] {
  const desc = description ?? "";
  const haystack = `${title} ${desc}`;
  const isCertSpam = isCertSpamTitle(haystack);
  const tags = new Set<string>();
  for (const rule of RULES) {
    const hit = rule.anyText
      ? rule.re.test(haystack)
      : rule.re.test(title) || (rule.desc !== undefined && rule.desc.test(desc));
    if (!hit) continue;
    if (isCertSpam && STRONG_CONTENT_TAGS.has(rule.tag)) continue;
    tags.add(rule.tag);
  }
  return finalizeTags([...tags]);
}

/* The tags the classifier's suggestions may produce: every canonical
   topic tag except
   - format tags (meetup, conference, workshop, hackathon): title rules only;
   - founders: the model says "startup" on about a third of everything
     (leadership series, CEO talks, a town hall), and the title rule plus
     source defaults already find founder events (1 Million Cups etc.).
     startup still aliases to founders everywhere else. */
const NOT_FROM_LLM = new Set(["meetup", "conference", "workshop", "hackathon", "founders"]);
export const LLM_TAG_ALLOWLIST: ReadonlySet<string> = new Set(
  RULES.map((r) => r.tag).filter((t) => !NOT_FROM_LLM.has(t)),
);

/* The classifier's free-text suggestions (356 distinct strings on 626
   approved events) mapped onto canonical tags before the allowlist.
   Only spellings seen in stored verdicts that clearly mean one tag. */
const LLM_SYNONYMS: Readonly<Record<string, string>> = {
  "life sciences": "biotech",
  "life-sciences": "biotech",
  "health tech": "biotech",
  "medical devices": "biotech",
  "medical-devices": "biotech",
  defense: "aerospace",
  "aerospace & defense": "aerospace",
  space: "aerospace",
  drones: "aerospace",
  hardtech: "hard-tech",
  "hard tech": "hard-tech",
  manufacturing: "hard-tech",
  "advanced manufacturing": "hard-tech",
  composites: "hard-tech",
  energy: "hard-tech",
  robotics: "hard-tech",
  kubernetes: "devops",
  "cloud-native": "cloud",
  "platform-engineering": "devops",
  "web-development": "web",
  "web-dev": "web",
  "web development": "web",
  golang: "go",
  security: "cybersecurity",
  "machine learning": "machine-learning",
  ml: "machine-learning",
  crypto: "blockchain",
  web3: "blockchain",
  "data engineering": "data",
  "data science": "data",
  ios: "mobile",
  csharp: "c-sharp",
  "c#": "c-sharp",
  ".net": "c-sharp",
  agents: "ai",
  "artificial intelligence": "ai",
  ux: "design",
};

/* One suggested string -> the canonical tags it stands for (with
   implications), or [] when it is not on the allowlist. */
export function mapLlmTag(raw: string): string[] {
  const t = raw.trim().toLowerCase();
  const syn = LLM_SYNONYMS[t] ?? t;
  const canon = canonicalTag(syn);
  if (!canon || !LLM_TAG_ALLOWLIST.has(canon)) return [];
  return finalizeTags([canon]);
}

/* The classifier's suggestedTags as canonical tags. A cert-spam event
   gets no strong content tag from the model either. */
export function llmTagsFor(
  suggested: unknown,
  opts: { certSpam?: boolean } = {},
): string[] {
  if (!Array.isArray(suggested)) return [];
  const out: string[] = [];
  for (const s of suggested) {
    if (typeof s !== "string") continue;
    for (const t of mapLlmTag(s)) {
      if (opts.certSpam && STRONG_CONTENT_TAGS.has(t)) continue;
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
}

/* Every (suggested spelling, canonical tag) pair the mapping knows, so
   the rescrape UPDATE can map the row's stored suggestedTags in SQL
   (lib/tag-merge.ts) and read them under the row lock. A spelling not
   listed here maps to nothing, which is the allowlist. */
const pairCache = new Map<boolean, Array<[string, string]>>();
export function llmTagPairs(opts: { certSpam?: boolean } = {}): Array<[string, string]> {
  const certSpam = opts.certSpam === true;
  const hit = pairCache.get(certSpam);
  if (hit) return hit;
  const pairs = buildLlmTagPairs(certSpam);
  pairCache.set(certSpam, pairs);
  return pairs;
}

function buildLlmTagPairs(certSpam: boolean): Array<[string, string]> {
  const keys = new Set<string>([...LLM_TAG_ALLOWLIST, ...Object.keys(LLM_SYNONYMS), ...Object.keys(TAG_ALIASES)]);
  const pairs: Array<[string, string]> = [];
  for (const k of [...keys].sort()) {
    for (const t of mapLlmTag(k)) {
      if (certSpam && STRONG_CONTENT_TAGS.has(t)) continue;
      pairs.push([k, t]);
    }
  }
  return pairs;
}

/* The tags a scraped event gets: inferred from its text, unioned with
   scraper-supplied tags (no longer a replacement for inference), the
   source's default tags (cert-spam scrubbed), special-week tags and any
   classifier tags, then canonicalized. */
export function buildEventTags(input: {
  title: string;
  description?: string | null;
  supplied?: readonly string[] | null;
  injected?: readonly string[];
  specialWeek?: readonly string[];
  llm?: unknown;
}): string[] {
  const haystack = `${input.title} ${input.description ?? ""}`;
  const certSpam = isCertSpamTitle(haystack);
  const injected = (input.injected ?? []).filter(
    (t) => !(certSpam && STRONG_CONTENT_TAGS.has(canonicalTag(t) ?? "")),
  );
  return finalizeTags([
    ...inferTagsFromTitle(input.title, input.description),
    ...(input.supplied ?? []),
    ...injected,
    ...(input.specialWeek ?? []),
    ...llmTagsFor(input.llm, { certSpam }),
  ]);
}

/* Public re-exports so scrape-runner can apply the same cert-spam
   scrub to source-injected defaultTags. */
export { isCertSpamTitle as isCertSpam };
export const CERT_SPAM_STRIPPED_TAGS: ReadonlySet<string> = STRONG_CONTENT_TAGS;
