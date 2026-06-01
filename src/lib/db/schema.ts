import {
  boolean,
  index,
  integer,
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
    /* Surfaces a thicker bar + "Conference" eyebrow in the schedule.
       Flagged manually via admin (or by future heuristic at scrape time). */
    isConference: boolean("is_conference").notNull().default(false),
    /* True for ticketed/training events with a real price (training
       bootcamps, conferences, paid workshops). Surfaces the same badge
       slot as conferences but with a "Paid" label. */
    isPaid: boolean("is_paid").notNull().default(false),
    /* True for "penciled in" events whose date is a placeholder based on
       prior-year cadence (e.g. Silicon Slopes SUMMIT 2027 lands in
       February but no specific dates have been announced). Surfaces
       brackets around the date + a PENCILED trailing badge. Flip to
       false when the real date is announced. */
    isTentative: boolean("is_tentative").notNull().default(false),
    /* For status='hidden' rows, why - so /admin/hidden can group by
       the cause (craft filter, cross-post dedup-sweep, cert-spam,
       manual admin reject, source disabled). NULL on
       status='approved' or 'pending' rows. New enum-ish strings:
       'craft' | 'cert-spam' | 'cross-post' | 'manual' |
       'source-disabled' | 'unknown' (legacy). */
    hiddenReason: text("hidden_reason"),
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
  /* When true, events from this source land as status='pending' instead
     of 'approved' — they show up in the admin review queue until an
     admin manually approves/rejects each one. For broad/generic sources
     like a city-wide events calendar. */
  requiresReview: boolean("requires_review").notNull().default(false),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastError: text("last_error"),
  /* For cookie/session-auth scrapers (e.g. Silicon Slopes via Circle.so),
     manually set whenever the cookie is rotated so the admin can warn
     before the cookie silently expires. NULL on sources that don't have
     a rotation lifecycle. */
  authRotatedAt: timestamp("auth_rotated_at", { withTimezone: true }),
  /* Per-source JSON config consumed by adapters that need parameters
     beyond a URL. The recurrence adapter uses this to encode the
     pattern ({type:"weekly", weekday, hour, minute, ...}); other
     adapters can leave it NULL. */
  config: jsonb("config"),
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

/* Email subscribers for the weekly digest. Double opt-in: an unverified
   row is created on signup, then verifiedAt flips when the user clicks
   the magic link. Unsubscribe is a HMAC-signed link that deletes the
   row outright (no soft-delete - we never want to email someone again
   if they explicitly opted out). */
export const emailSubscriptions = pgTable(
  "email_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    /* Outbound digest tracking - prevents duplicate sends within the
       same week if the cron fires twice (e.g. a manual retry). */
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    /* Legacy column kept for future per-topic tagging - unused by the
       current digest. The active filter mechanism is `feedQuery`. */
    topics: text("topics").array(),
    /* URL search string captured at signup time (e.g.
       `regions=Salt+Lake+County&tags=ai`). The digest cron parses this
       and runs `queryEvents` per subscriber so everyone gets the same
       slice they'd see on the website. NULL or empty = full digest. */
    feedQuery: text("feed_query"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("email_subscriptions_email_idx").on(t.email)],
);

export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
export type NewEmailSubscription = typeof emailSubscriptions.$inferInsert;

/* Singleton admin preferences. The id column is CHECK-constrained to
   1 at the DB level so we always upsert into the same row regardless
   of how many edits land. */
export const adminSettings = pgTable("admin_settings", {
  id: integer("id").primaryKey().default(1),
  alertEmail: text("alert_email"),
  notifySourceErrors: boolean("notify_source_errors").notNull().default(true),
  notifySourceStale: boolean("notify_source_stale").notNull().default(true),
  notifyCookieExpiry: boolean("notify_cookie_expiry").notNull().default(true),
  staleThresholdHours: integer("stale_threshold_hours").notNull().default(24),
  /* Last time the health-alerts cron emailed - used both for "send
     once per day max" rate-limiting and for the alerts hash dedup. */
  lastAlertsSentAt: timestamp("last_alerts_sent_at", { withTimezone: true }),
  lastAlertsHash: text("last_alerts_hash"),
  /* Heartbeat - stamped at the start of every scrape cron tick so the
     health detector can independently verify "the cron is firing" even
     when every individual source has lastScrapedAt updates that look
     fresh from a stale cached run. If this gets too old, alert. */
  lastScrapeTickAt: timestamp("last_scrape_tick_at", { withTimezone: true }),
  /* Heartbeat - stamped at the start of every queue-digest cron tick
     regardless of whether the email was actually sent (the cron is
     skip-if-empty). Lets /admin show "queue digest ran 4h ago" so the
     admin can spot a silent cron outage even during dry weeks. */
  lastQueueDigestRunAt: timestamp("last_queue_digest_run_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminSettings = typeof adminSettings.$inferSelect;
export type NewAdminSettings = typeof adminSettings.$inferInsert;

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type PendingSubmission = typeof pendingSubmissions.$inferSelect;
export type NewPendingSubmission = typeof pendingSubmissions.$inferInsert;
