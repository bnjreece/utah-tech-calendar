/* Partnership credit for the Forge Utah Foundation. Forge ships separate
   light/dark wordmarks; the .theme-logo-* classes (globals.css) show the
   one that matches the active theme (.dark on <html>). */
export function ForgeCredit({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://forgeutah.tech"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="In partnership with the Forge Utah Foundation"
      className={`inline-flex items-center gap-2.5 group ${className}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        in partnership with
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/forge-logo-light.png"
        alt="Forge Utah Foundation"
        width={320}
        height={121}
        className="theme-logo-light h-6 w-auto opacity-75 group-hover:opacity-100 transition-opacity"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/forge-logo-dark.png"
        alt="Forge Utah Foundation"
        width={320}
        height={121}
        className="theme-logo-dark h-6 w-auto opacity-75 group-hover:opacity-100 transition-opacity"
      />
    </a>
  );
}
