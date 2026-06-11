/* Surfaces the Scraper Doctor's activity for the /admin/health page.
   The repo is public, so we read its pull requests from the GitHub API
   unauthenticated (no token, no new secret) and pick out the doctor's
   fix branches (scraper-doctor/*). Cached so an admin refresh doesn't
   hammer the 60/hr unauthenticated rate limit. */

const REPO = "bnjreece/utah-tech-calendar";

export interface HealingPR {
  number: number;
  title: string;
  url: string;
  state: "open" | "merged" | "closed";
  updatedAt: string;
}

export const SCRAPER_DOCTOR_WORKFLOW_URL = `https://github.com/${REPO}/actions/workflows/scraper-doctor.yml`;

export async function fetchSelfHealingActivity(): Promise<{
  prs: HealingPR[];
  error: string | null;
}> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/pulls?state=all&per_page=20&sort=updated&direction=desc`,
      {
        headers: {
          "User-Agent": "utah-tech-calendar-admin",
          Accept: "application/vnd.github+json",
        },
        // Admin-only page; 5 min cache keeps us well under the rate limit.
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return { prs: [], error: `GitHub API ${res.status}` };
    const data = (await res.json()) as Array<{
      number: number;
      title: string;
      html_url: string;
      state: string;
      merged_at: string | null;
      updated_at: string;
      head: { ref: string };
    }>;
    const prs: HealingPR[] = data
      .filter((p) => p.head?.ref?.startsWith("scraper-doctor/"))
      .map((p) => ({
        number: p.number,
        title: p.title,
        url: p.html_url,
        state: p.merged_at ? "merged" : p.state === "open" ? "open" : "closed",
        updatedAt: p.updated_at,
      }));
    return { prs, error: null };
  } catch (e) {
    return { prs: [], error: e instanceof Error ? e.message : "fetch failed" };
  }
}
