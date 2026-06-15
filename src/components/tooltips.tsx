import * as React from "react";
import {
  InfoTip,
  Tooltip,
  TooltipPanel,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STRATUM_CLASSES, type Stratum } from "@/lib/strata";

/* Domain tooltip helpers + canonical copy. Single source of truth so the
   same vocabulary reads identically across the ~6 admin surfaces (and the
   public site) that show it. Built on the ui/tooltip primitives. */

/* Health-status vocabulary (health + sources pages). */
export const STATUS_TIP: Record<string, string> = {
  ok: "The source ran successfully and returned events.",
  quiet: "The source runs successfully but is currently returning zero events.",
  stale: "No successful scrape within the stale threshold; the cron or the source may be down.",
  broken: "The source's last run threw an error and recorded a lastError.",
  never: "This source has not completed a scrape run yet.",
  disabled: "Scraping is turned off for this source.",
};

/* Hidden-reason chip vocabulary (hidden + recent + screened pages). */
export const REASON_TIP: Record<string, string> = {
  craft: "A non-tech hobby or maker event.",
  "cert-spam": "Low-value certification or training spam.",
  "cross-post": "A duplicate of the same event from another source.",
  "not-tech": "Not a technology event.",
  spam: "Low-quality lead-generation or advertising spam.",
  duplicate: "A duplicate listing of an event already on the calendar.",
  placeholder: "An organizer placeholder, not a real public event yet.",
  "llm-screened": "Auto-hidden by the model because it was flagged with high confidence.",
  manual: "Hidden by an admin.",
  "source-disabled": "Hidden because its source was turned off.",
};

/* The router-lock sentence, reused wherever a human action locks an event. */
export const LOCK_NOTE =
  "Locks this event so the automated router cannot re-route it later.";

type Side = "top" | "bottom" | "left" | "right";

/* An info icon explaining a health status, keyed off STATUS_TIP. */
export function StatusTip({ status, side }: { status: string; side?: Side }) {
  const copy = STATUS_TIP[status];
  return copy ? <InfoTip label={copy} side={side} /> : null;
}

/* An info icon explaining a hidden_reason chip, keyed off REASON_TIP. */
export function ReasonTip({ reason, side }: { reason: string; side?: Side }) {
  const copy = REASON_TIP[reason];
  return copy ? <InfoTip label={copy} side={side} /> : null;
}

/* One info icon whose tooltip lists the source-family color legend - the
   single source of truth for what the accent bars / source dots mean. */
const STRATA_LEGEND: { stratum: Stratum; sources: string }[] = [
  { stratum: "sunset", sources: "Meetup" },
  { stratum: "dusk", sources: "Luma" },
  { stratum: "terracotta", sources: "Eventbrite, Silicon Slopes" },
  { stratum: "sage", sources: "Manual, web calendars" },
  { stratum: "sand", sources: "Other sources" },
];

export function StrataLegendTip({ side }: { side?: Side }) {
  return (
    <InfoTip
      side={side}
      label={
        <span className="block">
          <span className="mb-1.5 block text-ink">
            The accent color marks the source family.
          </span>
          {STRATA_LEGEND.map(({ stratum, sources }) => (
            <span key={stratum} className="flex items-center gap-2 py-0.5">
              <span
                className={`inline-block size-2 shrink-0 rounded-full ${STRATUM_CLASSES[stratum].bar}`}
                aria-hidden
              />
              <span>{sources}</span>
            </span>
          ))}
        </span>
      }
    />
  );
}

/* Wrap an EXISTING interactive element (an action button, a chip) with a
   tooltip - keeps a single DOM/a11y node instead of adding an icon. */
export function ActionTip({
  tip,
  side,
  children,
}: {
  tip: React.ReactNode;
  side?: Side;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPanel side={side}>{tip}</TooltipPanel>
    </Tooltip>
  );
}
