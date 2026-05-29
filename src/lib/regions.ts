const SALT_LAKE_COUNTY = [
  "salt lake city", "west valley city", "west jordan", "sandy", "murray",
  "taylorsville", "south salt lake", "millcreek", "draper", "riverton",
  "cottonwood heights", "holladay", "midvale", "south jordan", "herriman",
  "bluffdale", "alta", "magna", "kearns", "west valley",
];

const UTAH_COUNTY = [
  "provo", "orem", "american fork", "lehi", "pleasant grove", "springville",
  "spanish fork", "payson", "lindon", "highland", "alpine", "cedar hills",
  "saratoga springs", "eagle mountain", "mapleton", "vineyard", "salem",
  "santaquin", "elk ridge", "genola", "goshen",
];

const NORTHERN_UTAH = [
  "ogden", "layton", "bountiful", "roy", "clearfield", "kaysville", "clinton",
  "north salt lake", "centerville", "farmington", "woods cross", "west point",
  "syracuse", "logan", "brigham city", "tremonton", "hyrum", "smithfield",
  "richmond", "providence", "north logan", "river heights", "nibley",
];

const SOUTHERN_UTAH = [
  "st george", "saint george", "cedar city", "hurricane", "washington", "ivins",
  "santa clara", "leeds", "la verkin", "toquerville", "enterprise", "veyo",
  "summit", "dammeron valley", "springdale", "rockville", "virgin", "hildale",
  "orderville", "glendale", "alton", "duck creek village", "brian head",
  "parowan", "paragonah", "enoch", "minersville", "beaver", "milford",
];

const ONLINE_INDICATORS = [
  "online", "virtual", "remote", "zoom", "teams", "webinar",
  "livestream", "livestreaming", "stream", "digital", "internet", "web-based",
  "video call", "video conference", "teleconference", "hangout", "discord",
];

const PLATFORM_WORDS = ["zoom", "google meet", "teams", "webex", "gotomeeting", "jitsi", "discord"];
const URL_REGEX = /https?:\/\/[\w\-./?=&%#]+/i;

export type UtahRegion =
  | "Salt Lake County"
  | "Utah County"
  | "Northern Utah"
  | "Southern Utah"
  | "Unknown";

export const UTAH_REGIONS: UtahRegion[] = [
  "Salt Lake County",
  "Utah County",
  "Northern Utah",
  "Southern Utah",
  "Unknown",
];

export interface RegionInput {
  city?: string | null;
  venueName?: string | null;
  address?: string | null;
}

export function categorizeRegion(event: RegionInput): UtahRegion {
  const haystack = [event.city, event.venueName, event.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) return "Unknown";
  if (SALT_LAKE_COUNTY.some((c) => haystack.includes(c))) return "Salt Lake County";
  if (UTAH_COUNTY.some((c) => haystack.includes(c))) return "Utah County";
  if (NORTHERN_UTAH.some((c) => haystack.includes(c))) return "Northern Utah";
  if (SOUTHERN_UTAH.some((c) => haystack.includes(c))) return "Southern Utah";
  return "Unknown";
}

export interface OnlineInput {
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  title?: string | null;
  description?: string | null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isOnlineOnlyEvent(event: OnlineInput): boolean {
  const venueText = [event.venueName, event.address].filter(Boolean).join(" ").toLowerCase();
  const contentText = [event.description, event.title].filter(Boolean).join(" ").toLowerCase();

  if (venueText) {
    if (PLATFORM_WORDS.some((p) => new RegExp(`\\b${escapeRegex(p)}\\b`, "i").test(venueText))) return true;
    if (URL_REGEX.test(venueText)) return true;
    if (ONLINE_INDICATORS.some((ind) => new RegExp(`\\b${escapeRegex(ind)}\\b`, "i").test(venueText))) return true;
    const hasPhysical =
      /\d{1,5}\s+\w+/.test(venueText) ||
      /\b(street|st\.|avenue|ave\.|road|rd\.|lane|ln\.|drive|dr\.)\b/i.test(venueText);
    if (hasPhysical) return false;
  }

  if (event.city || event.postalCode) return false;

  if (contentText) {
    if (URL_REGEX.test(contentText)) return true;
    if (PLATFORM_WORDS.some((p) => new RegExp(`\\b${escapeRegex(p)}\\b`, "i").test(contentText))) return true;
    if (ONLINE_INDICATORS.some((ind) => new RegExp(`\\b${escapeRegex(ind)}\\b`, "i").test(contentText))) return true;
  }

  return false;
}
