import { describe, expect, test } from "bun:test";
import {
  decidePending,
  LOWCONF_YES_BAR,
  normalizeEventTitle,
  submissionPastDated,
  type AutopilotCtx,
  type AutopilotDecision,
  type AutopilotRow,
} from "@/lib/autopilot";
import type { EventVerdict } from "@/lib/verdict";

/* Table-driven over real pending rows and their stored verdicts (production
   queue, 2026-10-20). Description lengths are kept, text is filler. */

const NOW = new Date("2026-10-20T15:00:00Z");
const LATER = new Date("2026-11-10T02:00:00Z");
const EB = (path: string) => `https://www.eventbrite.com/d/${path}/`;
const LUMA = "https://lu.ma/saltlakecity";

interface Case {
  title: string;
  source: string;
  url: string;
  v: [tech: boolean, spam: boolean, conf: number, category: string, online?: boolean];
  venue?: string;
  city?: string;
  desc?: number;
  isOnline?: boolean;
  tags?: string[];
  suggestedTags?: string[];
  ctx?: Partial<AutopilotCtx>;
}

function run(c: Case, base: Partial<AutopilotCtx> = {}) {
  const row: AutopilotRow = {
    title: c.title,
    description: "x".repeat(c.desc ?? 120),
    venueName: c.venue ?? null,
    city: c.city ?? null,
    isOnline: c.isOnline ?? false,
    tags: c.tags ?? null,
    source: c.source,
    status: "pending",
    statusLocked: false,
    startsAt: LATER,
  };
  const [tech, spam, conf, category, online] = c.v;
  const verdict: EventVerdict = {
    isTechRelevant: tech,
    isSpam: spam,
    isOnline: online ?? false,
    isPaid: false,
    category,
    suggestedTags: c.suggestedTags ?? [],
    confidence: conf,
    reasoning: "",
  };
  return decidePending(row, verdict, {
    now: NOW,
    sourceUrl: c.url,
    duplicate: false,
    seriesCount: 0,
    publishEnabled: true,
    publishedThisRun: 0,
    ...base,
    ...c.ctx,
  });
}

/* The 13 the judged replay expects to publish. */
const PUBLISH: Case[] = [
  { title: "KubeAuto Day North America with Kelsey Hightower", source: "luma", url: LUMA, v: [true, false, 0.98, "tech conference"], desc: 563 },
  { title: "Utah Valley University HackTheBox CTF Event", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.98, "cybersecurity competition"], venue: "Utah Valley University", city: "Orem", desc: 105 },
  { title: "BSidesSLC 2027", source: "eventbrite", url: EB("ut--salt-lake-city/cyber-security--events"), v: [true, false, 0.95, "conference"], venue: "Karen Gail Miller Conference Center", city: "Sandy", desc: 58 },
  { title: "2nd Annual Student AI Symposium", source: "eventbrite", url: EB("ut--park-city/tech--events"), v: [true, false, 0.95, "student tech conference"], venue: "William R. & Erlyn J. Gould Auditorium", city: "Salt Lake City" },
  { title: "Makerspace Club: Robotics", source: "eventbrite", url: EB("ut--salt-lake-city/developer--events"), v: [true, false, 0.95, "robotics meetup"], venue: "3848 S W Temple St suite 102", city: "South Salt Lake", desc: 64 },
  { title: "Makespace Build: Speaker", source: "eventbrite", url: EB("ut--park-city/tech--events"), v: [true, false, 0.92, "maker workshop"], venue: "3848 S W Temple St suite 102", city: "South Salt Lake", desc: 74 },
  { title: "2026 Mountain West Foundation Final Pitch Competition Luncheon", source: "eventbrite", url: EB("ut--salt-lake-city/startup--events"), v: [true, false, 0.92, "pitch competition"], venue: "7167 Center Park Dr", city: "West Jordan" },
  { title: "From the Space Shuttle to Mars: Astronaut Jeffrey Hoffman on Technology When Failure Isn’t an Option | Sponsored by Tanner", source: "luma", url: LUMA, v: [true, false, 0.95, "tech community talk / aerospace"], desc: 1007 },
  { title: "Agent Substrate Day", source: "luma", url: LUMA, v: [true, false, 0.95, "tech conference"], venue: "Sky SLC, 149 Pierpont Ave", city: "Salt Lake City", desc: 1097 },
  { title: "Agent Substrate Community Party", source: "luma", url: LUMA, v: [true, false, 0.95, "tech community social"], venue: "Sky SLC, 149 Pierpont Ave", city: "Salt Lake City", desc: 539 },
  { title: "AprèsKube SLC: Keyboards & Keys", source: "luma", url: LUMA, v: [true, false, 0.95, "tech community social"], venue: "Keys On Main, 242 S Main St", city: "Salt Lake City", desc: 1156 },
  { title: "Hard Tech Networking Night (Dessert, Padel & Games)", source: "luma", url: LUMA, v: [true, false, 0.92, "tech community social"], venue: "Conquer Padel Lehi", city: "Lehi", desc: 900 },
  { title: "How these companies are making AI pay off", source: "luma", url: LUMA, v: [true, false, 0.92, "tech talk / AI community event"], venue: "Kiln, 2701 N Thanksgiving Way #100", city: "Lehi", desc: 1501 },
];

describe("decidePending: publishes", () => {
  for (const c of PUBLISH) {
    test(c.title, () => {
      expect(run(c)).toEqual({ action: "publish", reason: "autopilot:publish" });
    });
  }

  test("publishing is off unless AUTOPILOT_PUBLISH is on", () => {
    expect(run(PUBLISH[0], { publishEnabled: false })).toEqual({ action: "hold", reason: "hold:publish-off" });
  });

  test("at most 8 publishes per run", () => {
    expect(run(PUBLISH[0], { publishedThisRun: 7 }).action).toBe("publish");
    expect(run(PUBLISH[0], { publishedThisRun: 8 })).toEqual({ action: "hold", reason: "hold:publish-cap" });
  });
});

type Expect = [action: "hide" | "hold", reason: string, hiddenReason?: string];
const OTHERS: Array<[Case, Expect]> = [
  /* Employer tiers never publish; the twin listing of the same date is a dup. */
  [{ title: "HackerX - Utah County - Employer Ticket - 12/14", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.92, "developer meetup"], venue: "Provo", city: "Provo", desc: 47 }, ["hold", "hold:not-community"]],
  [{ title: "HackerX - Utah County - Employer Ticket - 12/14", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.85, "tech recruiting event"], venue: "Utah County", city: "Utah County", desc: 47, isOnline: true, ctx: { duplicate: true } }, ["hide", "autopilot:dup", "cross-post"]],
  [{ title: "Women in Tech 2026 - Salt Lake City Employer Ticket", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.85, "tech conference"], venue: "Nice", city: "Sandy", desc: 59 }, ["hold", "hold:unsure"]],
  [{ title: "Women in Tech 2026 - Salt Lake City Employer Ticket", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.95, "tech conference"], venue: "Nice", city: "Sandy", desc: 59 }, ["hold", "hold:not-community"]],
  /* The 14-copy daily Pitch Lunch: low confidence holds; even a confident
     copy is a series, not a publish. */
  [{ title: "\"STARTUP-INVESTOR PITCH LUNCH\" -  FUNDRAISING PROGRAM IN SILICON VALLEY", source: "eventbrite", url: EB("ut--park-city/tech--events"), v: [true, false, 0.85, "startup event"], venue: "Park City" }, ["hold", "hold:unsure"]],
  [{ title: "\"STARTUP-INVESTOR PITCH LUNCH\" -  FUNDRAISING PROGRAM IN SILICON VALLEY", source: "eventbrite", url: EB("ut--park-city/tech--events"), v: [true, false, 0.92, "startup event"], venue: "Park City", ctx: { seriesCount: 13 } }, ["hold", "hold:series"]],
  /* Crypto always stays human. */
  [{ title: "UVU 2026 Bitcoin Conference: Saturday October 31st", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.95, "conference"], venue: "Fulton Library", city: "Orem" }, ["hold", "hold:crypto"]],
  [{ title: "SLC XPR Community Activation", source: "luma", url: "https://lu.ma/utahcrypto", v: [true, false, 0.85, "web3 community meetup"], venue: "Publik Coffee Roasters", city: "Salt Lake City", desc: 578 }, ["hold", "hold:crypto"]],
  /* Crypto-source listings whose titles do not say crypto: caught by tags. */
  [{ title: "Primitive", source: "luma", url: "https://lu.ma/utahcrypto", v: [true, false, 0.95, "conference"], venue: "Utah, USA", desc: 710, tags: ["fintech", "blockchain"], suggestedTags: ["crypto", "blockchain", "web3", "solana"] }, ["hold", "hold:crypto"]],
  [{ title: "The Capital Room", source: "luma", url: "https://www.meetup.com/utahcrypto/", v: [true, false, 0.92, "tech community networking"], desc: 613, tags: ["product-management", "meetup", "fintech", "blockchain"], suggestedTags: ["fintech", "blockchain", "web3"] }, ["hold", "hold:crypto"]],
  [{ title: "The Capital Room", source: "luma", url: "https://www.meetup.com/utahcrypto/", v: [true, false, 0.92, "tech community networking"], desc: 613, tags: ["blockchain"] }, ["hold", "hold:crypto"]],
  /* Kids-audience listings (Moonpreneur free trials) go to a human. */
  [{ title: "Free In-person Robotics Class in Orem, UT  for Kids Ages 7-14 Yrs", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.92, "youth STEM/robotics education"], venue: "TownePlace Suites by Marriott 873 N 1200 W, Orem, UT 84057, United States", city: "Orem", desc: 102 }, ["hold", "hold:kids-audience"]],
  [{ title: "Free In-person STEM Activities for Kids in  Sandy, UT (7-14 Yrs)", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [true, false, 0.92, "kids STEM education"], venue: "Best Western Plus Cotton Tree Inn", city: "Sandy", desc: 95 }, ["hold", "hold:kids-audience"]],
  [{ title: "Free In-person STEM Activities for Kids in  Sandy, UT (7-14 Yrs)", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [false, false, 0.95, "not-tech"], venue: "Best Western Plus Cotton Tree Inn", city: "Sandy", desc: 95 }, ["hold", "hold:protected"]],
  /* Astra round 1: a kids class flagged as spam must still reach a human. */
  [{ title: "Free Python Class for Kids Ages 7-14", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [false, true, 0.95, "cert-spam"], venue: "Some Library", city: "Orem" }, ["hold", "hold:kids-audience"]],
  /* Protected verticals with a no/spam verdict stay human. */
  [{ title: "The Biological Evaluation Puzzle: Building a Complete ISO 10993 Strategy Webinar Series: Part 7", source: "html", url: "https://bioutah.growthzoneapp.com/communityeventscalendar", v: [true, true, 0.85, "cert-spam", true], city: "Salt Lake City", desc: 251, isOnline: true }, ["hold", "hold:protected"]],
  [{ title: "Satellite Constellations Office Hours", source: "eventbrite", url: EB("ut--salt-lake-city/tech--events"), v: [false, false, 0.95, "not-tech"], venue: "Some Hall", city: "Salt Lake City" }, ["hold", "hold:protected"]],
  /* Southern Utah "no" below 0.95 stays human. */
  [{ title: "BUILDING DEPTH 5x5 - JAN 29-30, 2027  (St. George, UTAH) General Admission", source: "eventbrite", url: EB("ut--st-george/startup--events"), v: [false, true, 0.9, "business-spam"], venue: "Best Western Plus Abbey Inn", city: "St. George" }, ["hold", "hold:rural"]],
  /* Structural hides fire before the model's verdict is trusted. */
  [{ title: "Pregame Sideline Experience (Baylor)", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [false, false, 0.95, "not-tech"], venue: "LaVell Edwards Stadium (LES)", city: "Provo" }, ["hide", "autopilot:struct:byu-athletics", "spam"]],
  [{ title: "Tech and Business Networking | Elevating Your Potential - SLC", source: "eventbrite", url: EB("ut--provo/tech--events"), v: [false, true, 0.92, "networking-spam"], venue: "Zest Kitchen & Bar", city: "Salt Lake City" }, ["hide", "autopilot:struct:elevating", "spam"]],
  [{ title: "Blockchain and Business Networking | Elevating Your Potential - SLC", source: "eventbrite", url: EB("ut--park-city/tech--events"), v: [false, true, 0.92, "networking-spam"], venue: "Zest Kitchen & Bar", city: "Salt Lake City" }, ["hide", "autopilot:struct:elevating", "spam"]],
  [{ title: "Artificial Intelligence and Automation | Utah", source: "eventbrite", url: EB("ut--park-city/tech--events"), v: [false, true, 0.92, "cert-spam"], venue: "For venue details reach us at info@learnerring.com", city: "Utah" }, ["hide", "autopilot:struct:venue-mill", "spam"]],
  /* Auto-reject: Eventbrite at 0.85, everyone else at 0.90. */
  [{ title: "Employee Experience in the Age of AI", source: "eventbrite", url: EB("ut--salt-lake-city/ai--events"), v: [false, true, 0.85, "networking-spam"], venue: "Armanino Salt Lake City", city: "Salt Lake City" }, ["hide", "autopilot:screen", "llm-screened"]],
  [{ title: "3-day C-IED Train-the-Trainer Course", source: "eventbrite", url: EB("ut--salt-lake-city/cyber-security--events"), v: [false, true, 0.95, "cert-spam"], venue: "South Jordan Fire Station #64", city: "South Jordan" }, ["hide", "autopilot:screen", "llm-screened"]],
  [{ title: "Invite Only: Media Roundtable", source: "luma", url: "https://lu.ma/47G_Utah", v: [false, true, 0.85, "networking-spam"], desc: 168 }, ["hold", "hold:unsure"]],
  [{ title: "Invite Only: Media Roundtable", source: "luma", url: "https://lu.ma/47G_Utah", v: [false, true, 0.87, "networking-spam"], desc: 168 }, ["hold", "hold:unsure"]],
  [{ title: "Utah's Statewide Virtual Job Fair", source: "silicon_slopes", url: "https://www.siliconslopes.com/c/events", v: [false, false, 0.85, "not-tech", true], desc: 253, isOnline: true }, ["hold", "hold:unsure"]],
  /* Known wrong hide in the judged replay; restorable from /admin/hidden. */
  [{ title: "Saturday Workshop: Speaker Building", source: "eventbrite", url: EB("ut--salt-lake-city/developer--events"), v: [false, false, 0.95, "not-tech"], venue: "3848 S W Temple St suite 102", city: "South Salt Lake", desc: 74 }, ["hide", "autopilot:screen", "llm-screened"]],
  /* Unsure tech rows wait for a human. */
  [{ title: "TECHSPO Salt Lake City 2027 Technology Expo (Internet ~ AdTech ~ MarTech)", source: "eventbrite", url: EB("ut--park-city/tech--events"), v: [true, false, 0.85, "technology conference"], venue: "Hilton Salt Lake City Center", city: "Salt Lake City" }, ["hold", "hold:unsure"]],
  [{ title: "IMPACT Fall Book Club", source: "luma", url: LUMA, v: [true, false, 0.85, "tech community social"], city: "Salt Lake City", desc: 972 }, ["hold", "hold:unsure"]],
  /* Publish vetoes on otherwise confident tech rows. */
  [{ title: "Founders Advisory Board Orientation", source: "luma", url: LUMA, v: [true, false, 0.95, "founder meetup"], venue: "Kiln", desc: 300 }, ["hold", "hold:not-community"]],
  [{ title: "Rust Night", source: "luma", url: LUMA, v: [true, false, 0.95, "developer meetup", true], desc: 300 }, ["hold", "hold:online"]],
  [{ title: "Rust Night", source: "luma", url: LUMA, v: [true, false, 0.95, "developer meetup"], desc: 20 }, ["hold", "hold:thin"]],
  [{ title: "Rust Night", source: "eventbrite", url: EB("ut--salt-lake-city/developer--events"), v: [true, false, 0.95, "developer meetup"], venue: "TBD", desc: 300 }, ["hold", "hold:venue"]],
  [{ title: "Rust Night", source: "eventbrite", url: EB("ut--salt-lake-city/developer--events"), v: [true, false, 0.95, "developer meetup"], desc: 300 }, ["hold", "hold:venue"]],
];

describe("decidePending: hides and holds", () => {
  for (const [c, [action, reason, hiddenReason]] of OTHERS) {
    test(`${c.title} -> ${reason}`, () => {
      const d = run(c);
      expect(d.action).toBe(action);
      expect(d.reason).toBe(reason);
      expect(d.hiddenReason).toBe(hiddenReason as typeof d.hiddenReason);
    });
  }

  test("athletics pattern only hides on the Provo tech search", () => {
    const c: Case = { title: "Pregame Sideline Experience (Baylor)", source: "eventbrite", url: EB("ut--salt-lake-city/startup--events"), v: [true, false, 0.95, "tech social"], venue: "LaVell Edwards Stadium (LES)", city: "Provo" };
    expect(run(c).action).toBe("publish");
  });

  test("ineligible rows are never touched", () => {
    const v: EventVerdict = { isTechRelevant: true, isSpam: false, isOnline: false, isPaid: false, category: "x", suggestedTags: [], confidence: 0.99, reasoning: "" };
    const ctx: AutopilotCtx = { now: NOW, sourceUrl: LUMA, duplicate: false, seriesCount: 0, publishEnabled: true, publishedThisRun: 0 };
    const row: AutopilotRow = { title: "Rust Night", description: "x".repeat(300), venueName: "Kiln", city: "Lehi", isOnline: false, source: "luma", status: "pending", statusLocked: false, startsAt: LATER };
    expect(decidePending(row, v, ctx).action).toBe("publish");
    expect(decidePending({ ...row, statusLocked: true }, v, ctx).action).toBe("hold");
    expect(decidePending({ ...row, source: "manual" }, v, ctx).action).toBe("hold");
    expect(decidePending({ ...row, status: "approved" }, v, ctx).action).toBe("hold");
    expect(decidePending({ ...row, startsAt: new Date(NOW.getTime() - 1) }, v, ctx).action).toBe("hold");
  });
});

describe("decidePending: low-confidence yes", () => {
  const tech = (conf: number, extra: Partial<Case> = {}): Case => ({
    title: "Tricks, Treats & Tech",
    source: "eventbrite",
    url: EB("ut--salt-lake-city/tech--events"),
    v: [true, false, conf, "tech community social"],
    venue: "Hanwha Vision Center @ WESCO",
    city: "Murray",
    ...extra,
  });
  const LOW: AutopilotDecision = { action: "hide", reason: "autopilot:lowconf-yes", hiddenReason: "llm-screened" };

  test("the bar is 0.85", () => expect(LOWCONF_YES_BAR).toBe(0.85));

  test("a yes under the bar is hidden (real queue rows)", () => {
    expect(run(tech(0.75))).toEqual(LOW);
    expect(run(tech(0.84))).toEqual(LOW);
    expect(run(tech(0.78, { title: "Employee Experience in the Age of AI", venue: "Armanino Salt Lake City", city: "Salt Lake City" }))).toEqual(LOW);
    expect(run(tech(0.75, { title: "EDGE OF AI: Quantum Conversations", venue: "Michael Best & Friedrich LLP", city: "Salt Lake City" }))).toEqual(LOW);
    /* Luma rows use the same bar (the reject bar differs by source, this does not). */
    expect(run(tech(0.8, { source: "luma", url: LUMA }))).toEqual(LOW);
  });

  test("a yes at or over the bar is untouched", () => {
    expect(run(tech(0.85))).toEqual({ action: "hold", reason: "hold:unsure" });
    expect(run(tech(0.89))).toEqual({ action: "hold", reason: "hold:unsure" });
    expect(run(tech(0.9)).action).toBe("publish");
  });

  test("a no under the bar is not a yes: it still waits for a human", () => {
    expect(run(tech(0.75, { v: [true, true, 0.75, "networking-spam"] }))).toEqual({ action: "hold", reason: "hold:unsure" });
    expect(run(tech(0.72, { v: [false, false, 0.72, "not-tech"] }))).toEqual({ action: "hold", reason: "hold:unsure" });
  });

  test("policy holds still win", () => {
    /* Crypto (title, category, model tags, row tags). */
    expect(run(tech(0.75, { title: "SLC XPR Community Activation", v: [true, false, 0.75, "web3 community meetup"], source: "luma", url: "https://lu.ma/utahcrypto" }))).toEqual({ action: "hold", reason: "hold:crypto" });
    expect(run(tech(0.75, { tags: ["blockchain"] }))).toEqual({ action: "hold", reason: "hold:crypto" });
    /* Kids. */
    expect(run(tech(0.7, { title: "Free Robotics Class for Kids Ages 7-14" }))).toEqual({ action: "hold", reason: "hold:kids-audience" });
    /* Protected verticals and rural Utah, for an unsure yes too. */
    expect(run(tech(0.7, { title: "BioUtah Member Mixer" }))).toEqual({ action: "hold", reason: "hold:protected" });
    expect(run(tech(0.7, { title: "Satellite Builders Night" }))).toEqual({ action: "hold", reason: "hold:protected" });
    expect(run(tech(0.7, { city: "St. George" }))).toEqual({ action: "hold", reason: "hold:rural" });
  });

  test("structural and duplicate hides keep their own reasons", () => {
    expect(run(tech(0.7, { ctx: { duplicate: true } }))).toEqual({ action: "hide", reason: "autopilot:dup", hiddenReason: "cross-post" });
  });

  test("locked, manual, non-pending and past rows are never touched", () => {
    const v: EventVerdict = { isTechRelevant: true, isSpam: false, isOnline: false, isPaid: false, category: "x", suggestedTags: [], confidence: 0.6, reasoning: "" };
    const ctx: AutopilotCtx = { now: NOW, sourceUrl: LUMA, duplicate: false, seriesCount: 0, publishEnabled: true, publishedThisRun: 0 };
    const row: AutopilotRow = { title: "Rust Night", description: "x".repeat(300), venueName: "Kiln", city: "Lehi", isOnline: false, source: "luma", status: "pending", statusLocked: false, startsAt: LATER };
    expect(decidePending(row, v, ctx)).toEqual(LOW);
    for (const r of [{ ...row, statusLocked: true }, { ...row, source: "manual" }, { ...row, status: "approved" }, { ...row, startsAt: new Date(NOW.getTime() - 1) }])
      expect(decidePending(r, v, ctx)).toEqual({ action: "hold", reason: "hold:ineligible" });
  });
});

describe("normalizeEventTitle", () => {
  test("ticket tiers and punctuation drop out", () => {
    expect(normalizeEventTitle("HackerX - Utah County - Employer Ticket - 12/14")).toBe(
      normalizeEventTitle("HackerX: Utah County 12/14"),
    );
    expect(normalizeEventTitle("Summit 2026 (VIP)")).toBe("summit 2026");
    expect(normalizeEventTitle("Summit 2026 - Early Bird General Admission")).toBe("summit 2026");
    expect(normalizeEventTitle("Expo Vendor Pass")).toBe("expo");
  });
});

describe("submissionPastDated", () => {
  test("naive form times get a 12h grace", () => {
    expect(submissionPastDated({ startsAt: "2026-09-15T17:00" }, NOW)).toBe(true);
    expect(submissionPastDated({ startsAt: "2026-10-20T18:00" }, NOW)).toBe(false);
    expect(submissionPastDated({ startsAt: "2026-11-17T17:00" }, NOW)).toBe(false);
    expect(submissionPastDated({ startsAt: "not a date" }, NOW)).toBe(false);
    expect(submissionPastDated({}, NOW)).toBe(false);
  });
});

import { validDay } from "@/lib/autopilot";
describe("validDay", () => {
  test("keeps real dates, drops impossible ones", () => {
    expect(validDay("2026-11-17T18:00")).toBe("2026-11-17");
    expect(validDay("2026-02-31T10:00")).toBeNull();
    expect(validDay("garbage")).toBeNull();
    expect(validDay(undefined)).toBeNull();
  });
});
