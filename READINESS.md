
# Readiness report: Campus Club Events

## 1. Live URL and how to verify it

Codespaces development preview: https://secret-sorcery-g44vq6gv4rxjh7gg-3000.app.github.dev
This is not a verified public Render deployment. `course.json` deliberately still has an empty liveUrl.
How I checked: local HTTP requests to the normal `npm start` server on port 3000 returned 200 for `/`, `/health` and `/api/events`. External forwarding and browser refresh still need a browser check.

## 2. Environment variables

| Name | Purpose | Source | Secret |
|---|---|---|---|
| PORT | HTTP listening port, default 3000 | Host or shell | No |
| DATABASE_PATH | Local SQLite file, default campus.sqlite | Host or shell | No |
| NODE_ENV | Runtime mode in Docker | Dockerfile | No |

Provider and PostgreSQL configuration are not implemented yet. Updating `.env.example` is pending approval under AGENTS.md.
How I checked: read `src/server.js`, `src/data/events.js` and `Dockerfile`; did not read real secrets.

## 3. What happens when things fail

An unavailable database produces a generic JSON error with status 500. The browser displays “Could not load events. Please try again.” An empty database produces status 200 with `[]` and a separate empty message. A missing API path returns 404 JSON. Deployment rollback has not been tried.
How I checked: `test/events.test.js` closes a test database before requesting events and health, and asserts status and response. `test/homepage.test.js` exercises network and HTTP failures with doubles; it is not a browser run.

## 4. Four states of one screen

Upcoming events: loading message before fetch resolves, articles after success, a no-upcoming-events message for an empty array, and an error with a Refresh events button after failure.
How I checked: renderer tests with a small DOM double. Real browser screenshots and keyboard checks are pending.

## 5. Request waterfall

Expected from source: HTML loads CSS and deferred JavaScript; JavaScript then requests `/api/events`. Request counts and timing in a browser network tab have not been measured.
How I checked: read `public/index.html` and `public/events.js`; no network-waterfall observation is claimed.

## 6. Security basics checked

Event queries use parameters and the renderer uses textContent. Authentication, sessions, private records and organizer permissions are not implemented; this is not ready for private data. No cookie flags or provider verification have been tested. No full git-history secrets audit has been performed.
How I checked: inspected the data query and renderer. Existing course checks passed their committed-secret pattern check; this is not proof that all secrets are absent.

## 7. Known gaps, ranked by risk

1. High: authentication and authorization are absent. Await approval, then implement and test exact acceptance criteria before handling private records.
2. High: no PostgreSQL persistence or production deployment. Course Lab 4 requires Neon and Render; local SQLite in a free Render container would lose writes on redeploy. The Dockerfile is preparation only and has not been built here.
3. High: Google sign-in, verified linking and model suggestions are absent. Configure provider accounts only through their consoles, never by sharing secrets in chat.
4. Medium: registration/capacity, private registration lists and project MCP tools are absent. Preserve lecture tools when extending the server.
5. Medium: browser layout, keyboard navigation, contrast and screenshots are unverified. Unticked `docs/UI.md` items remain gaps.
6. Medium: no real assigned peer review, red/green review-fix commits, pushed changes or observed CI run from this session.

How I checked: compared source and the retrieved course pages for Exercises 1–5, project requirements and defence.

## 8. Model feature

Not implemented or called. The spec plans to send interests and public upcoming-event information outside the app to Gemini, with a timeout and deterministic date-order fallback. No user data leaves the app for this feature today. Current provider list-price cost has not been verified; do not reuse older usage-log prices as a current quote.
How I checked: there is no model client in application source. Provider-off production behavior cannot yet be demonstrated.

## 9. MCP

The two original lecture tools remain. The three project tools are declared in SPEC.md but not implemented; permission is pending. No project session token or admin key exists. The MCP server is not deployed; it currently uses local stdio for course-agent clients.
How I checked: existing MCP conformance check passed 12/12 in the actual Codespace environment. This does not establish AC-10.
