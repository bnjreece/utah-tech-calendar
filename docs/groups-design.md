# Groups — design

Lets people filter and subscribe to the calendar by the communities they care
about (Utah Go, UtahJS, Rust, …). Decided 2026-06-11.

## Model: shared, no accounts

Groups are a **single global taxonomy**, not per-user collections. This keeps
the product's core promise — *no login, no tracking, nothing to sign up for*.

- **"My groups" is a saved filter, not an account.** Selecting groups updates
  the URL querystring (`?groups=utah-go,utahjs`), which is already shareable
  (Share view), restorable (localStorage "Restore your last view"), and
  subscribable (the iCal/RSS feeds already honor the querystring). No server-
  side per-user state.
- **Changes to a group are admin-curated.** A global rename/merge affects
  everyone, so it can't be anonymous. New groups come in through the existing
  suggest → admin-approve flow.

### Group ≠ Tag (don't rebuild tags)
- **Group** = the community/org that *runs* the events (Utah Go User Group).
  One per event, derived from its source.
- **Tag** = the cross-cutting topic (AI, Python, web, beginner). Many per
  event. Already implemented. Topical collections are tags, not groups.

## What already exists
- `groups` table; `sources.group_id` and `events.group_id`.
- Query filters by group (`inArray(events.groupId, filters.groups)`).
- iCal/RSS feeds honor `?groups=` already.
- Per-group page at `/group/[slug]`.
- `/submit-source` (user suggests, admin approves) — a source ≈ a group.
- Gap: only 17 / 72 sources are grouped; no Group chip in the filter UI.

## CRUD, mapped to this model
- **Create** → add a source (its URL *is* the group) via `/submit-source` →
  admin approve. A lightweight "suggest a group" can wrap the same flow for
  orgs with no scrapable feed.
- **Assign an event** → automatic from its source; manual `/submit` events get
  a group picker; admin can override.
- **Rename / merge / remove** → admin-only, in a small `/admin/groups` screen.

## Build plan

### Tier 1 — delivers the feature (build first)
1. **Auto-derive a group for every source** so all 72 sources (and their
   events) are grouped, not just the 17 seeded ones. Backfill once, then derive
   on source creation. The Group filter is only useful if groups are populated.
2. **Group filter chip** in the filter bar — reuse `MultiSelectPopover` (same
   as City/Tag/Source); the query + URL state already support `groups`.
3. **Per-group subscribe** — add an iCal/webcal "Subscribe" affordance on
   `/group/[slug]` (and a "subscribe to these groups" link when groups are
   selected), reusing the existing feed + `subscribe-popover`.

### Tier 2 — curation (next)
- `/admin/groups`: rename, merge duplicates, remove dead groups, reassign a
  source's group. Admin-gated (`requireAdmin`).

### Tier 3 — community input (later)
- "Suggest a group" surfaced in the UI → `/submit-source` → admin approve.

### Out of scope
- Personal accounts / per-user group CRUD. Breaks the no-login principle; only
  revisit if that principle changes.
