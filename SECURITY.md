# Security Policy

Thanks for helping keep Utah Tech Calendar and its users safe.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via GitHub's [private vulnerability reporting](https://github.com/bnjreece/utah-tech-calendar/security/advisories/new) (Security tab → "Report a vulnerability"). If that isn't available to you, email **b@bnjmn.org** with "SECURITY" in the subject.

Please include:
- What the issue is and where (file/route/endpoint).
- Steps to reproduce, or a proof of concept.
- The impact you think it has.

We aim to acknowledge within a few days and to fix confirmed issues promptly. We'll credit you in the fix unless you'd prefer to stay anonymous.

## Scope / areas of particular interest

This project scrapes external sites and accepts community submissions, so the highest-value areas are:

- **SSRF / outbound fetch** — all server-side fetches of source URLs must go through `src/lib/safe-fetch.ts` (`safeFetchHtml`). Any path that fetches a URL without it is a bug.
- **Injection** — SQL (we use parameterized Drizzle queries), XSS (scraped/submitted content is rendered as text and escaped in emails/feeds), and HTML in outbound email.
- **Auth** — `/admin` is gated by `requireAdmin`; cron routes by `CRON_SECRET`; moderation/subscription links by HMAC tokens.
- **Secrets** — none are committed; production secrets live only in Vercel env. Contributors must never commit real credentials.

## For contributors

- Never commit secrets. `.env.local` is gitignored and a gitleaks check runs on every PR.
- Run scrapers/fetches through `safeFetchHtml`, never a bare `fetch` of a user/community URL.
- Validate and escape any new user input. See [CONTRIBUTING.md](CONTRIBUTING.md).
