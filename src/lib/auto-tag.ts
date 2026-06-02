/* Title-keyword auto-tagger. Scrapers don't always emit tags - most
   Eventbrite events ship without any, and Luma calendars supply ad-hoc
   labels at best. We infer tags from the event title (and description
   when present) so the /tag/[tag] landing pages have actual content.

   Approach: a hand-curated keyword -> canonical-tag table. Each title
   gets scanned for whole-word matches; duplicates are removed before
   returning. Aim for high precision - a tag landing page with one
   off-topic event hurts more than helps. */

interface TagRule {
  tag: string;
  re: RegExp;
}

const RULES: TagRule[] = [
  /* Programming languages */
  { tag: "javascript", re: /\b(javascript|js\b|node\.?js)\b/i },
  { tag: "typescript", re: /\btypescript|\bts\b/i },
  { tag: "python", re: /\bpython\b/i },
  { tag: "rust", re: /\brust\b(?! belt)/i },
  { tag: "go", re: /\b(golang|go user group|go meetup)\b/i },
  { tag: "java", re: /\bjava\b(?!script)/i },
  { tag: "kotlin", re: /\bkotlin\b/i },
  { tag: "swift", re: /\bswift\b/i },
  { tag: "ruby", re: /\bruby\b/i },
  { tag: "php", re: /\bphp\b/i },
  { tag: "elixir", re: /\belixir\b/i },
  { tag: "c-sharp", re: /\bc#|c-sharp|\.net\b/i },
  { tag: "scala", re: /\bscala\b/i },
  { tag: "dart", re: /\bdart\b/i },

  /* Frameworks / runtimes */
  { tag: "react", re: /\breact(?:\.?js)?\b(?!ion)/i },
  { tag: "vue", re: /\bvue(?:\.?js)?\b/i },
  { tag: "angular", re: /\bangular\b/i },
  { tag: "svelte", re: /\bsvelte\b/i },
  { tag: "nextjs", re: /\bnext\.?js\b/i },
  { tag: "django", re: /\bdjango\b/i },
  { tag: "flask", re: /\bflask\b/i },
  { tag: "rails", re: /\brails\b/i },
  { tag: "laravel", re: /\blaravel\b/i },
  { tag: "flutter", re: /\bflutter\b/i },

  /* Topics */
  /* Tightened: bare `agents?` and `claude`/`copilot` collide with real
     estate agents, insurance agents, the literal model name in an
     unrelated career-fair listing, etc. Require the AI sense via
     "AI agents" / "agentic" / "agent framework", and skip the bare
     model names since they're already covered by the broader AI/LLM
     vocabulary. */
  { tag: "ai", re: /\b(ai|artificial intelligence|generative ai|genai|llm|llms|ai agents?|agentic|agent framework|chatgpt|gpt-?\d|anthropic|openai)\b/i },
  { tag: "machine-learning", re: /\b(machine learning|\bml\b|mlops|deep learning|neural network)\b/i },
  { tag: "data", re: /\b(data engineering|data science|data analytics|sql|postgres|postgresql|big data|warehouse|databricks|snowflake|airflow|dbt)\b/i },
  { tag: "cybersecurity", re: /\b(cybersecurity|security|infosec|cissp|cisa|penetration test|pentest|hacking|ethical hacking|ceh|comptia)\b/i },
  { tag: "blockchain", re: /\b(blockchain|crypto|web3|defi|nft|solana|ethereum|bitcoin)\b/i },
  { tag: "devops", re: /\b(devops|sre|kubernetes|k8s|docker|terraform|ci\/cd|cicd)\b/i },
  { tag: "cloud", re: /\b(aws|azure|gcp|google cloud|cloud native|serverless|lambda)\b/i },
  { tag: "hardware", re: /\b(hardware|iot|robotics|embedded|raspberry pi|arduino|3d print)\b/i },
  { tag: "design", re: /\b(design|ux|ui|product design|figma|sketch)\b/i },
  { tag: "product-management", re: /\b(product manager|product management|pm\b|prodmgmt)\b/i },
  { tag: "mobile", re: /\b(android|ios|mobile app|native app)\b/i },
  { tag: "web", re: /\b(web dev|web development|frontend|backend|fullstack|full[- ]stack)\b/i },
  { tag: "biotech", re: /\b(biotech|life sciences|genomics|medical device|drug discovery|clinical trial|cell therapy|gene therapy|crispr)\b/i },
  /* Utah's fintech corridor (Galileo/MX/SoFi/Finicity) plus payments/
     banking infra vocabulary. Anchor employer names must be scoped to
     a fintech context - bare "Galileo" collides with the telescope,
     bare "Plaid" with the clothing pattern. "Acima" dropped: lease-
     to-own retail credit is fintech-adjacent at best, and dilutes
     the tag. */
  { tag: "fintech", re: /\b(fintech|fin[- ]tech|payments?\s+(?:platform|infra|engineer|tech|industry|company|product|api)|banking\s+(?:tech|infra|platform|api|software)|neobank|defi|wealthtech|insurtech|paytech|galileo\s+financial|finicity|plaid\s+(?:api|developer|engineer|fintech))\b/i },
  /* Healthtech = software side of healthcare (distinct from biotech
     wet-lab work). Anchor names scoped: bare `owlet` had no Utah-
     event collisions today but "Owlet" as a generic word does exist.
     `patient experience` retained despite UX-conference crossover -
     low Utah volume, worth the tradeoff. */
  { tag: "healthtech", re: /\b(healthtech|health[- ]tech|digital health|healthcare\s+(?:tech|innovation|engineer|software|platform|startup)|telehealth|telemedicine|ehr\b|emr\b|patient\s+(?:platform|portal|experience|engagement)|oracle\s+health|intermountain\s+health|owlet\s+(?:health|baby|monitor|engineer))\b/i },
  /* Edtech = K-12 + higher ed + corporate learning. Instructure
     (Canvas), Pluralsight anchor the Lehi cluster. `lms\b` dropped
     - overloaded with Lawn Mower Service, Lab Management System, etc. */
  { tag: "edtech", re: /\b(edtech|ed[- ]tech|learning\s+(?:management\s+system|platform|tech|design|engineer)|online\s+learning|education\s+(?:tech|software|startup)|canvas\s+(?:lms|instructure|university)|instructure|pluralsight|civitas\s+learning)\b/i },
  /* Utah aerospace + defense corridor - Northrop Grumman / Boeing /
     L3Harris / BAE around Hill AFB, plus the 47G industry group.
     "Aerospace" alone is too broad (NASA hobbyist meetups, BYU rocket
     club shows up as is_paid by accident, etc), so anchor on the
     industry vocabulary. */
  { tag: "aerospace", re: /\b(aerospace|defense\s+(?:tech|industry|contractor|engineer)|hill\s+air\s+force|northrop\s+grumman|raytheon|l3harris|lockheed\s+martin|space\s+(?:industry|tech|systems)|satellite\s+(?:engineer|tech|industry)|47g\b)\b/i },
  /* Game development - small but real Utah scene (WB Games SLC, Smart
     Bomb, BYU EAE, U of U Entertainment Arts). Match dev/design
     vocabulary scoped to gaming so a generic "Game Night" social
     doesn't get tagged. */
  { tag: "gamedev", re: /\b(game\s+(?:dev|developer|design|designer|engine|jam|night|programming|studio|industry)|indie\s+game|gamedev|unity\s+(?:engine|game|developer)|unreal\s+engine|godot\s+engine|byu\s+eae)\b/i },

  /* Format / audience */
  { tag: "founders", re: /\b(founders?|founding|startup|entrepreneurs?)\b/i },
  { tag: "women-in-tech", re: /\b(women in tech|women who|she tech|girls who)\b/i },
  { tag: "hackathon", re: /\b(hackathon|hack night|hack day)\b/i },
  { tag: "conference", re: /\b(conference|summit|conf\b)\b/i },
  { tag: "workshop", re: /\b(workshop|bootcamp|class\b|training)\b/i },
  { tag: "meetup", re: /\b(meetup|networking|mixer|happy hour)\b/i },
];

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
  /\b(certification|certification training|training program|exam prep|bootcamp|cissp|capm|pmp|isc[²2]|ceh|comptia|isaca|itil|cpmai|caip|caissp|scrum master|prince2|safe agile|tableau certification|six sigma|black belt|green belt|pmi-acp)\b/i;
/* The middle slot is an allowlist of cert-spam adjectives (Classroom,
   Hands-On, Live Online, Weekend, etc) rather than `\w+` filler. The
   previous {0,3} \w+ slot false-flagged legit titles like
   "30 Day Coding Challenge Workshop" - "Coding Challenge" is a tech
   subject in the filler position, not a paid-class signal. Constraining
   the filler to cert-spam-coded adjectives keeps "4 Days Classroom
   Training" and "2 Hours Live Online Workshop" inside the net while
   community events with subject-y phrasing slip through. */
const NUMERIC_TRAINING_RE =
  /\b\d+\s*(?:days?|hours?|weeks?|sessions?|weekends?)\s+(?:(?:live|online|virtual|in[- ]person|hybrid|classroom|hands[- ]on|weekend|intensive|certified|confirmed|advanced|basic|beginner)\s+){0,3}(?:training|workshop|bootcamp|course)\b/i;
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
  const haystack = `${title} ${description ?? ""}`;
  const isCertSpam = isCertSpamTitle(haystack);
  const tags = new Set<string>();
  for (const rule of RULES) {
    if (!rule.re.test(haystack)) continue;
    if (isCertSpam && STRONG_CONTENT_TAGS.has(rule.tag)) continue;
    tags.add(rule.tag);
  }
  return [...tags];
}
