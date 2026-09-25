# Known limitations for the current release candidate

## Curriculum

- The 118 element records have a current chemistry-SME review; the eight named
  groups still need that review.
- The 469 enabled nomenclature records and 116 enabled preparation/production
  equations are owner-approved, not chemistry-SME reviewed. One unbalanced
  source equation is held out. See [curriculum credits](content-credits.md)
  and the review ledgers under `docs/exec-plans/active/`.
- Equation validation proves supported syntax and atom balance, not that each
  reaction is chemically plausible or that its conditions are correct.
- The equation parser intentionally supports a documented subset of chemical
  notation. Unsupported charges, phases, coordination, nested groups, and
  structural formulas are not inferred.

## Accounts and progress

- Rank and correctness use client-reported answers. They are personal learning
  indicators, not independently verified scores.
- Resetting progress starts a new active generation but retains old immutable
  server events for daily upload quota accounting. It does not erase account
  data; self-service account deletion is not available in this version.
- Progress export/import is not implemented. Browser storage loss can remove
  unsynchronized attempts and local custom cards.
- Offline account access uses the last verified browser marker. It cannot
  authenticate a new device or confirm a password/session while disconnected.

## Compatibility and release operations

- Automated browser coverage uses desktop and mobile Chromium. It does not
  replace testing on physical iPad/Safari, assistive technology, or other
  supported browsers. No moderated usability sessions or screen-reader review
  have been completed yet, and no performance budget has been signed off.
- A chemistry content release remains blocked until every shipped curriculum
  record passes `pnpm content:release-check`.
- Public operation also requires a completed privacy notice, DNS/firewall/TLS
  configuration, working SMTP delivery, backup restoration checks, and the
  scheduled purge job. See [deployment runbook](deployment.md) and the
  [privacy notice checklist](privacy-notice-release-checklist.md).
