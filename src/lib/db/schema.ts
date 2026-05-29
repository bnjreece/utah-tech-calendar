import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    source: text("source"),
    externalId: text("external_id"),
    website: text("website"),
    imageUrl: text("image_url"),
    defaultTags: text("default_tags").array(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("groups_source_external_idx").on(t.source, t.externalId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    link: text("link"),
    source: text("source").notNull(),
    externalId: text("external_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("America/Denver"),
    isOnline: boolean("is_online").notNull().default(false),
    venueName: text("venue_name"),
    address: text("address"),
    city: text("city"),
    state: text("state").default("UT"),
    postalCode: text("postal_code"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    imageUrl: text("image_url"),
    tags: text("tags").array(),
    groupId: uuid("group_id").references(() => groups.id),
    status: text("status").notNull().default("approved"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("events_source_external_idx").on(t.source, t.externalId),
    index("events_starts_at_idx").on(t.startsAt),
    index("events_status_idx").on(t.status),
  ],
);

export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  adapter: text("adapter").notNull(),
  url: text("url").notNull(),
  groupId: uuid("group_id").references(() => groups.id),
  enabled: boolean("enabled").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pendingSubmissions = pgTable("pending_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  payload: jsonb("payload").notNull(),
  submitterEmail: text("submitter_email"),
  submitterName: text("submitter_name"),
  status: text("status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type PendingSubmission = typeof pendingSubmissions.$inferSelect;
export type NewPendingSubmission = typeof pendingSubmissions.$inferInsert;
