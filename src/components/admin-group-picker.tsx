"use client";

import { useState } from "react";

interface GroupOpt {
  id: string;
  name: string;
}

/* Group picker used in admin to assign a source or an event to a group.
   Server action is passed in (setSourceGroup / setEventGroup); idField
   is the hidden field name that action reads ("sourceId" | "eventId"). */
export function GroupPicker({
  action,
  idField,
  idValue,
  groups,
  currentId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  idField: string;
  idValue: string;
  groups: GroupOpt[];
  currentId: string | null;
}) {
  const [choice, setChoice] = useState<string>(currentId ?? "none");

  const fieldClass =
    "rounded-md bg-foreground/[0.04] px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-sunset-deep -outline-offset-1";

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name={idField} value={idValue} />
      <select
        name="groupId"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className={fieldClass}
        aria-label="Group"
      >
        <option value="none">— no group —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
        <option value="__new__">+ New group…</option>
      </select>
      {choice === "__new__" && (
        <input name="newGroupName" placeholder="New group name" className={fieldClass} aria-label="New group name" />
      )}
      <button
        type="submit"
        className="rounded-md px-2 py-1 text-xs font-medium text-ink-soft hover:text-ink hover:bg-foreground/[0.06] transition-colors"
      >
        Set
      </button>
    </form>
  );
}
