// Pre-paint dark-mode bootstrap. Loaded as a static <script src> with
// strategy=beforeInteractive so the user's saved theme (or their
// system preference) is applied to <html> before React hydrates.
// Mirrors the localStorage logic in components/theme-toggle.tsx.
(function () {
  try {
    var stored = localStorage.getItem("utc:theme");
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (stored !== "light" && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    // private mode, quota, anything else - quietly continue with the
    // default light theme.
  }
})();
