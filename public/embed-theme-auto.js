// Embed-only auto-theme detection. Runs inside the <iframe> and flips
// <html> to .dark when the parent system prefers dark mode. Kept
// separate from theme-init.js (which reads localStorage for the main
// site) so embed iframes don't share theme state with anything else.
(function () {
  try {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    // ignore - default light theme stands
  }
})();
