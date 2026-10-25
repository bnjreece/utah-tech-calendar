import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEventTags,
  canonicalTag,
  canonicalizeTags,
  finalizeTags,
  inferTagsFromTitle,
  llmTagPairs,
  llmTagsFor,
  tagQueryVariants,
} from "../src/lib/auto-tag";
import { parseFilters } from "../src/lib/filters";
import { displayTags, tagDisplayName } from "../src/lib/tag-taxonomy";

const has = (tags: string[], t: string) => tags.includes(t);

/* Titles and description shapes below are from approved rows (2026-10-25). */

test("a clock time never tags product (pm\\b is gone, product-management retired)", () => {
  const tags = inferTagsFromTitle("Utah Elixir Meetup", "Doors open at 6:30 PM, talks start at 7:00 PM.");
  assert.ok(!has(tags, "product-management"));
  assert.ok(!tags.some((t) => t.startsWith("product")));
  assert.ok(!has(inferTagsFromTitle("Product Management: Myth or Fact with Jeff Patton"), "product-management"));
});

test("bare 'security' in a description does not tag cybersecurity", () => {
  for (const desc of [
    "A refundable security deposit is required for the venue.",
    "Badge check at the security desk in the lobby.",
    "Roundtable on AUKUS, the industrial base and national security.",
  ]) {
    assert.ok(!has(inferTagsFromTitle("Fortem Technologies Facility Tour", desc), "cybersecurity"), desc);
  }
});

test("security titles and strong description phrases still tag cybersecurity", () => {
  assert.ok(has(inferTagsFromTitle("TACO BOUT SECURITY | Free Lunch & Learn"), "cybersecurity"));
  assert.ok(has(inferTagsFromTitle("Apres-Cyber Slopes Summit 2027"), "cybersecurity"));
  assert.ok(has(inferTagsFromTitle("Utah Valley University HackTheBox CTF Event"), "cybersecurity"));
  assert.ok(has(inferTagsFromTitle("CMMC Level 2: We Made It. Here's What We Learned."), "cybersecurity"));
  assert.ok(has(inferTagsFromTitle("Monthly meetup", "An evening on application security and threat intelligence."), "cybersecurity"));
  assert.ok(!has(inferTagsFromTitle("Critical Ventures: Investing in National Security Materials"), "cybersecurity"));
  assert.ok(!has(inferTagsFromTitle("Ask about Social Security benefits"), "cybersecurity"));
});

test("47G or Snowflake in a description alone tags neither aerospace nor data", () => {
  const tags = inferTagsFromTitle(
    "Hard Tech Week Opening Party",
    "Presented by 47G. Sponsors: Snowflake, Qualtrics. SQL Server pros welcome. Held at a warehouse.",
  );
  assert.ok(!has(tags, "aerospace"));
  assert.ok(!has(tags, "data"));
  assert.ok(has(tags, "hard-tech"), "Hard Tech in the title is hard tech");
  assert.ok(has(inferTagsFromTitle("47G Investor Roundtable: Targeting Utah"), "aerospace"));
});

test("facility tours of Hexcel, Nammo, Fortem and Albany get hard-tech", () => {
  for (const title of [
    "Hexcel R&D and Carbon Fiber Tour",
    "Inside Nammo: Innovation in Composite Technology",
    "Fortem Technologies Facility Tour",
    "Albany Engineered Composites Tour",
    "Paramount Machine Tour",
    "Mass production Additive manufaturing (3D printing)",
    "Weber County Nuclear Energy Symposium",
    "Deploying Robots into the Real World: A Case Study with Blue Collar Robotics",
    "The Future of Physical AI Summit 2026",
  ]) {
    assert.ok(has(inferTagsFromTitle(title), "hard-tech"), title);
  }
});

test("aerospace covers defense, drones, AAM, space and astronauts, and implies hard-tech", () => {
  for (const title of [
    "Tech Tuesday: Defense Tech Networking Event",
    "Drone Lunch & Learn: Smith College, UVU",
    "MITRE's Work in AAM",
    "Fortem Technologies | 47G: Zero Gravity Summit - Live Counter-UAS Demo",
    "From the Space Shuttle to Mars: Astronaut Jeffrey Hoffman on Technology",
    "7th August is for Aerospace 2026 | Securing Utah's Presence in Space",
    "Demystifying the U.S. Air Force",
  ]) {
    const tags = inferTagsFromTitle(title);
    assert.ok(has(tags, "aerospace"), title);
    assert.ok(has(tags, "hard-tech"), title);
  }
});

test("hard-tech and aerospace false positives stay out", () => {
  for (const title of [
    "Founders Space: Quick Connects & Beers",
    "Rocketlane in Utah: Careers, Culture & What's Next",
    "Own Your AI: Run Open Source AI Models on Hardware You Own",
    "Autonomous Sales",
    "Intro to AI Native Engineering",
    "PhD Dissertation Defense: Graph Neural Networks",
    "Self-Defense Class for Beginners",
  ]) {
    const tags = inferTagsFromTitle(title);
    assert.ok(!has(tags, "aerospace"), title);
    assert.ok(!has(tags, "hard-tech"), title);
  }
});

test("design needs a design title, not a loose word", () => {
  assert.ok(!has(inferTagsFromTitle("CAD & Create - 3D Design and Printing for Beginners"), "design"));
  assert.ok(!has(inferTagsFromTitle("Make a Trinket - Laser Cutting", "Design your own UI for the build"), "design"));
  assert.ok(has(inferTagsFromTitle("Designing for the Future of UX"), "design"));
  assert.ok(has(inferTagsFromTitle("#319: AI Prototyping that Uses Your Design System"), "design"));
});

test("description-only matches need a strong phrase", () => {
  assert.ok(!has(inferTagsFromTitle("Tech & Tacos", "Bring your AI questions"), "ai"));
  assert.ok(has(inferTagsFromTitle("Tech & Tacos", "A night on generative AI tools."), "ai"));
  assert.ok(has(inferTagsFromTitle("Lunch talk", "A deep dive into machine learning in production."), "machine-learning"));
  assert.ok(!has(inferTagsFromTitle("Lunch talk", "We use Postgres and SQL at work."), "data"));
  assert.ok(has(inferTagsFromTitle("Lunch talk", "All about data engineering pipelines."), "data"));
});

test("alias map: startup/founder -> founders, healthtech/medtech -> biotech, product-management dropped", () => {
  assert.equal(canonicalTag("startup"), "founders");
  assert.equal(canonicalTag("Founder"), "founders");
  assert.equal(canonicalTag("healthtech"), "biotech");
  assert.equal(canonicalTag("medtech"), "biotech");
  assert.equal(canonicalTag("product-management"), null);
  assert.equal(canonicalTag("ai"), "ai");
  assert.deepEqual(canonicalizeTags(["founders", "startup", "founder", "biotech", "healthtech", "product-management"]), [
    "founders",
    "biotech",
  ]);
  assert.deepEqual(tagQueryVariants("founders").sort(), ["founder", "founders", "startup"]);
  assert.deepEqual(tagQueryVariants("biotech").sort(), ["biotech", "healthtech", "medtech"]);
  assert.deepEqual(finalizeTags(["hard-tech-week"]), ["hard-tech-week", "hard-tech"]);
  /* Inferred tags come out canonical: the old healthtech rule is biotech now. */
  assert.deepEqual(inferTagsFromTitle("Digital Health Founders Night"), ["biotech", "founders"]);
});

test("classifier suggestedTags: aliased, mapped, limited to the allowlist", () => {
  assert.deepEqual(
    llmTagsFor(["startup", "AI", "leadership", "community", "networking", "Defense", "life sciences", "product-management", "meetup"]),
    ["ai", "aerospace", "hard-tech", "biotech"],
  );
  assert.deepEqual(llmTagsFor(["hard-tech-week", "conference", "hackathon"]), []);
  assert.deepEqual(llmTagsFor("ai"), []);
  assert.deepEqual(llmTagsFor([1, null, "rust"]), ["rust"]);
  /* A cert-spam event gets no strong content tag from the model either. */
  assert.deepEqual(llmTagsFor(["ai", "cybersecurity", "rust"], { certSpam: true }), ["rust"]);
  /* founders is title-rule and source only: the model over-calls "startup". */
  assert.deepEqual(llmTagsFor(["startup", "founders", "entrepreneurship"]), []);
});

test("llmTagPairs lists every mapping the SQL merge uses, and matches llmTagsFor", () => {
  const pairs = llmTagPairs();
  for (const [from, to] of pairs) assert.ok(llmTagsFor([from]).includes(to), `${from} -> ${to}`);
  assert.ok(pairs.some(([f, t]) => f === "healthtech" && t === "biotech"));
  assert.ok(!pairs.some(([, t]) => t === "founders"));
  assert.ok(pairs.some(([f, t]) => f === "aerospace" && t === "hard-tech"));
  assert.ok(!pairs.some(([f]) => f === "product-management"));
  assert.ok(!pairs.some(([, t]) => t === "meetup" || t === "hard-tech-week"));
  assert.ok(!llmTagPairs({ certSpam: true }).some(([, t]) => t === "ai"));
});

test("buildEventTags unions supplied tags with inference instead of replacing it", () => {
  const tags = buildEventTags({
    title: "1 Million Cups SLC: AI startup pitches",
    supplied: ["startup", "founders"],
    injected: ["healthtech"],
    specialWeek: [],
  });
  assert.deepEqual(tags, ["ai", "founders", "biotech"]);
  /* Cert-spam: injected strong tags are scrubbed, as before. */
  const spam = buildEventTags({ title: "CISSP 4 Days Training", injected: ["cybersecurity", "conference"] });
  assert.ok(!has(spam, "cybersecurity"));
  assert.ok(has(spam, "conference"));
  /* Week tag implies the permanent umbrella. */
  assert.deepEqual(
    buildEventTags({ title: "BYU Engineering Lab-o-ween", specialWeek: ["hard-tech-week"] }),
    ["hard-tech-week", "hard-tech"],
  );
});

test("?tags= aliases keep old URLs working", () => {
  assert.deepEqual(parseFilters(new URLSearchParams("tags=startup,founder")).tags, ["founders"]);
  assert.deepEqual(parseFilters(new URLSearchParams("tags=healthtech")).tags, ["biotech"]);
  assert.deepEqual(parseFilters(new URLSearchParams("tags=hard-tech-week")).tags, ["hard-tech-week"]);
  const pm = parseFilters(new URLSearchParams("tags=product-management"));
  assert.deepEqual(pm.tags, []);
  assert.equal(pm.q, "product management");
  /* With another tag or an explicit search, the retired tag just drops. */
  assert.equal(parseFilters(new URLSearchParams("tags=product-management,ai")).q, "");
  assert.equal(parseFilters(new URLSearchParams("tags=product-management&q=roadmap")).q, "roadmap");
});

test("display names and card order", () => {
  assert.equal(tagDisplayName("biotech"), "Health & Life Sciences");
  assert.equal(tagDisplayName("healthtech"), "Health & Life Sciences");
  assert.equal(tagDisplayName("aerospace"), "Aerospace & Defense");
  assert.equal(tagDisplayName("hard-tech"), "Hard Tech");
  assert.equal(tagDisplayName("hard-tech-week"), "Hard Tech Week");
  assert.equal(tagDisplayName("startup"), "Founders");
  assert.equal(tagDisplayName("c-sharp"), "C# / .NET");
  assert.equal(tagDisplayName("some-new-tag"), "Some New Tag");
  /* The 4-tag cut keeps the week and the industry tags. */
  assert.deepEqual(
    displayTags(["data", "product-management", "founders", "hackathon", "conference", "aerospace", "hard-tech-week", "startup"]).slice(0, 4),
    ["hard-tech-week", "aerospace", "data", "founders"],
  );
});
