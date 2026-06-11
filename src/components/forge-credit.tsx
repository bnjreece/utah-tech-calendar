/* Partnership credit for the Forge Utah Foundation. Forge ships separate
   light/dark wordmarks; the .theme-logo-* classes (globals.css) show the
   one that matches the active theme (.dark on <html>). */
export function ForgeCredit({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "lg";
}) {
  const lg = size === "lg";
  const gap = lg ? "gap-5" : "gap-2.5";
  const textCls = lg
    ? "text-sm tracking-[0.25em]"
    : "text-[10px] tracking-[0.2em]";
  const logoCls = lg ? "h-10" : "h-6";

  return (
    <a
      href="https://forgeutah.tech"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="In partnership with the Forge Utah Foundation"
      className={`inline-flex items-center ${gap} group ${className}`}
    >
      <span className={`font-mono ${textCls} uppercase text-ink-soft leading-none`}>
        in partnership with
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/forge-logo-light.png"
        alt="Forge Utah Foundation"
        width={320}
        height={121}
        className={`theme-logo-light ${logoCls} w-auto opacity-80 group-hover:opacity-100 transition-opacity`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/forge-logo-dark.png"
        alt="Forge Utah Foundation"
        width={320}
        height={121}
        className={`theme-logo-dark ${logoCls} w-auto opacity-80 group-hover:opacity-100 transition-opacity`}
      />
    </a>
  );
}
