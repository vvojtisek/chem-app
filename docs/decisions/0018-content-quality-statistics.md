# ADR 0018: Content-quality statistics from attempts, no analytics tool

- Status: Proposed
- Date: 2026-11-14
- Decision owners: Product owner and engineering
- Depends on: ADR 0016
- Affects: `apps/web/app/soukromi/page.tsx`, `docs/privacy-notice-release-checklist.md`,
  `docs/security.md`, `apps/api` (admin endpoint, maintenance purge)

## Context

The product owner wants usage data to guide UX and content work: drop-off, time per question,
hint use, mode preferences and error patterns. Users are VŠCHT students in the EU. The app is
offline-capable, and production has confirmed security properties (hashed session tokens,
SameSite=Strict cookies with Origin and CSRF checks, no account enumeration, least-privilege
database role, read-only containers). The privacy notice states that there are no advertising or
analytics scripts. Attempts are never purged on the server today (`services/maintenance.py`), and
ADR 0009 resets are logical only.

The most valuable use is content quality: questions with unusual error rates or times point to
wrong or ambiguous reviewed data, which AGENTS.md treats as the most severe defect class.

## Decision

1. Phase 0 (no new collection; shipped in #144): a „Nahlásit chybu v otázce“ link in answer feedback
   opens a prefilled GitHub issue with exercise, prompt, question ID and app version. The app
   stores and sends nothing.
2. Phase 1 (after ADR 0016, only once the privacy notice is updated):
   - No third-party or self-hosted analytics tool, no page-view, click, scroll, referrer or
     user-agent tracking, no new cookie, no CSP change.
   - Session start and end are recorded as attempt-store records in the existing IndexedDB
     outbox (`exercise`, `level`, `selectionSize`, `plannedQuestions`; `answered`, `correct`,
     `reason`), synced through the existing CSRF-protected upload.
   - An admin-only endpoint returns aggregates only: per exercise (sessions, finished share,
     median answered, chosen round length) and per question (distinct users, error rate, median
     `responseMs`, hint rate). Groups with fewer than 5 distinct users are omitted on the server.
     Testers and admins are excluded. No endpoint returns per-user rows for this purpose.
   - The admin page `/admin/statistiky` links each question to its record in `/admin/data`.
3. Privacy: the privacy notice adds the purpose (improving learning content), legal basis
   (legitimate interest, Art. 6(1)(f), with a compatibility assessment under Art. 6(4) for using
   existing attempts), the aggregation threshold and a retention period. Attempts older than 24
   months after the account's last activity are deleted by the daily maintenance job.
4. No `navigator.sendBeacon` or separate ingest route: beacons cannot carry the CSRF header.

## Consequences

- No new data flow leaves the existing attempt pipeline; ePrivacy consent is not needed because
  every stored field also serves the learner's own Pokrok.
- The audience is small, so per-question statistics will be sparse for months; the 5-user
  threshold will hide much of the data at first.
- Retention requires a new purge step and a migration-free delete; whether the daily purge job
  runs on the host is unverified and must be checked before relying on it.
- The admin endpoint is new attack surface; it uses the existing admin authorization and returns
  only aggregates.

## Alternatives considered

- Self-hosted Plausible, Umami or Matomo: measures page views rather than learning, needs another
  container and database on a t4g.small, a CSP change, consent handling for cookies, and loses
  events offline.
- No telemetry: leaves content errors to be found only by learners who complain.
