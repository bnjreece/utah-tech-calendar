import { db, sources, groups } from "../src/lib/db";
import { sql } from "drizzle-orm";

interface SeedSource {
  adapter: string;
  url: string;
  groupName?: string;
  groupSlug?: string;
  groupExternalId?: string;
  defaultTags?: string[];
  enabled?: boolean;
}

const SEED_SOURCES: SeedSource[] = [
  // Meetup groups — verified active as of 2026-05-29
  { adapter: "meetup", url: "https://www.meetup.com/utahjs/", groupName: "UtahJS", groupSlug: "utahjs", groupExternalId: "utahjs", defaultTags: ["javascript", "web"] },
  { adapter: "meetup", url: "https://www.meetup.com/utah-rust/", groupName: "Utah Rust", groupSlug: "utah-rust", groupExternalId: "utah-rust", defaultTags: ["rust", "systems"] },
  { adapter: "meetup", url: "https://www.meetup.com/utahpython/", groupName: "Utah Python", groupSlug: "utahpython", groupExternalId: "utahpython", defaultTags: ["python"] },
  { adapter: "meetup", url: "https://www.meetup.com/Utah-Software-Craftsmanship/", groupName: "Utah Software Craftsmanship", groupSlug: "utah-craftsmanship", groupExternalId: "Utah-Software-Craftsmanship", defaultTags: ["software"] },
  { adapter: "meetup", url: "https://www.meetup.com/utah-elixir/", groupName: "Utah Elixir", groupSlug: "utah-elixir", groupExternalId: "utah-elixir", defaultTags: ["elixir"] },

  // Meetup groups — kept enabled but currently no upcoming events; will pick up activity automatically
  { adapter: "meetup", url: "https://www.meetup.com/salt-lake-city-aws-user-group/", groupName: "SLC AWS User Group", groupSlug: "slc-aws", groupExternalId: "salt-lake-city-aws-user-group", defaultTags: ["aws", "cloud"] },
  { adapter: "meetup", url: "https://www.meetup.com/utahgo/", groupName: "UtahGo", groupSlug: "utahgo", groupExternalId: "utahgo", defaultTags: ["golang"] },
  { adapter: "meetup", url: "https://www.meetup.com/utah-iot/", groupName: "Utah IoT", groupSlug: "utah-iot", groupExternalId: "utah-iot", defaultTags: ["iot", "hardware"] },

  // Wrong slug, kept disabled. Real slug is `utahpython` above.
  { adapter: "meetup", url: "https://www.meetup.com/utah-python-users-group/", groupName: "Utah Python (wrong slug)", groupSlug: "utah-python-users-group-DEPRECATED", groupExternalId: "utah-python-users-group", enabled: false },

  // Luma calendars
  { adapter: "luma", url: "https://lu.ma/slc", groupName: "Luma SLC", groupSlug: "luma-slc", groupExternalId: "slc", defaultTags: ["ai", "founders"] },
  // lu.ma/saltlakecity mirrors lu.ma/slc — skipped to avoid duplicate work, dedup would catch it anyway

  // Eventbrite searches by region and topic
  { adapter: "eventbrite", url: "https://www.eventbrite.com/d/ut--salt-lake-city/tech--events/", groupName: "Eventbrite SLC Tech", groupSlug: "eventbrite-slc-tech", groupExternalId: "slc-tech-search" },
  { adapter: "eventbrite", url: "https://www.eventbrite.com/d/ut--provo/tech--events/", groupName: "Eventbrite Provo Tech", groupSlug: "eventbrite-provo-tech", groupExternalId: "provo-tech-search" },
  { adapter: "eventbrite", url: "https://www.eventbrite.com/d/ut--salt-lake-city/ai--events/", groupName: "Eventbrite Utah AI", groupSlug: "eventbrite-utah-ai", groupExternalId: "utah-ai-search" },
  { adapter: "eventbrite", url: "https://www.eventbrite.com/d/ut--salt-lake-city/startup--events/", groupName: "Eventbrite Utah Startup", groupSlug: "eventbrite-utah-startup", groupExternalId: "utah-startup-search" },
  // Park City returned 100% duplicates of SLC tech — skipped
];

async function main() {
  console.log(`Seeding ${SEED_SOURCES.length} sources...`);

  for (const seed of SEED_SOURCES) {
    let groupId: string | undefined;

    if (seed.groupName && seed.groupSlug) {
      const [existing] = await db
        .select({ id: groups.id })
        .from(groups)
        .where(sql`${groups.slug} = ${seed.groupSlug}`)
        .limit(1);

      if (existing) {
        groupId = existing.id;
      } else {
        const [inserted] = await db
          .insert(groups)
          .values({
            name: seed.groupName,
            slug: seed.groupSlug,
            source: seed.adapter,
            externalId: seed.groupExternalId,
            defaultTags: seed.defaultTags,
            status: "active",
          })
          .returning({ id: groups.id });
        groupId = inserted.id;
        console.log(`  + group: ${seed.groupName}`);
      }
    }

    const [existingSource] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(sql`${sources.url} = ${seed.url}`)
      .limit(1);

    if (existingSource) {
      console.log(`  = source exists: ${seed.url}`);
      continue;
    }

    await db.insert(sources).values({
      adapter: seed.adapter,
      url: seed.url,
      groupId,
      enabled: seed.enabled ?? true,
    });
    console.log(`  + ${seed.adapter} ${seed.url}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
