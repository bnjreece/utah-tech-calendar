import { db, events, groups } from "../src/lib/db";
import { sql } from "drizzle-orm";

interface SeedEvent {
  title: string;
  description: string;
  link: string;
  source: string;
  externalId: string;
  startsAt: Date;
  endsAt?: Date;
  isOnline: boolean;
  venueName?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  imageUrl?: string;
  tags: string[];
  groupSlug?: string;
}

function daysFromNow(days: number, hour = 18): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const SEED_EVENTS: SeedEvent[] = [
  {
    title: "React + TanStack Query patterns",
    description: "Deep dive into TanStack Query for React. Live coding, audience questions.",
    link: "https://www.meetup.com/utahjs/events/seed-1/",
    source: "manual",
    externalId: "seed-1",
    startsAt: daysFromNow(2, 18),
    endsAt: daysFromNow(2, 20),
    isOnline: false,
    venueName: "Domo HQ",
    address: "802 East Lehi Pkwy",
    city: "Lehi",
    state: "UT",
    postalCode: "84043",
    tags: ["javascript", "react", "web"],
    groupSlug: "utahjs",
  },
  {
    title: "Rust async runtimes face-off",
    description: "Tokio vs smol vs async-std. Benchmarks, ergonomics, real world.",
    link: "https://www.meetup.com/utah-rust/events/seed-2/",
    source: "manual",
    externalId: "seed-2",
    startsAt: daysFromNow(4, 19),
    endsAt: daysFromNow(4, 21),
    isOnline: false,
    venueName: "Recursion Coworking",
    address: "358 S 700 E",
    city: "Salt Lake City",
    state: "UT",
    postalCode: "84102",
    tags: ["rust", "systems"],
    groupSlug: "utah-rust",
  },
  {
    title: "AI builders happy hour",
    description: "Founders, engineers, and PMs building with LLMs in Utah. Drinks + demos.",
    link: "https://lu.ma/slc-ai-happy-hour-seed",
    source: "manual",
    externalId: "seed-3",
    startsAt: daysFromNow(6, 17),
    endsAt: daysFromNow(6, 20),
    isOnline: false,
    venueName: "Kiln SLC",
    address: "26 S Rio Grande St",
    city: "Salt Lake City",
    state: "UT",
    postalCode: "84101",
    imageUrl: "https://images.unsplash.com/photo-1558403194-611308249627?w=800",
    tags: ["ai", "founders", "happy-hour"],
    groupSlug: "slc-tech-luma",
  },
  {
    title: "Online: Python typing deep dive (Zoom)",
    description: "Live online session on PEP 695, type parameter syntax, and Pyright.",
    link: "https://zoom.us/seed-4",
    source: "manual",
    externalId: "seed-4",
    startsAt: daysFromNow(3, 18),
    endsAt: daysFromNow(3, 19),
    isOnline: true,
    venueName: "Zoom",
    tags: ["python"],
    groupSlug: "utah-python",
  },
  {
    title: "Go monthly: gRPC at scale",
    description: "Patterns for streaming, observability, and zero-downtime deploys.",
    link: "https://www.meetup.com/utahgo/events/seed-5/",
    source: "manual",
    externalId: "seed-5",
    startsAt: daysFromNow(8, 18),
    endsAt: daysFromNow(8, 20),
    isOnline: false,
    venueName: "Industry SLC",
    address: "650 S Main St",
    city: "Salt Lake City",
    state: "UT",
    postalCode: "84101",
    tags: ["golang"],
    groupSlug: "utahgo",
  },
  {
    title: "AWS user group: Bedrock for prod",
    description: "Practical patterns for using Bedrock in production workloads.",
    link: "https://www.meetup.com/salt-lake-city-aws-user-group/events/seed-6/",
    source: "manual",
    externalId: "seed-6",
    startsAt: daysFromNow(11, 18),
    endsAt: daysFromNow(11, 20),
    isOnline: false,
    venueName: "Pluralsight",
    address: "182 N Union Ave",
    city: "Farmington",
    state: "UT",
    postalCode: "84025",
    tags: ["aws", "cloud", "ai"],
    groupSlug: "slc-aws",
  },
  {
    title: "Provo founders: pitch night",
    description: "Five startups, five minutes each. Q&A with investors.",
    link: "https://lu.ma/provo-pitch-night-seed",
    source: "manual",
    externalId: "seed-7",
    startsAt: daysFromNow(14, 19),
    endsAt: daysFromNow(14, 21),
    isOnline: false,
    venueName: "Founders Live",
    address: "300 N University Ave",
    city: "Provo",
    state: "UT",
    postalCode: "84601",
    tags: ["founders", "startup", "pitch"],
  },
  {
    title: "Hardware hack: Raspberry Pi cluster night",
    description: "BYO Pi. We build a tiny k8s cluster and break it.",
    link: "https://www.meetup.com/utah-iot/events/seed-8/",
    source: "manual",
    externalId: "seed-8",
    startsAt: daysFromNow(17, 18),
    endsAt: daysFromNow(17, 21),
    isOnline: false,
    venueName: "Provo Maker Space",
    address: "144 N University Ave",
    city: "Provo",
    state: "UT",
    postalCode: "84601",
    tags: ["iot", "hardware", "kubernetes"],
    groupSlug: "utah-iot",
  },
  {
    title: "Elixir Phoenix LiveView workshop",
    description: "Half-day workshop. Bring a laptop, leave with a working LiveView app.",
    link: "https://www.meetup.com/utah-elixir/events/seed-9/",
    source: "manual",
    externalId: "seed-9",
    startsAt: daysFromNow(20, 10),
    endsAt: daysFromNow(20, 16),
    isOnline: false,
    venueName: "Lehi Tech Hub",
    address: "2600 W Executive Pkwy",
    city: "Lehi",
    state: "UT",
    postalCode: "84043",
    tags: ["elixir", "phoenix", "workshop"],
    groupSlug: "utah-elixir",
  },
  {
    title: "Ogden devs coffee",
    description: "Casual monthly meetup. No talks, just hang.",
    link: "https://www.meetup.com/ogden-devs/events/seed-10/",
    source: "manual",
    externalId: "seed-10",
    startsAt: daysFromNow(23, 9),
    endsAt: daysFromNow(23, 11),
    isOnline: false,
    venueName: "Grounds for Coffee",
    address: "111 24th St",
    city: "Ogden",
    state: "UT",
    postalCode: "84401",
    tags: ["community"],
  },
];

async function main() {
  console.log(`Seeding ${SEED_EVENTS.length} events...`);

  for (const seed of SEED_EVENTS) {
    let groupId: string | undefined;
    if (seed.groupSlug) {
      const [g] = await db
        .select({ id: groups.id })
        .from(groups)
        .where(sql`${groups.slug} = ${seed.groupSlug}`)
        .limit(1);
      groupId = g?.id;
    }

    const [existing] = await db
      .select({ id: events.id })
      .from(events)
      .where(sql`${events.source} = ${seed.source} AND ${events.externalId} = ${seed.externalId}`)
      .limit(1);

    if (existing) {
      console.log(`  = exists: ${seed.title}`);
      continue;
    }

    await db.insert(events).values({
      title: seed.title,
      description: seed.description,
      link: seed.link,
      source: seed.source,
      externalId: seed.externalId,
      startsAt: seed.startsAt,
      endsAt: seed.endsAt,
      isOnline: seed.isOnline,
      venueName: seed.venueName,
      address: seed.address,
      city: seed.city,
      state: seed.state,
      postalCode: seed.postalCode,
      imageUrl: seed.imageUrl,
      tags: seed.tags,
      groupId,
      status: "approved",
    });
    console.log(`  + ${seed.title}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
