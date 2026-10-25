import { SPECIAL_WEEK_SLUGS } from "./special-weeks";

/* Hiding a duplicate must never take an event out of a special week's
   filtered view. The official Hard Tech Week calendar tags its own listing
   (hard-tech-week); the older row it duplicates often lacks the tag, and a
   generic title ("Facility Tour") does not earn it. So every special-week
   tag on a row the sweep hides moves to the row(s) left visible for that
   event.

   Clusters overlap: a row can be dropped by one cluster and kept by
   another, and the same-day-twins pass can drop the survivor of an earlier
   cluster. Clusters that share a row are one event, so they are joined
   first, and each hidden row's week tags go to every visible row of its
   joined group that lacks them.

   Pure: the sweep supplies the clusters, the final hidden set and the
   rows' current tags, and writes the result with appendTagsSql. */
export function planTagCarries(
  clusters: ReadonlyArray<readonly string[]>,
  hidden: ReadonlySet<string>,
  tagsById: ReadonlyMap<string, readonly string[] | null>,
): Map<string, string[]> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (c !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  for (const ids of clusters) {
    for (const id of ids) if (!parent.has(id)) parent.set(id, id);
    for (const id of ids.slice(1)) {
      const a = find(ids[0]);
      const b = find(id);
      if (a !== b) parent.set(b, a);
    }
  }

  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const r = find(id);
    const g = groups.get(r);
    if (g) g.push(id);
    else groups.set(r, [id]);
  }

  const out = new Map<string, string[]>();
  for (const ids of groups.values()) {
    const weekTags = new Set<string>();
    for (const id of ids)
      if (hidden.has(id)) for (const t of tagsById.get(id) ?? []) if (SPECIAL_WEEK_SLUGS.has(t)) weekTags.add(t);
    if (weekTags.size === 0) continue;
    for (const id of ids) {
      if (hidden.has(id)) continue;
      const have = new Set(tagsById.get(id) ?? []);
      const add = [...weekTags].filter((t) => !have.has(t));
      if (add.length > 0) out.set(id, add.sort());
    }
  }
  return out;
}
