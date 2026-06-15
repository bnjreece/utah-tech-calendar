"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/* Shared tooltip suite, built on @base-ui/react Tooltip. One TooltipProvider
   is mounted in layout.tsx so the open/close delay is shared - scanning
   adjacent tips doesn't re-wait the open delay. The panel is the lightest
   editorial surface: paper bg, opacity border, soft shadow. Accessibility
   (role="tooltip", aria-describedby, Escape, focus + hover triggers) and
   tap-to-toggle on touch (every trigger is a real <button>) come from
   base-ui. Tooltips carry SUPPLEMENTARY clarification only - never the sole
   copy of essential information. */

export function TooltipProvider(props: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={350} closeDelay={120} {...props} />;
}

export function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />;
}

export function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export function TooltipPanel({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-panel"
          className={cn(
            "max-w-72 origin-(--transform-origin) rounded-xl border border-ink/10 bg-paper px-3 py-2 text-xs leading-snug text-ink-soft shadow-lg outline-hidden duration-100",
            "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/* InfoTip - a 16px info icon button + tooltip, for a stat / heading / label
   that has no existing word to anchor a tip to. Real <button> so it's
   keyboard-focusable and tap-toggles on touch. */
export function InfoTip({
  label,
  side,
  className,
  icon = InformationCircleIcon,
}: {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  icon?: typeof InformationCircleIcon;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={typeof label === "string" ? label : "More information"}
            className={cn(
              "inline-flex shrink-0 items-center rounded-full align-text-top text-ink-soft/55 hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep",
              className,
            )}
          />
        }
      >
        <HugeiconsIcon icon={icon} size={16} className="size-4 shrink-0" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipPanel side={side}>{label}</TooltipPanel>
    </Tooltip>
  );
}

/* Term - inline jargon word with a static dotted underline + tooltip. Use
   when the term is already a word in running text (no extra icon). The
   underline is a static affordance; only the panel animates. */
export function Term({
  children,
  tip,
  side,
  className,
}: {
  children: React.ReactNode;
  tip: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "cursor-help underline decoration-dotted decoration-ink/30 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sunset-deep",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPanel side={side}>{tip}</TooltipPanel>
    </Tooltip>
  );
}
