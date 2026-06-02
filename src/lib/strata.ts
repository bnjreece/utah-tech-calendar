export type Stratum =
  | "sage"
  | "sand"
  | "sunset"
  | "terracotta"
  | "dusk";

const SOURCE_TO_STRATUM: Record<string, Stratum> = {
  meetup: "sunset",
  luma: "dusk",
  eventbrite: "terracotta",
  manual: "sage",
  silicon_slopes: "terracotta",
  forge_utah: "sand",
  html: "sage",
};

export function stratumForEvent(source: string): Stratum {
  return SOURCE_TO_STRATUM[source] ?? "sand";
}

export const STRATUM_CLASSES: Record<
  Stratum,
  { bar: string; chip: string; text: string }
> = {
  sage: {
    bar: "bg-sage",
    chip: "bg-sage/15 text-sage-deep",
    text: "text-sage-deep",
  },
  sand: {
    bar: "bg-sand",
    chip: "bg-sand/40 text-ink-soft",
    text: "text-ink-soft",
  },
  sunset: {
    bar: "bg-sunset",
    chip: "bg-sunset/15 text-sunset-deep",
    text: "text-sunset-deep",
  },
  terracotta: {
    bar: "bg-terracotta",
    chip: "bg-terracotta/15 text-terracotta-deep",
    text: "text-terracotta-deep",
  },
  dusk: {
    bar: "bg-dusk",
    chip: "bg-dusk/15 text-dusk-deep",
    text: "text-dusk-deep",
  },
};
