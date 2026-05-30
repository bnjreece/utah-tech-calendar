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
  { tag: "ai", re: /\b(ai|artificial intelligence|generative ai|genai|llm|llms|agents?|agentic|chatgpt|claude|copilot)\b/i },
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
  { tag: "gaming", re: /\b(game dev|game design|unity|unreal|godot)\b/i },
  { tag: "biotech", re: /\b(biotech|life sciences|genomics|medical device)\b/i },

  /* Format / audience */
  { tag: "founders", re: /\b(founders?|founding|startup|entrepreneurs?)\b/i },
  { tag: "women-in-tech", re: /\b(women in tech|women who|she tech|girls who)\b/i },
  { tag: "hackathon", re: /\b(hackathon|hack night|hack day)\b/i },
  { tag: "conference", re: /\b(conference|summit|conf\b)\b/i },
  { tag: "workshop", re: /\b(workshop|bootcamp|class\b|training)\b/i },
  { tag: "meetup", re: /\b(meetup|networking|mixer|happy hour)\b/i },
];

export function inferTagsFromTitle(title: string, description?: string | null): string[] {
  const haystack = `${title} ${description ?? ""}`;
  const tags = new Set<string>();
  for (const rule of RULES) {
    if (rule.re.test(haystack)) tags.add(rule.tag);
  }
  return [...tags];
}
